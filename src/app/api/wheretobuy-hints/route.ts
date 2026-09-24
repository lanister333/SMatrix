/**
 * ТЗ 2026-09-22. Быстрые подсказки «Где купить» на ГЛАВНОЙ странице
 * SakhMatrix.ru — витрина СУХИХ географических фактов (ориентиры, адреса,
 * названия ТЦ, павильонов, официальных открытых организаций).
 *
 * GET  — публичная лента последних подсказок (новые сверху; панель Главной).
 * POST — отправка подсказки (только зарегистрированные). ПЕРЕД записью
 *        работает ПЕРВАЯ ЛИНИЯ пре-модерации
 *        (lib/moderation/wheretobuy-hint-premoderation.ts):
 *
 *   Кейс А (rule="phones"): паттерны сотовых номеров физлиц («+79…»,
 *   «8-924…») → отправка БЛОКИРУЕТСЯ (422), клиенту возвращается строгая
 *   плашка Flat 2.0 с ДОСЛОВНЫМ текстом заказчика и кнопка переноса;
 *
 *   Кейс Б (rule="labels"): слова-маркеры «мошенники», «хамы», «уроды»,
 *   «вор», «конторка», «обдираловка» → БЛОКИРОВКА (422) со своей плашкой;
 *
 *   пропуск (verdict="pass") — подсказка публикуется на Главной.
 *
 * ТЕХНИЧЕСКИЙ UX-РЕЖИМ (дословно заказчик): «При клике на кнопку переноса,
 * текущий текст пользователя не должен стираться. Он должен быть передан
 * GET/POST-параметром в форму ответа темы форума "Товары и услуги ▸
 * Где купить"». Реализация: ответ блокировки несёт forumUrl — ссылку вида
 * /?topic=<id>&wtbhint=<encodeURIComponent(текст)> в тему-приёмник
 * рубрики «Товары и услуги ▸ Где купить» (slug tovary-i-uslugi--gde-kupit).
 * Кнопка — обычная <a>, текст передаётся GET-параметром wtbhint; форма
 * быстрого ответа темы предзаполняется им (topic-view.tsx), текущий текст
 * автора не стирается.
 *
 * Дополнительных линий модерации (ИИ/лексика) на витрине сухих адресов НЕТ —
 * заказчиком для этой формы определена ровно эта первая линия (решение
 * задокументировано в worklog).
 *
 * ДОПОЛНЕНИЕ — ТЗ 2026-09-22 «сквозная логика ИИ-фильтра и переноса текста
 * на форум» (раунд prefilled_text): фильтр переехал НА КЛИЕНТ (проверка ДО
 * отправки, серая плашка с единым текстом, поле не стирается), и кнопка
 * переноса строится в компоненте по ДОСЛОВНОМУ формату ТЗ
 * /forum/topic/ИД_ТОПИКА?prefilled_text=… Для этого GET отдаёт
 * forumTopicId — идемпотентно разрешённую тему-приёмник рубрики
 * «Товары и услуги ▸ Где купить» (метка source "wtb-hints-transfer",
 * при отсутствии создаётся — самовосстановление). Серверная первая линия
 * в POST остаётся заделом прочности для прямых API-вызовов (плашки Кейс
 * А/Б прежнего ТЗ дословно, URL /?topic=<id>&wtbhint=… — тот же перенос,
 * тема предзаполняется тем же эффектом topic-view.tsx).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import {
  premoderateWhereToBuyHint,
  WTB_HINT_FORUM_BUTTON_LABEL,
} from "@/lib/moderation/wheretobuy-hint-premoderation";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Разумная защита от флуда (общий механизм сайта). */
const CREATE_LIMIT_PER_HOUR = 30;

/** Подсказка — короткий сухой факт; 300 хватает «ТЦ Рай на Пуркаева, бокс 4». */
const HINT_MIN_LEN = 3;
const HINT_MAX_LEN = 300;

