/**
 * ШАГ 19 (ТЗ п.8). Обновления от жителей к проблеме «ЖКХ и городские
 * проблемы». Любой зарегистрированный пользователь может добавить к
 * существующей проблеме собственное фактическое обновление:
 *   «У меня в этом же доме такая же проблема»,
 *   «Сегодня приехала аварийная служба»,
 *   «Проблема всё ещё сохраняется».
 * Каждый пользователь редактирует и удаляет ТОЛЬКО собственные обновления.
 * К чужому обновлению свои фото прикреплять нельзя (ТЗ п.27) — для своих
 * материалов пользователь создаёт собственное обновление в истории проблемы.
 * Обновления проверяет ИИ-модерация («Не нравится ≠ нарушение», ТЗ п.18).
 * POST — добавить обновление (текст + до 5 фото + до 1 видео ≤1 мин).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import { restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction, handleConfirmedViolation } from "@/lib/moderation/sanctions";
import { moderateNewGkhText } from "@/lib/moderation/gkh";
import { GKH_MAX_PHOTOS } from "@/lib/gkh";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Лимит обновлений в час на пользователя (ТЗ п.28 — защита от спама). */
const UPDATE_LIMIT_PER_HOUR = 20;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { token } = body;

    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json(
        { error: "Обновления могут добавлять только зарегистрированные пользователи" },
        { status: 401 }
      );
    }

    const restriction = await getActiveRestriction(user.id);
    if (restriction) {
      return NextResponse.json(
        { error: restrictionBlockMessage(restriction), restricted: true, restriction },
        { status: 403 }
      );
    }

    if (!rateLimit(`gkh-update:${user.id}`, UPDATE_LIMIT_PER_HOUR, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Слишком много обновлений за час. Попробуйте позже." }, { status: 429 });
    }

    const problem = await db.gkhProblem.findUnique({ where: { id } });
    if (!problem || problem.isDeleted) {
      return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
    }
    if (problem.isHiddenByAi) {
      return NextResponse.json({ error: "Публикация скрыта модерацией — обновления недоступны" }, { status: 403 });
    }

    const text = String(body.text ?? "").trim();
    if (text.length < 3 || text.length > 2000) {
      return NextResponse.json({ error: "Текст обновления: от 3 до 2000 символов" }, { status: 400 });
    }
    const photos: string[] = Array.isArray(body.photos) ? body.photos.map(String).slice(0, GKH_MAX_PHOTOS) : [];
    const video: string | null = body.video ? String(body.video) : null;
    const mediaConnect = [...photos.map((pid) => ({ id: pid })), ...(video ? [{ id: video }] : [])];

    // Валидация медиа: не привязаны и существуют (ТЗ п.27).
    if (mediaConnect.length > 0) {
      const mediaRows = await db.gkhMedia.findMany({
        where: { id: { in: mediaConnect.map((m) => m.id) } },
        select: { id: true, problemId: true, updateId: true },
      });
      const byId = new Map(mediaRows.map((m) => [m.id, m]));
      for (const m of mediaConnect) {
        const row = byId.get(m.id);
        if (!row || row.problemId || row.updateId) {
          return NextResponse.json({ error: "Некорректное вложение (фото/видео). Загрузите файл заново." }, { status: 400 });
        }
      }
    }

    // ИИ-модерация («Не нравится ≠ нарушение»: сообщение «проблема всё ещё
    // сохраняется» или критика — не нарушение, ТЗ п.18).
    const outcome = await moderateNewGkhText("обновление жителя", "", text, problem.place);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    const created = await db.gkhUpdate.create({
      data: {
        problemId: id,
        authorId: user.id,
        authorName: user.nickname,
        text,
        aiStatus: outcome.action === "hide" ? "hidden" : outcome.action === "human" ? "human" : "ok",
        aiNote: outcome.aiNote ?? "",
        isHiddenByAi: outcome.action === "hide",
        hiddenReason: outcome.hiddenReason ?? "",
        needHuman: outcome.needHuman,
        ...(mediaConnect.length ? { media: { connect: mediaConnect } } : {}),
      },
    });

    let sanction: Record<string, unknown> | null = null;
    if (outcome.action === "hide" && outcome.source === "ai") {
      const violation = await handleConfirmedViolation({
        userId: user.id,
        category: outcome.category ?? "other",
        reason: outcome.hiddenReason ?? "нарушение правил раздела «ЖКХ и городские проблемы»",
      });
      sanction = { ...violation.sanction, note: violation.note, needsHumanDecision: violation.needsHumanDecision };
    }

    const note =
      outcome.action === "hide"
        ? `Обновление скрыто ИИ-модерацией: ${outcome.hiddenReason ?? "нарушение правил"}. Его проверит человек-модератор.`
        : outcome.needHuman
          ? "Обновление отправлено на дополнительную проверку человеку-модератору."
          : "Обновление добавлено в историю проблемы";

    return NextResponse.json({
      ok: true,
      id: created.id,
      hidden: outcome.action === "hide",
      needHuman: outcome.needHuman,
      note,
      sanction,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
