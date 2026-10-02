"use client";

/**
 * ШАГ 18. «Где купить» — самостоятельный раздел вопросов о КОНКРЕТНЫХ товарах
 * (ТЗ п.1/2). Отдельная страница: НЕ форум, НЕ «Подслушано Сахалин», НЕ
 * «Нужна помощь» и не рекламная площадка (ТЗ п.27).
 *
 * Главный принцип (ТЗ п.2/3): здесь спрашивают не «где купить вообще», а
 * «где купить вот этот конкретный товар». Одна публикация — один конкретный
 * товар или одна конкретная модель. Статусы вопроса (п.8): «Ищу» → «Нашёл» /
 * «Неактуально»; найденные и неактуальные вопросы сохраняются в разделе (п.25).
 *
 * Комментариев, лайков, реакций, рейтингов, кармы, подписок, аватаров НЕТ
 * (п.13/26). Обсуждение — только через кнопку состояния форума (п.10/12):
 * максимум одна тема на публикацию (п.11). Жалоба — не голосование (п.18).
 *
 * Компактный информационный формат (п.20/22): линейный список с тонкими серыми
 * разделителями — без декоративных карточек, теней, градиентов и тёмно-синих
 * форумных рамок.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import SakhDatetimeBlock from "@/components/site/sakh-datetime-block";
import E2eTransferTestPanel from "@/components/site/e2e-transfer-test-panel";
import type { ForumUser } from "@/lib/ui";
import { discussOnForum } from "@/lib/discuss";
import { findPhoneNumbers } from "@/lib/moderation/premoderation";
import { findEmotionalLabels, WTB_HINT_FORUM_BUTTON_LABEL } from "@/lib/moderation/wheretobuy-hint-premoderation";
import { nickGenderClass } from "@/lib/nick-gender";

/** ТЗ 2026-09-23 «Ответить»: один ответ в плоском списке на карточке. */
interface WtbAnswerItem {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
}

interface WhereToBuyItem {
  id: string;
  title: string;
  text: string;
  place: string;
  status: string; // seeking | found | irrelevant
  authorId: string;
  authorName: string;
  authorGender?: string | null;
  editedAt: string | null;
  createdAt: string;
  topicId: number | null;
  topicState?: string; // none | open | closed | archived
  isHiddenByAi?: boolean;
  hiddenReason?: string;
  needHuman?: boolean;
  // ТЗ 2026-09-23 «Ответить»: ПЛОСКИЙ СПИСОК ответов — сколько угодно,
  // без вложенности; ответов на ответ НЕТ (споры — только на форуме).
  answers?: WtbAnswerItem[];
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
  posts: WhereToBuyItem[];
  total: number;
  page: number;
  pages: number;
}

const PAGE_SIZE = 15;

/** Дата и время публикации: «8 сентября, 14:30» (ТЗ п.20). */
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** Причины жалоб (ТЗ п.18 — ровно пять). */
const WTB_COMPLAINT_REASONS = [
  { key: "ad", label: "Реклама" },
  { key: "spam", label: "Спам" },
  { key: "fraud", label: "Мошенничество" },
  { key: "personal_data", label: "Личные данные" },
  { key: "other", label: "Другое" },
];

/** Правила «Где купить» — правая колонка (ТЗ п.21, дословно). */
const WTB_RULES = [
  "Публикация должна содержать вопрос о конкретном товаре.",
  "Один вопрос — один конкретный товар или одна конкретная модель.",
  "Если нужно найти несколько разных товаров, создайте отдельные публикации.",
  "Вопрос должен быть именно о том, где приобрести указанный товар.",
  "Общие вопросы о категориях товаров запрещены.",
  "Вопросы «где купить хороший аккумулятор», «где купить телевизор», «посоветуйте магазин» и подобные не относятся к разделу.",
  "Ответы должны относиться именно к указанному товару.",
  "Сравнение цен относится к разделу «Где дешевле».",
  "Реклама магазинов, продавцов и собственных товаров запрещена.",
  "Контактные данные можно по желанию указать непосредственно в тексте публикации.",
  "Ссылки и контакты допустимы, если они относятся к конкретному вопросу и не используются для рекламы.",
  "Спам и повторяющиеся публикации запрещены.",
  "Если товар найден, автор может установить статус «Найдено».",
  "Если вопрос больше не актуален, автор может установить статус «Неактуально».",
  "Найденные и неактуальные вопросы сохраняются в разделе.",
  "Нарушающие правила публикации могут быть удалены.",
];

