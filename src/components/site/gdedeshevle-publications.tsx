"use client";

/**
 * ШАГ 23. «Где дешевле» — самостоятельный раздел сравнения цен на КОНКРЕТНЫЕ
 * товары (ТЗ п.1/2). Отдельная страница: НЕ форум, НЕ «Подслушано Сахалин»,
 * НЕ «Где купить» и не рекламная площадка (ТЗ п.30).
 *
 * Главное правило (ТЗ п.2/24): «Здесь сравнивают цену конкретного товара,
 * а не спрашивают, где вообще дешевле покупать». Одна публикация — один
 * конкретный товар или одна конкретная модель. Статусы (п.12): «Сравниваю» →
 * «Нашёл дешевле» / «Неактуально»; завершённые вопросы сохраняются (п.28).
 *
 * Комментариев, лайков, реакций, рейтингов, кармы, подписок, аватаров НЕТ
 * (п.1/29). Обсуждение — только через кнопку состояния форума (п.15/16):
 * максимум одна тема на публикацию. Жалоба — не голосование (п.21).
 *
 * Компактный информационный формат (п.25): линейный список с тонкими серыми
 * разделителями — без декоративных карточек, теней, градиентов и тёмно-синих
 * форумных рамок.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import SakhDatetimeBlock from "@/components/site/sakh-datetime-block";
import type { ForumUser } from "@/lib/ui";
import { discussOnForum } from "@/lib/discuss";
import { findPhoneNumbers } from "@/lib/moderation/premoderation";
import { findEmotionalLabels, WTB_HINT_FORUM_BUTTON_LABEL } from "@/lib/moderation/wheretobuy-hint-premoderation";
import { nickGenderClass } from "@/lib/nick-gender";

/** ТЗ 2026-09-23 «Ответить»: один ответ в плоском списке на карточке. */
interface CdAnswerItem {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
}

interface CheapItem {
  id: string;
  title: string;
  text: string;
  place: string;
  status: string; // comparing | cheaper | fixed | irrelevant
  authorId: string;
  authorName: string;
  editedAt: string | null;
  createdAt: string;
  topicId: number | null;
  topicState?: string; // none | open | closed | archived
  isHiddenByAi?: boolean;
  hiddenReason?: string;
  needHuman?: boolean;
  // ТЗ 2026-09-23 «Ответить»: ПЛОСКИЙ СПИСОК ответов — сколько угодно,
  // без вложенности; ответов на ответ НЕТ (споры — только на форуме).
  answers?: CdAnswerItem[];
  // Legacy-поля прежнего одиночного ответа (совместимость).
  answerText?: string;
  answerAuthorName?: string;
  answeredAt?: string | null;
}

