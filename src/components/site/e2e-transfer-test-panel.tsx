"use client";

/**
 * ТЗ 2026-09-23 «ЧИСТЫЙ БЛОК ТЕМЫ» (ред. «убрать отладочную писанину»):
 * карточки 7 сценариев на «Где купить» (/gde-kupit) и «Где дешевле»
 * (/gde-deshevle) выглядят КАК ОБЫЧНОЕ СООБЩЕНИЕ НА ФОРУМЕ:
 *
 *   [Ник] · [Дата] · [Город]
 *   ─────────────────────────────
 *   Вопрос: [текст вопроса]
 *
 *   ✅ Статус: Найдено / Цена зафиксирована
 *   📍 Ответ от [ник]: [текст]        ← ×N, ПЛОСКИЙ список
 *
 *   Пожаловаться    [ 📍 Ответить ] [ 💬 Обсудить на форуме ]
 *
 * ЧТО СНЯТО С ЭКРАНА (указ заказчика 2026-09-23 «убрать с экрана всю
 * отладочную писанину») — этих надписей на странице БОЛЬШЕ НЕТ:
 *   • заголовок панели «Сквозные тестовые сообщения — симулятор
 *     перехода на форум» и подпись «Проверка бесшовного переноса…»;
 *   • «Сценарий 4 (Зимняя резина)» и т.п. (номер + имя сценария);
 *   • поле «Тестовый ввод (Ошибка)»;
 *   • поле «Тема форума: topic-…»;
 *   • поле «URL: /forum/topic/…?prefilled_text=…»;
 *   • «Проба ТЗ …» и любые другие служебные подписи.
 * ВСЕ ЭТИ ДАННЫЕ ОСТАЮТСЯ ТОЛЬКО В КОДЕ — в полях интерфейса
 * E2eScenario, в data-атрибутах карточки (data-e2e-topic-slug,
 * data-e2e-url, data-e2e-receiver), в href кнопки переноса и в
 * aria-label поля ответа. На страницу они НЕ выводятся.
 *
 * ЛОГИКА ОТВЕТОВ (ТЗ 2026-09-23 «Ответить», без изменений):
 *  • кнопка [📍 Ответить] открывает простое текстовое поле прямо на
 *    странице; автор пишет сухой факт (точный адрес, цену, ТЦ) и
 *    нажимает «Опубликовать» — ответ появляется В ПЛОСКОМ СПИСКЕ на
 *    карточке («📍 Ответ от ника: текст»);
 *  • ответов может быть СКОЛЬКО УГОДНО, каждый добавляется в конец
 *    списка; ответов на ответ НЕТ (внутри ответа нет кнопки — споры
 *    только на форуме);
 *  • как только у карточки есть хотя бы один ответ — статус «Найдено»
 *    («Где купить») или «Цена зафиксирована» («Где дешевле»), строка
 *    «✅ Статус: …», карточка ТУСКНЕЕТ (is-dim), но ответы продолжают
 *    добавляться;
 *  • внизу карточки ОДИН РЯД: «Пожаловаться» — серым текстом слева,
 *    [📍 Ответить] (СИНЯЯ форумская) и [💬 Обсудить на форуме]
 *    (бирюзовая) — РЯДОМ, СПРАВА внизу.
 *
 * ИИ-фильтр (Часть 4 ТЗ) действует на «Ответить» так же, как в
 * лентах разделов: паттерны телефонов (89…/+79…) и слова «барыги, хамы,
 * мошенники, уроды, вор, обдираловка, спекулянты» (движок
 * findPhoneNumbers/findEmotionalLabels). При блокировке публикация НЕ
 * отправляется, ТЕКСТ В ПОЛЕ НЕ СТИРАЕТСЯ, под полем — серая плашка
 * (bg-zinc-50, border-zinc-200) с дословным текстом ТЗ и кнопкой
 * бесшовного переноса набранного текста в тему-приёмник сценария
 * (/forum/topic/СЛАГ?prefilled_text=…: сценарии 1–3 → тема #177 «Товары
 * и услуги ▸ Где купить», 4–6 → #178 «Товары и услуги ▸ Цены»,
 * 7 → #176 — актуальная тема обсуждения публикации Cybex; карту слагов
 * ведёт src/app/forum/topic/[topicId]/page.tsx).
 *
 * ВАЖНО:
 *  • URL хранятся СТРОКАМИ байт-в-байт из ТЗ (пробелы = %20, запятые = %2C,
 *    двоеточия = %3A, восклицательный знак «!» НЕ кодируется) — их НЕЛЬЗЯ
 *    строить через encodeURIComponent: он закодировал бы кириллицу и «!»
 *    (→ %21) и исказил бы формат ТЗ. (Динамический перенос текста,
 *    набранного пользователем в поле ответа, наоборот, кодируется
 *    стандартным encodeURIComponent — как в лентах разделов.)
 *  • Клик по [💬 Обсудить на форуме] ведёт на /forum/topic/СЛАГ?prefilled_text=…
 *    — роут-адаптер src/app/forum/topic/[topicId]/page.tsx переводит слаг
 *    в тему-приёмник, сохраняя prefilled_text; форма быстрого ответа темы
 *    подхватывает текст в ПУСТОЕ поле и вычищает параметр из адресной строки.
 *  • Ответы панели демонстрационные (состояние карточки в памяти
 *    страницы): реальное сохранение ответов выполняют карточки лент
 *    разделов (PATCH action=answer).
 */