const STATUS_LABELS: Record<string, string> = { seeking: "Ищу", found: "Найдено", irrelevant: "Неактуально" };

/**
 * ТЗ 2026-09-23 «сквозная логика ИИ-фильтра»: серая плашка фильтра ответа —
 * ДОСЛОВНЫЙ текст заказчика (единый для телефонов и плохих слов; тот же,
 * что у быстрых подсказок на Главной). Паттерны блокировки: телефоны
 * («89…», «+79…») и слова «барыги, хамы, мошенники, уроды, вор,
 * обдираловка, спекулянты» (движок findPhoneNumbers/findEmotionalLabels).
 */
const FILTER_PLAQUE_TEXT =
  "Сообщение отклонено фильтром главной страницы. На главной странице запрещено публиковать личные мобильные телефоны и субъективные споры. Вы можете опубликовать этот текст на форуме.";

/** Гостю кнопка «📍 Ответить» формы не открывает. */
const ANSWER_GUEST_NOTE =
  "Отвечать на запросы могут только зарегистрированные пользователи. Войдите или зарегистрируйтесь.";

/** ТЗ 2026-09-23: метка кнопки ответа — ровно [ 📍 Ответить ]. */
const ANSWER_BUTTON_LABEL = "📍 Ответить";

/** Запасной ИД темы-приёмника «Товары и услуги ▸ Где купить» (source
 *  "wtb-hints-transfer", самовосстановление; обычно приходит из GET). */
const FALLBACK_TRANSFER_TOPIC_ID = 177;

/**
 * ТЗ 2026-09-23 (часть 3): под каждым запросом — СТРОГО две кнопки.
 * Кнопка 2 — [💬 Обсудить на форуме]: мгновенный переход в привязанную
 * ветку («Товары и услуги ▸ Где купить»); состояние темы передаётся
 * цветом класса и всплывающей подсказкой, надпись — всегда по ТЗ.
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
      return "Открыть обсуждение на форуме (рубрика «Товары и услуги ▸ Где купить»)";
  }
}

/** ТЗ 2026-09-24 «Вопрос решён»: авторская кнопка в служебном ряду —
 *  видна ТОЛЬКО автору вопроса. Нажатие → подтверждение (текст дословно);
 *  после подтверждения статус «Найдено» и карточка тускнеет. Передумал —
 *  кнопка меняется на «↩️ Вернуть в актуальные», статус возвращается. */
const SOLVE_BUTTON_LABEL = "✅ Вопрос решён";
const SOLVE_CONFIRM_TEXT =
  "Отметить вопрос как решённый? После этого публикация получит статус \"Решено\" и потускнеет.";
const REOPEN_BUTTON_LABEL = "↩️ Вернуть в актуальные";

/* ------------------------------------------------------------------ */
/* Вопрос ленты                                                        */
/* ------------------------------------------------------------------ */

