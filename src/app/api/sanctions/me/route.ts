import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { getActiveRestriction, getRecentWarning, SANCTION_LABELS } from "@/lib/moderation/sanctions";

export const runtime = "nodejs";

/**
 * ШАГ 11. Текущие санкции пользователя: активное ограничение и последнее
 * предупреждение. Используется для баннеров «Оспорить решение».
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json({ restriction: null, warning: null });
    }

    const [restriction, warning, openAppeals] = await Promise.all([
      getActiveRestriction(user.id),
      getRecentWarning(user.id),
      db.decisionAppeal.findMany({
        where: { userId: user.id, status: "open" },
        select: { sanctionId: true, messageId: true },
      }),
    ]);

    return NextResponse.json({
      restriction,
      warning,
      openAppeals: openAppeals.map((a) => ({ sanctionId: a.sanctionId, messageId: a.messageId })),
      labels: SANCTION_LABELS,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
