import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";
import { COMPLAINT_CONFIRM_MESSAGE, moderatePublishedText } from "@/lib/moderation";
import { handleConfirmedViolation } from "@/lib/moderation/sanctions";
import { checkComplaintAllowed, hasAlreadyComplained, detectRaid } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Причины жалоб (по ТЗ — ровно 7). */
const COMPLAINT_CATEGORIES = [
  "insult", // Оскорбление / травля
  "threat", // Угроза
  "spam", // Спам / реклама
  "fraud", // Мошенничество
  "personal_data", // Персональные данные
  "forbidden", // Запрещённый контент
  "other", // Другое
];

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const category = String(body.category ?? "");
    const comment = String(body.comment ?? "").trim().slice(0, 1000);
    const token = String(body.token ?? "");

    if (!COMPLAINT_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Выберите причину жалобы" }, { status: 400 });
    }
    const message = await db.message.findUnique({ where: { id } });
    if (!message || message.isDeleted) {
      return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
    }

    // ПРОМТ №1: rate-limit + уникальность + рейд-детектор.
    // Жалоба может быть анонимной (если модерация разрешит), но в форуме
    // обычно требует авторизации.
    const guard = await checkComplaintAllowed(req, token || null, false);
    if (!guard.allowed || guard.response) {
      return guard.response!;
    }
    if (
      guard.reporterId &&
      (await hasAlreadyComplained("complaint", {
        messageId: id,
        reporterId: guard.reporterId,
      }))
    ) {
      return NextResponse.json(
        { error: "Вы уже жаловались на это сообщение" },
        { status: 409 }
      );
    }

    // Жалоба создаётся всегда. Количество жалоб само по себе НЕ является
    // нарушением и никогда не влечёт автоматической блокировки: каждую
    // жалобу разбирает ИИ, а спорные случаи передаются человеку.
    const complaint = await db.complaint.create({
      data: {
        messageId: id,
        category,
        comment,
        reporterName: guard.reporterName ?? "",
        reporterId: guard.reporterId ?? null,
        aiVerdict: "",
        aiNote: "",
      },
    });

    // ИИ-проверка выполняется в фоне: пользователь сразу получает подтверждение.
    after(async () => {
      try {
        let verdict = "";
        let note = "";

        // ПРОМТ №1: рейд-детектор. Если ≥ 3 жалоб от связанных аккаунтов —
        // помечаем как рейд, контент НЕ скрываем автоматически.
        const raid = await detectRaid("complaint", "messageId", id);
        if (raid.isRaid) {
          await db.complaint
            .updateMany({
              where: { messageId: id },
              data: { aiNote: "Внимание: возможно скоординированная травля (рейд)." },
            })
            .catch(() => {});
        }

        if (message.isHiddenByAi) {
          // Сообщение уже скрыто ИИ ранее — повторная проверка не требуется.
          verdict = "violation";
          note = "сообщение уже скрыто ИИ-модерацией ранее";
        } else {
          const outcome = await moderatePublishedText(message.body);
          if (outcome.action === "hide") {
            await db.message.update({
              where: { id },
              data: {
                isHiddenByAi: true,
                hiddenReason: outcome.hiddenReason ?? "нарушение правил форума",
                aiNote: outcome.aiNote ?? "",
                aiStatus: "hidden",
                needHuman: false,
              },
            });
            verdict = "violation";
            note = `ИИ подтвердил нарушение: ${outcome.hiddenReason ?? ""}`;

            // ШАГ 11: нарушение подтверждено — мягкая лестница санкций автору.
            // Серьёзные категории автоматически не ограничивают аккаунт:
            // решение об ограничении принимает человек-модератор.
            if (message.authorId) {
              try {
                const violation = await handleConfirmedViolation({
                  userId: message.authorId,
                  messageId: message.id,
                  topicId: message.topicId,
                  category: outcome.category ?? "other",
                  reason: outcome.hiddenReason ?? "нарушение правил форума",
                });
                if (violation.needsHumanDecision) {
                  await db.message
                    .update({ where: { id }, data: { needHuman: true } })
                    .catch(() => {});
                }
              } catch (sErr) {
                console.error("[complaint sanction ladder]", sErr);
              }
            }
          } else if (outcome.needHuman) {
            // Спорный/неоднозначный случай — решение за человеком-модератором.
            await db.message.update({
              where: { id },
              data: {
                needHuman: true,
                aiNote: outcome.aiNote ?? "спорный случай по жалобе",
                aiStatus: "human",
              },
            });
            verdict = "ambiguous";
            note = outcome.aiNote ?? "спорный случай — передан человеку-модератору";
          } else {
            // ИИ не нашёл нарушения. Жалоба остаётся в очереди — финальное
            // решение за человеком, но авто-блокировки по количеству жалоб нет.
            verdict = "ok";
            note = outcome.aiNote ?? "ИИ нарушений не нашёл";
          }
        }

        await db.complaint.update({
          where: { id: complaint.id },
          data: { aiVerdict: verdict, aiNote: note },
        });
      } catch (err) {
        console.error("[complaint ai review]", err);
        await db.complaint
          .update({
            where: { id: complaint.id },
            data: {
              aiVerdict: "ambiguous",
              aiNote: "ИИ-проверка не удалась — требуется решение человека-модератора",
            },
          })
          .catch(() => {});
      }
    });

    return NextResponse.json({ ok: true, note: COMPLAINT_CONFIRM_MESSAGE });
  } catch (e) {
    return handleApiError(e);
  }
}
