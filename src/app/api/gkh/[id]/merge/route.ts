/**
 * ШАГ 19 (ТЗ п.9). Объединение одинаковых проблем (доступно только
 * администратору/модератору).
 *
 * Если несколько жителей независимо опубликовали одну и ту же проблему,
 * их объединяют в одну общую историю, а не создают множество одинаковых
 * карточек. На уровне создания похожие проблемы ловит мягкое предупреждение
 * (POST /api/gkh → similar), окончательное решение о объединении принимает
 * человек-модератор (ТЗ п.9).
 *
 * POST { duplicateOfId } — проблема id становится дубликатом duplicateOfId:
 *  — обновления, медиа, жалобы и журнал статусов переезжают в общую историю;
 *  — если у дубликата была форумная тема, а у общей — нет, тема переезжает
 *    (одна проблема = одна тема сохраняется);
 *  — дубликат помечается mergedIntoId и исчезает из лент (повторное
 *    объединение уже объединённого невозможно — ТЗ п.28);
 *  — после объединения жители могут добавлять обновления к общей истории.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";
import { requireStaff, logAdminAction } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const staff = await requireStaff(body.token);

    const duplicateOfId = String(body.duplicateOfId ?? "");
    if (!duplicateOfId) {
      return NextResponse.json({ error: "Не указана общая проблема для объединения" }, { status: 400 });
    }
    if (duplicateOfId === id) {
      return NextResponse.json({ error: "Нельзя объединить проблему с самой собой" }, { status: 400 });
    }

    const [dup, target] = await Promise.all([
      db.gkhProblem.findUnique({ where: { id } }),
      db.gkhProblem.findUnique({ where: { id: duplicateOfId } }),
    ]);
    if (!dup || dup.isDeleted) {
      return NextResponse.json({ error: "Дубликат не найден" }, { status: 404 });
    }
    if (!target || target.isDeleted) {
      return NextResponse.json({ error: "Общая проблема не найдена" }, { status: 404 });
    }
    // ТЗ п.28: повторное объединение уже объединённых проблем невозможно.
    if (dup.mergedIntoId) {
      return NextResponse.json({ error: "Эта проблема уже объединена" }, { status: 409 });
    }
    if (target.mergedIntoId) {
      return NextResponse.json({ error: "Общая проблема сама является объединённой — укажите каноническую публикацию" }, { status: 409 });
    }

    await db.$transaction(async (tx) => {
      // Обновления, медиа и статусы дубликата переезжают в общую историю.
      await tx.gkhUpdate.updateMany({ where: { problemId: dup.id }, data: { problemId: target.id } });
      await tx.gkhStatusLog.updateMany({ where: { problemId: dup.id }, data: { problemId: target.id } });
      await tx.gkhMedia.updateMany({ where: { problemId: dup.id }, data: { problemId: target.id } });
      await tx.gkhComplaint.updateMany({ where: { problemId: dup.id }, data: { problemId: target.id } });

      // Форумная тема: если у дубликата была тема, а у общей — нет,
      // переносим её; «одна проблема = максимум одна тема» сохраняется.
      if (dup.topicId && !target.topicId) {
        await tx.gkhProblem.update({ where: { id: target.id }, data: { topicId: dup.topicId } });
        await tx.gkhProblem.update({ where: { id: dup.id }, data: { topicId: null } });
      }

      // Дубликат помечается и исчезает из лент (история сохраняется технически).
      await tx.gkhProblem.update({ where: { id: dup.id }, data: { mergedIntoId: target.id } });
    });

    await logAdminAction({
      actor: staff.nickname,
      actorRole: staff.role,
      action: "gkh.merge",
      targetType: "gkh_problem",
      targetLabel: `«${dup.title}» → «${target.title}»`,
      details: "Объединение дубликатов проблем ЖКХ",
    });

    return NextResponse.json({
      ok: true,
      note: "Проблемы объединены в одну общую историю",
      targetId: target.id,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
