/**
 * ШАГ 17 (ТЗ п.16). Модерация раздела «Подслушано Сахалин»
 * (только сотрудники: owner/admin/moderator — общая система модерации сайта).
 * GET  — нерешённые жалобы на сообщения + скрытые ИИ / спорные сообщения.
 * POST — действия человека-модератора:
 *  — resolve-complaint  — жалоба рассмотрена (закрыть);
 *  — hide-post          — скрыть сообщение (нарушение правил раздела);
 *  — restore-post       — вернуть сообщение в ленту (решение ИИ отменено человеком);
 *  — delete-post        — удалить сообщение (нарушающие правила удаляются модерацией).
 * Слух и неподтверждённая информация сами по себе — НЕ нарушение (ТЗ п.15):
 * модератор оценивает содержание и реальные нарушения.
 * Все действия пишутся в журнал действий (AdminLog).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";
import { requireStaff, logAdminAction } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const staff = await requireStaff(sp.get("token"));

    const show = sp.get("show") === "all" ? "all" : "open";
    const unresolved = show === "open";

    const complaints = await db.overheardComplaint.findMany({
      where: unresolved ? { resolved: false } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        post: { select: { id: true, title: true, isHiddenByAi: true, authorName: true } },
      },
    });

    const queue = await db.overheardPost.findMany({
      where: { isDeleted: false, OR: [{ isHiddenByAi: true }, { needHuman: true }] },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const openComplaints = await db.overheardComplaint.count({ where: { resolved: false } });

    return NextResponse.json({
      complaints: complaints.map((c) => ({
        id: c.id,
        category: c.category,
        comment: c.comment,
        reporterName: c.reporterName,
        aiVerdict: c.aiVerdict,
        aiNote: c.aiNote,
        resolved: c.resolved,
        createdAt: c.createdAt,
        post: c.post,
      })),
      queue: queue.map((r) => ({
        id: r.id,
        title: r.title,
        text: r.text,
        place: r.place,
        authorName: r.authorName,
        isHiddenByAi: r.isHiddenByAi,
        hiddenReason: r.hiddenReason,
        needHuman: r.needHuman,
        aiNote: r.aiNote,
        createdAt: r.createdAt,
      })),
      openCount: openComplaints,
      staff: staff.nickname,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, action, id } = body;
    const staff = await requireStaff(token);

    if (!id) {
      return NextResponse.json({ error: "Не указан объект действия" }, { status: 400 });
    }

    if (action === "resolve-complaint") {
      const complaint = await db.overheardComplaint.findUnique({ where: { id }, include: { post: true } });
      if (!complaint) return NextResponse.json({ error: "Жалоба не найдена" }, { status: 404 });
      await db.overheardComplaint.update({ where: { id }, data: { resolved: true } });
      await logAdminAction({
        actor: staff.nickname,
        actorRole: staff.role,
        action: "overheard.complaint.resolve",
        targetType: "overheard_complaint",
        targetLabel: `жалоба на «${complaint.post.title}»`,
      });
      return NextResponse.json({ ok: true, note: "Жалоба отмечена решённой" });
    }

    if (action === "hide-post") {
      const post = await db.overheardPost.findUnique({ where: { id } });
      if (!post) return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
      await db.overheardPost.update({
        where: { id },
        data: {
          isHiddenByAi: true,
          hiddenReason: post.hiddenReason || "скрыто модератором — нарушение правил раздела",
          aiStatus: "hidden",
          needHuman: false,
        },
      });
      await logAdminAction({
        actor: staff.nickname,
        actorRole: staff.role,
        action: "overheard.post.hide",
        targetType: "overheard_post",
        targetLabel: `«${post.title}»`,
      });
      return NextResponse.json({ ok: true, note: "Сообщение скрыто" });
    }

    if (action === "restore-post") {
      const post = await db.overheardPost.findUnique({ where: { id } });
      if (!post) return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
      await db.overheardPost.update({
        where: { id },
        data: { isHiddenByAi: false, hiddenReason: "", needHuman: false, aiStatus: "ok", aiNote: "возвращено человеком-модератором" },
      });
      await logAdminAction({
        actor: staff.nickname,
        actorRole: staff.role,
        action: "overheard.post.restore",
        targetType: "overheard_post",
        targetLabel: `«${post.title}»`,
      });
      return NextResponse.json({ ok: true, note: "Сообщение возвращено в ленту" });
    }

    if (action === "delete-post") {
      const post = await db.overheardPost.findUnique({ where: { id } });
      if (!post) return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
      await db.overheardPost.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() },
      });
      await db.overheardComplaint.updateMany({ where: { postId: id, resolved: false }, data: { resolved: true } });
      await logAdminAction({
        actor: staff.nickname,
        actorRole: staff.role,
        action: "overheard.post.delete",
        targetType: "overheard_post",
        targetLabel: `«${post.title}»`,
      });
      return NextResponse.json({ ok: true, note: "Сообщение удалено" });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (e) {
    return handleApiError(e);
  }
}
