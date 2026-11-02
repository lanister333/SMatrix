/**
 * ТЗ 2026-09-21 (Пункт 13 Манифеста). Официальный ответ организации на отзыв
 * в разделе «Рекомендую / Не рекомендую» (блок .review-official-response).
 *
 * Паттерн ЖКХ (ШАГ 19, ТЗ п.11/12) — один-в-один:
 *  — ответить может ТОЛЬКО подтверждённый представитель организации
 *    (User.orgRep — статус устанавливает только администратор);
 *  — РОВНО ОДИН официальный публичный ответ на отзыв; бесконечная
 *    переписка внутри публикации не ведётся;
 *  — ответ проходит ту же модерацию раздела.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import { restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction } from "@/lib/moderation/sanctions";
import { moderateNewRecommendText } from "@/lib/moderation/recommend";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { token } = body;

    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json(
        { error: "Чтобы ответить — войдите в аккаунт." },
        { status: 401 }
      );
    }

    // Статус представителя подтверждается отдельно; обычный пользователь
    // не может присвоить его себе.
    if (!user.orgRep) {
      return NextResponse.json(
        { error: "Официальный ответ может дать только подтверждённый представитель организации. Статус представителя подтверждается администратором." },
        { status: 403 }
      );
    }

    const restriction = await getActiveRestriction(user.id);
    if (restriction) {
      return NextResponse.json(
        { error: restrictionBlockMessage(restriction), restricted: true, restriction },
        { status: 403 }
      );
    }

    if (!rateLimit(`rec-orgresp:${user.id}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Слишком много действий за час. Попробуйте позже." }, { status: 429 });
    }

    const post = await db.recPost.findUnique({ where: { id } });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
    }

    // РОВНО ОДИН официальный публичный ответ на отзыв.
    if (post.orgResponseAt) {
      return NextResponse.json(
        { error: "Официальный ответ на этот отзыв уже дан" },
        { status: 409 }
      );
    }

    const text = String(body.text ?? "").trim();
    if (text.length < 10 || text.length > 4000) {
      return NextResponse.json({ error: "Текст ответа: от 10 до 4000 символов" }, { status: 400 });
    }

    // Ответ организации проходит модерацию раздела; разъяснения и
    // извинения — не нарушение.
    const outcome = await moderateNewRecommendText(
      post.subject,
      post.stance,
      "официальный ответ организации",
      text,
      post.place
    );
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    await db.recPost.update({
      where: { id },
      data: {
        orgResponseText: text,
        orgResponseAt: new Date(),
        orgResponseById: user.id,
        orgResponseByName: user.orgName || user.nickname,
      },
    });

    return NextResponse.json({
      ok: true,
      note: "Официальный ответ опубликован. Спасибо!",
      hidden: outcome.action === "hide",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
