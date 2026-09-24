/**
 * ШАГ 23 (ТЗ п.14). Изменение вопроса «Где дешевле» — только автором.
 * Действия (action):
 *  — edit    — изменить заголовок/текст/место (с повторной проверкой
 *              конкретности, нескольких товаров и ИИ-проверкой);
 *  — delete  — удалить свой вопрос (исчезает из общей ленты; связанная тема
 *              форума не удаляется, состояние кнопки — «Тема в архиве»,
 *              к «Обсудить на форуме» кнопка не возвращается);
 *  — status  — сменить статус вопроса (ТЗ п.12/14):
 *                cheaper    — «Нашёл дешевле»;
 *                irrelevant — «Неактуально»;
 *                comparing  — снова «Сравниваю».
 * Публикации со статусами «Нашёл дешевле» и «Неактуально» НЕ удаляются
 * автоматически — остаются в разделе и доступны через поиск (ТЗ п.13/28).
 * Другие пользователи не могут менять чужой вопрос (403).
 * Никаких рейтингов/лайков/кармы (п.29).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { moderateNewGdedeshevleText } from "@/lib/moderation/gdedeshevle";
import { CD_SPECIFIC_HINT, CD_MULTIPLE_HINT, isMultipleProducts, isTooGeneric } from "@/lib/gdedeshevle";
import { findPhoneNumbers } from "@/lib/moderation/premoderation";
import { findEmotionalLabels } from "@/lib/moderation/wheretobuy-hint-premoderation";

export const runtime = "nodejs";
export const maxDuration = 60;

const ACTIONS = new Set(["edit", "delete", "status", "answer"]);
const STATUSES = new Set(["comparing", "cheaper", "irrelevant", "fixed"]);

/**
 * ТЗ 2026-09-24 «Обсудить на форуме из вопроса»: публичный GET одного
 * вопроса «Где дешевле» по cuid. Используется страницей рубрики форума
 * (/forum/category/<slug>?new=1&postId=...&kind=gdedeshevle) для
 * предзаполнения формы новой темы: подтягивает заголовок и текст вопроса.
 *
 * Возвращает поля, нужные форме: title, text, place, authorName, createdAt,
 * status, topicId, isDeleted, isHiddenByAi. Удалённые вопросы → 404,
 * скрытые ИИ → 410. Авторизация НЕ требуется — это публичные данные ленты.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const post = await db.cheapPost.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        text: true,
        place: true,
        authorName: true,
        createdAt: true,
        status: true,
        topicId: true,
        isDeleted: true,
        isHiddenByAi: true,
      },
    });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Вопрос не найден" }, { status: 404 });
    }
    if (post.isHiddenByAi) {
      return NextResponse.json({ error: "Публикация недоступна" }, { status: 410 });
    }
    return NextResponse.json(post);
  } catch (e) {
    return handleApiError(e);
  }
}

/** ТЗ 2026-09-23 «ИИ-ФИЛЬТР (обязательно)»: серая плашка — ДОСЛОВНЫЙ текст
 *  заказчика; сервер возвращает её текст прямым вызовам API. */
const FILTER_PLAQUE_TEXT =
  "Сообщение отклонено фильтром главной страницы. На главной странице запрещено публиковать личные мобильные телефоны и субъективные споры. Вы можете опубликовать этот текст на форуме.";

