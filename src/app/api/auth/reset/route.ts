import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeAuthToken, hashPassword, createSession, toSafeUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const { token, password, password2 } = await req.json();
    if (!password || password.length < 8 || !/[а-яёa-z]/i.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: "Пароль — от 8 символов, буквы и цифры" },
        { status: 400 }
      );
    }
    if (password !== password2) {
      return NextResponse.json({ error: "Пароли не совпадают" }, { status: 400 });
    }
    const payload = await consumeAuthToken(String(token ?? ""), "reset");
    if (!payload) {
      return NextResponse.json(
        { error: "Ссылка недействительна или устарела. Запросите восстановление снова." },
        { status: 400 }
      );
    }
    await db.user.update({
      where: { id: payload.userId },
      data: { passwordHash: hashPassword(password), emailVerified: true },
    });
    const user = await db.user.findUnique({ where: { id: payload.userId } });
    const sessionToken = await createSession(payload.userId);
    return NextResponse.json({ user: { ...toSafeUser(user!), token: sessionToken } });
  } catch (e) {
    return handleApiError(e);
  }
}
