/**
 * ШАГ 19 (ТЗ п.11/12). Официальный ответ организации.
 *
 * Дать ответ может ТОЛЬКО подтверждённый представитель организации
 * (User.orgRep — статус устанавливает только администратор; простого
 * заявления «я директор» недостаточно, ТЗ п.11). Обычный пользователь не
 * может присвоить себе официальный статус представителя.
 *
 * Представитель может дать ОДИН официальный публичный ответ (ТЗ п.12):
 * официальная позиция, пояснение обстоятельств, ход работ, план решения.
 * После ответа бесконечная публичная переписка внутри публикации не
 * ведётся. Ответ организации НЕ меняет статус «Решено» автоматически
 * (ТЗ п.3) и не означает, что SakhMatrix принимает чью-то сторону.
 * Разногласие сторон само по себе не является основанием для удаления.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import { restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction } from "@/lib/moderation/sanctions";
import { moderateNewGkhText } from "@/lib/moderation/gkh";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { token } = body;

    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json(
        { error: "Чтобы ответить — войдите в аккаунт." },
        { status: 401 }
      );
    }

    // ТЗ п.11: статус представителя подтверждается отдельно; обычный
    // пользователь не может присвоить его себе.
    if (!user.orgRep) {
      return NextResponse.json(
        { error: "Официальный ответ может дать только подтверждённый представитель организации. Статус представителя подтверждается администратором." },
        { status: 403 }
      );
    }

    const restriction = await getActiveRestriction(user.id);
    if (restriction) {
      return NextResponse.json(
        { error: restrictionBlockMessage(restriction), restricted: true, restriction },
        { status: 403 }
      );
    }

    if (!rateLimit(`gkh-orgresp:${user.id}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Слишком много действий за час. Попробуйте позже." }, { status: 429 });
    }

    const problem = await db.gkhProblem.findUnique({ where: { id } });
    if (!problem || problem.isDeleted) {
      return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
    }

    // ТЗ п.12: РОВНО ОДИН официальный публичный ответ на проблему.
    if (problem.orgResponseAt) {
      return NextResponse.json(
        { error: "Официальный ответ по этой проблеме уже дан" },
        { status: 409 }
      );
    }

    const text = String(body.text ?? "").trim();
    if (text.length < 10 || text.length > 4000) {
      return NextResponse.json({ error: "Текст ответа: от 10 до 4000 символов" }, { status: 400 });
    }

    // Ответ организации проходит ту же модерацию; критика в ответе и
    // разъяснения — не нарушение (ТЗ п.18).
    const outcome = await moderateNewGkhText("официальный ответ организации", problem.title, text);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    await db.gkhProblem.update({
      where: { id },
      data: {
        orgResponseText: text,
        orgResponseAt: new Date(),
        orgResponseById: user.id,
        orgResponseByName: user.nickname,
        // Если организация ещё не указана — записываем организацию представителя.
        organization: problem.organization || user.orgName || problem.organization,
        aiStatus: outcome.action === "hide" ? "hidden" : outcome.action === "human" ? "human" : "ok",
        aiNote: outcome.aiNote ?? "",
        needHuman: outcome.needHuman,
        // ВАЖНО (ТЗ п.3): ответ организации сам по себе НЕ устанавливает
        // статус «Решено» — статус меняет автор или модератор.
      },
    });

    return NextResponse.json({
      ok: true,
      note: "Официальный ответ опубликован в истории проблемы. Спасибо!",
      hidden: outcome.action === "hide",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
