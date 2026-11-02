import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isStaffRole } from "@/lib/admin";

export const runtime = "nodejs";

/**
 * Журнал модерации (ШАГ 12: владелец и модераторы).
 * Показывает: сообщения с нерешёнными жалобами, спорные случаи
 * (needHuman — передача от ИИ человеку), скрытые ИИ и удалённые сообщения.
 * Количество жалоб НИКОГДА не используется для авто-блокировки —
 * каждая жалоба разбирается индивидуально.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const user = await userByToken(sp.get("token"));
    if (!user) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    if (!isStaffRole(user.role)) {
      return NextResponse.json({ error: "Доступно только администратору" }, { status: 403 });
    }
    const q = (sp.get("q") || "").trim();
    const limit = Math.min(200, Math.max(1, parseInt(sp.get("limit") || "60", 10) || 60));
    // 2026-10-21: опциональный фильтр — если задан, показываем только этот тип
    // (нужно для блоков админки: «Спорных случаев», «Скрыто авто», и т.д.)
    const filter = (sp.get("filter") || "").trim().toLowerCase();

    const where: Record<string, unknown> = {};
    if (filter === "needhuman") {
      where.needHuman = true;
    } else if (filter === "hiddenbyai") {
      where.isHiddenByAi = true;
    } else if (filter === "deleted") {
      where.isDeleted = true;
    } else if (filter === "complaints") {
      where.complaints = { some: { resolved: false } };
    } else {
      // По умолчанию — все спорные/скрытые/удалённые/с жалобами (как было)
      where.OR = [
        { needHuman: true },
        { isHiddenByAi: true },
        { isDeleted: true },
        { complaints: { some: { resolved: false } } },
      ];
    }
    if (q) {
      where.AND = [
        where.OR ? { OR: where.OR } : (filter === "needhuman" ? { needHuman: true } : filter === "hiddenbyai" ? { isHiddenByAi: true } : filter === "deleted" ? { isDeleted: true } : filter === "complaints" ? { complaints: { some: { resolved: false } } } : {}),
        {
          OR: [
            { body: { contains: q } },
            { authorName: { contains: q } },
            { topic: { title: { contains: q } } },
          ],
        },
      ];
      // Чистим — оставляем только AND
      if (where.OR) delete where.OR;
      if (where.needHuman !== undefined && filter !== "needhuman") delete where.needHuman;
      if (where.isHiddenByAi !== undefined && filter !== "hiddenbyai") delete where.isHiddenByAi;
      if (where.isDeleted !== undefined && filter !== "deleted") delete where.isDeleted;
      if (where.complaints !== undefined && filter !== "complaints") delete where.complaints;
    }

    const messages = await db.message.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: limit,
      include: {
        topic: { select: { id: true, title: true } },
        complaints: { where: { resolved: false }, orderBy: { createdAt: "desc" } },
      },
    });

    // Сортировка: спорные случаи (нужен человек) → с жалобами → остальные
    messages.sort((a, b) => {
      const ah = a.needHuman ? 2 : 0;
      const bh = b.needHuman ? 2 : 0;
      if (ah !== bh) return bh - ah;
      const ac = a.complaints.length > 0 ? 1 : 0;
      const bc = b.complaints.length > 0 ? 1 : 0;
      if (ac !== bc) return bc - ac;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return NextResponse.json({
      entries: messages.slice(0, limit).map((m) => ({
        id: m.id,
        author: m.authorName,
        topic: { id: m.topic.id, title: m.topic.title },
        body: m.body,
        isHiddenByAi: m.isHiddenByAi,
        hiddenReason: m.hiddenReason,
        isDeleted: m.isDeleted,
        needHuman: m.needHuman,
        aiNote: m.aiNote,
        complaintsCount: m.complaints.length,
        complaints: m.complaints.map((c) => ({
          id: c.id,
          category: c.category,
          comment: c.comment,
          aiVerdict: c.aiVerdict,
          aiNote: c.aiNote,
          createdAt: c.createdAt,
        })),
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
