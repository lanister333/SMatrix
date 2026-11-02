import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isOwnerRole, isStaffRole, logAdminAction, ROLE_LABELS } from "@/lib/admin";

export const runtime = "nodejs";

/**
 * ШАГ 12. Управление темой в админ-панели.
 *
 * GET  — карточка темы + история действий по ней (внутренний журнал).
 * POST — действия:
 *   rename  — изменить заголовок (модератор и владелец);
 *   move    — перенести в другой раздел (владелец). Обсуждение, счётчики
 *             и ссылки сохраняются: сообщения остаются в теме, номер темы
 *             и её id не меняются, ссылки вида /?topic=N продолжают работать;
 *   pin     — закрепить; unpin — открепить;
 *   close   — закрыть; open — открыть;
 *   delete  — удалить (владелец; мягкое удаление, восстановимо);
 *   restore — восстановить удалённую тему (владелец).
 *
 * Модератор: rename/pin/unpin/close/open — права ограничены.
 * Удаление, перенос и восстановление — только Главный администратор/Владелец.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const staff = await userByToken(req.nextUrl.searchParams.get("token"));
    if (!staff) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    if (!isStaffRole(staff.role)) {
      return NextResponse.json({ error: "Доступно только администратору" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const topicId = parseInt(id, 10);
    const topic = await db.topic.findUnique({
      where: { id: topicId },
      include: {
        rubric: { include: { parent: { select: { id: true, name: true } } } },
        author: { select: { nickname: true, gender: true } },
        _count: { select: { messages: true } },
      },
    });
    if (!topic) {
      return NextResponse.json({ error: "Тема не найдена" }, { status: 404 });
    }
    const history = await db.adminLog.findMany({
      where: { targetType: "topic", OR: [{ targetLabel: { contains: `#${topicId}` } }, { details: { contains: `topicId=${topicId}` } }] },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({
      topic: {
        id: topic.id,
        number: topic.number,
        title: topic.title,
        author: topic.authorName,
        rubricId: topic.rubricId,
        rubricName: topic.rubric?.name ?? "",
        rubricParent: topic.rubric?.parent?.name ?? "",
        answers: Math.max(0, topic._count.messages - 1),
        views: topic.views,
        isPinned: topic.isPinned,
        isClosed: topic.isClosed,
        isDeleted: !!topic.deletedAt,
        createdAt: topic.createdAt,
        lastActivityAt: topic.lastActivityAt,
      },
      history: history.map((h) => ({
        id: h.id,
        actor: h.actor,
        actorRole: h.actorRole,
        action: h.action,
        details: h.details,
        createdAt: h.createdAt,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const topicId = parseInt(id, 10);
    const body = await req.json();
    const staff = await userByToken(body.token);
    if (!staff) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    if (!isStaffRole(staff.role)) {
      return NextResponse.json({ error: "Доступно только администратору" }, { status: 403 });
    }
    const topic = await db.topic.findUnique({ where: { id: topicId }, include: { rubric: { select: { name: true } } } });
    if (!topic) {
      return NextResponse.json({ error: "Тема не найдена" }, { status: 404 });
    }
    const action = String(body.action ?? "");
    const label = `тема #${topicId} «${topic.title}»`;
    const isOwner = isOwnerRole(staff.role);

    if (action === "rename") {
      const title = String(body.title ?? "").trim();
      if (title.length < 5 || title.length > 150) {
        return NextResponse.json({ error: "Заголовок — от 5 до 150 символов" }, { status: 400 });
      }
      await db.topic.update({ where: { id: topicId }, data: { title } });
      await logAdminAction({ actor: staff.nickname, actorRole: staff.role, action: "topic.rename", targetType: "topic", targetLabel: label, details: `«${topic.title}» → «${title}»` });
      return NextResponse.json({ ok: true, note: "Заголовок изменён" });
    }

    if (action === "move") {
      if (!isOwner) {
        return NextResponse.json({ error: "Перенос тем доступен только Главному администратору (Владельцу)" }, { status: 403 });
      }
      const rubricId = parseInt(String(body.rubricId ?? ""), 10);
      const rubric = await db.rubric.findUnique({ where: { id: rubricId }, include: { parent: { select: { name: true } } } });
      if (!rubric) {
        return NextResponse.json({ error: "Раздел не найден" }, { status: 404 });
      }
      if (rubric.isService) {
        return NextResponse.json({ error: "Нельзя переносить темы в служебный раздел" }, { status: 400 });
      }
      await db.topic.update({ where: { id: topicId }, data: { rubricId } });
      const where = rubric.parent ? `${rubric.parent.name} → ${rubric.name}` : rubric.name;
      await logAdminAction({
        actor: staff.nickname,
        actorRole: staff.role,
        action: "topic.move",
        targetType: "topic",
        targetLabel: label,
        details: `topicId=${topicId}; «${topic.rubric?.name ?? "—"}» → «${where}»; обсуждение и ссылки сохранены`,
      });
      return NextResponse.json({ ok: true, note: `Тема перенесена в раздел «${where}». Обсуждение и ссылки сохранены.` });
    }

    if (action === "pin" || action === "unpin") {
      await db.topic.update({ where: { id: topicId }, data: { isPinned: action === "pin" } });
      await logAdminAction({ actor: staff.nickname, actorRole: staff.role, action: `topic.${action}`, targetType: "topic", targetLabel: label });
      return NextResponse.json({ ok: true, note: action === "pin" ? "Тема закреплена" : "Тема откреплена" });
    }

    if (action === "close" || action === "open") {
      await db.topic.update({ where: { id: topicId }, data: { isClosed: action === "close" } });
      await logAdminAction({ actor: staff.nickname, actorRole: staff.role, action: `topic.${action}`, targetType: "topic", targetLabel: label });
      return NextResponse.json({ ok: true, note: action === "close" ? "Тема закрыта" : "Тема открыта" });
    }

    if (action === "delete") {
      if (!isOwner) {
        return NextResponse.json({ error: "Удаление тем доступно только Главному администратору (Владельцу)" }, { status: 403 });
      }
      await db.topic.update({ where: { id: topicId }, data: { deletedAt: new Date() } });
      await logAdminAction({ actor: staff.nickname, actorRole: staff.role, action: "topic.delete", targetType: "topic", targetLabel: label, details: `topicId=${topicId}` });
      return NextResponse.json({ ok: true, note: "Тема удалена (можно восстановить)" });
    }

    if (action === "restore") {
      if (!isOwner) {
        return NextResponse.json({ error: "Восстановление тем доступно только Главному администратору (Владельцу)" }, { status: 403 });
      }
      await db.topic.update({ where: { id: topicId }, data: { deletedAt: null } });
      await logAdminAction({ actor: staff.nickname, actorRole: staff.role, action: "topic.restore", targetType: "topic", targetLabel: label, details: `topicId=${topicId}` });
      return NextResponse.json({ ok: true, note: "Тема восстановлена" });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (e) {
    return handleApiError(e);
  }
}
