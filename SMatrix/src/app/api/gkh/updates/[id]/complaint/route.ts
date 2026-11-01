/**
 * ШАГ 19 (ТЗ п.17). Жалоба на обновление жителя в проблеме «ЖКХ и городские
 * проблемы». Причины — те же восемь (ТЗ п.17). Жалоба — сигнал для модерации,
 * не голосование; количество жалоб не показывается. Обновление повторно
 * проверяет ИИ в фоне.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";
import { isGkhComplaintCategory } from "@/lib/gkh";
import { moderatePublishedGkhText, gkhSanctionCategory } from "@/lib/moderation/gkh";
import { handleConfirmedViolation } from "@/lib/moderation/sanctions";
import { checkComplaintAllowed, hasAlreadyComplained, detectRaid } from "@/lib/security";
import { notifyAdmin } from "@/lib/notifications";

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
    const update = await db.gkhUpdate.findUnique({ where: { id } });
    if (!update || update.isDeleted) {
      return NextResponse.json({ error: "Обновление не найдено" }, { status: 404 });
    }

    // ПРОМТ №1: rate-limit + уникальность + рейд-детектор.
    const guard = await checkComplaintAllowed(req, token || null, false);
    if (!guard.allowed || guard.response) return guard.response!;
    if (guard.reporterId && (await hasAlreadyComplained("gkhComplaint", { updateId: id, reporterId: guard.reporterId }))) {
      return NextResponse.json({ error: "Вы уже жаловались на эту публикацию" }, { status: 409 });
    }

    const complaint = await db.gkhComplaint.create({
      data: {
        updateId: id,
        problemId: update.problemId,
        category,
        comment,
        reporterName: guard.reporterName ?? safeAnonReporterName(reporterName),
        reporterId: guard.reporterId ?? null,
      },
    });

    // ПРОМТ №1: рейд-детектор + ИИ-проверка выполняются в фоне.
    after(async () => {
      try {
        const raid = await detectRaid("gkhComplaint", "updateId", id);
        if (raid.isRaid) {
          await db.gkhComplaint.updateMany({
            where: { updateId: id },
            data: { aiNote: "Внимание: возможно скоординированная травля (рейд)." },
          }).catch(() => {});
        }
        const outcome = await moderatePublishedGkhText("обновление жителя", "", update.text);
        const verdict =
          outcome.action === "hide" ? "violation" : outcome.action === "human" ? "ambiguous" : "ok";
        await db.gkhComplaint.update({
          where: { id: complaint.id },
          data: { aiVerdict: verdict, aiNote: outcome.aiNote ?? outcome.hiddenReason ?? "" },
        });
        if (outcome.action === "hide") {
          await db.gkhUpdate.update({
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
              userId: update.authorId,
              category: gkhSanctionCategory(outcome.gkhCategory ?? category),
              reason: outcome.hiddenReason ?? "нарушение правил раздела «ЖКХ и городские проблемы»",
            });
          }
        }
      } catch {
        // Фоновая проверка не должна ломать ответ пользователю.
      }
    });

    // Уведомление администратора о новой жалобе.


    notifyAdmin({


      type: "complaint",


      section: "ЖКХ (обновление)",


      title: "Новая жалоба в разделе «ЖКХ (обновление)»",


      details: "Категория: " + category + ".",


    }).catch(() => {});


    return NextResponse.json({
      ok: true,
      note: "Жалоба отправлена. Спасибо. Модерация рассмотрит обновление.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