import { useState } from "react";
import { findPhoneNumbers } from "@/lib/moderation/premoderation";
import { findEmotionalLabels, WTB_HINT_FORUM_BUTTON_LABEL } from "@/lib/moderation/wheretobuy-hint-premoderation";
import { nickGenderClass } from "@/lib/nick-gender";
import { useAuth } from "@/components/site/chrome";

export interface E2eScenario {
  /** Номер сценария ТЗ (1–7). ТОЛЬКО в коде (data-атрибут), не на экране. */
  num: number;
  /** Короткое имя из ТЗ. ТОЛЬКО в коде (aria-label поля ответа), не на экране. */
  name: string;
  /** Вопрос на странице (дословно) — ЕДИНСТВЕННЫЙ текст сценария на экране. */
  question: string;
  /** Тестовый ввод (Ошибка) из ТЗ — ТОЛЬКО в коде (он же в prefilled_text
   *  точного URL), на экран НЕ выводится. */
  errorInput?: string;
  /** Символьный ИД темы из «Ссылки для переноса» ТЗ — ТОЛЬКО в коде
   *  (data-атрибут data-e2e-topic-slug + href кнопки), не на экране. */
  topicSlug: string;
  /** Точный URL переноса из ТЗ (байт-в-байт, кодировку не менять) —
   *  ТОЛЬКО в коде (href кнопки + data-атрибут data-e2e-url), не на экране. */
  url: string;
  /** Ник автора карточки (шапка «Ник · Дата · Город»). */
  author: string;
  /** Дата публикации (шапка). */
  date: string;
  /** Город (шапка). */
  city: string;
  /** Нестандартная тема-приёмник (сценарий 7 → актуальная тема #176) —
   *  ТОЛЬКО в коде (data-атрибут data-e2e-receiver), не на экране. */
  receiverId?: number;
}

/* БЛОК «ГДЕ КУПИТЬ» — рубрика форума «Товары и услуги ▸ Где купить» (#177);
   сценарий 7 — актуальная тема обсуждения публикации (#176). */
