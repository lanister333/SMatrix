"use client";

/**
 * ТЗ 2026-09-22 (раунд «FLAT 2.0 — строгий минимализм»): «УБЕРИ ВСЕ СИНИЕ
 * ПЛАШКИ И ТЯЖЕЛЫЕ РАМКИ… МНОГО БЕЛОГО ЦВЕТА И ВОЗДУХА». Блоки «Где купить»
 * и «Где дешевле» на ГЛАВНОЙ странице SakhMatrix.ru заменяют собой прежние
 * панели «Быстрые подсказки…» (.mp-panel с синей шапкой .mp-paneltitle на
 * var(--sm-navy), рамкой #4a688c и плашками 2px #b91c1c с navy-кнопкой —
 * всё это снято с витрины по прямому указу заказчика; файлы старых панелей
 * и их серверные API не удалены, только отключены от Главной).
 *
 * 1. ДИЗАЙН (пункт 1 ТЗ): заголовки блоков — простым чёрным текстом БЕЗ
 *    синих фоновых полос; рамки полей ввода — очень тонкие светло-серые
 *    (border-zinc-200); никаких теней; белый фон и воздух.
 *
 * 2. ДАННЫЕ (пункт 2 ТЗ): константный массив sakhMatrixData вставлен
 *    ДОСЛОВНО (4 тестовые карточки: 2 «Где купить», 2 «Где дешевле»).
 *
 * 3. ПРОВЕРКА ТЕКСТА (пункт 3 ТЗ): при нажатии «Подсказать» — жёсткий
 *    пре-анализ строки ДО отправки. Телефоны («8924…», «+79…») и плохие
 *    слова-ярлыки («барыги», «хамы», «мошенники», «уроды», «вор»,
 *    «обдираловка») → сообщение на сайт НЕ отправляется, текст из поля
 *    НЕ СТИРАЕТСЯ, прямо под полем — простая серая плашка с ДОСЛОВНЫМ
 *    текстом заказчика и кнопкой-ссылкой [💬 Опубликовать этот текст на
 *    форуме]. Без модальных окон и сторонних библиотек.
 *
 * 4. БЕСШОВНЫЙ UX (пункт 4 ТЗ): ссылка кнопки формата 1-в-1 —
 *    /forum/topic/ИД_ТОПИКА?prefilled_text=<encodeURIComponent(текст)>;
 *    текст автоматически переносится в форму ответа на форуме
 *    (topic-view.tsx читает prefilled_text), поле при клике не очищается.
 *    Ссылка вычисляется на каждом рендере, поэтому несёт АКТУАЛЬНЫЙ ввод:
 *    пользователь может дописать текст после блокировки — ссылка обновится.
 *
 * ЗАДОКУМЕНТИРОВАННЫЕ ИМПРОВИЗАЦИИ (заказчик прислал ТЗ-алгоритм, а не
 * разметку; всё — в worklog):
 *  — регулярки: телефон — из ТЗ того же автора (предшествующий раунд о
 *    симуляторе, пункт 2); ярлыки — основы маркеров НОВОГО ТЗ
 *    /барыг|хам|урод|вор|мошенник|обдиралов/i, ловят словоформы
 *    («барыги», «хамы», «мошенники», «уроды», «обдираловка»); известно
 *    ограничение: основа «вор» редкими случаями даёт ложное срабатывание
 *    («ворота») — в ТЗ слово названо маркером без оговорок;
 *  — «серая плашка» — токены Flat 2.0 из ТЗ того же автора: bg-zinc-50,
 *    border-zinc-200, текст zinc-700, маркер «Ошибка:» — text-red-600;
 *  — кнопка форума и кнопка «Подсказать» — семейство Flat 2.0:
 *    border-zinc-200, при ховере bg-zinc-950 и text-white;
 *  — поведение при ПРОХОДЕ проверки (ТЗ не определено, серверная часть
 *    не задана): демо-режим «максимально просто» — поле очищается,
 *    короткое локальное подтверждение; ни один запрос на сервер с этой
 *    формы не уходит; прежние API /api/wheretobuy-hints и
 *    /api/gdedeshevle-hints живут, но этой формой не используются;
 *  — авторизация не требуется (ТЗ про вход молчит, код максимально
 *    простой) — форма работает и для гостей;
 *  — плейсхолдер поля и надпись подтверждения — авторские;
 *  — URL /forum/topic/<ИД_ТОПИКА> — формат ТЗ; реальный движок форума
 *    открывает темы по /?topic=<число>, поэтому добавлен роут-адаптер
 *    src/app/forum/topic/[topicId]/route.ts (маппинг тестовых слагов на
 *    темы-приёмники по Topic.source + 302 с сохранением prefilled_text).
 */

