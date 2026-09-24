/**
 * ШАГ 26. Модерация раздела «Знакомства»
 * (только сотрудники: owner/admin/moderator — общая система модерации сайта,
 * ИИ → человек-модератор для спорных случаев).
 * GET  — нерешённые жалобы на объявления + скрытые ИИ / спорные объявления.
 *        ВАЖНО (ТЗ): модерация ВИДИТ АВТОРА анонимного объявления.
 * POST — действия человека-модератора:
 *  — resolve-complaint  — жалоба рассмотрена (закрыть);
 *  — hide-post          — скрыть объявление (нарушение правил раздела);
 *  — restore-post       — вернуть объявление в ленту (решение ИИ отменено человеком);
 *  — delete-post        — удалить объявление.
 * Все действия пишутся в журнал действий (AdminLog).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";
import { requireStaff, logAdminAction } from "@/lib/admin";
import { datingCategoryLabel } from "@/lib/znakomstva";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const staff = await requireStaff(sp.get("token"));

    const show = sp.get("show") === "all" ? "all" : "open";
    const unresolved = show === "open";

    const complaints = await db.datingComplaint.findMany({
      where: unresolved ? { resolved: false } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        post: { select: { id: true, title: true, isHiddenByAi: true, authorName: true } },
      },
    });

    const queue = await db.datingPost.findMany({
      where: { isDeleted: false, OR: [{ isHiddenByAi: true }, { needHuman: true }] },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const openComplaints = await db.datingComplaint.count({ where: { resolved: false } });

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
        category: r.category,
        title: r.title,
        body: r.body,
        // ТЗ: «ИИ-модератор и администратор видят автора» — анонимность
        // действует только для публичных посетителей.
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
      const complaint = await db.datingComplaint.findUnique({ where: { id }, include: { post: true } });
      if (!complaint) return NextResponse.json({ error: "Жалоба не найдена" }, { status: 404 });
      await db.datingComplaint.update({ where: { id }, data: { resolved: true } });
      await logAdminAction({
        actor: staff.nickname,
        actorRole: staff.role,
        action: "dating.complaint.resolve",
        targetType: "dating_complaint",
        targetLabel: `жалоба на «${complaint.post.title}»`,
      });
      return NextResponse.json({ ok: true, note: "Жалоба отмечена решённой" });
    }

    if (action === "hide-post") {
      const post = await db.datingPost.findUnique({ where: { id } });
      if (!post) return NextResponse.json({ error: "Объявление не найдено" }, { status: 404 });
      await db.datingPost.update({
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
        action: "dating.post.hide",
        targetType: "dating_post",
        targetLabel: `«${post.title}» (${datingCategoryLabel(post.category)})`,
      });
      return NextResponse.json({ ok: true, note: "Объявление скрыто" });
    }

    if (action === "restore-post") {
      const post = await db.datingPost.findUnique({ where: { id } });
      if (!post) return NextResponse.json({ error: "Объявление не найдено" }, { status: 404 });
      await db.datingPost.update({
        where: { id },
        data: { isHiddenByAi: false, hiddenReason: "", aiStatus: "ok", needHuman: false },
      });
      await logAdminAction({
        actor: staff.nickname,
        actorRole: staff.role,
        action: "dating.post.restore",
        targetType: "dating_post",
        targetLabel: `«${post.title}» (${datingCategoryLabel(post.category)})`,
      });
      return NextResponse.json({ ok: true, note: "Объявление возвращено в ленту" });
    }

    if (action === "delete-post") {
      const post = await db.datingPost.findUnique({ where: { id } });
      if (!post) return NextResponse.json({ error: "Объявление не найдено" }, { status: 404 });
      await db.datingPost.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date(), needHuman: false },
      });
      await db.datingComplaint.updateMany({ where: { postId: id, resolved: false }, data: { resolved: true } });
      await logAdminAction({
        actor: staff.nickname,
        actorRole: staff.role,
        action: "dating.post.delete",
        targetType: "dating_post",
        targetLabel: `«${post.title}» (${datingCategoryLabel(post.category)})`,
      });
      return NextResponse.json({ ok: true, note: "Объявление удалено" });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (e) {
    return handleApiError(e);
  }
}