/** Рубрика-приёмник форума (seed БД): «Товары и услуги ▸ Где купить». */
const WTB_FORUM_RUBRIC_SLUG = "tovary-i-uslugi--gde-kupit";
/** Метка темы-приёмника (Topic.source) — идемпотентный поиск/создание. */
export const WTB_HINT_TOPIC_SOURCE = "wtb-hints-transfer";
const WTB_HINT_TOPIC_TITLE = "Быстрые подсказки: Где купить — перенесено с Главной";

/**
 * Тема-приёмник заблокированных подсказок в рубрике «Товары и услуги ▸
 * Где купить». Идемпотентно: находится по метке source; если отсутствует
 * (свежая БД) — создаётся закреплённой с первым сообщением-описанием.
 * Гонка создания гасится повторным поиском. При любой ошибке возвращается
 * null — вызывающий код отдаст запасной forumUrl (форум), а не упадёт.
 */
async function resolveHintForumTopic(): Promise<number | null> {
  try {
    const existing = await db.topic.findFirst({
      where: { source: WTB_HINT_TOPIC_SOURCE, deletedAt: null },
      select: { id: true },
    });
    if (existing) return existing.id;

    const rubric = await db.rubric.findFirst({
      where: { slug: WTB_FORUM_RUBRIC_SLUG },
      select: { id: true },
    });
    if (!rubric) return null;

    const last = await db.topic.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    try {
      const topic = await db.topic.create({
        data: {
          number: (last?.number ?? 0) + 1,
          title: WTB_HINT_TOPIC_TITLE,
          source: WTB_HINT_TOPIC_SOURCE,
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
            "Приёмник подсказок с Главной страницы (ТЗ 2026-09-22). Здесь обсуждаются сообщения, которые первая линия пре-модерации не пропустила на витрину сухих адресов: телефоны физлиц и эмоциональные ярлыки. Текст сообщения автора переносится в форму быстрого ответа этой темы автоматически — ничего не стирается и не теряется.",
        },
      });
      return topic.id;
    } catch {
      // Гонка параллельного создания — перечитываем по метке.
      const retry = await db.topic.findFirst({
        where: { source: WTB_HINT_TOPIC_SOURCE, deletedAt: null },
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
    const rows = await db.wheretobuyHint.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
    });
    // ТЗ 2026-09-22 «сквозная логика»: ИД темы-приёмника для кнопки переноса
    // формата /forum/topic/ИД_ТОПИКА?prefilled_text=… (разрешается
    // идемпотентно, при отсутствии тема создаётся — self-healing).
    const forumTopicId = await resolveHintForumTopic();
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
        { error: "Подсказывать на Главной могут только зарегистрированные пользователи. Войдите или зарегистрируйтесь — ссылки в левой колонке форума." },
        { status: 401 }
      );
    }

    if (!rateLimit(`wtb-hint-try:${user.id}`, CREATE_LIMIT_PER_HOUR, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Слишком много попыток за час. Попробуйте позже." },
        { status: 429 }
      );
    }

    const text = String(body?.text ?? "").trim();
    if (text.length < HINT_MIN_LEN || text.length > HINT_MAX_LEN) {
      return NextResponse.json(
        { error: `Подсказка — от ${HINT_MIN_LEN} до ${HINT_MAX_LEN} символов: сухой адрес, ориентир, ТЦ или павильон.` },
        { status: 400 }
      );
    }

    // ПЕРВАЯ ЛИНИЯ пре-модерации (Кейс А → Кейс Б → пропуск).
    const verdict = premoderateWhereToBuyHint(text);
    if (verdict.verdict === "block") {
      const topicId = await resolveHintForumTopic();
      const forumUrl = topicId
        ? `/?topic=${topicId}&wtbhint=${encodeURIComponent(text)}`
        : "/?view=forum";
      return NextResponse.json(
        {
          blocked: verdict.rule,
          message: verdict.message,
          forumButton: WTB_HINT_FORUM_BUTTON_LABEL,
          forumUrl,
        },
        { status: 422 }
      );
    }

    const created = await db.wheretobuyHint.create({
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