import { useState } from "react";
import { nickGenderClass } from "@/lib/nick-gender";

/* ==== Пункт 2 ТЗ: ДАННЫЕ ДЛЯ ТЕСТА — массив заказчика ДОСЛОВНО ==== */
const sakhMatrixData = {
  buy: [
    { id: "1", author: "Island_Driver65", text: "Где в Южном купить ремкомплект ГРМ на двигатель 1JZ-GE?", topic: "topic-grm" },
    { id: "2", author: "Aniva_Fisher", text: "Ищу японские блесны на симу (розовые, 18г). Где есть?", topic: "topic-sima" }
  ],
  cheap: [
    { id: "3", author: "Sakhalin_Gid", text: "Где в Южно-Сахалинске самая дешевая зимняя резина Triangle R16?", topic: "topic-tyres" },
    { id: "4", author: "Korsakov_News", text: "Где найти свежую горбушу по минимальной цене напрямую от рыбаков?", topic: "topic-salmon" }
  ]
};

type Card = { id: string; author: string; text: string; topic: string };

/* ==== Пункт 3 ТЗ: жёсткий пре-анализ строки ДО отправки ====
   Телефоны физлиц («8924…», «+79…») — регулярка из ТЗ заказчика. */
const phoneRegex = /(\+7|8)\s?\(?\d{3}\)?\s?\d{3}-?\d{2}-?\d{2}/;
/* Плохие слова-ярлыки («барыги», «хамы», «мошенники», «уроды», «вор»,
   «обдираловка») — основы маркеров ТЗ, ловят словоформы. */
const insultRegex = /барыг|хам|урод|вор|мошенник|обдиралов/i;

/* Плашка (пункт 3 ТЗ — текст ДОСЛОВНО; префикс «Ошибка:» рендерится
   красным маркером text-red-600 — Flat 2.0-токены того же автора). */
const PLAQUE_ERROR =
  "На главной странице запрещены личные телефоны и оскорбления. Вы можете опубликовать этот текст на форуме.";
const FORUM_BUTTON_LABEL = "💬 Опубликовать этот текст на форуме";