const WTB_SCENARIOS: E2eScenario[] = [
  {
    num: 1,
    name: "Ремкомплект ГРМ",
    question:
      "Где в Южно-Сахалинске купить оригинальный японский ремкомплект ГРМ на двигатель 1JZ-GE? На маркетплейсах ждать долго",
    errorInput: "Есть мастер Вова на Железнодорожной, звони ему: 8-924-111-22-33",
    topicSlug: "topic-grm-123",
    url: "/forum/topic/topic-grm-123?prefilled_text=Есть%20мастер%20Вова%20на%20Железнодорожной%2C%20звони%20ему%3A%208-924-111-22-33",
    author: "Автолюбитель74",
    date: "16 сентября, 09:12",
    city: "Южно-Сахалинск",
  },
  {
    num: 2,
    name: "Школьная форма",
    question:
      "Где в городе прямо сейчас купить качественную школьную форму на мальчика (рост 140)? В крупных ТЦ всё раскупили перед сезоном",
    errorInput: "В ТЦ Рояль на 3 этаже сидят хамы и мошенники, торгуют синтетикой!",
    topicSlug: "topic-shkola-789",
    url: "/forum/topic/topic-shkola-789?prefilled_text=В%20ТЦ%20Рояль%20на%203%20этаже%20сидят%20хамы%20и%20мошенники%2C%20торгуют%20синтетикой!",
    author: "Мама двоих",
    date: "16 сентября, 11:40",
    city: "Южно-Сахалинск",
  },
  {
    num: 3,
    name: "Блесны на симу",
    question:
      "Ищу специфические японские снасти и блесны на симу (розовые, 18г). В обычных рыболовных магазинах Южного всё выгребли",
    errorInput: "Закажи у чувака на Авито, вот его сотовый 8-914-000-44-55",
    topicSlug: "topic-sima-555",
    url: "/forum/topic/topic-sima-555?prefilled_text=Закажи%20у%20чувака%20на%20Авито%2C%20вот%20его%20сотовый%208-914-000-44-55",
    author: "Спиннингист",
    date: "17 сентября, 07:05",
    city: "Южно-Сахалинск",
  },
  {
    /* Сценарий 7 (ТЗ 2026-09-23): прежде — полноценная публикация «Где
       купить», затем — компактная карточка с полями Автор/Дата; по указу
       «чистый блок темы» поля сведены в общую шапку «Ник · Дата · Город».
       Тема форума из ТЗ topic-cybex-777 — заполнитель, «подставить
       актуальную» = существующая тема обсуждения #176
       (WhereToBuyPost.topicId), карта слагов в route.ts переведена на неё.
       prefilled_text = сам вопрос (тестового ввода нет). */
    num: 7,
    name: "Детское автокресло Cybex Solution T i-Fix",
    question:
      "Нужно автокресло Cybex Solution T i-Fix, ростовая группа 2/3. Подскажите магазины или страницы товара на сайтах магазинов Сахалина. wb",
    topicSlug: "topic-cybex-777",
    url: "/forum/topic/topic-cybex-777?prefilled_text=Нужно%20автокресло%20Cybex%20Solution%20T%20i-Fix%2C%20ростовая%20группа%202%2F3.%20Подскажите%20магазины%20или%20страницы%20товара%20на%20сайтах%20магазинов%20Сахалина.%20wb",
    author: "Админ",
    date: "15 сентября, 05:53",
    city: "Южно-Сахалинск",
    receiverId: 176,
  },
];

/* БЛОК «ГДЕ ДЕШЕВЛЕ» — рубрика форума «Товары и услуги ▸ Цены» (#178). */
const CHEAP_SCENARIOS: E2eScenario[] = [
  {
    num: 4,
    name: "Зимняя резина",
    question:
      "Подскажите, где в Южно-Сахалинске сейчас самая дешевая зимняя резина Triangle R16? В крупных сетях ценник сильно задрали",
    errorInput: "На Пуркаева в ТЦ не ходи, там барыги совсем с ума сошли, крутят цены!",
    topicSlug: "topic-tyres-456",
    url: "/forum/topic/topic-tyres-456?prefilled_text=На%20Пуркаева%20в%20ТЦ%20не%20ходи%2C%20там%20барыги%20совсем%20с%20ума%20сошли%2C%20крутят%20цены!",
    author: "Дима74",
    date: "17 сентября, 18:26",
    city: "Южно-Сахалинск",
  },
  {
    num: 5,
    name: "Свежая горбуша",
    question:
      "Где найти свежую горбушу по минимальной цене напрямую от рыбаков, без наценки перекупщиков?",
    errorInput: "Все перекупщики уроды, задрали ценник на рыбу в два раза!",
    topicSlug: "topic-salmon-888",
    url: "/forum/topic/topic-salmon-888?prefilled_text=Все%20перекупщики%20уроды%2C%20задрали%20ценник%20на%20рыбу%20в%20два%20раза!",
    author: "Хозяюшка",
    date: "18 сентября, 08:31",
    city: "Южно-Сахалинск",
  },
  {
    num: 6,
    name: "Обрезная доска",
    question:
      "Где сейчас дешевле взять куб обрезной доски 50х150 с доставкой в Троицкое? Цены на базах Южного сильно разнятся",
    errorInput: "На базах на Холмском шоссе устроили обдираловку, воры кругом!",
    topicSlug: "topic-timber-999",
    url: "/forum/topic/topic-timber-999?prefilled_text=На%20базах%20на%20Холмском%20шоссе%20устроили%20обдираловку%2C%20воры%20кругом!",
    author: "Загородный",
    date: "18 сентября, 20:14",
    city: "с. Троицкое",
  },
];

