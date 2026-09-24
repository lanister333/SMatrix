import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createAuthToken, checkCaptcha } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

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
    const body = await req.json();
    const nickname = String(body.nickname ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const password2 = String(body.password2 ?? "");
    // ТЗ 2026-09-21: при регистрации строго два пола (male/female); прочие значения не принимаются.
    const gender = body.gender === "female" ? "female" : "male";
    const question = String(body.question ?? "").trim().slice(0, 200);
    const answer = String(body.answer ?? "").trim();

    if (nickname.length < 3 || nickname.length > 20) {
      return NextResponse.json({ error: "Ник должен быть от 3 до 20 символов" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Введите корректный email" }, { status: 400 });
    }
    if (password.length < 8 || !/[а-яёa-z]/i.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: "Пароль — от 8 символов, буквы и цифры" },
        { status: 400 }
      );
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

    const user = await db.user.create({
      data: {
        nickname,
        email,
        passwordHash: hashPassword(password),
        gender,
        secretQuestion: question,
        secretAnswer: answer.toLowerCase(),
        emailVerified: false,
      },
    });
    const token = await createAuthToken(user.id, "verify");
    // Демо-режим: почтовый шлюз не подключён — отдаём ссылку подтверждения напрямую.
    return NextResponse.json({
      ok: true,
      verifyPath: `/api/auth/verify?token=${encodeURIComponent(token)}`,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
