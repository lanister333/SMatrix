/**
 * ШАГ 20. Изменение публикации «Рекомендую / Не рекомендую» — только автором.
 * Действия (action):
 *  — edit    — изменить субъект/заголовок/текст/место (с повторной ИИ-проверкой);
 *  — delete  — удалить свою публикацию (исчезает из общей ленты; связанная тема
 *              форума не удаляется, состояние кнопки — «Тема в архиве»);
 *  — stance  — изменить позицию (Рекомендую ↔ Не рекомендую).
 * Другие пользователи не могут менять чужую публикацию (403).
 * Никаких рейтингов/лайков/кармы.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { moderateNewRecommendText } from "@/lib/moderation/recommend";
// ТЗ 2026-09-22: первая линия автоматической пре-модерации (ярлыки/личные
// данные → вернуть автору с подсказкой; капслок/мат/угрозы → блок).
import { premoderateReviewText } from "@/lib/moderation/premoderation";

export const runtime = "nodejs";
export const maxDuration = 60;

const ACTIONS = new Set(["edit", "delete", "stance", "resolve"]);
const STANCES = new Set(["recommend", "notrecommend"]);

/**
 * ТЗ 2026-09-24 «Обсудить на форуме из отзыва»: публичный GET одной
 * публикации по её cuid. Используется страницей рубрики форума
 * (/forum/category/<slug>?new=1&postId=...) для предзаполнения формы
 * создания новой темы: подтягивает заголовок и текст отзыва, чтобы
 * пользователь не вставлял их вручную.
 *
 * Возвращает поля, нужные форме: subject, title, text, place, authorName,
 * createdAt, stance, topicId (если уже есть связанная тема). Удалённые
 * отзывы отдаются как 404 — не показываем даже автору.
 *
 * Авторизация НЕ требуется — это публичные данные ленты (как в GET /api/recommend).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const post = await db.recPost.findUnique({
      where: { id },
      select: {
        id: true,
        subject: true,
        title: true,
        text: true,
        place: true,
        authorName: true,
        createdAt: true,
        stance: true,
        topicId: true,
        isDeleted: true,
        isHiddenByAi: true,
      },
    });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
    }
    // Если ИИ скрыл отзыв — не отдаём его для предзаполнения (как в ленте).
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

    const post = await db.recPost.findUnique({ where: { id } });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
    }

    // Редактировать, удалять и менять позицию может только автор.
    if (post.authorId !== user.id) {
      return NextResponse.json(
        { error: "Изменить публикацию может только её автор" },
        { status: 403 }
      );
    }

    if (action === "delete") {
      await db.recPost.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() },
      });
      return NextResponse.json({ ok: true, note: "Публикация удалена" });
    }

    if (action === "stance") {
      const stance = String(body.stance ?? "");
      if (!STANCES.has(stance)) {
        return NextResponse.json({ error: "Неизвестная позиция" }, { status: 400 });
      }
      await db.recPost.update({
        where: { id },
        data: { stance, stanceAt: new Date() },
      });
      const notes: Record<string, string> = {
        recommend: "Позиция изменена: «Рекомендую»",
        notrecommend: "Позиция изменена: «Не рекомендую»",
      };
      return NextResponse.json({ ok: true, stance, note: notes[stance] ?? "" });
    }

    // 29.09.2026: «Вопрос решён» — автор публикации отмечает проблему
    // решённой (или снимает отметку). Только владелец сообщения (проверка
    // авторства выше — action разрешён только автору).
    if (action === "resolve") {
      const resolved = !!body.resolved;
      await db.recPost.update({
        where: { id },
        data: { resolved, resolvedAt: resolved ? new Date() : null },
      });
      return NextResponse.json({
        ok: true,
        resolved,
        note: resolved ? "Отмечено как решённая" : "Отметка «решено» снята",
      });
    }

    // action === "edit"
    const subject = String(body.subject ?? post.subject).trim().slice(0, 120);
    const title = String(body.title ?? "").trim();
    const text = String(body.text ?? body.body ?? "").trim();
    const place = String(body.place ?? "").trim().slice(0, 80);
    // ТЗ 2026-09-21 (Пункт 6 Манифеста): правка выделения человека — как у остальных полей.
    const humanHighlight = String(body.humanHighlight ?? post.humanHighlight).trim().slice(0, 600);

    if (subject.length < 2) {
      return NextResponse.json({ needsSubject: true, hint: "Укажите, кого вы рекомендуете или не рекомендуете." }, { status: 422 });
    }
    if (title.length < 5 || title.length > 150) {
      return NextResponse.json({ error: "Заголовок должен быть от 5 до 150 символов" }, { status: 400 });
    }
    if (text.length < 10 || text.length > 8000) {
      return NextResponse.json({ error: "Текст публикации: от 10 до 8000 символов" }, { status: 400 });
    }

    // ТЗ 2026-09-22: ПЕРВАЯ ЛИНИЯ пре-модерации — и при правке отзыва
    // (ярлыки/личные данные → вернуть с подсказкой; капслок/мат/угрозы → блок).
    const pre = premoderateReviewText({ subject, title, text, place, humanHighlight });
    if (pre.verdict === "return") {
      return NextResponse.json(
        { premoderation: "return", rule: pre.rule, hint: pre.message, error: pre.message },
        { status: 422 }
      );
    }
    if (pre.verdict === "block") {
      return NextResponse.json(
        { premoderation: "block", rule: pre.rule, error: pre.message },
        { status: 400 }
      );
    }

    const outcome = await moderateNewRecommendText(subject, post.stance, title, text, place, humanHighlight);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    await db.recPost.update({
      where: { id },
      data: {
        subject,
        title,
        text,
        place,
        humanHighlight,
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
        ? `Публикация скрыта ИИ-модерацией после правки: ${outcome.hiddenReason ?? "нарушение правил"}.`
        : outcome.needHuman
          ? "Правка отправлена на дополнительную проверку человеку-модератору."
          : "Публикация обновлена";

    return NextResponse.json({ ok: true, hidden: outcome.action === "hide", note });
  } catch (e) {
    return handleApiError(e);
  }
}
