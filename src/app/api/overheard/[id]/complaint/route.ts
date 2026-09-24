/**
 * ШАГ 17 (ТЗ п.22). Жалоба на сообщение «Подслушано Сахалин».
 * Причины: оскорбления; угрозы; травля; мошенничество; спам; реклама;
 * персональные данные; запрещённое содержание; другие нарушения.
 * Жалоба — не голосование: количество жалоб не показывается пользователям
 * и не создаёт никаких оценок; каждая жалоба разбирается ИИ, спорные случаи
 * видит человек-модератор. Массовые жалобы — только сигнал, не доказательство.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";
import { moderatePublishedOverheardText, OVERHEARD_COMPLAINT_CATEGORIES, overheardSanctionCategory } from "@/lib/moderation/overheard";
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

    if (!OVERHEARD_COMPLAINT_CATEGORIES.includes(category as (typeof OVERHEARD_COMPLAINT_CATEGORIES)[number])) {
      return NextResponse.json({ error: "Выберите причину жалобы" }, { status: 400 });
    }
    const post = await db.overheardPost.findUnique({ where: { id } });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
    }

    // Жалоба создаётся всегда. Количество жалоб само по себе НЕ является
    // нарушением, не показывается пользователям и не создаёт рейтинг.
    const complaint = await db.overheardComplaint.create({
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
        const outcome = await moderatePublishedOverheardText(post.title, post.text, post.place);
        const verdict =
          outcome.action === "hide" ? "violation" : outcome.action === "human" ? "ambiguous" : "ok";
        await db.overheardComplaint.update({
          where: { id: complaint.id },
          data: { aiVerdict: verdict, aiNote: outcome.aiNote ?? outcome.hiddenReason ?? "" },
        });
        if (outcome.action === "hide") {
          await db.overheardPost.update({
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
              category: overheardSanctionCategory(outcome.overheardCategory ?? category),
              reason: outcome.hiddenReason ?? "нарушение правил раздела «Подслушано Сахалин»",
            });
          }
        }
      } catch {
        // Фоновая проверка не должна ломать ответ пользователю.
      }
    });

    return NextResponse.json({
      ok: true,
      note: "Жалоба отправлена. Спасибо. Модерация рассмотрит сообщение.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
