/**
 * ШАГ 16 (ТЗ п.8). Модерация раздела «Нужна помощь» (только сотрудники: owner/admin/moderator).
 * GET  — нерешённые жалобы на публикации + скрытые ИИ / спорные публикации.
 * POST — действия человека-модератора:
 *  — resolve-complaint     — жалоба рассмотрена (закрыть);
 *  — hide-publication      — скрыть публикацию (нарушение правил раздела);
 *  — restore-publication   — вернуть публикацию в ленту (решение ИИ отменено человеком);
 *  — delete-publication    — удалить публикацию (нарушающие правила удаляются модерацией).
 * Жалобы не являются автоматическим доказательством нарушения — решает модератор.
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

    const complaints = await db.helpComplaint.findMany({
      where: unresolved ? { resolved: false } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        publication: { select: { id: true, title: true, status: true, isHiddenByAi: true, authorName: true } },
      },
    });

    const queue = await db.helpPublication.findMany({
      where: {
        isDeleted: false,
        OR: unresolved ? [{ isHiddenByAi: true }, { needHuman: true }] : [{ isHiddenByAi: true }, { needHuman: true }],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const openComplaints = await db.helpComplaint.count({ where: { resolved: false } });

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
        publication: c.publication,
      })),
      queue: queue.map((r) => ({
        id: r.id,
        title: r.title,
        text: r.text,
        contactData: r.contactData,
        authorName: r.authorName,
        isHiddenByAi: r.isHiddenByAi,
        hiddenReason: r.hiddenReason,
        needHuman: r.needHuman,
        aiNote: r.aiNote,
        status: r.status,
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
      const complaint = await db.helpComplaint.findUnique({ where: { id }, include: { publication: true } });
      if (!complaint) return NextResponse.json({ error: "Жалоба не найдена" }, { status: 404 });
      await db.helpComplaint.update({ where: { id }, data: { resolved: true } });
      await logAdminAction({
        actor: staff.nickname,
        actorRole: staff.role,
        action: "help.complaint.resolve",
        targetType: "help_complaint",
        targetLabel: `жалоба на «${complaint.publication.title}»`,
      });
      return NextResponse.json({ ok: true, note: "Жалоба отмечена решённой" });
    }

    if (action === "hide-publication") {
      const publication = await db.helpPublication.findUnique({ where: { id } });
      if (!publication) return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
      await db.helpPublication.update({
        where: { id },
        data: {
          isHiddenByAi: true,
          hiddenReason: publication.hiddenReason || "скрыто модератором — нарушение правил раздела",
          aiStatus: "hidden",
          needHuman: false,
        },
      });
      await logAdminAction({
        actor: staff.nickname,
        actorRole: staff.role,
        action: "help.publication.hide",
        targetType: "help_publication",
        targetLabel: `«${publication.title}»`,
      });
      return NextResponse.json({ ok: true, note: "Публикация скрыта" });
    }

    if (action === "restore-publication") {
      const publication = await db.helpPublication.findUnique({ where: { id } });
      if (!publication) return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
      await db.helpPublication.update({
        where: { id },
        data: { isHiddenByAi: false, hiddenReason: "", needHuman: false, aiStatus: "ok", aiNote: "возвращено человеком-модератором" },
      });
      await logAdminAction({
        actor: staff.nickname,
        actorRole: staff.role,
        action: "help.publication.restore",
        targetType: "help_publication",
        targetLabel: `«${publication.title}»`,
      });
      return NextResponse.json({ ok: true, note: "Публикация возвращена в ленту" });
    }

    if (action === "delete-publication") {
      const publication = await db.helpPublication.findUnique({ where: { id } });
      if (!publication) return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
      await db.helpPublication.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() },
      });
      await db.helpComplaint.updateMany({ where: { publicationId: id, resolved: false }, data: { resolved: true } });
      await logAdminAction({
        actor: staff.nickname,
        actorRole: staff.role,
        action: "help.publication.delete",
        targetType: "help_publication",
        targetLabel: `«${publication.title}»`,
      });
      return NextResponse.json({ ok: true, note: "Публикация удалена" });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (e) {
    return handleApiError(e);
  }
}
