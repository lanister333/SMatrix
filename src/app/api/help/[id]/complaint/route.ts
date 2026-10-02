/**
 * ШАГ 16. Жалоба на объявление раздела «Нужна помощь».
 * Причины (по ТЗ): мошенничество; скрытая платная услуга; реклама; спам;
 * чужие персональные данные; запрещённое содержание; другое нарушение.
 * Жалоба — не голосование: количество не показывается и не создаёт рейтинг.
 * Пользователь сразу получает подтверждение, ИИ-проверка идёт в фоне;
 * спорные случаи видит человек-модератор (через /api/admin/help).
 */

import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";
import { moderatePublishedHelpText, HELP_COMPLAINT_CATEGORIES } from "@/lib/moderation/help";
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

    if (!HELP_COMPLAINT_CATEGORIES.includes(category as (typeof HELP_COMPLAINT_CATEGORIES)[number])) {
      return NextResponse.json({ error: "Выберите причину жалобы" }, { status: 400 });
    }
    const publication = await db.helpPublication.findUnique({ where: { id } });
    if (!publication || publication.isDeleted) {
      return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
    }

    // ПРОМТ №1: rate-limit + уникальность + рейд-детектор.
    const guard = await checkComplaintAllowed(req, token || null, false);
    if (!guard.allowed || guard.response) return guard.response!;
    if (guard.reporterId && (await hasAlreadyComplained("helpComplaint", { publicationId: id, reporterId: guard.reporterId }))) {
      return NextResponse.json({ error: "Вы уже жаловались на эту публикацию" }, { status: 409 });
    }

    // Жалоба создаётся всегда. Количество жалоб само по себе НЕ является
    // нарушением, не показывается пользователям и не создаёт рейтинг:
    // каждую жалобу разбирает ИИ, спорные случаи видит человек.
    const complaint = await db.helpComplaint.create({
      data: {
        publicationId: id,
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
        const raid = await detectRaid("helpComplaint", "publicationId", id);
        if (raid.isRaid) {
          await db.helpComplaint.updateMany({
            where: { publicationId: id },
            data: { aiNote: "Внимание: возможно скоординированная травля (рейд)." },
          }).catch(() => {});
        }
        let verdict = "";
        let note = "";

        if (publication.isHiddenByAi) {
          verdict = "violation";
          note = "публикация уже скрыта ИИ-модерацией ранее";
        } else {
          const outcome = await moderatePublishedHelpText(publication.title, publication.text, publication.contactData);
          if (outcome.action === "hide") {
            await db.helpPublication.update({
              where: { id },
              data: {
                isHiddenByAi: true,
                hiddenReason: outcome.hiddenReason ?? "нарушение правил раздела",
                aiNote: outcome.aiNote ?? "",
                aiStatus: "hidden",
                needHuman: false,
              },
            });
            verdict = "violation";
            note = `ИИ подтвердил нарушение: ${outcome.hiddenReason ?? ""}`;

            // Нарушение подтверждено — мягкая лестница санкций автору
            // (серьёзные категории автоматически не ограничивают аккаунт:
            // решение об ограничении принимает человек-модератор).
            if (publication.authorId) {
              try {
                const violation = await handleConfirmedViolation({
                  userId: publication.authorId,
                  category: outcome.category ?? "other",
                  reason: outcome.hiddenReason ?? "нарушение правил раздела «Нужна помощь»",
                });
                if (violation.needsHumanDecision) {
                  await db.helpPublication
                    .update({ where: { id }, data: { needHuman: true } })
                    .catch(() => {});
                }
                note += ` ${violation.note}`;
              } catch {}
            }
          } else if (outcome.action === "human" || outcome.needHuman) {
            verdict = "ambiguous";
            note = outcome.aiNote ?? "спорный случай — рассмотрит человек-модератор";
            await db.helpPublication.update({ where: { id }, data: { needHuman: true } }).catch(() => {});
          } else {
            verdict = "ok";
            note = outcome.aiNote ?? "нарушений не найдено";
          }
        }

        await db.helpComplaint.update({
          where: { id: complaint.id },
          data: { aiVerdict: verdict, aiNote: note },
        });
      } catch {
        // ИИ недоступен: жалоба остаётся нерешённой и видна человеку-модератору.
        await db.helpComplaint
          .update({
            where: { id: complaint.id },
            data: { aiVerdict: "pending", aiNote: "ИИ недоступен — требуется проверка человеком" },
          })
          .catch(() => {});
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