/** Тема-приёмник «Товары и услуги ▸ Цены» (запасной ИД, как на клиенте). */
const FALLBACK_TRANSFER_TOPIC_ID = 178;

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

    const post = await db.cheapPost.findUnique({ where: { id } });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Вопрос не найден" }, { status: 404 });
    }

    // ТЗ 2026-09-23 «Ответить»: ответов может быть СКОЛЬКО УГОДНО — каждый
    // новый ответ ДОБАВЛЯЕТСЯ В ПЛОСКИЙ СПИСОК на карточке (без вложенности
    // и ответов на ответ — споры уходят на форум). Как только у карточки
    // есть хотя бы один ответ — статус «Цена зафиксирована» (правило 4 ТЗ);
    // ответы продолжают добавляться и после этого.
    if (action === "answer") {
      const answerText = String(body.answerText ?? body.text ?? "").trim().slice(0, 300);
      if (answerText.length < 3) {
        return NextResponse.json(
          { error: "Опишите сухой факт: цену, магазин и ориентир (от 3 символов)." },
          { status: 400 }
        );
      }
      // ИИ-ФИЛЬТР (обязательно): телефоны и плохие слова блокируют публикацию —
      // тот же движок, что на клиенте и на Главной. Текст НЕ сохраняется.
      const phones = findPhoneNumbers(answerText);
      const labels = findEmotionalLabels(answerText);
      if (phones.length > 0 || labels.length > 0) {
        return NextResponse.json(
          {
            error: FILTER_PLAQUE_TEXT,
            filtered: true,
            forumHref: `/forum/topic/${FALLBACK_TRANSFER_TOPIC_ID}?prefilled_text=${encodeURIComponent(answerText)}`,
          },
          { status: 400 }
        );
      }
      const hadAnswers = (await db.cheapAnswer.count({ where: { postId: id } })) > 0;
      await db.cheapAnswer.create({
        data: { postId: id, text: answerText, authorName: user.nickname },
      });
      const becameFixed = post.status !== "fixed";
      if (becameFixed) {
        await db.cheapPost.update({
          where: { id },
          data: { status: "fixed", statusAt: new Date() },
        });
      }
      return NextResponse.json({
        ok: true,
        status: "fixed",
        note: hadAnswers
          ? "Ответ опубликован в списке на карточке."
          : "Ответ принят: статус вопроса — «Цена зафиксирована». Ответ добавлен в список на карточке.",
      });
    }

    // Редактировать, удалять и менять статус может только автор (ТЗ п.14).
    if (post.authorId !== user.id) {
      return NextResponse.json(
        { error: "Изменить вопрос может только его автор" },
        { status: 403 }
      );
    }

    if (action === "delete") {
      await db.cheapPost.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() },
      });
      return NextResponse.json({ ok: true, note: "Вопрос удалён" });
    }

    if (action === "status") {
      const status = String(body.status ?? "");
      if (!STATUSES.has(status)) {
        return NextResponse.json({ error: "Неизвестный статус" }, { status: 400 });
      }
      await db.cheapPost.update({
        where: { id },
        data: { status, statusAt: new Date() },
      });
      const notes: Record<string, string> = {
        comparing: "Вопрос снова открыт — статус «Сравниваю»",
        cheaper: "Отлично! Статус вопроса — «Нашёл дешевле». Вопрос останется в разделе как подсказка другим.",
        irrelevant: "Статус вопроса — «Неактуально». Вопрос останется в разделе.",
      };
      return NextResponse.json({ ok: true, status, note: notes[status] ?? "" });
    }

    // action === "edit"
    const title = String(body.title ?? "").trim();
    const text = String(body.text ?? body.body ?? "").trim();
    const place = String(body.place ?? "").trim().slice(0, 80);

    if (title.length < 5 || title.length > 150) {
      return NextResponse.json({ error: "Заголовок должен быть от 5 до 150 символов" }, { status: 400 });
    }
    if (text.length < 10 || text.length > 8000) {
      return NextResponse.json({ error: "Текст вопроса: от 10 до 8000 символов" }, { status: 400 });
    }

    // При правке снова проверяем конкретность и «один вопрос — один товар» (ТЗ п.2/3/4).
    if (isTooGeneric(title, text)) {
      return NextResponse.json({ needsSpecific: true, hint: CD_SPECIFIC_HINT }, { status: 422 });
    }
    if (isMultipleProducts(title, text)) {
      return NextResponse.json({ needsSpecific: true, hint: CD_MULTIPLE_HINT, multiple: true }, { status: 422 });
    }

    const outcome = await moderateNewGdedeshevleText(title, text, place);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    await db.cheapPost.update({
      where: { id },
      data: {
        title,
        text,
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
        ? `Вопрос скрыт ИИ-модерацией после правки: ${outcome.hiddenReason ?? "нарушение правил"}.`
        : outcome.needHuman
          ? "Правка отправлена на дополнительную проверку человеку-модератору."
          : "Вопрос обновлён";

    return NextResponse.json({ ok: true, hidden: outcome.action === "hide", note });
  } catch (e) {
    return handleApiError(e);
  }
}
