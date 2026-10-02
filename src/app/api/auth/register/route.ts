import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createAuthToken, checkCaptcha } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import {
  isWeakPassword,
  getClientIp,
  getClientAgent,
  getDeviceFingerprint,
} from "@/lib/security";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  try {
    // ШАГ 12: регистрация может быть приостановлена в настройках сайта.
    const regEnabled = await db.siteSetting.findUnique({ where: { key: "registrationEnabled" } });
    if (regEnabled && regEnabled.value === "0") {
      return NextResponse.json(
        { error: "Регистрация временно приостановлена администратором" },
        { status: 403 }
      );
    }

    // ПРОМТ №1: простой in-memory rate-limit на регистрацию с одного IP.
    // Не раскрываем точные пороги пользователю.
    const ip = getClientIp(req);
    if (!rateLimit(`register:${ip}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Слишком много регистраций с вашего адреса. Попробуйте позже." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const nickname = String(body.nickname ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const password2 = String(body.password2 ?? "");
    // ТЗ 2026-09-21: при регистрации строго два пола (male/female); прочие значения не принимаются.
    const gender = body.gender === "female" ? "female" : "male";
    const question = String(body.question ?? "").trim().slice(0, 200);
    const answer = String(body.answer ?? "").trim();
    const phone = String(body.phone ?? "").trim().slice(0, 30);

    if (nickname.length < 3 || nickname.length > 20) {
      return NextResponse.json({ error: "Ник должен быть от 3 до 20 символов" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Введите корректный email" }, { status: 400 });
    }
    // ПРОМТ №1: проверка слабого пароля (база + паттерны).
    const pwdCheck = isWeakPassword(password);
    if (!pwdCheck.ok) {
      return NextResponse.json({ error: pwdCheck.reason ?? "Слабый пароль" }, { status: 400 });
    }
    if (password !== password2) {
      return NextResponse.json({ error: "Пароли не совпадают" }, { status: 400 });
    }
    if (!question || !answer) {
      return NextResponse.json({ error: "Задайте контрольный вопрос и ответ" }, { status: 400 });
    }
    const captchaOk = await checkCaptcha(String(body.captchaId ?? ""), String(body.captchaAnswer ?? ""));
    if (!captchaOk) {
      return NextResponse.json({ error: "CAPTCHA решена неверно — обновите вопрос" }, { status: 400 });
    }

    const nickExists = await db.user.findUnique({ where: { nickname: nickname } });
    if (nickExists) {
      return NextResponse.json({ error: "Такой ник уже занят" }, { status: 400 });
    }
    const emailExists = await db.user.findUnique({ where: { email } });
    if (emailExists) {
      return NextResponse.json({ error: "Этот email уже зарегистрирован" }, { status: 400 });
    }

    // ПРОМТ №1: один основной аккаунт — на один номер телефона.
    // Проверяем только если телефон указан (т.к. поле опционально).
    // Не делаем unique constraint в БД (старые записи имеют ""), но проверяем в приложении.
    let phoneConflict = false;
    if (phone) {
      const phoneOwner = await db.user.findFirst({
        where: { phone, phoneVerified: true },
        select: { id: true },
      });
      if (phoneOwner) phoneConflict = true;
    }

    // ПРОМТ №1: если устройство/IP уже использовалось для регистрации, помечаем
    // новый аккаунт как suspicious (требует ручной проверки, но не блокируем).
    const fingerprint = getDeviceFingerprint(req);
    const ua = getClientAgent(req);
    const deviceUsedByOthers = await db.userDevice.findFirst({
      where: { fingerprint },
      select: { userId: true },
    });
    const initialStatus = deviceUsedByOthers ? "suspicious" : "active";

    const user = await db.user.create({
      data: {
        nickname,
        email,
        passwordHash: hashPassword(password),
        gender,
        secretQuestion: question,
        secretAnswer: answer.toLowerCase(),
        emailVerified: false,
        status: initialStatus,
        phone: phone,
        phoneVerified: false,
      },
    });

    // Записываем устройство и IP нового пользователя.
    try {
      await Promise.all([
        db.userDevice.create({
          data: { userId: user.id, fingerprint, userAgent: ua, ip },
        }),
        db.userIp.create({ data: { userId: user.id, ip } }),
      ]);
      // Если устройство использовалось другим аккаунтом — создаём связь.
      if (deviceUsedByOthers) {
        const [a, b] = [user.id, deviceUsedByOthers.userId].sort();
        await db.accountLink.upsert({
          where: { userA_userB_reason: { userA: a, userB: b, reason: "same_device" } },
          update: { weight: { increment: 1.0 }, evidence: fingerprint },
          create: { userA: a, userB: b, reason: "same_device", evidence: fingerprint, weight: 1.0 },
        });
      }
    } catch (e) {
      console.error("[register] device/ip tracking error:", e);
    }

    const token = await createAuthToken(user.id, "verify");
    // Демо-режим: почтовый шлюз не подключён — отдаём ссылку подтверждения напрямую.
    return NextResponse.json({
      ok: true,
      verifyPath: `/api/auth/verify?token=${encodeURIComponent(token)}`,
      // Подсказка пользователю — не раскрываем детали безопасности.
      notice:
        initialStatus === "suspicious"
          ? "Аккаунт помечен для проверки. Некоторые функции будут ограничены до проверки администратором."
          : phoneConflict
          ? "Этот телефон уже используется. Если это ваш — восстановите доступ к другому аккаунту."
          : undefined,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
