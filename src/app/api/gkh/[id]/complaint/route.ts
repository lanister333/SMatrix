/**
 * ШАГ 19 (ТЗ п.17). Жалоба на публикацию «ЖКХ и городские проблемы».
 * Причины (ТЗ — ровно восемь): персональные данные; оскорбления; угрозы;
 * спам; реклама; мошенничество; не по теме; другое.
 * Кнопок «Ложь», «Фейк», «Не согласен» НЕТ — разногласие с содержанием
 * не является жалобой.
 * Жалоба — сигнал для модерации: НЕ голосование, количество не показывается,
 * публикацию сама по себе не удаляет (ТЗ п.17). По каждой жалобе публикацию
 * повторно проверяет ИИ; спорные случаи видит человек-модератор.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";
import { isGkhComplaintCategory } from "@/lib/gkh";
import { moderatePublishedGkhText, gkhSanctionCategory } from "@/lib/moderation/gkh";
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

    if (!isGkhComplaintCategory(category)) {
      return NextResponse.json({ error: "Выберите причину жалобы" }, { status: 400 });
    }
    const problem = await db.gkhProblem.findUnique({ where: { id } });
    if (!problem || problem.isDeleted) {
      return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
    }

    // ПРОМТ №1: rate-limit + уникальность + рейд-детектор.
    const guard = await checkComplaintAllowed(req, token || null, false);
    if (!guard.allowed || guard.response) return guard.response!;
    if (guard.reporterId && (await hasAlreadyComplained("gkhComplaint", { problemId: id, reporterId: guard.reporterId }))) {
      return NextResponse.json({ error: "Вы уже жаловались на эту публикацию" }, { status: 409 });
    }

    // Жалоба создаётся всегда. Количество жалоб само по себе НЕ является
    // нарушением, не показывается пользователям и не создаёт рейтинг.
    const complaint = await db.gkhComplaint.create({
      data: {
        problemId: id,
        category,
        comment,
        reporterName: guard.reporterName ?? reporterName,
        reporterId: guard.reporterId ?? null,
      },
    });

    // ПРОМТ №1: рейд-детектор + ИИ-проверка выполняются в фоне.
    after(async () => {
      try {
        const raid = await detectRaid("gkhComplaint", "problemId", id);
        if (raid.isRaid) {
          await db.gkhComplaint.updateMany({
            where: { problemId: id },
            data: { aiNote: "Внимание: возможно скоординированная травля (рейд)." },
          }).catch(() => {});
        }
        const outcome = await moderatePublishedGkhText("публикацию о проблеме", problem.title, problem.text, problem.place);
        const verdict =
          outcome.action === "hide" ? "violation" : outcome.action === "human" ? "ambiguous" : "ok";
        await db.gkhComplaint.update({
          where: { id: complaint.id },
          data: { aiVerdict: verdict, aiNote: outcome.aiNote ?? outcome.hiddenReason ?? "" },
        });
        if (outcome.action === "hide") {
          await db.gkhProblem.update({
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
              userId: problem.authorId,
              category: gkhSanctionCategory(outcome.gkhCategory ?? category),
              reason: outcome.hiddenReason ?? "нарушение правил раздела «ЖКХ и городские проблемы»",
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