export default function SakhMatrixHintsFlat() {
  // Ввод пользователя по каждой карточке + флаги блокировки/приёмки.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [blocked, setBlocked] = useState<Record<string, boolean>>({});
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});

  const setAnswer = (id: string, v: string) => {
    setAnswers((prev) => ({ ...prev, [id]: v }));
  };

  /* Пункт 3 ТЗ: если в тексте телефон или ярлык — на сайт НЕ отправляем,
     текст из поля НЕ стираем, под полем показываем серую плашку. */
  const submit = (card: Card) => {
    const t = (answers[card.id] || "").trim();
    if (!t) return;
    if (phoneRegex.test(t) || insultRegex.test(t)) {
      setBlocked((prev) => ({ ...prev, [card.id]: true }));
      setAccepted((prev) => ({ ...prev, [card.id]: false }));
      return;
    }
    // Сухой факт проходит (поведение при прохождении ТЗ не определено —
    // демо-подтверждение, сервер не вызывается; см. шапку файла).
    setBlocked((prev) => ({ ...prev, [card.id]: false }));
    setAccepted((prev) => ({ ...prev, [card.id]: true }));
    setAnswers((prev) => ({ ...prev, [card.id]: "" }));
  };

  /* Пункт 4 ТЗ — формат ссылки 1-в-1; поле при клике НЕ очищается. */
  const forumHref = (card: Card) =>
    `/forum/topic/${card.topic}?prefilled_text=${encodeURIComponent((answers[card.id] || "").trim())}`;

  const renderCard = (card: Card) => (
    <div key={card.id} data-smflat-card={card.id} className="border border-zinc-200 bg-white p-4">
      <div className={`text-[13.5px] font-semibold text-zinc-900 ${nickGenderClass(card.author)}`}>{card.author}</div>
      <p className="mt-1 text-[13.5px] leading-relaxed text-zinc-700">{card.text}</p>

      {/* Рамка очень тонкая светло-серая (border-zinc-200), никаких теней — пункт 1 ТЗ. */}
      <textarea
        data-smflat-input={card.id}
        value={answers[card.id] || ""}
        onChange={(e) => setAnswer(card.id, e.target.value)}
        rows={2}
        placeholder="Сухой ответ: адрес, ориентир, цена…"
        aria-label={`Ответ на запрос ${card.author}`}
        className="mt-3 w-full resize-y border border-zinc-200 bg-white px-2.5 py-2 text-[13px] leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          data-smflat-submit={card.id}
          onClick={() => submit(card)}
          className="border border-zinc-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-zinc-900 transition-colors hover:bg-zinc-950 hover:text-white"
        >
          Подсказать
        </button>
      </div>

      {accepted[card.id] && (
        <div data-smflat-note={card.id} className="mt-2 text-[12.5px] text-zinc-500">
          ✓ Подсказка принята.
        </div>
      )}

      {/* Простая серая плашка (bg-zinc-50 / border-zinc-200 / zinc-700,
          маркер «Ошибка:» — red-600) строго под полем, внутри карточки —
          без модальных окон. Поле ввода при этом НЕ очищено (ТЗ, пункт 3). */}
      {blocked[card.id] && (
        <div data-smflat-plaque={card.id} role="alert" className="mt-2.5 border border-zinc-200 bg-zinc-50 px-3 py-2.5">
          <div data-smflat-plaque-text={card.id} className="text-[13px] leading-relaxed text-zinc-700">
            <span className="font-semibold text-red-600">Ошибка:</span> {PLAQUE_ERROR}
          </div>
          {/* Кнопка-ссылка рядом с ошибкой: бесшовный перенос текста на форум
              (пункт 4 ТЗ), формат ссылки 1-в-1, hover — чёрный фон/белый текст. */}
          <a
            data-smflat-forum-btn={card.id}
            href={forumHref(card)}
            className="mt-2 inline-block border border-zinc-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-zinc-700 transition-colors hover:bg-zinc-950 hover:text-white"
          >
            {FORUM_BUTTON_LABEL}
          </a>
        </div>
      )}
    </div>
  );

  return (
    <div data-smflat="1" className="mt-6 space-y-7">
      {/* Заголовки — простой чёрный текст БЕЗ синих фоновых полос (пункт 1 ТЗ). */}
      <section data-smflat-block="buy" aria-label="Где купить">
        <h3 data-smflat-title="buy" className="text-[15px] font-bold tracking-tight text-zinc-900">
          Где купить
        </h3>
        <div className="mt-3 space-y-3">{sakhMatrixData.buy.map((card) => renderCard(card))}</div>
      </section>

      <section data-smflat-block="cheap" aria-label="Где дешевле">
        <h3 data-smflat-title="cheap" className="text-[15px] font-bold tracking-tight text-zinc-900">
          Где дешевле
        </h3>
        <div className="mt-3 space-y-3">{sakhMatrixData.cheap.map((card) => renderCard(card))}</div>
      </section>
    </div>
  );
}
