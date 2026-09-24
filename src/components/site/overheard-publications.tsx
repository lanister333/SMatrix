"use client";

/**
 * ШАГ 17. «Подслушано Сахалин» — городская лента слухов, наблюдений и
 * сообщений жителей (ТЗ п.1). Отдельная самостоятельная страница: НЕ форум,
 * НЕ «Нужна помощь», без объединения с другими лентами (ТЗ п.23).
 *
 * Основной принцип (ТЗ п.2/13): пользователь публикует сообщение; обсуждений,
 * комментариев, ответов, лайков, дизлайков и реакций под публикацией НЕТ.
 * Для обсуждения — только кнопка состояния форума под текстом публикации
 * («Обсудить на форуме» / «Обсуждается на форуме» / «Тема закрыта» /
 * «Тема в архиве»), максимум одна тема на публикацию.
 *
 * Компактный информационный формат (ТЗ п.11/17): линейный список с тонкими
 * серыми разделителями — без больших декоративных карточек, теней, градиентов
 * и тёмно-синих форумных рамок. Аватары и рейтинги автора не используются
 * (ТЗ п.21). Жалобы — не голосование, количество не показывается (ТЗ п.22).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import SakhDatetimeBlock from "@/components/site/sakh-datetime-block";
import type { ForumUser } from "@/lib/ui";
import { sectionDiscussHref } from "@/lib/forum-links";

interface OverheardItem {
  id: string;
  title: string;
  text: string;
  place: string;
  authorId: string;
  authorName: string;
  editedAt: string | null;
  createdAt: string;
  topicId: number | null;
  topicState?: string; // none | open | closed | archived
  isHiddenByAi?: boolean;
  hiddenReason?: string;
  needHuman?: boolean;
}

interface FeedResponse {
  posts: OverheardItem[];
  total: number;
  page: number;
  pages: number;
}

const PAGE_SIZE = 15;

/** Дата и время публикации: «8 сентября, 14:30» (ТЗ п.11). */
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** Причины жалоб (ТЗ п.22). */
const OVERHEARD_COMPLAINT_REASONS = [
  { key: "insult", label: "Оскорбления" },
  { key: "threat", label: "Угрозы" },
  { key: "bullying", label: "Травля" },
  { key: "fraud", label: "Мошенничество" },
  { key: "spam", label: "Спам" },
  { key: "ad", label: "Реклама" },
  { key: "personal_data", label: "Персональные данные" },
  { key: "forbidden", label: "Запрещённое содержание" },
  { key: "other", label: "Другие нарушения" },
];

/** Правила «Подслушано» — правая колонка (ТЗ п.15, дословно). */
const OVERHEARD_RULES = [
  "«Подслушано» — это лента сообщений, наблюдений и слухов жителей.",
  "Не вся информация является подтверждённым фактом.",
  "Не выдавайте слух за достоверно установленный факт.",
  "Запрещены угрозы и травля.",
  "Запрещены оскорбления.",
  "Запрещена реклама и спам.",
  "Запрещено мошенничество.",
  "Запрещена публикация чужих персональных данных без согласия.",
  "Запрещён запрещённый законом контент.",
  "Для полноценного обсуждения используйте форум.",
];

/** Состояния кнопки форума (ТЗ п.5): одинаковый размер и форма для всех. */
function forumButtonLabel(state: string | undefined): string {
  switch (state) {
    case "open":
      return "Обсуждается на форуме";
    case "closed":
      return "Тема закрыта";
    case "archived":
      return "Тема в архиве";
    default:
      return "Обсудить на форуме";
  }
}

/* ------------------------------------------------------------------ */
/* Сообщение ленты                                                     */
/* ------------------------------------------------------------------ */

