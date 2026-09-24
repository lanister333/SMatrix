import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { moderateNewText, restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction, handleConfirmedViolation } from "@/lib/moderation/sanctions";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const topicId = parseInt(id, 10);
    const body = await req.json();
    const token = String(body.token ?? "");
    const text = String(body.body ?? "").trim();
    const parentId = body.parentId ? String(body.parentId) : null;

    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json(
        { error: "Чтобы писать на форуме, войдите или зарегистрируйтесь" },
        { status: 401 }
      );
    }

    // ШАГ 11: активное ограничение аккаунта (мягкая система санкций).
    const restriction = await getActiveRestriction(user.id);
    if (restriction) {
      return NextResponse.json(
        {
          error: restrictionBlockMessage(restriction),
          restricted: true,
          restriction,
        },
        { status: 403 }
      );
    }

    const topic = await db.topic.findUnique({ where: { id: topicId } });
    if (!topic || topic.deletedAt) {
      return NextResponse.json({ error: "Тема не найдена" }, { status: 404 });
    }
    // ТЗ: тема без активности 1 год считается архивной
    const staleArchived =
      topic.isArchived || topic.lastActivityAt.getTime() < Date.now() - 365 * 24 * 3600 * 1000;
    if (staleArchived) {
      return NextResponse.json(
        { error: "Тема в архиве — обсуждение закрыто" },
        { status: 403 }
      );
    }
    if (topic.isClosed) {
      return NextResponse.json(
        { error: "Тема закрыта для новых сообщений" },
        { status: 403 }
      );
    }
    if (!text) {
      return NextResponse.json({ error: "Введите текст сообщения" }, { status: 400 });
    }
    if (text.length > 10000) {
      return NextResponse.json(
        { error: "Сообщение слишком длинное (максимум 10000 символов)" },
        { status: 400 }
      );
    }

    // Защита от флуда: повтор того же текста в той же теме
    const recent = await db.message.findMany({
      where: { topicId, authorId: user.id, isDeleted: false },
      orderBy: { num: "desc" },
      take: 5,
      select: { body: true },
    });
    if (recent.some((m) => m.body.trim() === text)) {
      return NextResponse.json(
        { error: "Похоже на флуд: вы недавно отправляли такое же сообщение в этой теме" },
        { status: 429 }
      );
    }

    let parent = null;
    if (parentId) {
      parent = await db.message.findUnique({ where: { id: parentId } });
      if (!parent || parent.topicId !== topicId) parent = null;
    }

    // ШАГ 10: ИИ-модерация — первая инстанция. Проверяется весь текст,
    // включая цитируемые фрагменты. Нецензурная лексика → блокировка
    // отправки с точным сообщением; очевидные нарушения → скрытие;
    // спорные случаи → человек-модератор.
    const outcome = await moderateNewText(text);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    const agg = await db.message.aggregate({
      where: { topicId },
      _max: { num: true },
    });
    const num = (agg._max.num ?? 0) + 1;

    const message = await db.message.create({
      data: {
        topicId,
        parentId: parent ? parent.id : null,
        depth: parent ? Math.min(6, parent.depth + 1) : 0,
        num,
        authorName: user.nickname,
        authorId: user.id,
        body: text,
        aiStatus: outcome.action === "hide" ? "hidden" : outcome.action === "human" ? "human" : "ok",
        aiNote: outcome.aiNote ?? "",
        needHuman: outcome.needHuman,
        isHiddenByAi: outcome.action === "hide",
        hiddenReason: outcome.hiddenReason ?? "",
      },
    });

    // ШАГ 11: очевидное нарушение скрыто ИИ — мягкая лестница санкций
    // (предупреждение → 1 час → 24 часа). Серьёзные категории решает человек.
    let sanction: Record<string, unknown> | null = null;
    if (outcome.action === "hide") {
      const violation = await handleConfirmedViolation({
        userId: user.id,
        messageId: message.id,
        topicId,
        category: outcome.category ?? "other",
        reason: outcome.hiddenReason ?? "нарушение правил форума",
      });
      sanction = { ...violation.sanction, note: violation.note, needsHumanDecision: violation.needsHumanDecision };
      if (violation.needsHumanDecision) {
        await db.message.update({
          where: { id: message.id },
          data: { needHuman: true },
        });
      }
    }

    await db.topic.update({
      where: { id: topicId },
      data: { lastActivityAt: new Date(), lastAuthorName: user.nickname },
    });

    return NextResponse.json({
      message: {
        id: message.id,
        num: message.num,
        isHiddenByAi: message.isHiddenByAi,
        hiddenReason: message.hiddenReason,
        aiNote: message.aiNote,
      },
      sanction,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
