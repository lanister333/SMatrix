import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isStaffRole } from "@/lib/admin";

export const runtime = "nodejs";

/**
 * ШАГ 12. Журнал действий модерации — хранится внутренне.
 * Доступен только сотрудникам (владелец и модераторы).
 * Поддерживает фильтр по типу действия и поиск по нику исполнителя.
 */
export async function GET(req: NextRequest) {
  try {
    const staff = await userByToken(req.nextUrl.searchParams.get("token"));
    if (!staff) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    if (!isStaffRole(staff.role)) {
      return NextResponse.json({ error: "Доступно только администратору" }, { status: 403 });
    }

    const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    const type = req.nextUrl.searchParams.get("type") || "all";

    const rows = await db.adminLog.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
    let list = rows;
    if (type === "moderation") list = list.filter((l) => l.action.startsWith("message.") || l.action.startsWith("complaint.") || l.action.startsWith("appeal."));
    if (type === "sanctions") list = list.filter((l) => l.action.startsWith("sanction."));
    if (type === "topics") list = list.filter((l) => l.action.startsWith("topic."));
    if (type === "users") list = list.filter((l) => l.targetType === "user");
    if (type === "admin") list = list.filter((l) => l.action.startsWith("settings.") || l.action.startsWith("section."));
    if (q) {
      list = list.filter(
        (l) =>
          l.actor.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.targetLabel.toLowerCase().includes(q) ||
          l.details.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      total: rows.length,
      entries: list.slice(0, 200).map((l) => ({
        id: l.id,
        actor: l.actor,
        actorRole: l.actorRole,
        action: l.action,
        targetType: l.targetType,
        targetLabel: l.targetLabel,
        details: l.details,
        createdAt: l.createdAt,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
