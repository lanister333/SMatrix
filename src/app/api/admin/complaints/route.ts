import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isStaffRole, logAdminAction } from "@/lib/admin";

export const runtime = "nodejs";

/**
 * ШАГ 12. Жалобы: отдельный список для админ-панели.
 * Показывает нерешённые и решённые жалобы с причиной, комментарием,
 * вердиктом ИИ и контекстом сообщения. Количество жалоб НИКОГДА
 * не блокирует аккаунт автоматически — каждая разбирается индивидуально.
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
    const show = req.nextUrl.searchParams.get("show") || "open"; // open | all

    const complaints = await db.complaint.findMany({
      where: show === "open" ? { resolved: false } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        message: {
          include: {
            topic: { select: { id: true, title: true } },
          },
        },
      },
    });

    return NextResponse.json({
      openCount: await db.complaint.count({ where: { resolved: false } }),
      complaints: complaints.map((c) => ({
        id: c.id,
        category: c.category,
        comment: c.comment,
        reporter: c.reporterName,
        aiVerdict: c.aiVerdict,
        aiNote: c.aiNote,
        resolved: c.resolved,
        createdAt: c.createdAt,
        message: {
          id: c.message.id,
          num: c.message.num,
          author: c.message.authorName,
          body: c.message.body.slice(0, 400),
          isHiddenByAi: c.message.isHiddenByAi,
          isDeleted: c.message.isDeleted,
          hiddenReason: c.message.hiddenReason,
          topic: { id: c.message.topic.id, title: c.message.topic.title },
        },
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** Отметить жалобу рассмотренной (без изменения сообщения). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const staff = await userByToken(body.token);
    if (!staff) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    if (!isStaffRole(staff.role)) {
      return NextResponse.json({ error: "Доступно только администратору" }, { status: 403 });
    }
    const complaint = await db.complaint.findUnique({ where: { id: String(body.id ?? "") }, include: { message: { select: { num: true, authorName: true } } } });
    if (!complaint) {
      return NextResponse.json({ error: "Жалоба не найдена" }, { status: 404 });
    }
    await db.complaint.update({ where: { id: complaint.id }, data: { resolved: true } });
    await logAdminAction({
      actor: staff.nickname,
      actorRole: staff.role,
      action: "complaint.resolve",
      targetType: "complaint",
      targetLabel: `жалоба на сообщение №${complaint.message.num} («${complaint.message.authorName}»), причина: ${complaint.category}`,
    });
    return NextResponse.json({ ok: true, note: "Жалоба отмечена рассмотренной" });
  } catch (e) {
    return handleApiError(e);
  }
}
