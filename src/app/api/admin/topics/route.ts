import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isStaffRole } from "@/lib/admin";

export const runtime = "nodejs";

/**
 * ШАГ 12. Темы форума для админ-панели: поиск по заголовку/автору,
 * фильтры статуса, служебные пометки. Удалённые темы показываются
 * с пометкой, чтобы их можно было найти и восстановить.
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
    const filter = req.nextUrl.searchParams.get("filter") || "all"; // all | open | closed | pinned | deleted

    const topics = await db.topic.findMany({
      orderBy: { lastActivityAt: "desc" },
      take: 300,
      include: {
        rubric: { include: { parent: { select: { name: true } } } },
        _count: { select: { messages: true } },
      },
    });

    const now = new Date();
    let list = topics.map((t) => ({
      id: t.id,
      number: t.number,
      title: t.title,
      author: t.authorName,
      rubricId: t.rubricId,
      rubricName: t.rubric ? (t.rubric.parent ? `${t.rubric.parent.name} → ${t.rubric.name}` : t.rubric.name) : "",
      answers: Math.max(0, t._count.messages - 1),
      views: t.views,
      isPinned: t.isPinned,
      isClosed: t.isClosed,
      isDeleted: !!t.deletedAt,
      createdAt: t.createdAt,
      lastActivityAt: t.lastActivityAt,
    }));

    if (q) list = list.filter((t) => t.title.toLowerCase().includes(q) || t.author.toLowerCase().includes(q));
    if (filter === "open") list = list.filter((t) => !t.isClosed && !t.isDeleted);
    if (filter === "closed") list = list.filter((t) => t.isClosed && !t.isDeleted);
    if (filter === "pinned") list = list.filter((t) => t.isPinned && !t.isDeleted);
    if (filter === "deleted") list = list.filter((t) => t.isDeleted);

    return NextResponse.json({ total: list.length, topics: list.slice(0, 120) });
  } catch (e) {
    return handleApiError(e);
  }
}
