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

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const category = String(body.category ?? "");
    const comment = String(body.comment ?? "").trim().slice(0, 1000);
    const reporterName = String(body.reporterName ?? "").trim().slice(0, 40);

    if (!isGkhComplaintCategory(category)) {
      return NextResponse.json({ error: "Выберите причину жалобы" }, { status: 400 });
    }
    const update = await db.gkhUpdate.findUnique({ where: { id } });
    if (!update || update.isDeleted) {
      return NextResponse.json({ error: "Обновление не найдено" }, { status: 404 });
    }

    const complaint = await db.gkhComplaint.create({
      data: {
        updateId: id,
        problemId: update.problemId,
        category,
        comment,
        reporterName,
      },
    });

    after(async () => {
      try {
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

    return NextResponse.json({
      ok: true,
      note: "Жалоба отправлена. Спасибо. Модерация рассмотрит обновление.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
