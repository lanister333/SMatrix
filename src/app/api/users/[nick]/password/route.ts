import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken, hashPassword, verifyPassword, newToken, createSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isWeakPassword } from "@/lib/security";
import { logAdminAction } from "@/lib/admin";

export const runtime = "nodejs";

/**
 * POST /api/users/[nick]/password — смена пароля.
 *
 * ПРОМТ №1 (защита платформы):
 *   - Проверка нового пароля по blacklist + паттернам.
 *   - Минимум 8 символов (было 6 — приведено к единому стандарту).
 *   - Завершение ВСЕХ других активных сессий (кроме текущей) —
 *     защита от того, кто успел украсть старый пароль.
 *   - Журналирование через AdminLog (target: user, action: password.change).
 *   - Возвращаем новую сессию для текущего устройства.
 *
 * Body: { token, oldPassword, newPassword }
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

    // ПРОМТ №1: единый стандарт — минимум 8 символов + blacklist.
    const pwdCheck = isWeakPassword(newPassword);
    if (!pwdCheck.ok) {
      return NextResponse.json(
        { error: pwdCheck.reason ?? "Новый пароль слишком слабый" },
        { status: 400 }
      );
    }

    // Запрет: новый == старый.
    if (oldPassword === newPassword) {
      return NextResponse.json(
        { error: "Новый пароль не должен совпадать со старым" },
        { status: 400 }
      );
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

    // Транзакция: обновляем пароль И удаляем все сессии КРОМЕ текущей.
    // Текущую сессию пересоздаём (старый токен инвалидируется).
    await db.$transaction([
      db.user.update({
        where: { id: safeUser.id },
        data: { passwordHash: newHash },
      }),
      // Все сессии пользователя — удалить.
      db.session.deleteMany({ where: { userId: safeUser.id } }),
    ]);

    // Создаём новую сессию для текущего устройства.
    const newTok = await createSession(safeUser.id);

    // ПРОМТ №1: «Уведомлять о смене пароля».
    // Реального email-шлюза нет — пишем запись в AdminLog,
    // которая видна в админ-панели и будет показана при следующем входе.
    await logAdminAction({
      actor: safeUser.nickname,
      actorRole: "user",
      action: "password.change",
      targetType: "user",
      targetLabel: `Смена пароля аккаунтом ${safeUser.nickname}`,
      details: "Самостоятельная смена пароля пользователем. Все активные сессии, кроме текущей, завершены.",
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      note: "Пароль изменён. Все остальные активные сессии завершены.",
      token: newTok,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
