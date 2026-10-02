import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { moderateNewText, restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction, handleConfirmedViolation } from "@/lib/moderation/sanctions";
import { checkDailyLimit, rateKey, checkQuickRate, suspiciousFactor } from "@/lib/security";
import { isStaffRole } from "@/lib/admin";
import { getAuthorHistory, getRecentMessages } from "@/lib/moderation/context";

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

    // ПРОМТ №1: проверка статуса аккаунта (banned) + лимиты для fresh-аккаунтов.
    // < 24 ч → 30 сообщений/час; обычно → 60/час. Suspicious → /2. Staff-роли свободны.
    if (!isStaffRole(user.role)) {
      const fullUser = await db.user.findUnique({
        where: { id: user.id },
        select: { status: true, createdAt: true },
      });
      if (fullUser?.status === "banned") {
        return NextResponse.json(
          { error: "Аккаунт заблокирован. Подайте апелляцию, если считаете это ошибкой." },
          { status: 403 }
        );
      }
      if (fullUser) {
        const factor = suspiciousFactor(fullUser.status);
        const isFresh = Date.now() - fullUser.createdAt.getTime() < 24 * 60 * 60 * 1000;
        const perHour = Math.floor((isFresh ? 30 : 60) * factor);
        if (!checkQuickRate(rateKey("msg_h", user.id), perHour, 60 * 60 * 1000)) {
          return NextResponse.json(
            { error: "Слишком много сообщений за час. Попробуйте позже." },
            { status: 429 }
          );
        }
        // Лимит сообщений со ссылками для fresh-аккаунтов: 5/сутки.
        if (isFresh && /https?:\/\//i.test(text)) {
          const linksCheck = await checkDailyLimit(
            user.id,
            fullUser.createdAt,
            "message_with_link",
            { fresh: 5, normal: 100, windowMs: 24 * 60 * 60 * 1000 }
          );
          if (!linksCheck.allowed) {
            return NextResponse.json(
              { error: linksCheck.reason ?? "Слишком много сообщений со ссылками" },
              { status: 429 }
            );
          }
        }
      }
    }

    const topic = await db.topic.findUnique({
      where: { id: topicId },
      include: { rubric: { select: { name: true } } },
    });
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

    let parent: { topicId: number; id: string; depth: number } | null = null;
    if (parentId) {
      parent = await db.message.findUnique({ where: { id: parentId } });
      if (!parent || parent.topicId !== topicId) parent = null;
    }

    // ШАГ 10: ИИ-модерация — первая инстанция. Проверяется весь текст,
    // включая цитируемые фрагменты. Нецензурная лексика → блокировка
    // отправки с точным сообщением; очевидные нарушения → скрытие;
    // спорные случаи → человек-модератор.
    // ПРОМТ №2: передаём контекст — соседние сообщения, тему, раздел,
    // историю нарушений автора. AI видит «что вокруг».
    const [before, authorHistory] = await Promise.all([
      getRecentMessages(topicId, 5),
      getAuthorHistory(user.id),
    ]);
    const outcome = await moderateNewText(text, {
      topicTitle: topic.title,
      sectionName: topic.rubric?.name ?? undefined,
      before,
      reviewType: "new",
      authorHistory,
    });
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
        modLevel: outcome.modLevel ?? 4,
        aiAction: outcome.aiAction ?? "WATCH",
        aiConfidence: outcome.aiConfidence === "high" ? 0.9 : outcome.aiConfidence === "medium" ? 0.6 : 0.3,
        aiSignal: outcome.aiSignal ?? "",
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