/** Стиль строгого флэта сайта (как у досок Flat 2.0): белый фон и тонкая
 *  рамка — окантовка КАК У БЛОКА С ЧАСАМИ (#4A688C, директива 2026-09-24:
 *  «все блоки на страницах где дешевле и где купить — окантовку как у
 *  блока с часами»; единообразно с .wb-item/.cd-item/.wb-sideblock).
 *  История: zinc-200 #e4e4e7 → zinc-300 #d4d4d8 → #4A688C. */
const FLAT_BORDER = "1px solid #4A688C";

/**
 * ТЗ 2026-09-23 «сквозная логика ИИ-фильтра»: серая плашка фильтра ответа —
 * ДОСЛОВНЫЙ текст заказчика (тот же, что у лент «Где купить»/«Где дешевле»
 * и у быстрых подсказок Главной).
 */
const FILTER_PLAQUE_TEXT =
  "Сообщение отклонено фильтром главной страницы. На главной странице запрещено публиковать личные мобильные телефоны и субъективные споры. Вы можете опубликовать этот текст на форуме.";

/** Гостю кнопка «📍 Ответить» формы не открывает (как в лентах). */
const ANSWER_GUEST_NOTE =
  "Отвечать на запросы могут только зарегистрированные пользователи. Войдите или зарегистрируйтесь.";

/** ТЗ 2026-09-23: метка кнопки ответа — ровно [ 📍 Ответить ]. */
const ANSWER_BUTTON_LABEL = "📍 Ответить";

/* ------------------------------------------------------------------ */
/* Карточка сценария = ЧИСТЫЙ БЛОК ТЕМЫ (как обычное сообщение форума) */
/* ------------------------------------------------------------------ */

