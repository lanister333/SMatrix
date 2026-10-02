/**
 * ШАГ 23 (ТЗ п.21). Жалоба на вопрос «Где дешевле».
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
  moderatePublishedGdedeshevleText,
  GDEDESHEVLE_COMPLAINT_CATEGORIES,
  gdedeshevleSanctionCategory,
} from "@/lib/moderation/gdedeshevle";
import { handleConfirmedViolation } from "@/lib/moderation/sanctions";
import { checkComplaintAllowed, hasAlreadyComplained, detectRaid } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const category = String(body.category ?? "");
    const comment = String(body.comment ?? "").trim().slice(0, 1000);
    const reporterName = String(body.reporterName ?? "").trim().slice(0, 40);
    const token = String(body.token ?? "");

    if (!GDEDESHEVLE_COMPLAINT_CATEGORIES.includes(category as (typeof GDEDESHEVLE_COMPLAINT_CATEGORIES)[number])) {
      return NextResponse.json({ error: "Выберите причину жалобы" }, { status: 400 });
    }
    const post = await db.cheapPost.findUnique({ where: { id } });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Вопрос не найден" }, { status: 404 });
    }

    // ПРОМТ №1: rate-limit + уникальность + рейд-детектор.
    const guard = await checkComplaintAllowed(req, token || null, false);
    if (!guard.allowed || guard.response) return guard.response!;
    if (guard.reporterId && (await hasAlreadyComplained("cheapComplaint", { postId: id, reporterId: guard.reporterId }))) {
      return NextResponse.json({ error: "Вы уже жаловались на эту публикацию" }, { status: 409 });
    }

    // Жалоба создаётся всегда. Количество жалоб само по себе НЕ является
    // нарушением, не показывается пользователям и не создаёт рейтинг.
    const complaint = await db.cheapComplaint.create({
      data: {
        postId: id,
        category,
        comment,
        reporterName: guard.reporterName ?? reporterName,
        reporterId: guard.reporterId ?? null,
        aiVerdict: "",
        aiNote: "",
      },
    });

    // ПРОМТ №1: рейд-детектор + ИИ-проверка выполняются в фоне.
    after(async () => {
      try {
        const raid = await detectRaid("cheapComplaint", "postId", id);
        if (raid.isRaid) {
          await db.cheapComplaint.updateMany({
            where: { postId: id },
            data: { aiNote: "Внимание: возможно скоординированная травля (рейд)." },
          }).catch(() => {});
        }
        const outcome = await moderatePublishedGdedeshevleText(post.title, post.text, post.place);
        const verdict =
          outcome.action === "hide" ? "violation" : outcome.action === "human" ? "ambiguous" : "ok";
        await db.cheapComplaint.update({
          where: { id: complaint.id },
          data: { aiVerdict: verdict, aiNote: outcome.aiNote ?? outcome.hiddenReason ?? "" },
        });
        if (outcome.action === "hide") {
          await db.cheapPost.update({
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
              category: gdedeshevleSanctionCategory(outcome.gdedeshevleCategory ?? category),
              reason: outcome.hiddenReason ?? "нарушение правил раздела «Где дешевле»",
            });
          }
        }
      } catch {
        // Фоновая проверка не должна ломать ответ пользователю.
      }
    });

    return NextResponse.json({
      ok: true,
      note: "Жалоба отправлена. Спасибо. Модерация рассмотрит вопрос.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