interface SimilarPost {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

interface FeedResponse {
  posts: CheapItem[];
  total: number;
  page: number;
  pages: number;
}

const PAGE_SIZE = 50;

/** Дата и время публикации: «8 сентября, 14:30» (ТЗ п.23). */
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** Причины жалоб (ТЗ п.21 — ровно пять). */
const CD_COMPLAINT_REASONS = [
  { key: "ad", label: "Реклама" },
  { key: "spam", label: "Спам" },
  { key: "fraud", label: "Мошенничество" },
  { key: "personal_data", label: "Личные данные" },
  { key: "other", label: "Другое" },
];

/** Правила «Где дешевле» — правая колонка (ТЗ п.24, дословно). */
const CD_RULES = [
  "Один вопрос — один конкретный товар или одна конкретная модель.",
  "Можно указывать модель, артикул, размер, цвет и другие характеристики.",
  "Если нужно сравнить несколько разных товаров, создайте отдельные публикации.",
  "Вопрос должен быть именно о сравнении цены конкретного товара.",
  "Общие вопросы о дешёвых магазинах и категориях товаров запрещены.",
  "Ответы должны относиться именно к указанному товару.",
  "Желательно указывать конкретный магазин, цену и дату проверки цены.",
  "Существенные условия цены — карта магазина, промокод, доставка и т. п. — желательно указывать явно.",
  "Не следует сравнивать разные модели или несопоставимые товары.",
  "Реклама магазинов, продавцов и собственных товаров запрещена.",
  "Ссылки и контакты допустимы, если они относятся к конкретному вопросу и не используются для рекламы.",
  "Спам и повторяющиеся публикации запрещены.",
  "Если найдено подходящее дешёвое предложение, автор может установить статус «Нашёл дешевле».",
  "Если вопрос больше не актуален, автор может установить статус «Неактуально».",
  "Завершённые публикации сохраняются для будущего поиска.",
  "Нарушающие правила публикации могут быть удалены.",
];

const STATUS_LABELS: Record<string, string> = { comparing: "Сравниваю", cheaper: "Нашёл дешевле", fixed: "Цена зафиксирована", irrelevant: "Неактуально" };

/**
 * ТЗ 2026-09-23 «сквозная логика ИИ-фильтра»: серая плашка фильтра ответа —
 * ДОСЛОВНЫЙ текст заказчика (единый для телефонов и плохих слов). Паттерны:
 * телефоны («89…», «+79…») и слова «барыги, хамы, мошенники, уроды, вор,
 * обдираловка, спекулянты» (findPhoneNumbers/findEmotionalLabels).
 */
const FILTER_PLAQUE_TEXT =
  "Сообщение отклонено фильтром главной страницы. На главной странице запрещено публиковать личные мобильные телефоны и субъективные споры. Вы можете опубликовать этот текст на форуме.";

/** Гостю кнопка «📍 Ответить» формы не открывает. */
const ANSWER_GUEST_NOTE =
  "Чтобы отвечать на запросы — войдите в аккаунт.";

/** ТЗ 2026-09-23: метка кнопки ответа — ровно [ 📍 Ответить ]. */
const ANSWER_BUTTON_LABEL = "📍 Ответить";

/** Запасной ИД темы-приёмника «Товары и услуги ▸ Цены» (source
 *  "cheap-hints-transfer", самовосстановление; обычно приходит из GET). */
const FALLBACK_TRANSFER_TOPIC_ID = 178;

/**
 * ТЗ 2026-09-23 (часть 3): под каждым запросом — СТРОГО две кнопки;
 * надпись кнопки форума — всегда по ТЗ (состояние темы — цветом/подсказкой).
 */
const FORUM_BUTTON_LABEL = "💬 Обсудить на форуме";

function forumButtonTitle(state: string | undefined): string {
  switch (state) {
    case "open":
      return "Тема обсуждения открыта на форуме";
    case "closed":
      return "Тема закрыта — читать на форуме";
    case "archived":
      return "Тема в архиве — читать на форуме";
    default:
      return "Открыть обсуждение на форуме (рубрика «Товары и услуги ▸ Цены»)";
  }
}

/** ТЗ 2026-09-24 «Вопрос решён»: авторская кнопка в служебном ряду —
 *  видна ТОЛЬКО автору вопроса. Нажатие → подтверждение (текст дословно);
 *  после подтверждения статус «Цена зафиксирована» и карточка тускнеет.
 *  Передумал — кнопка меняется на «↩️ Вернуть в актуальные», статус
 *  возвращается в «Сравниваю». */
const SOLVE_BUTTON_LABEL = "✅ Вопрос решён";
const SOLVE_CONFIRM_TEXT =
  "Отметить вопрос как решённый? После этого публикация получит статус \"Решено\" и потускнеет.";
const REOPEN_BUTTON_LABEL = "↩️ Вернуть в актуальные";

/* ------------------------------------------------------------------ */
/* Вопрос ленты                                                        */
/* ------------------------------------------------------------------ */

function CheapRow(props: {
  item: CheapItem;
  user: ForumUser | null;
  token: string | null;
  busy: boolean;
  highlight: boolean;
  /** ИД темы-приёмника для переноса текста (ТЗ часть 4). */
  transferTopicId: number;
  onDiscuss: (item: CheapItem) => void;
  onEdit: (item: CheapItem) => void;
  onDelete: (item: CheapItem) => void;
  onStatus: (item: CheapItem, status: string) => void;
  onComplain: (item: CheapItem) => void;
  /** Ответ принят — перезагрузить ленту. */
  onAnswered: () => void;
  notify: (m: string) => void;
}) {
  const { item, user } = props;
  const own = !!(user && item.authorId === user.id);
  // ТЗ часть 3: кнопка «📍 Ответить на запрос» → инлайн-поле прямо на странице.
  const [answerOpen, setAnswerOpen] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [answerBlocked, setAnswerBlocked] = useState<"phones" | "labels" | null>(null);
  const [answerErr, setAnswerErr] = useState("");
  const [answerBusy, setAnswerBusy] = useState(false);
  // ТЗ часть 3: после ответа карточка получает статус и ТУСКНЕЕТ.
  const dim = item.status === "fixed" || item.status === "cheaper" || item.status === "irrelevant";

  const changeAnswer = (v: string) => {
    setAnswerText(v);
    // Текст изменился — прежний вердикт фильтра устарел, плашка гаснет.
    setAnswerBlocked(null);
    setAnswerErr("");
  };

  const toggleAnswer = () => {
    if (!(props.user && props.token)) {
      // Гостю форма НЕ открывается — примечание о входе ниже.
      setAnswerOpen(true);
      return;
    }
    setAnswerOpen((v) => !v);
    setAnswerBlocked(null);
    setAnswerErr("");
  };

  /** ТЗ 2026-09-24 «Вопрос решён»: подтверждение перед сменой статуса.
   *  Согласие → статус «Цена зафиксирована» (карточка тускнеет); отмена —
   *  ничего не меняется. Смена статуса доступна только автору (own). */
  const askSolve = (row: CheapItem) => {
    if (window.confirm(SOLVE_CONFIRM_TEXT)) props.onStatus(row, "fixed");
  };

  /** ТЗ части 3/4: сухой факт → статус «Цена зафиксирована» + тускнеет.
   *  Текст с телефоном/плохим словом БЛОКИРУЕТСЯ на клиенте: публикация не
   *  отправляется, ТЕКСТ НЕ СТИРАЕТСЯ, под полем — серая плашка
   *  (bg-zinc-50/border-zinc-200) с кнопкой переноса на форум. */
  const submitAnswer = async () => {
    const t = answerText.trim();
    if (t.length < 3) {
      setAnswerErr("Опишите сухой факт: цену, магазин и ориентир (от 3 символов).");
      return;
    }
    setAnswerErr("");
    // Проверка ДО отправки: тот же движок, что на сервере и на Главной.
    const phones = findPhoneNumbers(t);
    const labels = findEmotionalLabels(t);
    if (phones.length > 0 || labels.length > 0) {
      setAnswerBlocked(phones.length > 0 ? "phones" : "labels");
      return; // без fetch: ничего не отправляется и не стирается
    }
    setAnswerBlocked(null);
    setAnswerBusy(true);
    try {
      const r = await fetch(`/api/gdedeshevle/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, action: "answer", answerText: t }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось отправить ответ");
      setAnswerOpen(false);
      setAnswerText("");
      props.notify(d.note || "Ответ принят: статус — «Цена зафиксирована»");
      props.onAnswered();
    } catch (e) {
      setAnswerErr(e instanceof Error ? e.message : "Ошибка ответа");
    } finally {
      setAnswerBusy(false);
    }
  };

  const answers = item.answers ?? [];
  /* ТЗ: строка «✅ Статус: Цена зафиксирована» — галочка у итогового статуса. */
  const statusLabel = STATUS_LABELS[item.status] ?? item.status;
  const statusDone = item.status === "fixed" || item.status === "cheaper";

  return (
    <article
      className={`cd-item${props.highlight ? " cd-highlight" : ""}${dim ? " is-dim" : ""}`}
      data-cd-id={item.id}
      data-cd-status={item.status}
    >
      {/* ТЗ: шапка карточки — «📍 [Ник] · [Дата] · [Город]». П.7 (2026-09-24):
          ник окрашен по полу, как на форуме (g-male/g-female/g-neutral). */}
      <div className="cd-headrow" data-cd-head={item.id}>
        📍 <b className={nickGenderClass(item.authorName)}>{item.authorName}</b> · {fmtDateTime(item.createdAt)}
        {item.place ? ` · ${item.place}` : ""}
        {item.editedAt && " · изменено автором"}
      </div>

      {/* ТЗ: «Вопрос: [текст вопроса]». */}
      <div className="cd-q">
        <span className="cd-qlabel">Вопрос:</span> {item.title}
      </div>
      {item.text && <div className="cd-qtext">{item.text}</div>}

      {own && item.isHiddenByAi && (
        <div className="cd-hiddennote">
          Вопрос скрыт модерацией: {item.hiddenReason || "нарушение правил раздела"}. Его проверит
          человек-модератор и при ошибке вернёт в ленту.
        </div>
      )}
      {own && !item.isHiddenByAi && item.needHuman && (
        <div className="cd-humannote">Вопрос отправлен на дополнительную проверку человеку-модератору.</div>
      )}

      {/* ТЗ: ПЛОСКИЙ СПИСОК ответов — «📍 Ответ от [ник]: [текст]».
          Ответов может быть СКОЛЬКО УГОДНО; внутри ответа НЕТ кнопки
          «Ответить» (ответов на ответ нет), вложенности и лесенки нет —
          споры уходят на форум (кнопка «💬 Обсудить на форуме»). */}
      {answers.length > 0 && (
        <div className="cd-answers" data-cd-answers={item.id}>
          {answers.map((a) => (
            <div className="cd-answer" key={a.id} data-cd-answer={a.id}>
              📍 Ответ от <b className={nickGenderClass(a.authorName)}>{a.authorName}</b>: {a.text}
            </div>
          ))}
        </div>
      )}

      <div className="cd-sep" />

      {/* 04.10.2026: ОДНА строка статуса + кнопок (статусная строка
          объединена с actrow). Раньше статус был отдельной строкой
          над кнопками — пользователь видел «две строки» (статус и
          кнопки Пожаловаться/Ответить/Обсудить на форуме).
          Теперь всё в одном ряду .cd-actrow.cd-actrow-unified:
            [Статус] [Пожаловаться (не владельцу) / авторские кнопки] [📍 Ответить] [💬 Обсудить на форуме]
          Статус — слева (margin-right:auto в CSS), кнопки — справа. */}

      <div className="cd-actrow-container" data-cd-actrow={item.id}>
        <div className="cd-row cd-row-1">
          <span className={`cd-statusline is-${item.status}`} data-cd-statusline={item.id}>
            {statusDone ? "✅ Статус: " : "Статус: "}
            {statusLabel}
          </span>
          {own && item.status === "comparing" && (
            <button className="cd-act cd-solvebtn" data-cd-solve={item.id} disabled={props.busy} onClick={() => askSolve(item)}>
              {SOLVE_BUTTON_LABEL}
            </button>
          )}
          {own && item.status !== "comparing" && (
            <button className="cd-act cd-reopenbtn" data-cd-reopen={item.id} disabled={props.busy} onClick={() => props.onStatus(item, "comparing")}>
              {REOPEN_BUTTON_LABEL}
            </button>
          )}
          {!own && user && (
            <button className="cd-report" onClick={() => props.onComplain(item)}>Пожаловаться</button>
          )}
        </div>
        {own && (
          <div className="cd-row cd-row-2">
            {item.status === "comparing" && (
              <button className="cd-act cd-statusbtn" disabled={props.busy} onClick={() => props.onStatus(item, "irrelevant")}>Неактуально</button>
            )}
            <button className="cd-act" disabled={props.busy} onClick={() => props.onEdit(item)}>Редактировать</button>
            <button className="cd-act cd-del" disabled={props.busy} onClick={() => props.onDelete(item)}>Удалить</button>
          </div>
        )}
        {!own && (
          <div className="cd-row cd-row-actions-other">
            <button className="cd-act cd-answerbtn" disabled={props.busy || answerBusy} onClick={toggleAnswer}>{ANSWER_BUTTON_LABEL}</button>
            <button className={`cd-act cd-btn-forum is-${item.topicId ? item.topicState ?? "open" : "none"}`} disabled={props.busy} onClick={() => props.onDiscuss(item)} title={forumButtonTitle(item.topicId ? item.topicState : "none")}>{FORUM_BUTTON_LABEL}</button>
          </div>
        )}
        {own && (
          <div className="cd-row cd-row-4">
            <button className={`cd-act cd-btn-forum is-${item.topicId ? item.topicState ?? "open" : "none"}`} disabled={props.busy} onClick={() => props.onDiscuss(item)} title={forumButtonTitle(item.topicId ? item.topicState : "none")}>{FORUM_BUTTON_LABEL}</button>
          </div>
        )}
      </div>

      {/* ТЗ: кнопка «📍 Ответить» открывает простое текстовое поле под
          карточкой; «Опубликовать» добавляет ответ в плоский список.
          Флуда здесь нет — обсуждения уходят на форум. */}
      {answerOpen && (
        <div className="cd-answerform" data-cd-answerform={item.id}>
          {props.user && props.token ? (
            <>
              <textarea
                data-cd-answer-input={item.id}
                value={answerText}
                maxLength={300}
                onChange={(e) => changeAnswer(e.target.value)}
                placeholder="Только сухой факт: цена, магазин, ориентир. Без флуда и споров."
                aria-label={`Ответ на запрос «${item.title}»`}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7, flexWrap: "wrap" }}>
                <button
                  className="sk-btn-classic"
                  data-cd-answer-submit={item.id}
                  disabled={answerBusy}
                  onClick={submitAnswer}
                  style={{ borderRadius: 0 }}
                >
                  {answerBusy ? "Проверка…" : "Опубликовать"}
                </button>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  Ответ появится в списке на карточке; первым ответом карточка получит статус «Цена зафиксирована» и тускнеет.
                </span>
              </div>
              {/* ТЗ: серая плашка фильтра (bg-zinc-50 / border-zinc-200).
                  Поле НЕ стёрто, публикация НЕ отправлена; кнопка бесшовно
                  переносит текст на форум. */}
              {answerBlocked && (
                <div
                  className="cd-answerplaque"
                  data-cd-filter-plaque={answerBlocked}
                  role="alert"
                  style={{ marginTop: 9, border: "1px solid #e4e4e7", background: "#f4f4f5", padding: "9px 11px" }}
                >
                  <div data-cd-filter-plaque-text={answerBlocked} style={{ fontSize: 13, lineHeight: 1.45, color: "#3f3f46" }}>
                    {FILTER_PLAQUE_TEXT}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <a
                      className="wb-hint-forum-btn"
                      data-cd-filter-forum-btn={item.id}
                      href={`/forum/topic/${props.transferTopicId}?prefilled_text=${encodeURIComponent(answerText.trim())}`}
                      style={{ display: "inline-block", background: "#1E3A5F", color: "#fff", fontSize: 13, fontWeight: 600, padding: "8px 12px", textDecoration: "none" }}
                    >
                      {WTB_HINT_FORUM_BUTTON_LABEL}
                    </a>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div data-cd-answer-guest={item.id} style={{ fontSize: 13, color: "#475569" }}>
              {ANSWER_GUEST_NOTE}
            </div>
          )}
          {answerErr && (
            <div data-cd-answer-err={item.id} role="alert" style={{ marginTop: 7, fontSize: 13, fontWeight: 600, color: "#AA3333" }}>
              {answerErr}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Форма вопроса / редактирования (ТЗ п.5 — простая форма)             */
/* ------------------------------------------------------------------ */

function CheapFormModal(props: {
  token: string | null;
  editItem: CheapItem | null;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const isEdit = !!props.editItem;
  const [title, setTitle] = useState(props.editItem?.title ?? "");
  const [text, setText] = useState(props.editItem?.text ?? "");
  const [place, setPlace] = useState(props.editItem?.place ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [specHint, setSpecHint] = useState(""); // подсказка конкретности / нескольких товаров (ТЗ п.2/3)
  const [similar, setSimilar] = useState<SimilarPost[] | null>(null); // предупреждение о похожих (ТЗ п.11)

  const clearWarnings = () => {
    setSpecHint("");
    setSimilar(null);
    setErr("");
  };

  const submit = async (confirmSimilar: boolean) => {
    clearWarnings();
    if (title.trim().length < 5) {
      setErr("Заголовок слишком короткий — минимум 5 символов");
      return;
    }
    if (text.trim().length < 10) {
      setErr("Напишите текст вопроса — минимум 10 символов");
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = isEdit
        ? { token: props.token, action: "edit", title: title.trim(), text: text.trim(), place: place.trim() }
        : { token: props.token, title: title.trim(), text: text.trim(), place: place.trim() };
      if (confirmSimilar) payload.confirmSimilar = true;
      const r = await fetch(isEdit ? `/api/gdedeshevle/${props.editItem!.id}` : "/api/gdedeshevle", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      // Слишком общий вопрос или несколько товаров (ТЗ п.2/3/4): подсказка
      // вместо молчаливой публикации, пользователь может отредактировать вопрос.
      if (d.needsSpecific) {
        setSpecHint(d.hint || "Укажите конкретный товар или модель.");
        return;
      }
      // Похожий вопрос уже опубликован (ТЗ п.11): предупреждение + ссылка,
      // но создание не запрещено — можно продолжить.
      if (d.similar && Array.isArray(d.similarPosts) && d.similarPosts.length > 0) {
        setSimilar(d.similarPosts as SimilarPost[]);
        return;
      }
      if (!r.ok) throw Error(d.error || "Не удалось опубликовать. Попробуйте ещё раз.");
      props.onDone(d.note || (isEdit ? "Вопрос обновлён" : "Вопрос опубликован"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sk-modal-overlay" onClick={props.onClose}>
      <div className="sk-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="sk-modal-title">
          <span>{isEdit ? "Редактировать вопрос" : "Задать вопрос в «Где дешевле»"}</span>
          <button className="sk-modal-x" onClick={props.onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="sk-modal-body">
          <div className="sk-modal-row">
            <label htmlFor="cd-f-title">Заголовок — где дешевле купить конкретный товар</label>
            <input
              id="cd-f-title"
              value={title}
              maxLength={150}
              onChange={(e) => {
                setTitle(e.target.value);
                clearWarnings();
              }}
              placeholder="Например: Где дешевле купить Bosch S5 AGM 70 Ah?"
            />
          </div>
          {specHint && (
            <div className="cd-spechint" role="alert">
              {specHint}
            </div>
          )}
          <div className="sk-modal-row">
            <label htmlFor="cd-f-text">Текст вопроса</label>
            <textarea
              id="cd-f-text"
              value={text}
              maxLength={8000}
              onChange={(e) => {
                setText(e.target.value);
                clearWarnings();
              }}
              placeholder="Уточните модель, артикул, размер, цвет или комплектацию. Можно сразу написать, как с вами связаться…"
              style={{ minHeight: 120 }}
            />
          </div>
          <div className="sk-modal-row">
            <label htmlFor="cd-f-place">Место — необязательно</label>
            <input
              id="cd-f-place"
              value={place}
              maxLength={80}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Южно-Сахалинск, Холмск, Корсаков, Долинск или конкретный район"
            />
          </div>
          {similar && similar.length > 0 && (
            <div className="cd-similarwarn" role="alert">
              <b>Похожий вопрос уже опубликован. Возможно, сравнение цен уже есть.</b>
              <ul>
                {similar.map((s) => (
                  <li key={s.id}>
                    <a href={`/gde-deshevle?post=${s.id}`}>«{s.title}»</a> — открыть
                  </li>
                ))}
              </ul>
              <p>Если ваш вопрос действительно отличается или цены изменились, опубликуйте его.</p>
            </div>
          )}
          <div className="sk-modal-demo">
            <b>Здесь сравнивают цену конкретного товара: одна публикация — один товар или одна модель.</b> Общие вопросы
            («где дешевле покупать продукты», «какой магазин самый дешёвый») не подходят разделу. Реклама магазинов и
            продавцов запрещена. Контакты при желании укажите прямо в тексте вопроса.
          </div>
          {err && <div className="sk-modal-err">{err}</div>}
          <div className="sk-modal-actions">
            <button className="sk-btn-classic" disabled={busy} onClick={() => submit(!!similar)}>
              {busy ? "Проверка…" : similar ? "Всё равно опубликовать" : isEdit ? "Сохранить" : "Опубликовать"}
            </button>
            <button className="right" onClick={props.onClose}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Жалоба (ТЗ п.21)                                                    */
/* ------------------------------------------------------------------ */

function CheapComplaintModal(props: {
  item: CheapItem;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [category, setCategory] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!category) {
      setErr("Выберите причину жалобы");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/gdedeshevle/${props.item.id}/complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, comment: comment.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось отправить жалобу");
      props.onDone(d.note || "Жалоба отправлена. Спасибо. Модерация рассмотрит вопрос.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sk-modal-overlay" onClick={props.onClose}>
      <div className="sk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sk-modal-title">
          <span>Жалоба на вопрос</span>
          <button className="sk-modal-x" onClick={props.onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="sk-modal-body">
          <div className="sk-modal-demo">
            Вопрос: «{props.item.title}». Жалоба уходит модерации. Жалобы не являются голосованием: их количество не
            публикуется, публикацию жалоба сама по себе не удаляет.
          </div>
          <div className="sk-modal-row">
            <label>Причина</label>
            {CD_COMPLAINT_REASONS.map((r) => (
              <label key={r.key} className="complaint-option">
                <input
                  type="radio"
                  name="cd-complaint"
                  checked={category === r.key}
                  onChange={() => setCategory(r.key)}
                />
                {r.label}
              </label>
            ))}
          </div>
          <div className="sk-modal-row">
            <label htmlFor="cd-c-comment">Комментарий (необязательно)</label>
            <textarea
              id="cd-c-comment"
              value={comment}
              maxLength={1000}
              onChange={(e) => setComment(e.target.value)}
              style={{ minHeight: 70 }}
              placeholder="Что именно нарушено…"
            />
          </div>
          {err && <div className="sk-modal-err">{err}</div>}
          <div className="sk-modal-actions">
            <button className="sk-btn-classic" disabled={busy || !category} onClick={submit}>
              {busy ? "Отправка…" : "Отправить жалобу"}
            </button>
            <button className="right" onClick={props.onClose}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Страница раздела                                                    */
/* ------------------------------------------------------------------ */

export function GdedeshevlePage(props: {
  user: ForumUser | null;
  token: string | null;
  notify: (m: string) => void;
  onNeedAuth: () => void;
}) {
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [activeNav, setActiveNav] = useState<"home" | "latest" | "mine">("home");
  const [items, setItems] = useState<CheapItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [place, setPlace] = useState("");
  const [appliedPlace, setAppliedPlace] = useState("");
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<CheapItem | null>(null);
  const [complainItem, setComplainItem] = useState<CheapItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // ТЗ 2026-09-23 (часть 4): ИД темы-приёмника «Товары и услуги ▸ Цены»
  // для кнопки переноса (плашка фильтра → /forum/topic/ИД?prefilled_text=…).
  const [transferTopicId, setTransferTopicId] = useState<number>(FALLBACK_TRANSFER_TOPIC_ID);
  const listTopRef = useRef<HTMLDivElement | null>(null);

  // ТЗ часть 4: резолвим ИД темы-приёмника (GET отдаёт forumTopicId,
  // сид самовосстанавливается — как у быстрых подсказок Главной).
  useEffect(() => {
    let alive = false;
    fetch("/api/gdedeshevle-hints")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive && d && typeof d.forumTopicId === "number") setTransferTopicId(d.forumTopicId);
      })
      .catch(() => {});
    return () => {
      alive = true;
    };
  }, []);

  const load = useCallback(async () => {
    setError("");
    try {
      const sp = new URLSearchParams();
      if (tab === "mine") {
        sp.set("mine", "1");
        sp.set("token", props.token ?? "");
      } else {
        sp.set("page", String(page));
        sp.set("pageSize", String(PAGE_SIZE));
        if (appliedQ) sp.set("q", appliedQ);
        if (appliedPlace) sp.set("place", appliedPlace);
      }
      const r = await fetch(`/api/gdedeshevle?${sp.toString()}`);
      const d: FeedResponse & { error?: string; posts?: CheapItem[] } = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка загрузки");
      setItems(d.posts ?? []);
      setTotal(d.total ?? d.posts?.length ?? 0);
      setPages(d.pages ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
      setItems([]);
    } finally {
      // nothing
    }
  }, [tab, page, appliedQ, appliedPlace, props.token]);

  useEffect(() => {
    load();
  }, [load]);

  // Глубокая ссылка из темы форума: /gde-deshevle?post=ID — подсветить вопрос.
  useEffect(() => {
    const postId = new URLSearchParams(window.location.search).get("post");
    if (!postId) return;
    setHighlightId(postId);
    const t = window.setInterval(() => {
      const el = document.querySelector(`[data-cd-id="${postId}"]`);
      if (el) {
        el.scrollIntoView({ block: "center" });
        window.clearInterval(t);
        window.setTimeout(() => setHighlightId(null), 4000);
      }
    }, 300);
    window.setTimeout(() => window.clearInterval(t), 12000);
    return () => window.clearInterval(t);
  }, [items]);

  const openNewForm = () => {
    if (!props.user) {
      props.onNeedAuth();
      return;
    }
    setEditItem(null);
    setFormOpen(true);
  };

  const mineTab = (t: "all" | "mine", nav: "home" | "latest" | "mine") => {
    if (t === "mine" && !props.user) {
      props.onNeedAuth();
      return;
    }
    setActiveNav(nav);
    setTab(t);
    setPage(1);
    setQ("");
    setAppliedQ("");
    setPlace("");
    setAppliedPlace("");
    window.scrollTo(0, 0);
  };

  const goToPage = (p: number) => {
    setPage(Math.min(Math.max(1, p), pages));
    listTopRef.current?.scrollIntoView({ block: "start" });
  };

  const applySearch = () => {
    setAppliedQ(q.trim());
    setAppliedPlace(place.trim());
    setPage(1);
  };

  const resetSearch = () => {
    setQ("");
    setPlace("");
    setAppliedQ("");
    setAppliedPlace("");
    setPage(1);
  };

  /**
   * Кнопка состояния форума — ЕДИНАЯ ЛОГИКА ТЗ 2026-09-23: переход по
   * относительной ссылке, работает и у гостя: тема связана →
   * /forum/topic/<id>, темы нет → /forum/category/<slug> — рубрика
   * «Товары и услуги ▸ Цены» (п.3/4/5 ТЗ). Прежний POST /discuss
   * заменён переходом в публичную рубрику блока.
   */
  /**
   * Кнопка состояния форума — ТЗ 2026-09-24 «Обсудить на форуме —
   * авто-создание темы»: при клике вызываем универсальный API
   * POST /api/discuss/gdedeshevle/<postId>, который:
   *   • если у вопроса уже есть topicId — редирект в существующую тему;
   *   • если нет — создаёт тему в рубрике «Цены» от имени текущего
   *     пользователя, привязывает к вопросу, редиректит.
   * Гостю открываем AuthModal.
   */
  const discuss = (item: CheapItem) => {
    discussOnForum("gdedeshevle", item.id, props.token, props.onNeedAuth);
  };

  const openEdit = (item: CheapItem) => {
    setEditItem(item);
    setFormOpen(true);
  };

  const deleteItem = async (item: CheapItem) => {
    if (!window.confirm("Удалить вопрос? Он исчезнет из общей ленты.")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/gdedeshevle/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, action: "delete" }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось удалить");
      props.notify(d.note || "Вопрос удалён");
      await load();
    } catch (e) {
      props.notify(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  /** Смена статуса вопроса (ТЗ п.12/14): Нашёл дешевле / Неактуально / возврат в Сравниваю. */
  const setStatus = async (item: CheapItem, status: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/gdedeshevle/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, action: "status", status }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось изменить статус");
      props.notify(d.note || "Статус обновлён");
      await load();
    } catch (e) {
      props.notify(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const list = items ?? [];
  const searching = !!(appliedQ || appliedPlace);

  return (
    <>
      {/* ТЗ 2026-09-28 (правки 1–4): 3-колоночный layout СОХРАНЯЕТСЯ,
          но блоки перераспределены:
          — ЛЕВАЯ колонка: блок «О разделе» (в дизайне .sakh-clock)
          — ЦЕНТРАЛЬНАЯ колонка: header-bar (заголовок «Где дешевле» + навигация
            «Последние вопросы / Мои публикации» + кнопка «Задать вопрос» —
            в одной строке по центру) + лента вопросов
          — ПРАВАЯ колонка: Время + блок «Правила «Где дешевле»» (в дизайне .sakh-clock) */}
      <div className="cd-layout main-grid-container">

        {/* ЛЕВАЯ КОЛОНКА — блок «О разделе» (в дизайне .sakh-clock, правка 2+4) */}
        <aside className="cd-col-left left-column">
          <div className="sakh-clock cd-clock-block cd-clock-about">
            <div className="sakh-clock-head">ℹ️ О разделе</div>
            <div className="sakh-clock-body sakh-clock-body-content">
              {/* 04.10.2026: мобильная версия «О разделе» сокращена до
                  главной сути; полный текст виден только на десктопе
                  (CSS: .about-short скрыт на десктопе, .about-full скрыт
                  на мобайле ≤768px). */}
              <div className="cd-info about-full">
                <p>
                  «Где дешевле» — самостоятельный раздел сравнения цен: спрашивайте, где на Сахалине дешевле купить
                  конкретную модель, артикул или размер. Это не форум, не каталог магазинов и не рекламная площадка:
                  обсуждений, комментариев и реакций под вопросом нет.
                </p>
                <p>
                  Вопрос содержит шапку (ник автора, дата, город), текст вопроса, статус («Сравниваю», «Нашёл дешевле»,
                  «Цена зафиксирована», «Неактуально») и список ответов. Обсудить цену можно на форуме — под каждым
                  вопросом есть кнопка «Обсудить на форуме»; для вопроса создаётся не более одной темы обсуждения.
                  Ответить сухим фактом можно прямо на странице — кнопка «📍 Ответить».
                </p>
                <p>
                  Ответов может быть сколько угодно: все они публикуются плоским списком на карточке — «📍 Ответ от
                  ника: факт». Ответов на ответ нет: споры и обсуждения — только на форуме. Как только карточка получает
                  хотя бы один ответ, её статус становится «Цена зафиксирована», карточка тускнеет, но ответы продолжают
                  добавляться.
                </p>
                <p>
                  Автор может отредактировать или удалить свой вопрос, а также установить статус «Нашёл дешевле» или
                  «Неактуально». Вопросы не удаляются автоматически — со временем они превращаются в полезную базу цен:
                  какой конкретный товар и где на Сахалине стоил дешевле.
                </p>
              </div>
              <div className="cd-info about-short">
                <p>
                  Где на Сахалине дешевле купить конкретный товар (модель, артикул, размер). Один вопрос —
                  один товар. Ответы — с ценой и магазином на карточке; обсуждение — на форуме. Автор меняет
                  статус: «Сравниваю» → «Нашёл дешевле» / «Цена зафиксирована» / «Неактуально».
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Центральная колонка — лента вопросов + header bar (правки 1) */}
        <div className="cd-col-main center-column">
          <div className="cd-head">
            {/* Правка 1: заголовок «Где дешевле» + навигация (Последние вопросы /
                Мои публикации) + кнопка «Задать вопрос» — в одной строке, по центру. */}
            <div className="cd-head-bar">
              {/* 28.09.2026: H1 «Где дешевле» прижат к левому краю,
                  nav + кнопка «Задать вопрос» — к правому. Группировка
                  через .cd-head-right + justify-content: space-between. */}
              <div className="cd-title">Где дешевле</div>
              <div className="cd-head-right">
                <div className="cd-nav-inline">
                  <button className={activeNav === "latest" ? "active" : ""} onClick={() => mineTab("all", "latest")}>
                    Последние вопросы
                  </button>
                  <button className={activeNav === "mine" ? "active" : ""} onClick={() => mineTab("mine", "mine")}>
                    Мои публикации
                  </button>
                </div>
                <button className="cd-addbtn" onClick={openNewForm}>
                  {/* 2026-10-02: знак «＋» убран по просьбе пользователя. */}
                  Задать вопрос
                </button>
              </div>
            </div>
            {/* 2026-10-02: надпись «Задавать вопросы могут только зарегистрированные
                пользователи — войдите или зарегистрируйтесь. Гости могут читать.»
                удалена по просьбе пользователя. */}
            <div className="cd-desc">Сравнивайте цены на конкретный товар и находите, где его можно купить дешевле.</div>

            {/* 28.09.2026 (по запросу пользователя): блоки .cd-search
                (поле поиска + кнопка «Найти» + «Сбросить») и .cd-placefilter
                (поле места + кнопка «Показать») УБРАНЫ из центральной колонки. */}
          </div>

          <div ref={listTopRef} />

          {items === null && !error && <div className="cd-empty">Загрузка…</div>}
          {error && <div className="sk-error">{error}</div>}
          {items !== null && !error && list.length === 0 && (
            <div className="cd-empty">
              {tab === "mine"
                ? "У вас пока нет публикаций."
                : searching
                  ? `По запросу ничего не найдено. Попробуйте изменить слова поиска.`
                  : "Пока нет вопросов — задайте первый вопрос о цене конкретного товара."}
            </div>
          )}

          {/* Лента: Сравниваю → Нашёл дешевле → Неактуально, внутри группы новые сверху
              (ТЗ п.13), стабильные позиции и пагинация (ТЗ п.1/25) */}
          {items !== null &&
            !error &&
            list.map((item) => (
              <CheapRow
                key={item.id}
                item={item}
                user={props.user}
                token={props.token}
                busy={busy}
                transferTopicId={transferTopicId}
                highlight={highlightId === item.id}
                onDiscuss={discuss}
                onEdit={openEdit}
                onDelete={deleteItem}
                onStatus={setStatus}
                onComplain={setComplainItem}
                onAnswered={load}
                notify={props.notify}
              />
            ))}

          {/* Пагинация (ТЗ п.1/25) — не бесконечная лента */}
          {tab === "all" && pages > 1 && items !== null && !error && (
            <div className="cd-pager">
              <button disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                ← Новее
              </button>
              <span>
                Страница {page} из {pages} · всего {total}
              </span>
              <button disabled={page >= pages} onClick={() => goToPage(page + 1)}>
                Старее →
              </button>
            </div>
          )}
          {/* 2026-10-03: строка «Всего 22 · новые сверху» удалена. */}

          {/* E2eTransferTestPanel с демонстрационными карточками сценариев
              4/5/6 убран со страницы: его карточки выглядели как обычные
              актуальные вопросы (нет серой пелены is-dim), но рендерились
              ПОСЛЕ основного списка — у пользователя складывалось ощущение,
              что «сначала идут актуальные, потом серая пелена, потом снова
              актуальные». Если нужна отладка сквозного переноса на форум,
              открывайте /e2e-transfer (компонент оставлен в проекте). */}
        </div>

        {/* ПРАВАЯ КОЛОНКА — Время + Правила (в дизайне .sakh-clock, правка 4) */}
        <aside className="cd-col-right right-column">
          {/* Часы на всех страницах: первым блоком правой колонки, как на Главной */}
          <SakhDatetimeBlock />
          {/* ТЗ 2026-09-28 (правка 2): «О разделе» убран из правой колонки —
              теперь он в левой. Здесь остаётся только «Правила». */}
          <div className="sakh-clock cd-clock-block cd-clock-rules">
            <div className="sakh-clock-head">⚠️ Правила «Где дешевле»</div>
            <div className="sakh-clock-body sakh-clock-body-content">
              <div className="cd-keyrule">
                Здесь сравнивают цену конкретного товара, а не спрашивают, где вообще дешевле покупать.
              </div>
              <ol className="cd-ruleslist">
                {CD_RULES.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ol>
              <p className="cd-rulesnote">
                Вопросы проверяются модерацией: реклама, скрытая реклама, спам и мошенничество не допускаются; спорные
                случаи рассматривает человек-модератор. Само наличие ссылки, телефона или названия магазина в вопросе о
                конкретном товаре не является нарушением — оценивается контекст. Кнопка «Пожаловаться» есть у каждого
                вопроса; количество жалоб не публикуется и не создаёт никаких оценок.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {formOpen && props.token && (
        <CheapFormModal
          token={props.token}
          editItem={editItem}
          onClose={() => setFormOpen(false)}
          onDone={(msg) => {
            setFormOpen(false);
            setEditItem(null);
            props.notify(msg);
            load();
          }}
        />
      )}
      {complainItem && (
        <CheapComplaintModal
          item={complainItem}
          onClose={() => setComplainItem(null)}
          onDone={(msg) => {
            setComplainItem(null);
            props.notify(msg);
          }}
        />
      )}
    </>
  );
}