function E2eScenarioCard(props: { s: E2eScenario; variant: "wtb" | "cheap" }) {
  const { s } = props;
  const { user, token } = useAuth();
  // ТЗ 2026-09-23 «Ответить»: инлайн-ответ — поле прямо на странице;
  // «Опубликовать» добавляет ответ В ПЛОСКИЙ СПИСОК (сколько угодно
  // ответов); после первого ответа карточка получает статус и ТУСКНЕЕТ,
  // но ответы продолжают добавляться (состояние демо-панели в памяти).
  const [answerOpen, setAnswerOpen] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [answerBlocked, setAnswerBlocked] = useState<"phones" | "labels" | null>(null);
  const [answerErr, setAnswerErr] = useState("");
  const [answers, setAnswers] = useState<Array<{ text: string; author: string; gender?: string }>>([]);

  const statusLabel = props.variant === "wtb" ? "Найдено" : "Цена зафиксирована";
  const statusKind = props.variant === "wtb" ? "found" : "fixed";
  const answered = answers.length > 0;
  const afterHint =
    props.variant === "wtb"
      ? "Ответ появится в списке на карточке; первым ответом карточка получит статус «Найдено» и тускнеет."
      : "Ответ появится в списке на карточке; первым ответом карточка получит статус «Цена зафиксирована» и тускнеет.";

  const changeAnswer = (v: string) => {
    setAnswerText(v);
    // Текст изменился — прежний вердикт фильтра устарел, плашка гаснет.
    setAnswerBlocked(null);
    setAnswerErr("");
  };

  const toggleAnswer = () => {
    setAnswerOpen((v) => !v);
    setAnswerBlocked(null);
    setAnswerErr("");
  };

  /** ТЗ 2026-09-23 «Ответить»: сухой факт добавляется В ПЛОСКИЙ СПИСОК
   *  на карточке; с первым ответом карточка получает статус и ТУСКНЕЕТ,
   *  но ответы продолжают добавляться. Текст с телефоном или плохим
   *  словом БЛОКИРУЕТСЯ на клиенте: ничего не отправляется, ТЕКСТ
   *  НЕ СТИРАЕТСЯ, под полем — серая плашка (bg-zinc-50/border-zinc-200)
   *  с кнопкой переноса набранного текста в тему-приёмник сценария. */
  const submitAnswer = () => {
    const t = answerText.trim();
    if (t.length < 3) {
      setAnswerErr("Опишите сухой факт: точный адрес, ТЦ или ориентир (от 3 символов).");
      return;
    }
    setAnswerErr("");
    // Проверка ДО отправки: тот же движок, что у лент разделов и Главной.
    const phones = findPhoneNumbers(t);
    const labels = findEmotionalLabels(t);
    if (phones.length > 0 || labels.length > 0) {
      setAnswerBlocked(phones.length > 0 ? "phones" : "labels");
      return; // без отправки: текст в поле не стёрт
    }
    setAnswerBlocked(null);
    setAnswers((prev) => [...prev, { text: t, author: user?.nickname || "Аноним", gender: user?.gender }]);
    setAnswerOpen(false);
    setAnswerText("");
  };

  /* Техданные сценария — ТОЛЬКО в коде: data-атрибуты карточки и href
     кнопки переноса. На экран НЕ выводятся (указ «чистый блок темы»). */
  const techAttrs = {
    "data-e2e-topic-slug": s.topicSlug,
    "data-e2e-url": s.url,
    ...(s.receiverId ? { "data-e2e-receiver": s.receiverId } : {}),
  };

  return (
    <article
      className={`e2e-scen${answered ? " is-dim" : ""}`}
      data-e2e-scenario={s.num}
      data-e2e-card-status={answered ? statusKind : "none"}
      {...techAttrs}
      style={{ background: "#fff", border: FLAT_BORDER, borderRadius: 0, padding: "9px 12px" }}
    >
      {/* Шапка карточки — как у обычного сообщения форума:
          «[Ник] · [Дата] · [Город]». Никаких «Сценарий N».
          П.7 (2026-09-24): ник окрашен по полу, как на форуме. */}
      <div className="e2e-headrow" data-e2e-head={s.num}>
        <b className={nickGenderClass(s.author)}>{s.author}</b> · {s.date} · {s.city}
      </div>

      <div className="e2e-sep" />

      {/* «Вопрос: [текст вопроса]» — простой текст, без служебных ссылок. */}
      <div className="e2e-q">
        <span className="e2e-qlabel">Вопрос: </span>
        {s.question}
      </div>

      {/* ТЗ: строка статуса — «✅ Статус: Найдено» / «Цена зафиксирована»
          (появляется, как только у карточки есть хотя бы один ответ). */}
      {answered && (
        <div className={`e2e-statusline is-${statusKind}`} data-e2e-statuschip={s.num}>
          ✅ Статус: {statusLabel}
        </div>
      )}

      {/* ТЗ: ПЛОСКИЙ СПИСОК ответов — «📍 Ответ от ника: текст»; ответов
          может быть СКОЛЬКО УГОДНО; внутри ответа НЕТ кнопки «Ответить»
          (ответов на ответ нет) — споры уходят на форум. */}
      {answered && (
        <div data-e2e-answer={s.num} style={{ marginTop: 6 }}>
          {answers.map((a, i) => (
            <div className="e2e-answer" key={i} data-e2e-answer-row={s.num}>
              📍 Ответ от <b className={nickGenderClass(a.author, a.gender)}>{a.author}</b>: {a.text}
            </div>
          ))}
        </div>
      )}

      <div className="e2e-sep" />

      {/* ТЗ: внизу карточки ОДИН РЯД — «Пожаловаться» серым текстом слева,
          справа РЯДОМ две кнопки: [📍 Ответить] — СИНЯЯ форумская (метрики
          .sk-btn-reply), [💬 Обсудить на форуме] — бирюзовая
          (.e2e-btn-forum), ОТНОСИТЕЛЬНЫЙ путь /forum/topic/СЛАГ.
          Пара кнопок обёрнута в единый flex-элемент: на узких экранах
          переносится ЦЕЛИКОМ (кнопки не разъезжаются по строкам). */}
      <div className="e2e-actrow">
        <button className="wb-report e2e-report" data-e2e-report={s.num} title="Жалоба будет отправлена модератору">
          Пожаловаться
        </button>
        <span className="e2e-pair">
          <button className="e2e-act e2e-answerbtn" data-e2e-answerbtn={s.num} onClick={toggleAnswer}>
            {ANSWER_BUTTON_LABEL}
          </button>
          <a className="e2e-btn-forum" data-e2e-btn={s.num} href={s.url} title="Открыть тему форума с этим текстом в поле ответа">
            💬 Обсудить на форуме
          </a>
        </span>
      </div>

      {/* Часть 3: инлайн-ответ — простое текстовое поле прямо на странице;
          флуда здесь нет, только сухой факт. */}
      {answerOpen && (
        <div className="e2e-answerform" data-e2e-answerform={s.num}>
          {user && token ? (
            <>
              <textarea
                data-e2e-answer-input={s.num}
                value={answerText}
                maxLength={300}
                onChange={(e) => changeAnswer(e.target.value)}
                placeholder="Только сухой факт: точный адрес, ТЦ, ориентир. Без флуда и споров."
                aria-label={`Ответ на запрос «${s.name}»`}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7, flexWrap: "wrap" }}>
                <button className="sk-btn-classic" data-e2e-answer-submit={s.num} onClick={submitAnswer} style={{ borderRadius: 0 }}>
                  Опубликовать
                </button>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{afterHint}</span>
              </div>
              {/* Часть 4: серая плашка фильтра (bg-zinc-50/border-zinc-200).
                  Поле НЕ стёрто, публикация НЕ отправлена; кнопка бесшовно
                  переносит НАБРАННЫЙ текст в тему-приёмник сценария
                  (слаг → #177/#178/#176, см. роут-адаптер форума). */}
              {answerBlocked && (
                <div className="e2e-answerplaque" data-e2e-filter-plaque={answerBlocked} role="alert">
                  <div data-e2e-filter-plaque-text={answerBlocked} style={{ fontSize: 13, lineHeight: 1.45, color: "#3f3f46" }}>
                    {FILTER_PLAQUE_TEXT}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <a
                      className="wb-hint-forum-btn"
                      data-e2e-filter-forum-btn={s.num}
                      href={`/forum/topic/${s.topicSlug}?prefilled_text=${encodeURIComponent(answerText.trim())}`}
                      style={{ display: "inline-block", background: "#1E3A5F", color: "#fff", fontSize: 13, fontWeight: 600, padding: "8px 12px", textDecoration: "none" }}
                    >
                      {WTB_HINT_FORUM_BUTTON_LABEL}
                    </a>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div data-e2e-answer-guest={s.num} style={{ fontSize: 13, color: "#475569" }}>
              {ANSWER_GUEST_NOTE}
            </div>
          )}
          {answerErr && (
            <div data-e2e-answer-err={s.num} role="alert" style={{ marginTop: 7, fontSize: 13, fontWeight: 600, color: "#AA3333" }}>
              {answerErr}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Панель карточек блока (без заголовка и подписи — «чистый блок темы»: */
/* техподписи сняты с экрана, данные живут в коде карточек)             */
/* ------------------------------------------------------------------ */

export default function E2eTransferTestPanel(props: { variant: "wtb" | "cheap" }) {
  const list = props.variant === "wtb" ? WTB_SCENARIOS : CHEAP_SCENARIOS;

  return (
    <section
      data-e2e-panel={props.variant}
      aria-label={props.variant === "wtb" ? "Запросы покупателей" : "Запросы цен"}
      style={{ marginTop: 18 }}
    >
      <div data-e2e-cards="1" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {list.map((s) => (
          <E2eScenarioCard key={s.num} s={s} variant={props.variant} />
        ))}
      </div>
    </section>
  );
}
