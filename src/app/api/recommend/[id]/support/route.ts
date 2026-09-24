/**
 * ТЗ 2026-09-21. Отметка «Полезный отзыв» на публикации раздела
 * «Рекомендую / Не рекомендую» (кнопка .btn-review-utility, supportReview(id)).
 *
 * Правила:
 *  — только зарегистрированные пользователи (гости читают);
 *  — автор не голосует за собственный отзыв;
 *  — один голос на пользователя на публикацию (RecUsefulVote @@unique —
 *    защита от накрутки); ТЗ 2026-09-24 (пользователь): голос имеет вид
 *    kind = "recommend" | "notrecommend" (кнопки «Рекомендую»/«Не
 *    рекомендую» рядом с «Обсудить на форуме»); повторный клик по той же
 *    кнопке снимает голос, клик по соседней — переключает; legacy-вид
 *    ("useful", кнопка «Полезный отзыв» удалена) при голосовании
 *    перезаписывается новым kind.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import { restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction } from "@/lib/moderation/sanctions";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const user = await userByToken(body.token);
    if (!user) {
      return NextResponse.json(
        { error: "Отмечать полезные отзывы могут только зарегистрированные пользователи. Гости могут читать." },
        { status: 401 }
      );
    }

    // Общий механизм сайта: активное ограничение аккаунта блокирует действия.
    const restriction = await getActiveRestriction(user.id);
    if (restriction) {
      return NextResponse.json(
        { error: restrictionBlockMessage(restriction), restricted: true, restriction },
        { status: 403 }
      );
    }

    // Грубая защита от флуда попытками.
    if (!rateLimit(`rec-support:${user.id}`, 60, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Слишком много действий за час. Попробуйте позже." }, { status: 429 });
    }

    const post = await db.recPost.findUnique({ where: { id } });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
    }

    if (post.authorId === user.id) {
      return NextResponse.json({ error: "Нельзя голосовать за собственный отзыв" }, { status: 400 });
    }

    // ТЗ 2026-09-24: вид голоса — «Рекомендую» / «Не рекомендую»
    // (без kind — legacy-вызов «Полезный отзыв», оставлен для совместимости).
    const kindRaw = typeof body.kind === "string" ? body.kind : "useful";
    const kind = ["recommend", "notrecommend"].includes(kindRaw) ? kindRaw : "useful";

    const existing = await db.recUsefulVote.findUnique({
      where: { postId_userId: { postId: id, userId: user.id } },
    });

    if (existing) {
      if (existing.kind === kind) {
        // Повторный клик по той же кнопке — снимаем голос (toggle).
        await db.recUsefulVote.delete({ where: { id: existing.id } });
      } else {
        // Клик по соседней кнопке — переключаем голос.
        await db.recUsefulVote.update({ where: { id: existing.id }, data: { kind } });
      }
    } else {
      await db.recUsefulVote.create({
        data: { postId: id, userId: user.id, kind },
      });
    }

    const [recommendCount, notrecommendCount, usefulCount] = await Promise.all([
      db.recUsefulVote.count({ where: { postId: id, kind: "recommend" } }),
      db.recUsefulVote.count({ where: { postId: id, kind: "notrecommend" } }),
      db.recUsefulVote.count({ where: { postId: id } }),
    ]);
    const mine = await db.recUsefulVote.findUnique({
      where: { postId_userId: { postId: id, userId: user.id } },
    });
    return NextResponse.json({
      ok: true,
      kind,
      myVote: mine?.kind ?? null,
      recommendCount,
      notrecommendCount,
      usefulCount,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
