/**
 * ТЗ 2026-09-23 «О работодателях» (Flat 2.0) — изменение карточки трудового
 * опыта — только автором. Действия (action):
 *  — edit    — изменить компанию/город/период/опыт/упоминание человека
 *              (с повторной проверкой: лексика → ИИ-фильтр лозунгов → ИИ);
 *  — delete  — удалить свою карточку (исчезает из общей ленты; связанная
 *              тема форума не удаляется, состояние кнопки — «Тема в архиве»).
 * Прежнее действие stance («Советую ↔ Не советую») удалено вместе с позициями:
 * раздел фиксирует сухой факт опыта без вердиктов (Пункты 5/6 ТЗ №2).
 * Другие пользователи не могут менять чужую карточку (403).
 * Никаких рейтингов/лайков/кармы.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { moderateNewEmployersText } from "@/lib/moderation/employers";
import { EP_EMPLOYER_HINT } from "@/lib/employers";

export const runtime = "nodejs";
export const maxDuration = 60;

const ACTIONS = new Set(["edit", "delete"]);

/**
 * ТЗ 2026-09-24 «Обсудить на форуме из трудового опыта»: публичный GET
 * одной карточки «О работодателях» по cuid. Используется страницей рубрики
 * форума (/forum/category/<slug>?new=1&postId=...&kind=employers) для
 * предзаполнения формы новой темы: подтягивает название организации, город,
 * период работы, личный опыт и упоминание человека.
 *
 * Возвращает поля, нужные форме: employer, city, workPeriod, experience,
 * personMention, authorName, createdAt, topicId, isDeleted, isHiddenByAi.
 * Удалённые карточки → 404, скрытые ИИ → 410. Авторизация НЕ требуется —
 * это публичные данные ленты.
 *
 * ВАЖНО: EmpPost также содержит legacy-поля position/stance/title/text —
 * они НЕ возвращаются этим GET, чтобы форма строилась из новых полей
 * Flat 2.0 (employer/workPeriod/experience/personMention), а не из
 * устаревшего формата «Советую/Не советую».
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const post = await db.empPost.findUnique({
      where: { id },
      select: {
        id: true,
        employer: true,
        city: true,
        workPeriod: true,
        experience: true,
        personMention: true,
        authorName: true,
        createdAt: true,
        topicId: true,
        isDeleted: true,
        isHiddenByAi: true,
      },
    });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Карточка не найдена" }, { status: 404 });
    }
    if (post.isHiddenByAi) {
      return NextResponse.json({ error: "Публикация недоступна" }, { status: 410 });
    }
    return NextResponse.json(post);
  } catch (e) {
    return handleApiError(e);
  }
}

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

    const post = await db.empPost.findUnique({ where: { id } });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Карточка опыта не найдена" }, { status: 404 });
    }

    // Редактировать и удалять может только автор.
    if (post.authorId !== user.id) {
      return NextResponse.json(
        { error: "Изменить карточку может только её автор" },
        { status: 403 }
      );
    }

    if (action === "delete") {
      await db.empPost.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() },
      });
      return NextResponse.json({ ok: true, note: "Карточка опыта удалена" });
    }

    // action === "edit"
    const employer = String(body.employer ?? post.employer).trim().slice(0, 120);
    const city = String(body.city ?? post.city).trim().slice(0, 80);
    const workPeriod = String(body.workPeriod ?? post.workPeriod).trim().slice(0, 120);
    const experience = String(body.experience ?? "").trim();
    const personMention = String(body.personMention ?? post.personMention ?? "").trim().slice(0, 2000);

    if (employer.length < 2) {
      return NextResponse.json({ needsEmployer: true, hint: EP_EMPLOYER_HINT }, { status: 422 });
    }
    if (city.length < 2) {
      return NextResponse.json({ error: "Укажите город, где находится организация" }, { status: 400 });
    }
    if (workPeriod.length < 2) {
      return NextResponse.json({ error: "Укажите период работы (например: май – август 2026 г.)" }, { status: 400 });
    }
    if (experience.length < 10 || experience.length > 8000) {
      return NextResponse.json({ error: "Личный опыт: от 10 до 8000 символов" }, { status: 400 });
    }

    const outcome = await moderateNewEmployersText(employer, city, workPeriod, experience, personMention);
    if (outcome.action === "block") {
      return NextResponse.json(
        { error: outcome.blockMessage, rewrite: outcome.source === "slogan" },
        { status: 400 }
      );
    }

    await db.empPost.update({
      where: { id },
      data: {
        employer,
        city,
        workPeriod,
        experience,
        personMention,
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
        ? `Карточка скрыта ИИ-модерацией после правки: ${outcome.hiddenReason ?? "нарушение правил"}.`
        : outcome.needHuman
          ? "Правка отправлена на дополнительную проверку человеку-модератору."
          : "Карточка опыта обновлена";

    return NextResponse.json({ ok: true, hidden: outcome.action === "hide", note });
  } catch (e) {
    return handleApiError(e);
  }
}
