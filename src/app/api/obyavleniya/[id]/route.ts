/**
 * ШАГ 22 (восстановление). Изменение объявления — только автором.
 * Действия (action):
 *  — edit    — изменить заголовок/текст/цену/контакты/место/рубрику
 *              (с повторной ИИ-проверкой);
 *  — delete  — удалить своё объявление (исчезает из общей ленты);
 *  — status  — сменить статус:
 *                closed — «Снято с публикации» (товар продан/услуга больше
 *                         не оказывается; объявление остаётся в разделе
 *                         ниже актуальных — история);
 *                active — снова «Актуально».
 * Другие пользователи не могут менять чужое объявление (403).
 * Никаких рейтингов/лайков/комментариев — связь по контактам из объявления.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { moderateNewAdListingText } from "@/lib/moderation/obyavleniya";
import { AD_RUBRIC_KEYS } from "@/lib/obyavleniya";

export const runtime = "nodejs";
export const maxDuration = 60;

const ACTIONS = new Set(["edit", "delete", "status"]);
// 29.09.2026: добавлен статус "resolved" — «Вопрос решён» (виден только автору).
// После resolved объявление уходит в архив (показывается серым ниже активных).
const STATUSES = new Set(["active", "closed", "resolved"]);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { token, action } = body;

    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json({ error: "Доступно только зарегистрированным пользователям" }, { status: 401 });
    }
    if (!ACTIONS.has(String(action))) {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }

    const post = await db.adListing.findUnique({ where: { id } });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Объявление не найдено" }, { status: 404 });
    }

    // Редактировать, удалять и менять статус может только автор.
    if (post.authorId !== user.id) {
      return NextResponse.json(
        { error: "Изменить объявление может только его автор" },
        { status: 403 }
      );
    }

    if (action === "delete") {
      await db.adListing.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() },
      });
      return NextResponse.json({ ok: true, note: "Объявление удалено" });
    }

    if (action === "status") {
      const status = String(body.status ?? "");
      if (!STATUSES.has(status)) {
        return NextResponse.json({ error: "Неизвестный статус" }, { status: 400 });
      }
      await db.adListing.update({
        where: { id },
        data: { status, statusAt: new Date() },
      });
      const notes: Record<string, string> = {
        closed: "Объявление снято с публикации. Оно останется в разделе — так покупатели увидят, что предложение уже не актуально.",
        active: "Объявление снова актуально",
        resolved: "Вопрос решён — объявление ушло в архив.",
      };
      return NextResponse.json({ ok: true, status, note: notes[status] ?? "" });
    }

    // action === "edit"
    const rubric = String(body.rubric ?? "").trim();
    const title = String(body.title ?? "").trim();
    const text = String(body.text ?? body.body ?? "").trim();
    const price = String(body.price ?? "").trim().slice(0, 80);
    const contact = String(body.contact ?? "").trim().slice(0, 200);
    const place = String(body.place ?? "").trim().slice(0, 80);

    if (!AD_RUBRIC_KEYS.has(rubric)) {
      return NextResponse.json(
        { error: "Выберите одну из восьми рубрик" },
        { status: 400 }
      );
    }
    if (title.length < 5 || title.length > 150) {
      return NextResponse.json({ error: "Заголовок должен быть от 5 до 150 символов" }, { status: 400 });
    }
    if (text.length < 10 || text.length > 8000) {
      return NextResponse.json({ error: "Текст объявления: от 10 до 8000 символов" }, { status: 400 });
    }

    const outcome = await moderateNewAdListingText(rubric, title, text, price, contact, place);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    await db.adListing.update({
      where: { id },
      data: {
        rubric,
        title,
        text,
        price,
        contact,
        place,
        editedAt: new Date(),
        aiStatus: outcome.action === "hide" ? "hidden" : outcome.action === "human" ? "human" : "ok",
        aiNote: outcome.aiNote ?? "",
        isHiddenByAi: outcome.action === "hide",
        hiddenReason: outcome.hiddenReason ?? "",
        needHuman: outcome.needHuman,
      },
    });

    const note =
      outcome.action === "hide"
        ? `Объявление скрыто ИИ-модерацией после правки: ${outcome.hiddenReason ?? "нарушение правил"}.`
        : outcome.needHuman
          ? "Правка отправлена на дополнительную проверку человеку-модератору."
          : "Объявление обновлено";

    return NextResponse.json({ ok: true, hidden: outcome.action === "hide", note });
  } catch (e) {
    return handleApiError(e);
  }
}
