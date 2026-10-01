import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isStaffRole } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * 2026-10-01: Карточка проверки сообщения (админка).
 * GET /api/moderation/[id] — полная карточка:
 *   - сообщение (№, автор, дата, текст, тема, рубрика)
 *   - контекст (несколько сообщений до и после)
 *   - жалобы
 *   - решение AI (уровень, действие, уверенность, сигнал, причина)
 *   - история решений (ModerationHistory timeline)
 *   - история нарушений пользователя (санкции)
 * POST /api/moderation/[id] — действие администратора:
 *   body: { token, action, reason }
 *   action: publish | hide | delete | warn | limit | ban | escalate | emergency_stop
 *   Создаёт запись в ModerationHistory + AdminLog.
 */

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    const user = await userByToken(sp.get("token"));
    if (!user || !isStaffRole(user.role)) {
      return NextResponse.json({ error: "Доступ только для администратора" }, { status: 403 });
    }

    // Основное сообщение
    const msg = await db.message.findUnique({
      where: { id },
      include: {
        topic: { select: { id: true, title: true, rubricId: true } },
        complaints: { orderBy: { createdAt: "desc" } },
        modHistory: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!msg) {
      return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
    }

    // Рубрика
    const rubric = msg.topic.rubricId
      ? await db.rubric.findUnique({ where: { id: msg.topic.rubricId }, select: { id: true, name: true, slug: true } })
      : null;

    // Контекст: 3 сообщения до и 3 после
    const context = await db.message.findMany({
      where: {
        topicId: msg.topicId,
        num: { gte: Math.max(1, msg.num - 3), lte: msg.num + 3 },
      },
      orderBy: { num: "asc" },
      select: { id: true, num: true, authorName: true, body: true, createdAt: true, isDeleted: true, isHiddenByAi: true },
      take: 7,
    });

    // История нарушений пользователя (санкции)
    const sanctions = msg.authorId
      ? await db.sanction.findMany({
          where: { userId: msg.authorId },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, kind: true, reason: true, source: true, expiresAt: true, revoked: true, createdAt: true },
        })
      : [];

    return NextResponse.json({
      message: {
        id: msg.id,
        num: msg.num,
        authorName: msg.authorName,
        authorId: msg.authorId,
        body: msg.body,
        createdAt: msg.createdAt,
        isDeleted: msg.isDeleted,
        isHiddenByAi: msg.isHiddenByAi,
        hiddenReason: msg.hiddenReason,
        needHuman: msg.needHuman,
        aiStatus: msg.aiStatus,
        aiNote: msg.aiNote,
        modLevel: msg.modLevel,
        aiAction: msg.aiAction,
        aiConfidence: msg.aiConfidence,
        aiSignal: msg.aiSignal,
      },
      topic: msg.topic,
      rubric,
      context: context.map((c) => ({
        id: c.id,
        num: c.num,
        authorName: c.authorName,
        body: c.body.slice(0, 300),
        createdAt: c.createdAt,
        isDeleted: c.isDeleted,
        isHiddenByAi: c.isHiddenByAi,
        isCurrent: c.id === msg.id,
      })),
      complaints: msg.complaints.map((c) => ({
        id: c.id,
        category: c.category,
        comment: c.comment,
        reporterName: c.reporterName,
        aiVerdict: c.aiVerdict,
        aiNote: c.aiNote,
        resolved: c.resolved,
        createdAt: c.createdAt,
      })),
      history: msg.modHistory.map((h) => ({
        id: h.id,
        actor: h.actor,
        actorRole: h.actorRole,
        action: h.action,
        reason: h.reason,
        result: h.result,
        confidence: h.confidence,
        createdAt: h.createdAt,
      })),
      userSanctions: sanctions.map((s) => ({
        id: s.id,
        kind: s.kind,
        reason: s.reason,
        source: s.source,
        expiresAt: s.expiresAt,
        revoked: s.revoked,
        createdAt: s.createdAt,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

const ACTION_LABELS: Record<string, string> = {
  publish: "сообщение опубликовано",
  hide: "сообщение скрыто",
  delete: "сообщение удалено",
  warn: "пользователь предупреждён",
  limit: "применено ограничение",
  ban: "пользователь заблокирован",
  escalate: "передано на доп. проверку",
  emergency_stop: "срочно остановлено",
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const token = String(body.token ?? "");
    const action = String(body.action ?? "");
    const reason = String(body.reason ?? "").trim();

    const user = await userByToken(token);
    if (!user || !isStaffRole(user.role)) {
      return NextResponse.json({ error: "Доступ только для администратора" }, { status: 403 });
    }

    const validActions = ["publish", "hide", "delete", "warn", "limit", "ban", "escalate", "emergency_stop"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }

    // Для удаления и ограничений — требуем причину
    if (["delete", "limit", "ban", "emergency_stop"].includes(action) && reason.length < 5) {
      return NextResponse.json({ error: "Укажите причину (минимум 5 символов)" }, { status: 400 });
    }

    const msg = await db.message.findUnique({
      where: { id },
      select: { id: true, num: true, authorName: true, authorId: true, topicId: true, body: true, modLevel: true, aiAction: true, aiConfidence: true, aiSignal: true, aiNote: true },
    });
    if (!msg) {
      return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
    }

    const resultText = ACTION_LABELS[action] || action;

    // Применяем действие к сообщению
    const updateData: Record<string, unknown> = {};
    if (action === "publish") { updateData.isHiddenByAi = false; updateData.needHuman = false; updateData.hiddenReason = ""; updateData.aiStatus = "ok"; }
    if (action === "hide") { updateData.isHiddenByAi = true; updateData.needHuman = false; updateData.hiddenReason = reason || "скрыто администратором"; }
    if (action === "delete") { updateData.isDeleted = true; updateData.deletedBy = user.nickname; updateData.needHuman = false; }
    if (action === "escalate") { updateData.needHuman = true; }

    if (Object.keys(updateData).length > 0) {
      await db.message.update({ where: { id }, data: updateData });
    }

    // Создаём запись в истории решений
    await db.moderationHistory.create({
      data: {
        messageId: id,
        actor: user.nickname,
        actorRole: user.role,
        action,
        reason,
        result: resultText,
        confidence: 0,
      },
    });

    // Записываем в журнал действий
    await db.adminLog.create({
      data: {
        actor: user.nickname,
        actorRole: user.role,
        action: `message.${action}`,
        targetType: "message",
        targetLabel: `№${msg.num} ${msg.authorName}: ${msg.body.slice(0, 60)}`,
        details: reason,
      },
    });

    // Для warn / limit / ban — создаём санкцию
    if (["warn", "limit", "ban"].includes(action) && msg.authorId) {
      const kindMap: Record<string, string> = { warn: "warning", limit: "limit_24h", ban: "ban" };
      const kind = kindMap[action] || "warning";
      const expiresAt = action === "limit"
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : action === "ban" ? null : null;
      await db.sanction.create({
        data: {
          userId: msg.authorId,
          kind,
          reason: reason || `Администратор: ${resultText}`,
          source: "human",
          messageId: id,
          topicId: msg.topicId,
          expiresAt,
        },
      });
    }

    return NextResponse.json({ ok: true, note: resultText });
  } catch (e) {
    return handleApiError(e);
  }
}
