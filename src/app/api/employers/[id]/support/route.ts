/**
 * 2026-10-17: голоса читателей «Рекомендую» / «Не рекомендую» на карточках
 * опыта работы в разделе «О работодателях». По образцу
 * /api/recommend/[id]/support, но для модели EmpVote.
 *
 * Правила:
 *  — только зарегистрированные пользователи (гости читают);
 *  — автор не голосует за собственную публикацию;
 *  — один голос на пользователя (EmpVote @@unique [postId, userId]);
 *  — повторный клик по той же кнопке — снимает голос (toggle);
 *  — клик по соседней — переключает.
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
        { error: "Чтобы проголосовать — войдите в аккаунт." },
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

    if (!rateLimit(`emp-support:${user.id}`, 60, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Слишком много действий за час. Попробуйте позже." }, { status: 429 });
    }

    const post = await db.empPost.findUnique({ where: { id } });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
    }

    if (post.authorId === user.id) {
      return NextResponse.json({ error: "Нельзя голосовать за собственную публикацию" }, { status: 400 });
    }

    const kindRaw = typeof body.kind === "string" ? body.kind : "recommend";
    const kind = ["recommend", "notrecommend"].includes(kindRaw) ? kindRaw : "recommend";

    const existing = await db.empVote.findUnique({
      where: { postId_userId: { postId: id, userId: user.id } },
    });

    if (existing) {
      if (existing.kind === kind) {
        await db.empVote.delete({ where: { id: existing.id } });
      } else {
        await db.empVote.update({ where: { id: existing.id }, data: { kind } });
      }
    } else {
      await db.empVote.create({
        data: { postId: id, userId: user.id, kind },
      });
    }

    const [recommendCount, notrecommendCount] = await Promise.all([
      db.empVote.count({ where: { postId: id, kind: "recommend" } }),
      db.empVote.count({ where: { postId: id, kind: "notrecommend" } }),
    ]);
    const mine = await db.empVote.findUnique({
      where: { postId_userId: { postId: id, userId: user.id } },
    });
    return NextResponse.json({
      ok: true,
      kind,
      myVote: mine?.kind ?? null,
      recommendCount,
      notrecommendCount,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
