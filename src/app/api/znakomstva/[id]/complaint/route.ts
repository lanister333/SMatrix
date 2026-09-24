/**
 * ШАГ 26. Жалоба на объявление «Знакомства».
 * Причины (ровно девять, см. DATING_COMPLAINT_REASONS): спам; реклама;
 * мошенничество; оскорбления; угрозы; сексуальная эксплуатация или
 * интим-услуги; чужие персональные данные или контакты; незаконное
 * предложение; другое нарушение правил.
 * Жалоба — сигнал для модерации: НЕ голосование, НЕ автоматическое нарушение,
 * количество жалоб не показывается; кнопок «Ложь»/«Фейк»/«Не согласен» нет.
 * По жалобе объявление повторно проверяет ИИ; спорные случаи видит
 * человек-модератор (общая система сайта: ИИ → человек).
 */

import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";
import { moderatePublishedDatingText, datingAiSanctionCategory } from "@/lib/moderation/znakomstva";
import { handleConfirmedViolation } from "@/lib/moderation/sanctions";
import { isDatingComplaintReason, datingComplaintLabel } from "@/lib/znakomstva";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const category = String(body.category ?? "");
    const comment = String(body.comment ?? "").trim().slice(0, 1000);
    const reporterName = String(body.reporterName ?? "").trim().slice(0, 40);

    if (!isDatingComplaintReason(category)) {
      return NextResponse.json({ error: "Выберите причину жалобы" }, { status: 400 });
    }
    const post = await db.datingPost.findUnique({ where: { id } });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Объявление не найдено" }, { status: 404 });
    }

    // Жалоба создаётся всегда. Количество жалоб само по себе НЕ является
    // нарушением, не показывается пользователям и не создаёт рейтинг.
    const complaint = await db.datingComplaint.create({
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
        const outcome = await moderatePublishedDatingText(post.category, post.title, post.body);
        const verdict =
          outcome.action === "hide" ? "violation" : outcome.action === "human" ? "ambiguous" : "ok";
        await db.datingComplaint.update({
          where: { id: complaint.id },
          data: { aiVerdict: verdict, aiNote: outcome.aiNote ?? outcome.hiddenReason ?? "" },
        });
        if (outcome.action === "hide") {
          await db.datingPost.update({
            where: { id },
            data: {
              isHiddenByAi: true,
              hiddenReason: outcome.hiddenReason ?? `жалоба: ${datingComplaintLabel(category)}`,
              aiNote: outcome.aiNote ?? "",
              aiStatus: "hidden",
            },
          });
          if (outcome.source === "ai") {
            await handleConfirmedViolation({
              userId: post.authorId,
              category: datingAiSanctionCategory(outcome.dkCategory ?? category),
              reason: outcome.hiddenReason ?? "нарушение правил раздела «Знакомства»",
            });
          }
        }
      } catch {
        // Фоновая проверка не должна ломать ответ пользователю.
      }
    });

    return NextResponse.json({
      ok: true,
      note: "Жалоба отправлена. Спасибо. Модерация рассмотрит объявление.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
