/**
 * ТЗ 2026-09-22. Быстрые подсказки «Где дешевле» на ГЛАВНОЙ странице
 * SakhMatrix.ru (блок цен) — витрина СУХИХ фактов стоимости, дат и адресов,
 * исключающая базарный шум.
 *
 * GET  — публичная лента последних ценовых подсказок (новые сверху).
 * POST — отправка подсказки (только зарегистрированные). ПЕРЕД записью
 *        работает ПЕРВАЯ ЛИНИЯ пре-модерации
 *        (lib/moderation/gdedeshevle-hint-premoderation.ts):
 *
 *   Кейс А (rule="phones"): паттерны сотовых номеров физлиц («+79…»,
 *   «8-914…») → отправка БЛОКИРУЕТСЯ (422), клиенту возвращается строгая
 *   плашка Flat 2.0 с ДОСЛОВНЫМ текстом заказчика и кнопка переноса;
 *
 *   Кейс Б (rule="labels"): слова-маркеры «барыги», «оборзели», «крутят»,
 *   «с ума сошли», «обдираловка», «грабеж» → БЛОКИРОВКА (422) со своей
 *   плашкой;
 *
 *   пропуск (verdict="pass") — подсказка публикуется в блоке цен на Главной.
 *
 * ТЕХНИЧЕСКИЙ UX-РЕЖИМ (дословно заказчик): «При клике на кнопку переноса,
 * текущий текст пользователя не стирается. Он передается GET/POST-параметром
 * в форму ответа темы форума "Товары и услуги ▸ Цены"». Реализация: ответ
 * блокировки несёт forumUrl — ссылку вида
 * /?topic=<id>&cheapHint=<encodeURIComponent(текст)> в тему-приёмник рубрики
 * «Товары и услуги ▸ Цены» (slug tovary-i-uslugi--ceny). Кнопка — обычная
 * <a>, текст передаётся GET-параметром cheapHint; форма быстрого ответа
 * темы предзаполняется им (topic-view.tsx), текущий текст автора не
 * стирается.
 *
 * Дополнительных линий модерации (ИИ/лексика) на витрине сухих цен НЕТ —
 * заказчиком для этой формы определена ровно эта первая линия (решение
 * задокументировано в worklog; зеркальный механизм — /api/wheretobuy-hints).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import {
  premoderateCheapHint,
  CHEAP_HINT_FORUM_BUTTON_LABEL,
} from "@/lib/moderation/gdedeshevle-hint-premoderation";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Разумная защита от флуда (общий механизм сайта; зеркально wheretobuy-hints). */
const CREATE_LIMIT_PER_HOUR = 30;

/** Подсказка — короткий сухой факт стоимости; 300 хватает примера заказчика. */
const HINT_MIN_LEN = 3;
const HINT_MAX_LEN = 300;

/** Рубрика-приёмник форума (seed БД): «Товары и услуги ▸ Цены». */
const CHEAP_FORUM_RUBRIC_SLUG = "tovary-i-uslugi--ceny";
/** Метка темы-приёмника (Topic.source) — идемпотентный поиск/создание. */
export const CHEAP_HINT_TOPIC_SOURCE = "cheap-hints-transfer";
const CHEAP_HINT_TOPIC_TITLE = "Быстрые подсказки: Где дешевле — перенесено с Главной";

/**
 * Тема-приёмник заблокированных ценовых подсказок в рубрике «Товары и
 * услуги ▸ Цены». Идемпотентно: находится по метке source; если отсутствует
 * (свежая БД) — создаётся закреплённой с первым сообщением-описанием.
 * Гонка создания гасится повторным поиском. При любой ошибке возвращается
 * null — вызывающий код отдаст запасной forumUrl (форум), а не упадёт.
 */
