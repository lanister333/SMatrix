import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { logAdminAction } from "@/lib/admin";

/**
 * ПРОМТ №1 (защита платформы): «Дать возможность завершить все активные сессии.»
 *
 * POST /api/auth/logout-all?token=...
 *   - Завершает ВСЕ сессии пользователя, КРОМЕ текущей.
 *   - Альтернативно, при ?all=1 завершает и текущую (полный выход со всех устройств).
 *
 * Возвращает количество завершённых сессий (без точного списка — безопасность).
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    const allFlag = req.nextUrl.searchParams.get("all");
    const safeUser = token ? await userByToken(token) : null;
    if (!safeUser) {
      return NextResponse.json({ error: "Требуется вход", needAuth: true }, { status: 401 });
    }

    let deleted = 0;
    if (allFlag === "1") {
      // Полный выход — удаляем все сессии включая текущую.
      const result = await db.session.deleteMany({ where: { userId: safeUser.id } });
      deleted = result.count;
    } else {
      // Завершаем все, КРОМЕ текущей. token уже проверен не-null выше.
      const result = await db.session.deleteMany({
        where: { userId: safeUser.id, NOT: { token: token ?? "" } },
      });
      deleted = result.count;
    }

    // Журналируем — аудит выхода из сессий.
    await logAdminAction({
      actor: safeUser.nickname,
      actorRole: "user",
      action: "session.logout_all",
      targetType: "user",
      targetLabel: `Завершение ${deleted} сессий аккаунтом ${safeUser.nickname}`,
      details: allFlag === "1" ? "Полный выход со всех устройств" : "Завершение других активных сессий",
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      endedSessions: deleted,
      note: deleted > 0 ? `Завершено сессий: ${deleted}` : "Не было других активных сессий",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
