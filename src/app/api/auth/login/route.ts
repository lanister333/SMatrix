import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, toSafeUser, createSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email?.trim() || !password) {
      return NextResponse.json({ error: "Введите email и пароль" }, { status: 400 });
    }
    const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
    }
    if (!user.emailVerified) {
      return NextResponse.json(
        { needVerify: true, error: "Email не подтверждён. Проверьте почту — там ссылка подтверждения." },
        { status: 403 }
      );
    }
    const token = await createSession(user.id);
    return NextResponse.json({ user: { ...toSafeUser(user), token } });
  } catch (e) {
    return handleApiError(e);
  }
}