function WhereToBuyRow(props: {
  item: WhereToBuyItem;
  user: ForumUser | null;
  token: string | null;
  busy: boolean;
  highlight: boolean;
  /** ИД темы-приёмника для переноса текста (ТЗ часть 4). */
  transferTopicId: number;
  onDiscuss: (item: WhereToBuyItem) => void;
  onEdit: (item: WhereToBuyItem) => void;
  onDelete: (item: WhereToBuyItem) => void;
  onStatus: (item: WhereToBuyItem, status: string) => void;
  onComplain: (item: WhereToBuyItem) => void;
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
  const dim = item.status === "found" || item.status === "irrelevant";

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
   *  Согласие → статус «Найдено» (карточка тускнеет); отмена — ничего
   *  не меняется. Смена статуса доступна только автору (own). */
  const askSolve = (row: WhereToBuyItem) => {
    if (window.confirm(SOLVE_CONFIRM_TEXT)) props.onStatus(row, "found");
  };

  /** ТЗ части 3/4: сухой факт → статус «Найдено» + тускнеет. Текст с
   *  телефоном/плохим словом БЛОКИРУЕТСЯ на клиенте: публикация не
   *  отправляется, ТЕКСТ НЕ СТИРАЕТСЯ, под полем — серая плашка
   *  (bg-zinc-50/border-zinc-200) с кнопкой переноса на форум. */
  const submitAnswer = async () => {
    const t = answerText.trim();
    if (t.length < 3) {
      setAnswerErr("Опишите сухой факт: точный адрес, ТЦ или ориентир (от 3 символов).");
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
      const r = await fetch(`/api/wheretobuy/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, action: "answer", answerText: t }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось отправить ответ");
      setAnswerOpen(false);
      setAnswerText("");
      props.notify(d.note || "Ответ принят: статус — «Найдено»");
      props.onAnswered();
    } catch (e) {
      setAnswerErr(e instanceof Error ? e.message : "Ошибка ответа");
    } finally {
      setAnswerBusy(false);
    }
  };

  const answers = item.answers ?? [];
  /* ТЗ: строка «✅ Статус: Найдено» — галочка у итогового статуса. */
  const statusLabel = STATUS_LABELS[item.status] ?? item.status;
  const statusDone = item.status === "found";

  return (
    <article
      className={`wb-item${props.highlight ? " wb-highlight" : ""}${dim ? " is-dim" : ""}`}
      data-wb-id={item.id}
      data-wb-status={item.status}
    >
      {/* ТЗ: шапка карточки — «📍 [Ник] · [Дата] · [Город]». П.7 (2026-09-24):
          ник окрашен по полу, как на форуме (g-male/g-female/g-neutral). */}
      <div className="wb-headrow" data-wb-head={item.id}>
        📍 <b className={nickGenderClass(item.authorName, item.authorGender)}>{item.authorName}</b> · {fmtDateTime(item.createdAt)}
        {item.place ? ` · ${item.place}` : ""}
        {item.editedAt && " · изменено автором"}
      </div>

      {/* ТЗ: «Вопрос: [текст вопроса]». */}
      <div className="wb-q">
        <span className="wb-qlabel">Вопрос:</span> {item.title}
      </div>
      {item.text && <div className="wb-qtext">{item.text}</div>}

      {own && item.isHiddenByAi && (
        <div className="wb-hiddennote">
          Вопрос скрыт ИИ-модерацией: {item.hiddenReason || "нарушение правил раздела"}. Его проверит
          человек-модератор и при ошибке вернёт в ленту.
        </div>
      )}
      {own && !item.isHiddenByAi && item.needHuman && (
        <div className="wb-humannote">Вопрос отправлен на дополнительную проверку человеку-модератору.</div>
      )}

      <div className="wb-sep" />

      {/* ТЗ: строка статуса — «✅ Статус: Найдено» (после первого ответа). */}
      <div className={`wb-statusline is-${item.status}`} data-wb-statusline={item.id}>
        {statusDone ? "✅ Статус: " : "Статус: "}
        {statusLabel}
      </div>

      {/* ТЗ: ПЛОСКИЙ СПИСОК ответов — «📍 Ответ от [ник]: [текст]».
          Ответов может быть СКОЛЬКО УГОДНО; внутри ответа НЕТ кнопки
          «Ответить» (ответов на ответ нет), вложенности и лесенки нет —
          споры уходят на форум (кнопка «💬 Обсудить на форуме»). */}
      {answers.length > 0 && (
        <div className="wb-answers" data-wb-answers={item.id}>
          {answers.map((a) => (
            <div className="wb-answer" key={a.id} data-wb-answer={a.id}>
              📍 Ответ от <b className={nickGenderClass(a.authorName)}>{a.authorName}</b>: {a.text}
            </div>
          ))}
        </div>
      )}

      <div className="wb-sep" />

      {/* 29.09.2026: ОДНА строка кнопок для всех (как в /rekomenduyu
          commit 1a357a4). Раньше было 2 раздельных ряда:
            .wb-secrow (только владелец): Вопрос решён / Неактуально / Редактировать / Удалить
            .wb-actrow (общий): Пожаловаться (не владельцу) / Ответить / Обсудить на форуме
          Теперь всё в одном ряду .wb-actrow.wb-actrow-unified.

          Для ВЛАДЕЛЬЦА:
            [✅ Вопрос решён / ↩️ Вернуть в актуальные] [Отметить «Неактуально»] [Редактировать] [Удалить] [📍 Ответить] [💬 Обсудить на форуме]

          Для НЕ ВЛАДЕЛЬЦА:
            [Пожаловаться] [📍 Ответить] [💬 Обсудить на форуме] */}

      {/* ТЗ: внизу карточки — ЕДИНЫЙ ряд кнопок. */}
      <div className="wb-actrow wb-actrow-unified" data-wb-actrow={item.id}>
        {/* Кнопки автора — видны только владельцу */}
        {own && (
          <>
            {/* ТЗ 2026-09-24 «Вопрос решён»: в актуальном вопросе (Ищу) автор
                видит «✅ Вопрос решён» — только после подтверждения статус
                станет «Найдено» и карточка тускнеет; у решённого/неактуального
                вместо неё — «↩️ Вернуть в актуальные». */}
            {item.status === "seeking" ? (
              <>
                <button
                  className="wb-act wb-solvebtn"
                  data-wb-solve={item.id}
                  disabled={props.busy}
                  onClick={() => askSolve(item)}
                >
                  {SOLVE_BUTTON_LABEL}
                </button>
                <button className="wb-act wb-statusbtn" disabled={props.busy} onClick={() => props.onStatus(item, "irrelevant")}>
                  Отметить «Неактуально»
                </button>
              </>
            ) : (
              <button
                className="wb-act wb-reopenbtn"
                data-wb-reopen={item.id}
                disabled={props.busy}
                onClick={() => props.onStatus(item, "seeking")}
              >
                {REOPEN_BUTTON_LABEL}
              </button>
            )}
            <button className="wb-act" disabled={props.busy} onClick={() => props.onEdit(item)}>
              Редактировать
            </button>
            <button className="wb-act wb-del" disabled={props.busy} onClick={() => props.onDelete(item)}>
              Удалить
            </button>
          </>
        )}

        {/* Кнопка «Пожаловаться» — только НЕ автору отзыва */}
        {!own && user && (
          <button className="wb-report" onClick={() => props.onComplain(item)}>
            Пожаловаться
          </button>
        )}
        <button className="wb-act wb-answerbtn" disabled={props.busy || answerBusy} onClick={toggleAnswer}>
          {ANSWER_BUTTON_LABEL}
        </button>
        <button
          className={`wb-act wb-btn-forum is-${item.topicId ? item.topicState ?? "open" : "none"}`}
          disabled={props.busy}
          onClick={() => props.onDiscuss(item)}
          title={forumButtonTitle(item.topicId ? item.topicState : "none")}
        >
          {FORUM_BUTTON_LABEL}
        </button>
      </div>

      {/* ТЗ: кнопка «📍 Ответить» открывает простое текстовое поле под
          карточкой; «Опубликовать» добавляет ответ в плоский список.
          Флуда здесь нет — обсуждения уходят на форум. */}
      {answerOpen && (
        <div className="wb-answerform" data-wb-answerform={item.id}>
          {props.user && props.token ? (
            <>
              <textarea
                data-wb-answer-input={item.id}
                value={answerText}
                maxLength={300}
                onChange={(e) => changeAnswer(e.target.value)}
                placeholder="Только сухой факт: точный адрес, ТЦ, ориентир. Без флуда и споров."
                aria-label={`Ответ на запрос «${item.title}»`}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7, flexWrap: "wrap" }}>
                <button
                  className="sk-btn-classic"
                  data-wb-answer-submit={item.id}
                  disabled={answerBusy}
                  onClick={submitAnswer}
                  style={{ borderRadius: 0 }}
                >
                  {answerBusy ? "Проверка…" : "Опубликовать"}
                </button>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  Ответ появится в списке на карточке; первым ответом карточка получит статус «Найдено» и тускнеет.
                </span>
              </div>
              {/* ТЗ: серая плашка фильтра (bg-zinc-50 / border-zinc-200).
                  Поле НЕ стёрто, публикация НЕ отправлена; кнопка бесшовно
                  переносит текст на форум. */}
              {answerBlocked && (
                <div
                  className="wb-answerplaque"
                  data-wb-filter-plaque={answerBlocked}
                  role="alert"
                  style={{ marginTop: 9, border: "1px solid #e4e4e7", background: "#f4f4f5", padding: "9px 11px" }}
                >
                  <div data-wb-filter-plaque-text={answerBlocked} style={{ fontSize: 13, lineHeight: 1.45, color: "#3f3f46" }}>
                    {FILTER_PLAQUE_TEXT}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <a
                      className="wb-hint-forum-btn"
                      data-wb-filter-forum-btn={item.id}
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
            <div data-wb-answer-guest={item.id} style={{ fontSize: 13, color: "#475569" }}>
              {ANSWER_GUEST_NOTE}
            </div>
          )}
          {answerErr && (
            <div data-wb-answer-err={item.id} role="alert" style={{ marginTop: 7, fontSize: 13, fontWeight: 600, color: "#AA3333" }}>
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

function WhereToBuyFormModal(props: {
  token: string | null;
  editItem: WhereToBuyItem | null;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const isEdit = !!props.editItem;
  const [title, setTitle] = useState(props.editItem?.title ?? "");
  const [text, setText] = useState(props.editItem?.text ?? "");
  const [place, setPlace] = useState(props.editItem?.place ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [specHint, setSpecHint] = useState(""); // подсказка конкретности (ТЗ п.4)
  const [similar, setSimilar] = useState<SimilarPost[] | null>(null); // предупреждение о похожих (ТЗ п.7)

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
      const r = await fetch(isEdit ? `/api/wheretobuy/${props.editItem!.id}` : "/api/wheretobuy", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      // Слишком общий вопрос (ТЗ п.4): подсказка вместо молчаливой публикации,
      // пользователь может отредактировать вопрос.
      if (d.needsSpecific) {
        setSpecHint(d.hint || "Укажите конкретный товар или модель.");
        return;
      }
      // Похожий вопрос уже опубликован (ТЗ п.7): предупреждение + ссылка,
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
          <span>{isEdit ? "Редактировать вопрос" : "Задать вопрос в «Где купить»"}</span>
          <button className="sk-modal-x" onClick={props.onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="sk-modal-body">
          <div className="sk-modal-row">
            <label htmlFor="wb-f-title">Заголовок — где купить конкретный товар</label>
            <input
              id="wb-f-title"
              value={title}
              maxLength={150}
              onChange={(e) => {
                setTitle(e.target.value);
                clearWarnings();
              }}
              placeholder="Например: Где купить аккумулятор Bosch S5 AGM 70 Ah?"
            />
          </div>
          {specHint && (
            <div className="wb-spechint" role="alert">
              {specHint}
            </div>
          )}
          <div className="sk-modal-row">
            <label htmlFor="wb-f-text">Текст вопроса</label>
            <textarea
              id="wb-f-text"
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
            <label htmlFor="wb-f-place">Место — необязательно</label>
            <input
              id="wb-f-place"
              value={place}
              maxLength={80}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Южно-Сахалинск, Холмск, Корсаков, Долинск или конкретный район"
            />
          </div>
          {similar && similar.length > 0 && (
            <div className="wb-similarwarn" role="alert">
              <b>Похожий вопрос уже опубликован. Возможно, ответ уже есть.</b>
              <ul>
                {similar.map((s) => (
                  <li key={s.id}>
                    <a href={`/gde-kupit?post=${s.id}`}>«{s.title}»</a> — открыть
                  </li>
                ))}
              </ul>
              <p>Если ваш вопрос действительно отличается, опубликуйте его.</p>
            </div>
          )}
          <div className="sk-modal-demo">
            <b>Здесь спрашивают о конкретном товаре: одна публикация — один товар или одна модель.</b> Общие вопросы
            («где купить телевизор», «посоветуйте магазин») не подходят разделу. Сравнение цен — тема раздела «Где
            дешевле». Реклама магазинов и продавцов запрещена. Контакты при желании укажите прямо в тексте вопроса.
          </div>
          {err && <div className="sk-modal-err">{err}</div>}
          <div className="sk-modal-actions">
            <button className="sk-btn-classic" disabled={busy} onClick={() => submit(!!similar)}>
              {busy ? "Проверка ИИ…" : similar ? "Всё равно опубликовать" : isEdit ? "Сохранить" : "Опубликовать"}
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
/* Жалоба (ТЗ п.18)                                                    */
/* ------------------------------------------------------------------ */

function WhereToBuyComplaintModal(props: {
  item: WhereToBuyItem;
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
      const r = await fetch(`/api/wheretobuy/${props.item.id}/complaint`, {
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
            {WTB_COMPLAINT_REASONS.map((r) => (
              <label key={r.key} className="complaint-option">
                <input
                  type="radio"
                  name="wb-complaint"
                  checked={category === r.key}
                  onChange={() => setCategory(r.key)}
                />
                {r.label}
              </label>
            ))}
          </div>
          <div className="sk-modal-row">
            <label htmlFor="wb-c-comment">Комментарий (необязательно)</label>
            <textarea
              id="wb-c-comment"
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

export function WhereToBuyPage(props: {
  user: ForumUser | null;
  token: string | null;
  notify: (m: string) => void;
  onNeedAuth: () => void;
}) {
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [activeNav, setActiveNav] = useState<"home" | "latest" | "mine">("home");
  const [items, setItems] = useState<WhereToBuyItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [place, setPlace] = useState("");
  const [appliedPlace, setAppliedPlace] = useState("");
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<WhereToBuyItem | null>(null);
  const [complainItem, setComplainItem] = useState<WhereToBuyItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // ТЗ 2026-09-23 (часть 4): ИД темы-приёмника «Товары и услуги ▸ Где купить»
  // для кнопки переноса (плашка фильтра → /forum/topic/ИД?prefilled_text=…).
  const [transferTopicId, setTransferTopicId] = useState<number>(FALLBACK_TRANSFER_TOPIC_ID);
  const listTopRef = useRef<HTMLDivElement | null>(null);

  // ТЗ часть 4: резолвим ИД темы-приёмника (тот же механизм, что у быстрых
  // подсказок Главной: GET отдаёт forumTopicId, сид самовосстанавливается).
  useEffect(() => {
    let alive = false;
    fetch("/api/wheretobuy-hints")
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
      const r = await fetch(`/api/wheretobuy?${sp.toString()}`);
      const d: FeedResponse & { error?: string; posts?: WhereToBuyItem[] } = await r.json();
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

  // Глубокая ссылка из темы форума: /gde-kupit?post=ID — подсветить вопрос (ТЗ п.12).
  useEffect(() => {
    const postId = new URLSearchParams(window.location.search).get("post");
    if (!postId) return;
    setHighlightId(postId);
    const t = window.setInterval(() => {
      const el = document.querySelector(`[data-wb-id="${postId}"]`);
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
   * Кнопка состояния форума — ЕДИНАЯ ЛОГИКА ТЗ 2026-09-23: обычный
   * переход по относительной ссылке (п.3/4), работает и у гостя:
   *  — тема уже связана → /forum/topic/<id> (реальная страница темы);
   *  — темы нет → /forum/category/<slug> — рубрика блока
   *    «Товары и услуги ▸ Где купить» (список тем рубрики, п.5).
   * Прежний POST /discuss с созданием служебной темы заменён переходом
   * в публичную рубрику блока; API-эндпоинт сохранён для совместимости.
   */
  /**
   * Кнопка состояния форума — ТЗ 2026-09-24 «Обсудить на форуме —
   * авто-создание темы»: при клике вызываем универсальный API
   * POST /api/discuss/wheretobuy/<postId>, который:
   *   • если у вопроса уже есть topicId — редирект в существующую тему;
   *   • если нет — создаёт тему в рубрике «Где купить» от имени текущего
   *     пользователя, привязывает к вопросу, редиректит.
   * Гостю открываем AuthModal.
   */
  const discuss = (item: WhereToBuyItem) => {
    discussOnForum("wheretobuy", item.id, props.token, props.onNeedAuth);
  };

  const openEdit = (item: WhereToBuyItem) => {
    setEditItem(item);
    setFormOpen(true);
  };

  const deleteItem = async (item: WhereToBuyItem) => {
    if (!window.confirm("Удалить вопрос? Он исчезнет из общей ленты.")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/wheretobuy/${item.id}`, {
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

  /** Смена статуса вопроса (ТЗ п.8/9): Нашёл / Неактуально / возврат в Ищу. */
  const setStatus = async (item: WhereToBuyItem, status: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/wheretobuy/${item.id}`, {
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
      {/* ТЗ 2026-09-28 (правки 1–4, аналогично /gde-deshevle): 3-колоночный
          layout СОХРАНЯЕТСЯ, блоки перераспределены:
          — ЛЕВАЯ колонка: блок «О разделе» (в дизайне .sakh-clock)
          — ЦЕНТРАЛЬНАЯ колонка: header-bar (заголовок «Где купить» + навигация
            «Последние вопросы / Мои публикации» + кнопка «Задать вопрос» —
            в одной строке по центру) + лента вопросов
          — ПРАВАЯ колонка: Время + блок «Правила «Где купить»» (в дизайне .sakh-clock) */}
      <div className="wb-layout main-grid-container">

        {/* ЛЕВАЯ КОЛОНКА — блок «О разделе» (в дизайне .sakh-clock, правка 2+4) */}
        <aside className="wb-col-left left-column">
          <div className="sakh-clock wb-clock-block wb-clock-about">
            <div className="sakh-clock-head">ℹ️ О разделе</div>
            <div className="sakh-clock-body sakh-clock-body-content">
              <div className="wb-info">
                <p>
                  «Где купить» — самостоятельный раздел вопросов о конкретных товарах: спрашивайте, где на Сахалине
                  купить конкретную модель, артикул или размер. Это не форум и не рекламная площадка: обсуждений,
                  комментариев и реакций под вопросом нет.
                </p>
                <p>
                  Вопрос содержит шапку (ник автора, дата, город), текст вопроса, статус («Ищу», «Найдено»,
                  «Неактуально») и список ответов. Обсудить вопрос можно на форуме — под каждым вопросом есть кнопка «💬
                  Обсудить на форуме»; для вопроса создаётся не более одной темы обсуждения. Ответить сухим фактом можно
                  прямо на странице — кнопка «📍 Ответить».
                </p>
                <p>
                  Ответов может быть сколько угодно: все они публикуются плоским списком на карточке — «📍 Ответ от
                  ника: факт». Ответов на ответ нет: споры и обсуждения — только на форуме. Как только карточка получает
                  хотя бы один ответ, её статус становится «Найдено», карточка тускнеет, но ответы продолжают добавляться.
                </p>
                <p>
                  Автор может отредактировать или удалить свой вопрос, а также установить статус «Найдено» или
                  «Неактуально». Вопросы не удаляются автоматически — со временем они превращаются в полезную базу:
                  какой конкретный товар где на Сахалине находили.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Центральная колонка — лента вопросов + header bar (правка 1) */}
        <div className="wb-col-main center-column">
          <div className="wb-head">
            {/* 28.09.2026 (правки от пользователя):
                — H1 «Где купить» УБРАН (чёрный дубликат названия раздела)
                — Поисковое окно + «Найти» УБРАНЫ
                — Окно поиска города + «Показать» УБРАНЫ
                В header-bar остались только nav-кнопки и кнопка «Задать вопрос». */}
            <div className="wb-head-bar">
              {/* 28.09.2026 (аналог /gde-deshevle):
                  — Восстановлен H1 «Где купить» (.wb-title, синий #0a5caa) — слева
                  — Удалена первая nav-кнопка «Где купить» (active имела цвет
                    #1a1a1a — почти чёрный, была «чёрной надписью»)
                  — Nav-inline + кнопка «Задать вопрос» обёрнуты в .wb-head-right
                    и прижаты к правому краю через justify-content: space-between */}
              <div className="wb-title">Где купить</div>
              <div className="wb-head-right">
                <div className="wb-nav-inline">
                  <button className={activeNav === "latest" ? "active" : ""} onClick={() => mineTab("all", "latest")}>
                    Последние вопросы
                  </button>
                  <button className={activeNav === "mine" ? "active" : ""} onClick={() => mineTab("mine", "mine")}>
                    Мои публикации
                  </button>
                </div>
                <button className="wb-addbtn" onClick={openNewForm}>
                  {/* 2026-10-02: знак «＋» убран по просьбе пользователя. */}
                  Задать вопрос
                </button>
              </div>
            </div>
            {/* 2026-10-02: надпись «Задавать вопросы могут только зарегистрированные
                пользователи — войдите или зарегистрируйтесь. Гости могут читать.»
                удалена по просьбе пользователя. */}
            <div className="wb-desc">Задайте вопрос о том, где на Сахалине купить конкретный товар.</div>
          </div>

          <div ref={listTopRef} />

          {items === null && !error && <div className="wb-empty">Загрузка…</div>}
          {error && <div className="sk-error">{error}</div>}
          {items !== null && !error && list.length === 0 && (
            <div className="wb-empty">
              {tab === "mine"
                ? "У вас пока нет публикаций."
                : searching
                  ? `По запросу ничего не найдено. Попробуйте изменить слова поиска.`
                  : "Пока нет вопросов — задайте первый вопрос о конкретном товаре."}
            </div>
          )}

          {/* Лента: Ищу → Нашёл → Неактуально, внутри группы новые сверху (ТЗ п.8),
              стабильные позиции и пагинация (ТЗ п.1/25) */}
          {items !== null &&
            !error &&
            list.map((item) => (
              <WhereToBuyRow
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
            <div className="wb-pager">
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
          {tab === "all" && pages === 1 && items !== null && !error && total > 0 && (
            <div className="wb-pager">
              <span>
                Всего {total} · новые сверху
              </span>
            </div>
          )}

          {/* ТЗ 2026-09-23: сквозные тестовые сообщения (сценарии 1–3) —
              симулятор перехода на форум; рубрика «Товары и услуги ▸
              Где купить» (слаги → тема-приёмник #177). */}
          <E2eTransferTestPanel variant="wtb" />
        </div>

        {/* ПРАВАЯ КОЛОНКА — Время + Правила (в дизайне .sakh-clock, правка 4) */}
        <aside className="wb-col-right right-column">
          {/* Часы на всех страницах: первым блоком правой колонки, как на Главной */}
          <SakhDatetimeBlock />
          {/* ТЗ 2026-09-28 (правка 2): «О разделе» убран из правой колонки —
              теперь он в левой. Здесь остаётся только «Правила». */}
          <div className="sakh-clock wb-clock-block wb-clock-rules">
            <div className="sakh-clock-head">⚠️ Правила «Где купить»</div>
            <div className="sakh-clock-body sakh-clock-body-content">
              <div className="wb-keyrule">
                Здесь спрашивают не «где купить вообще», а «где купить вот этот конкретный товар».
              </div>
              <ol className="wb-ruleslist">
                {WTB_RULES.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ol>
              <p className="wb-rulesnote">
                Вопросы проверяет ИИ-модерация: реклама, скрытая реклама, спам и мошенничество не допускаются; спорные
                случаи рассматривает человек-модератор. Само наличие ссылки, телефона или названия магазина в вопросе о
                конкретном товаре не является нарушением — оценивается контекст. Кнопка «Пожаловаться» есть у каждого
                вопроса; количество жалоб не публикуется и не создаёт никаких оценок.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {formOpen && props.token && (
        <WhereToBuyFormModal
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
        <WhereToBuyComplaintModal
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
