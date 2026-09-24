/**
 * ШАГ 22 (восстановление). Жалоба на объявление.
 * Причины (ровно пять): спам; мошенничество; запрещённый товар; личные
 * данные; другое. Рекламы в списке НЕТ — объявления сами по себе являются
 * рекламой товаров/услуг автора, это суть раздела.
 * Жалоба — сигнал для модерации: она НЕ удаляет объявление автоматически и
 * не является голосованием — количество жалоб не показывается пользователям.
 * По каждой жалобе объявление повторно проверяет ИИ; спорные случаи видит
 * человек-модератор (существующая система AI → человек).
 */

import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";
import {
  moderatePublishedAdListingText,
  ADS_COMPLAINT_CATEGORIES,
  adsSanctionCategory,
} from "@/lib/moderation/obyavleniya";
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

    if (!ADS_COMPLAINT_CATEGORIES.includes(category as (typeof ADS_COMPLAINT_CATEGORIES)[number])) {
      return NextResponse.json({ error: "Выберите причину жалобы" }, { status: 400 });
    }
    const post = await db.adListing.findUnique({ where: { id } });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Объявление не найдено" }, { status: 404 });
    }

    // Жалоба создаётся всегда. Количество жалоб само по себе НЕ является
    // нарушением, не показывается пользователям и не создаёт рейтинг.
    const complaint = await db.adComplaint.create({
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
        const outcome = await moderatePublishedAdListingText(post.rubric, post.title, post.text, post.price, post.contact, post.place);
        const verdict =
          outcome.action === "hide" ? "violation" : outcome.action === "human" ? "ambiguous" : "ok";
        await db.adComplaint.update({
          where: { id: complaint.id },
          data: { aiVerdict: verdict, aiNote: outcome.aiNote ?? outcome.hiddenReason ?? "" },
        });
        if (outcome.action === "hide") {
          await db.adListing.update({
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
              category: adsSanctionCategory(outcome.adsCategory ?? category),
              reason: outcome.hiddenReason ?? "нарушение правил раздела «Объявления»",
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