function OverheardRow(props: {
  item: OverheardItem;
  user: ForumUser | null;
  busy: boolean;
  highlight: boolean;
  onDiscuss: (item: OverheardItem) => void;
  onEdit: (item: OverheardItem) => void;
  onDelete: (item: OverheardItem) => void;
  onComplain: (item: OverheardItem) => void;
}) {
  const { item, user } = props;
  const own = !!(user && item.authorId === user.id);
  return (
    <article className={`oh-item${props.highlight ? " oh-highlight" : ""}`} data-oh-id={item.id}>
      <div className="oh-item-title">{item.title}</div>
      <div className="oh-item-text">{item.text}</div>
      {own && item.isHiddenByAi && (
        <div className="oh-hiddennote">
          Сообщение скрыто ИИ-модерацией: {item.hiddenReason || "нарушение правил раздела"}. Его проверит
          человек-модератор и при ошибке вернёт в ленту.
        </div>
      )}
      {own && !item.isHiddenByAi && item.needHuman && (
        <div className="oh-humannote">Сообщение отправлено на дополнительную проверку человеку-модератору.</div>
      )}
      <div className="oh-foot">
        <div className="oh-footinfo">
          <div className="oh-item-meta">
            <b>Автор:</b> {item.authorName} · {fmtDateTime(item.createdAt)}
            {item.place && (
              <>
                {" "}
                · <b>Место:</b> {item.place}
              </>
            )}
            {item.editedAt && " · изменено автором"}
          </div>
          <div className="oh-actrow">
            {own ? (
              <>
                <button className="oh-act" disabled={props.busy} onClick={() => props.onEdit(item)}>
                  Редактировать
                </button>
                <button className="oh-act oh-del" disabled={props.busy} onClick={() => props.onDelete(item)}>
                  Удалить
                </button>
              </>
            ) : (
              <button className="oh-report" onClick={() => props.onComplain(item)}>
                Пожаловаться
              </button>
            )}
          </div>
        </div>
        {/*
          Кнопка состояния форума — непосредственно под текстом публикации,
          рядом с автором и датой (ТЗ п.5). Обсуждений внутри страницы нет:
          это единственный путь к обсуждению (ТЗ п.13).
        */}
        {item.topicId ? (
          <button
            className={`oh-btn-forum is-${item.topicState ?? "open"}`}
            disabled={props.busy}
            onClick={() => props.onDiscuss(item)}
            title="Открыть тему обсуждения на форуме"
          >
            {forumButtonLabel(item.topicState)}
          </button>
        ) : (
          <button className="oh-btn-forum is-none" disabled={props.busy} onClick={() => props.onDiscuss(item)}>
            {forumButtonLabel(item.topicState)}
          </button>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Форма написания / редактирования (ТЗ п.12 — простая форма)          */
/* ------------------------------------------------------------------ */

function OverheardFormModal(props: {
  token: string | null;
  editItem: OverheardItem | null;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const isEdit = !!props.editItem;
  const [title, setTitle] = useState(props.editItem?.title ?? "");
  const [text, setText] = useState(props.editItem?.text ?? "");
  const [place, setPlace] = useState(props.editItem?.place ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (title.trim().length < 5) {
      setErr("Заголовок слишком короткий — минимум 5 символов");
      return;
    }
    if (text.trim().length < 10) {
      setErr("Напишите текст сообщения — минимум 10 символов");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(isEdit ? `/api/overheard/${props.editItem!.id}` : "/api/overheard", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? { token: props.token, action: "edit", title: title.trim(), text: text.trim(), place: place.trim() }
            : { token: props.token, title: title.trim(), text: text.trim(), place: place.trim() }
        ),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось опубликовать. Попробуйте ещё раз.");
      props.onDone(d.note || (isEdit ? "Сообщение обновлено" : "Сообщение опубликовано"));
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
          <span>{isEdit ? "Редактировать сообщение" : "Написать в «Подслушано»"}</span>
          <button className="sk-modal-x" onClick={props.onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="sk-modal-body">
          <div className="sk-modal-row">
            <label htmlFor="oh-f-title">Заголовок — кратко, о чём сообщение</label>
            <input
              id="oh-f-title"
              value={title}
              maxLength={150}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Говорят, что на улице скоро изменят движение"
            />
          </div>
          <div className="sk-modal-row">
            <label htmlFor="oh-f-text">Текст — что услышали или заметили в городе</label>
            <textarea
              id="oh-f-text"
              value={text}
              maxLength={8000}
              onChange={(e) => setText(e.target.value)}
              placeholder="Сообщение, наблюдение, слух или вопрос к городу…"
              style={{ minHeight: 120 }}
            />
          </div>
          <div className="sk-modal-row">
            <label htmlFor="oh-f-place">Место — необязательно</label>
            <input
              id="oh-f-place"
              value={place}
              maxLength={80}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Южно-Сахалинск, Корсаков, Холмск или конкретный район"
            />
          </div>
          <div className="sk-modal-demo">
            <b>Городская лента слухов и наблюдений — не вся информация является подтверждённым фактом.</b> Не
            публикуйте чужие персональные данные без их согласия. Запрещены оскорбления, угрозы, травля, реклама,
            спам и мошенничество. Для полноценного обсуждения на форуме под сообщением есть кнопка «Обсудить на
            форуме».
          </div>
          {err && <div className="sk-modal-err">{err}</div>}
          <div className="sk-modal-actions">
            <button className="sk-btn-classic" disabled={busy} onClick={submit}>
              {busy ? "Проверка ИИ…" : isEdit ? "Сохранить" : "Опубликовать"}
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
/* Жалоба (ТЗ п.22)                                                    */
/* ------------------------------------------------------------------ */

function OverheardComplaintModal(props: {
  item: OverheardItem;
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
      const r = await fetch(`/api/overheard/${props.item.id}/complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, comment: comment.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось отправить жалобу");
      props.onDone(d.note || "Жалоба отправлена. Спасибо. Модерация рассмотрит сообщение.");
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
          <span>Жалоба на сообщение</span>
          <button className="sk-modal-x" onClick={props.onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="sk-modal-body">
          <div className="sk-modal-demo">
            Сообщение: «{props.item.title}». Жалоба уходит модерации. Жалобы не являются голосованием: их количество
            не публикуется и не создаёт никаких оценок.
          </div>
          <div className="sk-modal-row">
            <label>Причина</label>
            {OVERHEARD_COMPLAINT_REASONS.map((r) => (
              <label key={r.key} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontWeight: 400, fontSize: 13.5 }}>
                <input
                  type="radio"
                  name="oh-complaint"
                  checked={category === r.key}
                  onChange={() => setCategory(r.key)}
                  style={{ marginTop: 2 }}
                />
                {r.label}
              </label>
            ))}
          </div>
          <div className="sk-modal-row">
            <label htmlFor="oh-c-comment">Комментарий (необязательно)</label>
            <textarea
              id="oh-c-comment"
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

export function OverheardPage(props: {
  user: ForumUser | null;
  token: string | null;
  notify: (m: string) => void;
  onNeedAuth: () => void;
}) {
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [activeNav, setActiveNav] = useState<"home" | "latest" | "mine">("home");
  const [items, setItems] = useState<OverheardItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [place, setPlace] = useState("");
  const [appliedPlace, setAppliedPlace] = useState("");
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<OverheardItem | null>(null);
  const [complainItem, setComplainItem] = useState<OverheardItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const listTopRef = useRef<HTMLDivElement | null>(null);

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
      const r = await fetch(`/api/overheard?${sp.toString()}`);
      const d: FeedResponse & { error?: string; posts?: OverheardItem[] } = await r.json();
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

  // Глубокая ссылка из темы форума: /podslyshano?post=ID — подсветить сообщение (ТЗ п.4/25.15).
  useEffect(() => {
    const postId = new URLSearchParams(window.location.search).get("post");
    if (!postId) return;
    setHighlightId(postId);
    const t = window.setInterval(() => {
      const el = document.querySelector(`[data-oh-id="${postId}"]`);
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
   * /forum/topic/<id>, темы нет → /forum/category/podslyshano-discuss —
   * соответствующая ветка обсуждений «Подслушано» (п.3/4/5 ТЗ).
   */
  const discuss = (item: OverheardItem) => {
    window.location.href = sectionDiscussHref("overheard", item.topicId);
  };

  const openEdit = (item: OverheardItem) => {
    setEditItem(item);
    setFormOpen(true);
  };

  const deleteItem = async (item: OverheardItem) => {
    if (!window.confirm("Удалить сообщение? Оно исчезнет из общей ленты.")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/overheard/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, action: "delete" }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось удалить");
      props.notify(d.note || "Сообщение удалено");
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
      <div className="oh-layout main-grid-container">
        {/* Левая колонка — компактная навигация раздела (ТЗ п.8) */}
        <aside className="oh-col-left left-column">
          <div className="oh-sideblock">
            <div className="oh-blocktitle">Раздел</div>
            <ul className="oh-navlist">
              <li>
                <button className={activeNav === "home" ? "active" : ""} onClick={() => mineTab("all", "home")}>
                  Подслушано Сахалин
                </button>
              </li>
              <li>
                <button className={activeNav === "latest" ? "active" : ""} onClick={() => mineTab("all", "latest")}>
                  Последние сообщения
                </button>
              </li>
              <li>
                <button className={activeNav === "mine" ? "active" : ""} onClick={() => mineTab("mine", "mine")}>
                  Мои публикации
                </button>
              </li>
            </ul>
          </div>
          <div className="oh-sideblock">
            <button className="oh-addbtn" onClick={openNewForm}>
              ＋ Написать в «Подслушано»
            </button>
            {!props.user && (
              <p className="oh-rulesnote">Писать могут только зарегистрированные пользователи — войдите или зарегистрируйтесь. Гости могут читать.</p>
            )}
          </div>
          <div className="oh-sideblock">
            <div className="oh-blocktitle">Место публикации</div>
            <div className="oh-placefilter">
              <input
                aria-label="Фильтр по месту"
                value={place}
                maxLength={80}
                onChange={(e) => setPlace(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearch();
                }}
                placeholder="Южно-Сахалинск, Корсаков…"
              />
              <button onClick={applySearch}>Показать</button>
            </div>
          </div>
        </aside>

        {/* Центральная колонка — лента (ТЗ п.9/10) */}
        <div className="oh-col-main center-column">
          <div className="oh-head">
            <div className="oh-title">Подслушано Сахалин</div>
            <div className="oh-warn">
              Городская лента слухов, наблюдений и сообщений жителей Сахалина. Не вся информация является
              подтверждённым фактом.
            </div>
            <button className="oh-newbtn" onClick={openNewForm}>
              ＋ Написать в «Подслушано»
            </button>
            {/* Простой поиск (ТЗ п.14): слова из заголовка и текста, частичное совпадение */}
            <div className="oh-search">
              <input
                aria-label="Поиск по публикациям"
                value={q}
                maxLength={120}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearch();
                }}
                placeholder="Поиск по заголовку и тексту…"
              />
              <button onClick={applySearch}>Найти</button>
              {searching && (
                <button className="oh-search-reset" onClick={resetSearch}>
                  Сбросить
                </button>
              )}
            </div>
          </div>

          <div ref={listTopRef} />

          {items === null && !error && <div className="oh-empty">Загрузка…</div>}
          {error && <div className="sk-error">{error}</div>}
          {items !== null && !error && list.length === 0 && (
            <div className="oh-empty">
              {tab === "mine"
                ? "У вас пока нет публикаций."
                : searching
                  ? `По запросу ничего не найдено. Попробуйте изменить слова поиска.`
                  : "Пока нет сообщений — напишите первое, расскажите городу, что вы услышали или заметили."}
            </div>
          )}

          {/* Лента: новые сверху, стабильное положение, пагинация (ТЗ п.10/20) */}
          {items !== null &&
            !error &&
            list.map((item) => (
              <OverheardRow
                key={item.id}
                item={item}
                user={props.user}
                busy={busy}
                highlight={highlightId === item.id}
                onDiscuss={discuss}
                onEdit={openEdit}
                onDelete={deleteItem}
                onComplain={setComplainItem}
              />
            ))}

          {/* Пагинация (ТЗ п.10/20) — не бесконечная лента */}
          {tab === "all" && pages > 1 && items !== null && !error && (
            <div className="oh-pager">
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
            <div className="oh-pager">
              <span>
                Всего {total} · новые сверху
              </span>
            </div>
          )}
        </div>

        {/* Правая колонка — информация и правила (ТЗ п.15) */}
        <aside className="oh-col-right right-column">
          {/* Часы на всех страницах: первым блоком правой колонки, как на Главной */}
          <SakhDatetimeBlock />
          <div className="oh-sideblock">
            <div className="oh-blocktitle">О разделе</div>
            <div className="oh-info">
              <p>
                «Подслушано Сахалин» — самостоятельная городская лента слухов, наблюдений и сообщений жителей:
                расскажите, что услышали или заметили в городе, задайте вопрос. Это не форум: обсуждений,
                комментариев и реакций под публикацией нет.
              </p>
              <p>
                Сообщение содержит заголовок, текст, место (если указано), ник автора, дату и время. Обсудить
                сообщение можно на форуме — под каждым сообщением есть кнопка «Обсудить на форуме»; для публикации
                создаётся не более одной темы обсуждения.
              </p>
              <p>
                Автор может отредактировать или удалить своё сообщение. Старые сообщения не удаляются — они
                остаются в ленте и доступны через пагинацию; новые появляются сверху.
              </p>
            </div>
          </div>
          <div className="oh-sideblock">
            <div className="oh-blocktitle">Правила «Подслушано»</div>
            <ol className="oh-ruleslist">
              {OVERHEARD_RULES.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ol>
            <div className="oh-truthnote">
              <b>Важно:</b> сам факт того, что сообщение является слухом или неподтверждённой информацией, не
              является нарушением. Модерация оценивает содержание публикации и реальные нарушения, а не удаляет
              сообщение только потому, что оно является слухом.
            </div>
            <p className="oh-rulesnote">
              Сообщения проверяет ИИ-модерация, спорные случаи рассматривает человек-модератор. Кнопка
              «Пожаловаться» есть у каждого сообщения; количество жалоб не публикуется и не создаёт никаких оценок.
            </p>
          </div>
        </aside>
      </div>

      {formOpen && props.token && (
        <OverheardFormModal
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
        <OverheardComplaintModal
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
