/**
 * ШАГ (восстановление) (ТЗ п.21). Жалоба на вопрос «Рекомендую / Не рекомендую».
 * Причины (по ТЗ — ровно пять): реклама; спам; мошенничество; личные данные;
 * другое.
 * Жалоба — сигнал для модерации: она НЕ удаляет публикацию автоматически и
 * не является голосованием — количество жалоб не показывается пользователям
 * и не создаёт никаких оценок (ТЗ п.21/29).
 * По каждой жалобе вопрос повторно проверяет ИИ; спорные случаи видит
 * человек-модератор (существующая система AI → человек).
 */

import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";
import {
  moderatePublishedRecommendText,
  RECOMMEND_COMPLAINT_CATEGORIES,
  recommendSanctionCategory,
} from "@/lib/moderation/recommend";
import { handleConfirmedViolation } from "@/lib/moderation/sanctions";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const category = String(body.category ?? "");
    const comment = String(body.comment ?? "").trim().slice(0, 1000);
    const reporterName = String(body.reporterName ?? "").trim().slice(0, 40);

    if (!RECOMMEND_COMPLAINT_CATEGORIES.includes(category as (typeof RECOMMEND_COMPLAINT_CATEGORIES)[number])) {
      return NextResponse.json({ error: "Выберите причину жалобы" }, { status: 400 });
    }
    const post = await db.recPost.findUnique({ where: { id } });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Вопрос не найден" }, { status: 404 });
    }

    // Жалоба создаётся всегда. Количество жалоб само по себе НЕ является
    // нарушением, не показывается пользователям и не создаёт рейтинг.
    const complaint = await db.recComplaint.create({
      data: {
        postId: id,
        category,
        comment,
        reporterName,
        aiVerdict: "",
        aiNote: "",
      },
    });

    // ИИ-проверка выполняется в фоне: пользователь сразу получает подтверждение.
    after(async () => {
      try {
        const outcome = await moderatePublishedRecommendText(post.subject, post.stance, post.title, post.text, post.place);
        const verdict =
          outcome.action === "hide" ? "violation" : outcome.action === "human" ? "ambiguous" : "ok";
        await db.recComplaint.update({
          where: { id: complaint.id },
          data: { aiVerdict: verdict, aiNote: outcome.aiNote ?? outcome.hiddenReason ?? "" },
        });
        if (outcome.action === "hide") {
          await db.recPost.update({
            where: { id },
            data: {
              isHiddenByAi: true,
              hiddenReason: outcome.hiddenReason ?? "нарушение правил раздела",
              aiNote: outcome.aiNote ?? "",
              aiStatus: "hidden",
            },
          });
          if (outcome.source === "ai") {
            await handleConfirmedViolation({
              userId: post.authorId,
              category: recommendSanctionCategory(outcome.recommendCategory ?? category),
              reason: outcome.hiddenReason ?? "нарушение правил раздела «Рекомендую / Не рекомендую»",
            });
          }
        }
      } catch {
        // Фоновая проверка не должна ломать ответ пользователю.
      }
    });

    return NextResponse.json({
      ok: true,
      note: "Жалоба отправлена. Спасибо. Модерация рассмотрит публикацию.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