async function resolveCheapHintTopic(): Promise<number | null> {
  try {
    const existing = await db.topic.findFirst({
      where: { source: CHEAP_HINT_TOPIC_SOURCE, deletedAt: null },
      select: { id: true },
    });
    if (existing) return existing.id;

    const rubric = await db.rubric.findFirst({
      where: { slug: CHEAP_FORUM_RUBRIC_SLUG },
      select: { id: true },
    });
    if (!rubric) return null;

    const last = await db.topic.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    try {
      const topic = await db.topic.create({
        data: {
          number: (last?.number ?? 0) + 1,
          title: CHEAP_HINT_TOPIC_TITLE,
          source: CHEAP_HINT_TOPIC_SOURCE,
          authorName: "SakhMatrix",
          rubricId: rubric.id,
          isPinned: true,
          lastAuthorName: "SakhMatrix",
        },
      });
      await db.message.create({
        data: {
          topicId: topic.id,
          num: 1,
          authorName: "SakhMatrix",
          body:
            "Приёмник ценовых подсказок с Главной страницы (ТЗ 2026-09-22). Здесь обсуждаются сообщения, которые первая линия пре-модерации не пропустила в витрину сухих цен: телефоны физлиц и эмоциональная критика ценообразования. Текст сообщения автора переносится в форму быстрого ответа этой темы автоматически — ничего не стирается и не теряется.",
        },
      });
      return topic.id;
    } catch {
      // Гонка параллельного создания — перечитываем по метке.
      const retry = await db.topic.findFirst({
        where: { source: CHEAP_HINT_TOPIC_SOURCE, deletedAt: null },
        select: { id: true },
      });
      return retry?.id ?? null;
    }
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const rows = await db.cheapHint.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
    });
    // ТЗ 2026-09-22 «сквозная логика» (зеркальный раунд «Где дешевле»):
    // ИД темы-приёмника для кнопки переноса формата
    // /forum/topic/ИД_ТОПИКА?prefilled_text=… (идемпотентно, тема
    // создаётся при отсутствии — self-healing).
    const forumTopicId = await resolveCheapHintTopic();
    return NextResponse.json({
      forumTopicId,
      hints: rows.map((h) => ({
        id: h.id,
        text: h.text,
        authorName: h.authorName,
        createdAt: h.createdAt,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await userByToken(body?.token);
    if (!user) {
      return NextResponse.json(
        { error: "Чтобы подсказывать цены — войдите в аккаунт." },
        { status: 401 }
      );
    }

    if (!rateLimit(`cheap-hint-try:${user.id}`, CREATE_LIMIT_PER_HOUR, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Слишком много попыток за час. Попробуйте позже." },
        { status: 429 }
      );
    }

    const text = String(body?.text ?? "").trim();
    if (text.length < HINT_MIN_LEN || text.length > HINT_MAX_LEN) {
      return NextResponse.json(
        { error: `Подсказка — от ${HINT_MIN_LEN} до ${HINT_MAX_LEN} символов: товар, стоимость, ориентир или адрес.` },
        { status: 400 }
      );
    }

    // ПЕРВАЯ ЛИНИЯ пре-модерации (Кейс А → Кейс Б → пропуск).
    const verdict = premoderateCheapHint(text);
    if (verdict.verdict === "block") {
      const topicId = await resolveCheapHintTopic();
      const forumUrl = topicId
        ? `/?topic=${topicId}&cheapHint=${encodeURIComponent(text)}`
        : "/?view=forum";
      return NextResponse.json(
        {
          blocked: verdict.rule,
          message: verdict.message,
          forumButton: CHEAP_HINT_FORUM_BUTTON_LABEL,
          forumUrl,
        },
        { status: 422 }
      );
    }

    const created = await db.cheapHint.create({
      data: { text, authorId: user.id, authorName: user.nickname },
    });
    return NextResponse.json({
      ok: true,
      hint: {
        id: created.id,
        text: created.text,
        authorName: created.authorName,
        createdAt: created.createdAt,
      },
      note: "Подсказка опубликована. Спасибо!",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
