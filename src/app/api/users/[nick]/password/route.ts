import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken, hashPassword, verifyPassword } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

/** POST /api/users/[nick]/password — смена пароля.
 *  Требует токен. Только владелец может сменить свой пароль.
 *  Body: { token, oldPassword, newPassword }
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ nick: string }> }) {
  try {
    const { nick } = await ctx.params;
    const nickname = decodeURIComponent(nick);
    const body = await req.json();
    const token = String(body.token ?? "");
    const safeUser = token ? await userByToken(token) : null;
    if (!safeUser || safeUser.nickname !== nickname) {
      return NextResponse.json({ error: "Можно сменить пароль только своего аккаунта", needAuth: true }, { status: 401 });
    }

    const oldPassword = String(body.oldPassword ?? "");
    const newPassword = String(body.newPassword ?? "");

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Новый пароль: минимум 6 символов" }, { status: 400 });
    }

    // Получаем полный user (с passwordHash) — SafeUser не включает passwordHash.
    const fullUser = await db.user.findUnique({ where: { id: safeUser.id } });
    if (!fullUser) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    if (!verifyPassword(oldPassword, fullUser.passwordHash)) {
      return NextResponse.json({ error: "Старый пароль неверен" }, { status: 400 });
    }

    const newHash = hashPassword(newPassword);
    await db.user.update({
      where: { id: safeUser.id },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ ok: true, note: "Пароль изменён" });
  } catch (e) {
    return handleApiError(e);
  }
}
