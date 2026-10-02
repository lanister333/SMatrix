import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, toSafeUser, createSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import {
  checkLoginAllowed,
  recordLoginAttempt,
  getClientIp,
} from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email?.trim() || !password) {
      return NextResponse.json({ error: "Введите email и пароль" }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const ip = getClientIp(req);

    // ПРОМТ №1: rate-limit + lockout.
    const gate = await checkLoginAllowed(normalizedEmail, ip);
    if (!gate.allowed) {
      // ВАЖНО: при throttle/lockout всё равно пишем неудачную попытку —
      // чтобы продлить lockout при продолжении атаки.
      await recordLoginAttempt({
        email: normalizedEmail,
        req,
        success: false,
        reason: gate.internalReason,
      });
      if (gate.delaySec > 0 && gate.delaySec < 60) {
        return NextResponse.json(
          { error: gate.userMessage ?? "Слишком много попыток входа" },
          {
            status: 429,
            headers: { "Retry-After": String(gate.delaySec) },
          }
        );
      }
      return NextResponse.json(
        { error: gate.userMessage ?? "Слишком много попыток входа" },
        { status: 429 }
      );
    }

    const user = await db.user.findUnique({ where: { email: normalizedEmail } });
    // Защита от тайминг-атак: всегда проверяем пароль, даже если юзера нет.
    const passwordOk = user ? verifyPassword(password, user.passwordHash) : verifyPassword(password, "00:00");
    if (!user || !passwordOk) {
      await recordLoginAttempt({
        email: normalizedEmail,
        userId: user?.id,
        req,
        success: false,
        reason: !user ? "not_found" : "bad_password",
      });
      return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
    }

    // ПРОМТ №1: проверка, что аккаунт не забанен.
    if (user.status === "banned" || (user.restrictedUntil && user.restrictedUntil.getTime() > Date.now() + 355 * 24 * 60 * 60 * 1000)) {
      await recordLoginAttempt({
        email: normalizedEmail,
        userId: user.id,
        req,
        success: false,
        reason: "banned",
      });
      return NextResponse.json(
        { error: "Аккаунт заблокирован. Если считаете это ошибкой — подайте апелляцию." },
        { status: 403 }
      );
    }

    if (!user.emailVerified) {
      await recordLoginAttempt({
        email: normalizedEmail,
        userId: user.id,
        req,
        success: false,
        reason: "email_not_verified",
      });
      return NextResponse.json(
        { needVerify: true, error: "Email не подтверждён. Проверьте почту — там ссылка подтверждения." },
        { status: 403 }
      );
    }

    // Успешный вход.
    await recordLoginAttempt({
      email: normalizedEmail,
      userId: user.id,
      req,
      success: true,
      reason: "ok",
    });

    const token = await createSession(user.id);
    return NextResponse.json({ user: { ...toSafeUser(user), token } });
  } catch (e) {
    return handleApiError(e);
  }
}
