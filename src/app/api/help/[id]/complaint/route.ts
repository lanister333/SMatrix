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

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const category = String(body.category ?? "");
    const comment = String(body.comment ?? "").trim().slice(0, 1000);
    const reporterName = String(body.reporterName ?? "").trim().slice(0, 40);

    if (!HELP_COMPLAINT_CATEGORIES.includes(category as (typeof HELP_COMPLAINT_CATEGORIES)[number])) {
      return NextResponse.json({ error: "Выберите причину жалобы" }, { status: 400 });
    }
    const publication = await db.helpPublication.findUnique({ where: { id } });
    if (!publication || publication.isDeleted) {
      return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
    }

    // Жалоба создаётся всегда. Количество жалоб само по себе НЕ является
    // нарушением, не показывается пользователям и не создаёт рейтинг:
    // каждую жалобу разбирает ИИ, спорные случаи видит человек.
    const complaint = await db.helpComplaint.create({
      data: {
        publicationId: id,
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
