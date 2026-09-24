"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORY_LABELS,
  COMPLAINT_REASONS,
  Nick,
  fmtDateTime,
  fmtNum,
  fmtRecent,
  type ForumUser,
  type Msg,
} from "@/lib/ui";
import { AppealModal } from "@/components/forum/modals";
import ForumThread from "@/components/forum/forum-thread";

interface SendSanction {
  kind: string;
  kindLabel: string;
  reason: string;
  note?: string;
  needsHumanDecision?: boolean;
}

/**
 * СТАДИЯ 1/Шаг 1 (мобайл ≤480px, действует и для ПК-текстов новых ответов):
 * кликабельные @упоминания автора в тексте сообщения — «@имя» открывает профиль.
 * Упоминаются только реальные участники темы (точное совпадение ника),
 * остальные «@токены» (e-mail и т.п.) остаются обычным текстом.
 */
function renderMentions(body: string, authors: Set<string>, onOpen: (nick: string) => void): React.ReactNode {
  if (!body.includes("@") || authors.size === 0) return body;
  const parts: React.ReactNode[] = [];
  const re = /@([^\s,.;:!?]+)/g;
  let last = 0;
  let key = 0;
  for (let mm = re.exec(body); mm; mm = re.exec(body)) {
    const nick = mm[1];
    if (!authors.has(nick)) continue;
    parts.push(body.slice(last, mm.index));
    parts.push(
      <a key={`sk-mention-${key++}`} className="sk-mention" title={`Профиль: ${nick}`} onClick={() => onOpen(nick)}>
        @{nick}
      </a>
    );
    last = mm.index + mm[0].length;
  }
  if (last === 0) return body;
  parts.push(body.slice(last));
  return parts;
}

function TopicPager(props: {
  label: React.ReactNode;
  pages: number;
  page: number;
  onGo: (p: number) => void;
  goto: string;
  setGoto: (v: string) => void;
  onGotoNum: (n: number) => void;
}) {
  const nums = Array.from({ length: Math.min(props.pages, 12) }, (_, i) => i + 1);
  return (
    <div className="sk-pager">
      <span>{props.label}</span>
      {props.pages > 1 && !props.goto && (
        <span className="pg-pages">
          <span>страницы:</span>
          {nums.map((n) =>
            n === props.page ? (
              <span key={n} className="pg-cur">
                {n}
              </span>
            ) : (
              <a key={n} className="pg-num" onClick={() => props.onGo(n)}>
                {n}
              </a>
            )
          )}
          {props.pages > 12 && <span>…</span>}
        </span>
      )}
      <span className="pg-goto">
        <span>перейти к №</span>
        <input
          value={props.goto}
          onChange={(e) => props.setGoto(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && props.goto) props.onGotoNum(parseInt(props.goto));
          }}
          aria-label="Перейти к сообщению по номеру"
        />
        <a
          onClick={() => {
            if (props.goto) props.onGotoNum(parseInt(props.goto));
          }}
        >
          »
        </a>
      </span>
    </div>
  );
}

function MessageRow(props: {
  m: Msg;
  user: ForumUser | null;
  favDone: boolean;
  isNew: boolean;
  canReply: boolean;
  mentionAuthors: Set<string>;
  onOpenProfile: (n: string) => void;
  onGoParent?: () => void; // клик по метке «└ ответ …» — плавная перемотка к сообщению-родителю
  parentPage?: number | null; // номер страницы поста-родителя, если он на ДРУГОЙ странице (иначе null)
  /** РЕСТАВРАЦИЯ «Сахкома» (2026-09-23): цитата сообщения, на которое
   *  дан ответ — единственная связь ответа с исходным постом у
   *  ответов на автора темы (у них parentId пуст и линии SVG нет).
   *  Формат Сахкома: серый блок с шапкой «{ник} писал(а):» и телом
   *  исходного сообщения (усечённым до 320 символов). */
  quoteOf?: { author: string; num: number; body: string; onGo?: () => void } | null;
  onReply: () => void;
  onComplain: () => void;
  onFav: () => void;
  onPermalink: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAppeal: () => void;
  appealSent: boolean;
}) {
  const { m } = props;
  if (m.isDeleted) {
    return (
      <div className="sk-msg sk-msg-deleted" data-msgnum={m.num}>
        {m.deletedBy === "moderator" ? `Сообщение №${m.num} удалено модератором.` : `Сообщение №${m.num} удалено автором`}
      </div>
    );
  }
  if (m.isHiddenByAi) {
    const own = !!(props.user && props.user.nickname && m.author === props.user.nickname);
    return (
      <div className="sk-msg-aihidden" data-msgnum={m.num}>
        Сообщение №{m.num} скрыто ИИ-модерацией ({m.hiddenReason || "нарушение"}).{" "}
        {own ? (
          props.appealSent ? (
            <span className="sk-appeal-pending">Апелляция отправлена — её рассмотрит человек-модератор.</span>
          ) : (
            <button className="sk-appeal-btn" onClick={props.onAppeal} title="Апелляцию рассматривает человек-модератор, ИИ не участвует">
              Оспорить решение
            </button>
          )
        ) : (
          "Автор может оспорить решение кнопкой «Оспорить решение»."
        )}
      </div>
    );
  }
  const own = !!(props.user && props.user.nickname && m.author === props.user.nickname);
  return (
    <div className="sk-msg" data-msgnum={m.num}>
      <div className="sk-msg-head">
        <a className="sk-msg-num" onClick={props.onPermalink} title="Ссылка на это сообщение">
          #{m.num}
        </a>
        <Nick name={m.author} gender={m.authorGender} onOpen={props.onOpenProfile} className="sk-msg-author" />
        <span className="sk-msg-time">{fmtRecent(m.createdAt)}</span>
        {props.isNew && (
          <span className="sk-msg-new" title="Появилось после вашего последнего посещения темы">
            Новое
          </span>
        )}
        {m.editedAt && (
          <span className="sk-msg-time" title={`Изменено: ${fmtDateTime(m.editedAt)}`}>
            изменено
          </span>
        )}
        {/* Директива «как на Сахкоме»: стрелка └ + имя адресата — кликабельная
            синяя ссылка, плавно перематывает к сообщению-родителю (как на то
            сообщение, на которое нажали «Ответить»). Имя — из parentAuthor
            ответа (подставляет API); переход — по parentNum через gotoMessage
            (работает и через страницы темы: gotoMessage сам переключит страницу
            и подсветит цель). */}
        {m.parentAuthor && (
          m.parentNum ? (
            <a
              className="sk-msg-parent"
              title={`Плавно перейти к сообщению №${m.parentNum} от ${m.parentAuthor}, на которое дан ответ${props.parentPage != null ? ` (стр. ${props.parentPage})` : ""}`}
              onClick={(e) => {
                e.preventDefault();
                props.onGoParent?.();
              }}
            >
              └ ответ <b className={`sk-nick g-${m.parentAuthorGender === "male" || m.parentAuthorGender === "female" ? m.parentAuthorGender : "neutral"}`}>{m.parentAuthor}</b>
              {props.parentPage != null && <span className="sk-msg-parent-page"> (стр. {props.parentPage})</span>}
            </a>
          ) : (
            <span className="sk-msg-parent" title={`Ответ на сообщение пользователя ${m.parentAuthor}`}>
              └ ответ <b className={`sk-nick g-${m.parentAuthorGender === "male" || m.parentAuthorGender === "female" ? m.parentAuthorGender : "neutral"}`}>{m.parentAuthor}</b>
            </span>
          )
        )}
        {m.aiNote && (
          <span className="sk-ai-badge" title={m.aiNote}>
            🛡 ИИ: {m.aiNote}
          </span>
        )}
        <span className="sk-msg-spacer" />
        {props.canReply && (
          <button className="sk-btn-reply" onClick={props.onReply} title={`Ответить на сообщение №${m.num}`}>
            Ответить
          </button>
        )}
        {/* ШАГ 10: жалоба на сообщение — модальное окно с 7 причинами */}
        <button className="sk-flood-btn" onClick={props.onComplain} title="Жалоба уходит ИИ-модератору; спорные случаи рассмотрит человек">
          Пожаловаться
        </button>
        <button
          className={`sk-flood-btn sk-fav-btn ${props.favDone ? "done" : ""}`}
          onClick={props.onFav}
          title="Сохранить тему в избранном (не подписка)"
        >
          {props.favDone ? "★ В избранном" : "☆ В избранное"}
        </button>
        {own && (
          <button className="sk-flood-btn" onClick={props.onEdit}>
            Редактировать
          </button>
        )}
        {own && (
          <button className="sk-flood-btn sk-msg-del" onClick={props.onDelete}>
            Удалить
          </button>
        )}
      </div>
      <div className="sk-msg-body">
        {/* Цитата Сахкома: шапка-ссылка (перемотка к исходному сообщению)
            + усечённое тело. Рендерится ДО основного текста ответа. */}
        {props.quoteOf && (
          <div className="sk-quote">
            <a
              className="sk-quote-head"
              onClick={props.quoteOf.onGo}
              title={props.quoteOf.onGo ? "Плавно перейти к цитируемому сообщению" : undefined}
            >
              {props.quoteOf.author} писал(а) (№{props.quoteOf.num}):
            </a>
            <div className="sk-quote-body">{props.quoteOf.body}</div>
          </div>
        )}
        {renderMentions(m.body, props.mentionAuthors, props.onOpenProfile)}
      </div>
    </div>
  );
}

function EditMsgModal(props: { message: Msg; token: string | null; onClose: () => void; onDone: (msg: string) => void; onFail: (msg: string) => void }) {
  const [text, setText] = useState(props.message.body);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!text.trim()) {
      props.onFail("Введите текст сообщения");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/messages/${props.message.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, body: text.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Не удалось сохранить. Проверьте связь и попробуйте ещё раз.");
      props.onDone("Сообщение обновлено");
    } catch (e) {
      props.onFail(e instanceof Error ? e.message : "Не удалось сохранить. Проверьте связь и попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sk-modal-overlay" onClick={props.onClose}>
      <div className="sk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sk-modal-title">
          <span>Редактировать сообщение №{props.message.num}</span>
          <button className="sk-modal-x" onClick={props.onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="sk-modal-body">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={10000}
            style={{ width: "100%", minHeight: 170, border: "1px solid #1E3A5F", padding: 9, fontFamily: "inherit", fontSize: 16, lineHeight: 1.55, boxSizing: "border-box", resize: "vertical" }}
          />
          <div className="sk-charcount">
            {text.length > 9000 && (
              <span className={text.length > 9500 ? "over" : ""}>
                {text.length}/10000
              </span>
            )}
          </div>
          <div className="sk-modal-hint">Текст повторно пройдёт проверку ИИ-модерации.</div>
          <div className="sk-modal-actions">
            <button className="sk-btn-classic" disabled={busy || !text.trim()} onClick={save}>
              {busy ? "Сохранение…" : "Сохранить"}
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

/** ШАГ 10: окно жалобы — 7 причин + необязательный комментарий. */
function ComplaintModal(props: { message: Msg; onClose: () => void; onDone: (msg: string) => void }) {
  const [category, setCategory] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!category) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/messages/${props.message.id}/complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, comment }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      props.onDone(data.note || "Жалоба отправлена");
    } catch (e) {
      props.onDone(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sk-modal-overlay" onClick={props.onClose}>
      <div className="sk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sk-modal-title">
          <span>Пожаловаться на сообщение №{props.message.num}</span>
          <button className="sk-modal-x" onClick={props.onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="sk-modal-body">
          <div className="sk-modal-hint" style={{ marginTop: 0, marginBottom: 8 }}>
            Жалоба не удаляет сообщение сама. Его проверит ИИ-модератор, а спорные случаи рассмотрит человек.
          </div>
          <div className="sk-kind-selector">
            {COMPLAINT_REASONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`sk-kind-chip ${category === value ? "active-warn" : ""}`}
                onClick={() => setCategory(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="sk-modal-row">
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий (необязательно)" />
          </div>
          <div className="sk-modal-actions">
            <span className="sk-modal-hint" style={{ margin: 0, flex: 1 }}>
              {CATEGORY_LABELS[category] ? `Причина: ${CATEGORY_LABELS[category]}` : "Выберите причину жалобы"}
            </span>
            <button className="sk-btn-classic" style={{ marginTop: 0 }} disabled={busy || !category} onClick={submit}>
              {busy ? "Отправка…" : "Отправить жалобу"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TopicView(props: {
  topicId: number;
  user: ForumUser | null;
  token: string | null;
  favorites: { ids: number[]; toggle: (id: number) => void; has: (id: number) => boolean };
  jumpMsg: number | null;
  backParams: string;
  onJumpDone: () => void;
  onBack: () => void;
  onGoForumHome: () => void;
  onOpenRubric: (r: { slug: string; name: string } | null) => void;
  onNeedAuth: () => void;
  onNewTopic: () => void;
  onOpenProfile: (n: string) => void;
  notify: (m: string) => void;
  /** ШАГ 11: обновить баннеры санкций после ошибки ограничения/применённой санкции */
  onSanctionChange?: () => void;
}) {
  const { topicId, token, favorites } = props;
  const [topic, setTopic] = useState<Record<string, unknown> | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  // СТАДИЯ 1/Шаг 1: ники участников темы — для кликабельных @упоминаний в тексте сообщений
  // (хук — до любых ранних return, порядок хуков не должен зависеть от состояния загрузки)
  const mentionAuthors = useMemo(() => new Set(messages.map((m) => m.author)), [messages]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [sending, setSending] = useState(false);
  const [inTopicSearch, setInTopicSearch] = useState(false);
  const [topicQ, setTopicQ] = useState("");
  const [complainMsg, setComplainMsg] = useState<Msg | null>(null);
  const [editMsg, setEditMsg] = useState<Msg | null>(null);
  const [appealMsg, setAppealMsg] = useState<Msg | null>(null);
  const [appealedIds, setAppealedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(35);
  const [total, setTotal] = useState(0);
  const [gotoNum, setGotoNum] = useState("");
  const [err, setErr] = useState<{ msg: string; deleted: boolean } | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [firstNew, setFirstNew] = useState(0);
  const seenRef = useRef<number | null>(null);
  const [pages, setPages] = useState(1);
  const [curPage, setCurPage] = useState(() => (props.jumpMsg ? Math.max(1, Math.ceil(props.jumpMsg / 35)) : 1));

  const load = useCallback(() => {
    const id = ++loadId.current;
    setLoading(true);
    let markView = false;
    try {
      const key = `sk_viewed_${topicId}`;
      markView = !sessionStorage.getItem(key);
      if (markView) sessionStorage.setItem(key, "1");
    } catch {
      markView = false;
    }
    fetch(`/api/topics/${topicId}?page=${curPage}${markView ? "&view=1" : ""}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          const e = new Error(data.error || "Тема не найдена") as Error & { status?: number };
          e.status = r.status;
          throw e;
        }
        return data;
      })
      .then((data) => {
        if (id !== loadId.current) return;
        setErr(null);
        setTopic(data.topic);
        setMessages(data.messages || []);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
        if (data.perPage) setPage(data.perPage);
        try {
          const key = `sk_seen_${topicId}`;
          if (seenRef.current !== topicId) {
            const seen = parseInt(localStorage.getItem(key) || "", 10);
            const t = data.total || 0;
            if (!seen || seen < 1) {
              setNewCount(0);
              setFirstNew(0);
            } else {
              const diff = Math.max(0, t - seen);
              setNewCount(diff);
              setFirstNew(diff > 0 ? t - diff + 1 : 0);
            }
            localStorage.setItem(key, String(t));
            seenRef.current = topicId;
          }
        } catch {
          setNewCount(0);
        }
      })
      .catch((e) => {
        if (id === loadId.current) {
          setTopic(null);
          setErr({ msg: e instanceof Error ? e.message : "Тема не найдена", deleted: e.status === 410 });
        }
      })
      .finally(() => {
        if (id === loadId.current) setLoading(false);
      });
  }, [topicId, curPage]);

  const loadId = useRef(0);
  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  // ТЗ 2026-09-22 «Быстрые подсказки "Где купить"» и «Быстрые подсказки
  // "Где дешевле"» (ТЕХНИЧЕСКИЙ UX-РЕЖИМ, дословно: «При клике на кнопку
  // переноса, текущий текст пользователя не стирается. Он передается
  // GET/POST-параметром в форму ответа темы форума»). Переход с Главной по
  // ссылке /?topic=<id>&wtbhint=<текст> (рубрика «Товары и услуги ▸ Где
  // купить») или /?topic=<id>&cheapHint=<текст> (рубрика «Товары и услуги ▸
  // Цены») предзаполняет форму быстрого ответа этой темы. Текущий текст
  // автора НЕ стирается — перенос идёт только в пустое поле; параметры после
  // переноса вычищаются из адресной строки (replaceState), чтобы повторная
  // навигация не дублировала текст.
  //
  // ТЗ 2026-09-22 «сквозная логика ИИ-фильтра» (раунд prefilled_text):
  // кнопка переноса формы «Где купить» несёт ДОСЛОВНЫЙ формат ТЗ
  // /forum/topic/ИД_ТОПИКА?prefilled_text=…; роут-адаптер
  // (src/app/forum/topic/[topicId]/route.ts) переводит его в /?topic=N,
  // сохраняя параметр — здесь prefilled_text читается в том же режиме
  // (пункт 4 ТЗ: «форма ответа на форуме умела считывать этот параметр из
  // ссылки и автоматически вставляла текст в поле ввода»).
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const carried = (sp.get("wtbhint") || sp.get("cheapHint") || sp.get("prefilled_text") || "").trim();
      if (!carried) return;
      setReply((prev) => (prev.trim().length > 0 ? prev : carried));
      const url = new URL(window.location.href);
      url.searchParams.delete("wtbhint");
      url.searchParams.delete("cheapHint");
      url.searchParams.delete("prefilled_text");
      const qs = url.searchParams.toString();
      window.history.replaceState(null, "", url.pathname + (qs ? `?${qs}` : ""));
    } catch {
      /* нет window (SSR) или старый браузер — тихо */
    }
  }, [topicId]);

  const jumpRef = useRef<HTMLDivElement | null>(null);
  const pendingJump = useRef<number | null>(null);
  const flashTo = (el: Element) => {
    const scroll = () => {
      const r = el.getBoundingClientRect();
      if (r.height <= 0) return;
      const top = window.scrollY + r.top - Math.max(0, (window.innerHeight - r.height) / 2);
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    };
    scroll();
    window.setTimeout(scroll, 350);
    el.classList.add("sk-msg-flash");
    window.setTimeout(() => el.classList.remove("sk-msg-flash"), 2600);
  };

  useEffect(() => {
    const target = props.jumpMsg ?? pendingJump.current;
    if (!target || loading || messages.length === 0 || jumpRef.current === target) return;
    const el = document.querySelector(`[data-msgnum="${target}"]`);
    if (el) {
      jumpRef.current = target;
      pendingJump.current = null;
      flashTo(el);
      props.onJumpDone();
    }
  }, [props.jumpMsg, loading, messages.length, props.onJumpDone]);

  const gotoMessage = (num: number) => {
    if (!num || num < 1) return;
    const el = document.querySelector(`[data-msgnum="${num}"]`);
    if (el) {
      flashTo(el);
    } else {
      pendingJump.current = num;
      jumpRef.current = null;
      setCurPage(Math.max(1, Math.ceil(num / (page || 35))));
    }
  };

  const sendReply = async () => {
    if (!props.user) {
      props.onNeedAuth();
      return;
    }
    if (!reply.trim()) return;
    setSending(true);
    try {
      // СТАДИЯ 1/Шаг 1: автоматическое @упоминание автора ответа («@имя, текст») —
      // связь ответа с сообщением сохраняется без глубоких сдвигов лесенки
      const text = reply.trim();
      const bodyWithMention =
        replyTo?.author && !text.startsWith(`@${replyTo.author}`) ? `@${replyTo.author}, ${text}` : text;
      const r = await fetch(`/api/topics/${topicId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: bodyWithMention, parentId: replyTo?.id, token }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Ошибка отправки");
      const m = data.message;
      const sanction = data.sanction as (SendSanction & { note: string }) | null;
      if (m.isHiddenByAi) {
        const base = "Сообщение скрыто ИИ-модерацией: " + (m.hiddenReason || "нарушение") + ". Решение можно оспорить кнопкой «Оспорить решение».";
        props.notify(sanction ? `${base} ${sanction.note || ""}` : base);
        if (m.id) setAppealedIds((prev) => new Set(prev).add(m.id));
      } else {
        props.notify("Сообщение опубликовано");
      }
      setReply("");
      setReplyTo(null);
      const num = m && m.num;
      if (num) {
        const p = Math.max(1, Math.ceil(num / (page || 35)));
        if (p !== curPage) setCurPage(p);
        pendingJump.current = num;
        jumpRef.current = null;
        setFirstNew(0);
        try {
          localStorage.setItem(`sk_seen_${topicId}`, String(num));
        } catch {}
      }
      if (inTopicSearch || topicQ.trim()) {
        setInTopicSearch(false);
        setTopicQ("");
      }
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка отправки";
      props.notify(msg);
      if (msg.includes("Действует ограничение") || msg.includes("заблокирован постоянно")) {
        props.onSanctionChange?.();
      }
    } finally {
      setSending(false);
    }
  };

  const deleteMsg = async (m: Msg) => {
    if (!window.confirm(`Удалить сообщение №${m.num}?`)) return;
    try {
      const r = await fetch(`/api/messages/${m.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Ошибка удаления");
      props.notify("Сообщение удалено");
      load();
    } catch (e) {
      props.notify(e instanceof Error ? e.message : "Ошибка удаления");
    }
  };

  const topicAction = async (action: string, okMsg: string, after?: () => void) => {
    try {
      const r = await fetch(`/api/topics/${topicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Не удалось выполнить действие");
      props.notify(okMsg);
      if (after) after();
      else load();
    } catch (e) {
      props.notify(e instanceof Error ? e.message : "Не удалось выполнить действие");
    }
  };

  if (loading && !topic) {
    return <div className="sk-loading">Загрузка темы…</div>;
  }

  if (!topic) {
    return (
      <>
        <div className="sk-mainheader">Обсуждение темы</div>
        {err?.deleted ? (
          <div className="sk-deadtopic">
            <div className="dt-title">Эта тема больше недоступна.</div>
            <div className="dt-sub">
              Тема была удалена автором или модератором. Остальные темы форума доступны в общем списке — поиск работает как обычно.
            </div>
            <a className="sk-backlink" onClick={props.onBack}>
              « К списку тем
            </a>
            <span className="dt-sep">·</span>
            <a className="sk-backlink" style={{ marginLeft: 0 }} onClick={props.onGoForumHome}>
              На главную форума
            </a>
          </div>
        ) : (
          <>
            <div className="sk-loading">{err?.msg || "Тема не найдена."} </div>
            <a className="sk-backlink" onClick={props.onBack}>
              « К списку тем
            </a>
          </>
        )}
      </>
    );
  }

  const answers = (total as number) || ((topic.answers as number) ?? 0) + 1;
  const canWrite = !topic.isArchived && !topic.isClosed;
  // ШАГ 12: модераторские кнопки доступны всем сотрудникам (владелец/модератор)
  const isAdmin = props.user?.role === "admin" || props.user?.role === "owner" || props.user?.role === "moderator";
  const isOwner = !!(props.user && topic.author && topic.author === props.user.nickname);
  const searchingInTopic = inTopicSearch && !!topicQ.trim();
  const visible = searchingInTopic
    ? messages.filter((m) => !m.isDeleted && !m.isHiddenByAi && m.body.toLowerCase().includes(topicQ.trim().toLowerCase()))
    : messages;
  const firstNum = messages.length ? messages[0].num : 0;
  const lastNum = messages.length ? messages[messages.length - 1].num : 0;
  const pagerLabel = searchingInTopic ? (
    <>
      Найдено: <b>{visible.length}</b>
    </>
  ) : (
    <>
      Ответы {firstNum} - {lastNum} из <b>{fmtNum(answers)}</b>
    </>
  );

  const renderMsg = (m: Msg, quoteOf?: { author: string; num: number; body: string; onGo?: () => void } | null) => (
    <MessageRow
      m={m}
      user={props.user}
      favDone={favorites.has(topicId)}
      isNew={firstNew > 0 && m.num >= firstNew}
      canReply={canWrite}
      mentionAuthors={mentionAuthors}
      onOpenProfile={props.onOpenProfile}
      quoteOf={quoteOf}
      // Кросс-страничный ответ: родитель не на текущей странице → в метке
      // «└ ответ …» появляется пометка «(стр. M)»; на текущей — линия
      // рисуется, пометка не нужна (parentPage = null).
      parentPage={
        m.parentNum && page > 0 && Math.ceil(m.parentNum / page) !== curPage ? Math.ceil(m.parentNum / page) : null
      }
      onReply={() => {
        if (props.user) {
          setReplyTo(m);
          document.getElementById("reply-form")?.scrollIntoView({ behavior: "smooth" });
        } else {
          props.onNeedAuth();
        }
      }}
      onComplain={() => setComplainMsg(m)}
      onFav={() => {
        favorites.toggle(topicId);
        props.notify(favorites.has(topicId) ? "Удалено из избранного" : "Тема добавлена в избранное");
      }}
      onPermalink={() => {
        window.history.pushState(null, "", `/?topic=${topicId}&msg=${m.num}${props.backParams || ""}`);
        gotoMessage(m.num);
      }}
      onGoParent={m.parentNum ? () => gotoMessage(m.parentNum as number) : undefined}
      onEdit={() => setEditMsg(m)}
      onDelete={() => deleteMsg(m)}
      onAppeal={() => setAppealMsg(m)}
      appealSent={appealedIds.has(m.id)}
    />
  );

  // Директива «Повтори картинку-образец один в один: тёмно-бирюзовые
  // вертикальные линии строго СЛЕВА от серых рамок, снаружи» (образец
  // Скриншот-20260919-004758.jpg):
  // 1) ПЛОСКИЙ HTML: все сообщения идут строго друг за другом в общем
  //    родителе .sakh-comments-container — НИКАКОЙ вложенности контейнеров.
  // 2) Уровень задаётся ИСКЛЮЧИТЕЛЬНО дата-атрибутом data-level="1…6".
  // 3) Каждое сообщение — отдельная карточка .sakh-comment: сплошная рамка
  //    #CED4DA со всех четырёх сторон, белый фон, зазор 8px снизу (CSS).
  // 4) Сдвиг лесенки — margin-left (шаг 25px, замер с образца).
  // 5) Линии «кто кому ответил» — SVG-оверлей (универсальные useReplyLines
  //    + ReplyLinesOverlay внутри ForumThread):
  //    бирюзовые линии var(--sm-rail) 2px, рисуются поверх фона, но ПОД
  //    карточками (z-index 0 против 1 у карточек). Для каждого родителя —
  //    ОДНА вертикальная шина в левом маргинесе уровня его ответов (шаг
  //    25px; конфликтующие шины расходятся колонками дальше влево);
  //    каждый ответ подключается горизонтальным отводом от левого края
  //    своей карточки на высоте шапки (22px), шина приходит к левому краю
  //    поста-родителя. Стыки скруглены (r=5). Линия не рисуется, если
  //    родитель не виден на странице (метка «└ ответ …» остаётся); если
  //    родитель удалён — линия ведёт к заглушке «Сообщение №N удалено…».
  // 6) Ни один конец линии не висит в воздухе: концы лежат на рамках
  //    карточек (под рамку линия заводится на 2px — белый фон карточки
  //    прячет заводку, видимый конец точно касается рамки); участки шины
  //    за чужими карточками честно уходят под белый фон, в зазорах 8px
  //    линия касается обеих рамок. Наведение на линию подсвечивает её и
  //    показывает подсказку «ответ на #N». Мобайл ≤768px: оверлей скрыт.
  const flatMsgs = [...visible].sort((a, b) => a.num - b.num);
  const byId = new Map(flatMsgs.map((m) => [m.id, m]));
  // Уровень каждой плашки: цепочка предков (корень → непосредственный
  // родитель). Если родитель на другой странице (цепочка оборвалась) —
  // уровень берём из поля depth: API считает НАСТОЯЩУЮ глубину сообщения
  // в дереве ответов всей темы (поле depth в БД не поддерживается — там
  // везде 0), минимум 2: это точно ответ. Уровень нужен только для
  // data-level (сдвиг лесенки); геометрию линий «кто кому ответил»
  // строит хук useReplyLines по parentId и фактическим координатам.
  const lvlOf = new Map<string, number>();
  for (const m of flatMsgs) {
    let len = 0;
    let p = m.parentId ? byId.get(m.parentId) : undefined;
    let reachedRoot = !m.parentId;
    while (p) {
      len += 1;
      const pp = p.parentId ? byId.get(p.parentId) : undefined;
      if (!pp) {
        reachedRoot = !p.parentId;
        break;
      }
      p = pp;
    }
    lvlOf.set(m.id, reachedRoot ? Math.min(6, Math.max(1, len + 1)) : Math.min(6, Math.max(2, (m.depth ?? 0) + 1)));
  }
  // ЦИТАТЫ «САХКОМА» (реставрация 2026-09-23): каждый ответ показывает
  // цитату сообщения, на которое отвечает; ответ на АВТОРА ТЕМЫ
  // (parentId пуст) цитирует корневой пост темы — цитата остаётся
  // единственной связью с ним (SVG-линии рисуются только для
  // ответов-на-ответ по parentId). Корень цитирования — только на стр. 1.
  const rootMsg = curPage === 1 ? flatMsgs[0] : undefined;
  const quoteOfFor = (m: Msg): { author: string; num: number; body: string; onGo?: () => void } | null => {
    const parent = m.parentId ? byId.get(m.parentId) : m.id !== rootMsg?.id ? rootMsg : undefined;
    if (!parent || parent.id === m.id) return null;
    const body = parent.body.length > 320 ? parent.body.slice(0, 320).replace(/\s+\S*$/, "") + "…" : parent.body;
    return {
      author: parent.author,
      num: parent.num,
      body,
      onGo: () => gotoMessage(parent.num),
    };
  };

  // ЛИНИИ «КТО КОМУ ОТВЕТИЛ»: прежняя система попостовых спанов
  // (rails/hooks/stub) удалена — все линии рисует ЕДИНЫЙ SVG-оверлей
  // <ForumThread posts={flatMsgs} /> (внутри него useReplyLines +
  // ReplyLinesOverlay): одна шина на родителя, отводы к каждому ответу,
  // приход к левому краю родителя, скругления, подсветка и подсказка.

  return (
    <>
      <div className="sk-crumbs">
        <a onClick={props.onGoForumHome} title="На главную страницу форума">
          Форум
        </a>
        <span className="sep">→</span>
        {topic.rubricName ? (
          <>
            <a onClick={() => props.onOpenRubric({ slug: (topic.rubricSlug as string) || "", name: topic.rubricName as string })}>
              {topic.rubricName as string}
            </a>
            <span className="sep">→</span>
          </>
        ) : null}
        {topic.subName ? (
          <>
            <a onClick={() => props.onOpenRubric({ slug: (topic.subSlug as string) || "", name: `${topic.rubricName} → ${topic.subName}` })}>
              {topic.subName as string}
            </a>
            <span className="sep">→</span>
          </>
        ) : null}
        <span className="cur">{topic.title as string}</span>
      </div>

      <div className="sk-topicbox">
        <div className="t-title">
          {topic.title as string}
          {topic.isPinned && <span className="sk-tstatus pinned">Закреплена</span>}
          {topic.isArchived ? (
            <span className="sk-tstatus archived">В архиве</span>
          ) : (
            topic.isClosed && <span className="sk-tstatus closed">Тема закрыта</span>
          )}
        </div>
        <div className="t-meta">
          Автор: <Nick name={topic.author as string} gender={topic.authorGender as string} onOpen={props.onOpenProfile} /> · создана{" "}
          {fmtDateTime(topic.createdAt as string)} · просмотров: {fmtNum(topic.views as number)} · ответов: {fmtNum(answers)} · обновлено:{" "}
          {fmtRecent(topic.lastActivityAt as string)}
        </div>
      </div>

      {/* ШАГ 17 (ТЗ п.4/25.15): ссылка из темы обратно на исходную публикацию «Подслушано Сахалин».
          Показывается только у тем, созданных из раздела; обычные темы форума не затронуты. */}
      {topic.overheard ? (
        <div className="oh-sourcebar">
          Источник:{" "}
          <a href={`/podslyshano?post=${(topic.overheard as { id: string }).id}`}>
            Подслушано Сахалин — «{(topic.overheard as { title: string }).title}»
          </a>
        </div>
      ) : null}

      {/* ШАГ 18 (ТЗ п.12): ссылка из темы обратно на исходный вопрос «Где купить».
          Показывается только у тем, созданных из раздела; обычные темы форума не затронуты. */}
      {topic.wheretobuy ? (
        <div className="wb-sourcebar">
          Источник:{" "}
          <a href={`/gde-kupit?post=${(topic.wheretobuy as { id: string }).id}`}>
            Где купить — «{(topic.wheretobuy as { title: string }).title}»
          </a>
        </div>
      ) : null}

      {/* ШАГ 19 (ТЗ п.14/16): ссылка из темы обратно на проблему «ЖКХ и городские
          проблемы». Если публикация удалена автором, тема сохраняется — вместо
          ссылки показывается «Исходная публикация была удалена автором.» (п.16). */}
      {topic.gkh ? (
        (topic.gkh as { isDeleted: boolean }).isDeleted ? (
          <div className="gkh-sourcebar">Исходная публикация была удалена автором.</div>
        ) : (
          <div className="gkh-sourcebar">
            Источник:{" "}
            <a href={`/gkh?post=${(topic.gkh as { id: string }).id}`}>
              ЖКХ и городские проблемы — «{(topic.gkh as { title: string }).title}»
            </a>
          </div>
        )
      ) : null}

      {/* ШАГ 23 (ТЗ п.17): ссылка из темы обратно на исходный вопрос «Где дешевле».
          Показывается только у тем, созданных из раздела; обычные темы форума не затронуты. */}
      {topic.gdedeshevle ? (
        (topic.gdedeshevle as { isDeleted: boolean }).isDeleted ? (
          <div className="cd-sourcebar">Исходная публикация была удалена автором.</div>
        ) : (
          <div className="cd-sourcebar">
            Источник:{" "}
            <a href={`/gde-deshevle?post=${(topic.gdedeshevle as { id: string }).id}`}>
              Где дешевле — «{(topic.gdedeshevle as { title: string }).title}»
            </a>
          </div>
        )
      ) : null}

      {/* ШАГ 20: ссылка из темы обратно на публикацию «Рекомендую / Не рекомендую». */}
      {topic.recommend ? (
        (topic.recommend as { isDeleted: boolean }).isDeleted ? (
          <div className="rc-sourcebar">Исходная публикация была удалена автором.</div>
        ) : (
          <div className="rc-sourcebar">
            Источник:{" "}
            <a href={`/rekomenduyu?post=${(topic.recommend as { id: string }).id}`}>
              Рекомендую / Не рекомендую — «{(topic.recommend as { title: string }).title}»
            </a>
          </div>
        )
      ) : null}

      {/* ШАГ 25: ссылка из темы обратно на отзыв «О работодателях». */}
      {topic.employers ? (
        (topic.employers as { isDeleted: boolean }).isDeleted ? (
          <div className="ep-sourcebar">Исходная публикация была удалена автором.</div>
        ) : (
          <div className="ep-sourcebar">
            Источник:{" "}
            <a href={`/o-rabotodatelyah?post=${(topic.employers as { id: string }).id}`}>
              О работодателях — «{(topic.employers as { title: string }).title}»
            </a>
          </div>
        )
      ) : null}

      {topic.isArchived && (
        <div className="sk-archive-note">
          <b>Тема в архиве.</b> Обсуждение закрыто из-за неактуальности. Если вопрос снова актуален —{" "}
          <a onClick={props.onNewTopic}>создайте новую тему</a>.
        </div>
      )}

      <div className="sk-topicactions">
        <button
          className="sk-btn-answer"
          onClick={() => {
            if (topic.isArchived) {
              props.notify("Тема в архиве — обсуждение закрыто. Создайте новую тему, если вопрос снова актуален");
            } else if (topic.isClosed) {
              props.notify("Тема закрыта для новых сообщений");
            } else if (props.user) {
              document.getElementById("reply-form")?.scrollIntoView({ behavior: "smooth" });
            } else {
              props.onNeedAuth();
            }
          }}
        >
          Ответить
        </button>
        {newCount > 0 && (
          <button
            onClick={() => {
              if (newCount <= 0) return;
              gotoMessage(answers - newCount + 1);
              try {
                localStorage.setItem(`sk_seen_${topicId}`, String(answers));
              } catch {}
              setNewCount(0);
            }}
            title={`К первому непрочитанному — сообщение №${answers - newCount + 1}`}
          >
            → Новые сообщения ({newCount})
          </button>
        )}
        <button
          className={favorites.has(topicId) ? "done" : ""}
          onClick={() => {
            favorites.toggle(topicId);
            props.notify(favorites.has(topicId) ? "Удалено из избранного" : "Добавлено в избранное");
          }}
        >
          {favorites.has(topicId) ? "★ В избранном" : "☆ Добавить в избранное"}
        </button>
        <button onClick={() => setInTopicSearch((v) => !v)}>Поиск по теме</button>
        {isAdmin && !topic.isArchived && (topic.isClosed ? (
          <button
            onClick={() => {
              if (window.confirm("Открыть тему снова? Пользователи смогут писать новые сообщения."))
                topicAction("open", "Тема снова открыта — можно писать сообщения");
            }}
            title="Открыть тему снова — разрешить новые сообщения"
          >
            Открыть тему
          </button>
        ) : (
          <button
            onClick={() => {
              if (window.confirm("Закрыть тему? Читать её сможет каждый, но новые сообщения будут запрещены. Открыть снова сможет модератор."))
                topicAction("close", "Тема закрыта — новые сообщения запрещены");
            }}
            title="Закрыть тему: читать можно, новые сообщения запрещены"
          >
            Закрыть тему
          </button>
        ))}
        {(isAdmin || isOwner) && (
          <button
            className="sk-topicdel"
            onClick={() => {
              if (window.confirm("Удалить тему? Она исчезнет из списков и поиска, а ссылки на неё будут открывать страницу «Эта тема больше недоступна».")) {
                topicAction("delete", "Тема удалена", () => props.onBack());
              }
            }}
            title="Удалить тему: ссылки на неё откроют страницу «Эта тема больше недоступна»"
          >
            Удалить тему
          </button>
        )}
      </div>

      {inTopicSearch && (
        <div className="sk-note">
          Поиск внутри темы:{" "}
          <input
            value={topicQ}
            onChange={(e) => setTopicQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const q = topicQ.trim().toLowerCase();
              if (!q) return;
              const found = messages.find((m) => !m.isDeleted && !m.isHiddenByAi && m.body.toLowerCase().includes(q));
              if (found) gotoMessage(found.num);
            }}
            placeholder="Что ищем… Enter — к первому найденному"
            style={{ width: "60%" }}
          />{" "}
          <a
            onClick={() => {
              setInTopicSearch(false);
              setTopicQ("");
            }}
          >
            закрыть
          </a>
        </div>
      )}

      <TopicPager label={pagerLabel} pages={pages} page={curPage} onGo={(p) => setCurPage(p)} goto={gotoNum} setGoto={setGotoNum} onGotoNum={(n) => { gotoMessage(n); setGotoNum(""); }} />

      {searchingInTopic ? (
        [...visible].sort((a, b) => a.num - b.num).map((m) => <div key={m.id}>{renderMsg(m)}</div>)
      ) : (
        <ForumThread
          /* УНИВЕРСАЛЬНЫЙ ForumThread (переиспользуется всеми местами, где
             показываются посты): плоский список карточек + SVG-линии «кто кому
             ответил» (хук useReplyLines + оверлей ReplyLinesOverlay). Смена
             posts — пагинация, новый ответ (load() после POST), другая тема —
             автоматически пересчитывает линии; никакого хардкода id. */
          className="sakh-comments-container"
          posts={flatMsgs}
          renderPost={(m) => (
            <div key={m.id} className="sakh-comment" data-level={String(lvlOf.get(m.id) ?? 1)} data-id={m.id} data-msgnum={m.num}>
              {renderMsg(m, quoteOfFor(m))}
            </div>
          )}
        />
      )}

      <TopicPager label={pagerLabel} pages={pages} page={curPage} onGo={(p) => setCurPage(p)} goto={gotoNum} setGoto={setGotoNum} onGotoNum={(n) => { gotoMessage(n); setGotoNum(""); }} />

      <div className="sk-qr" id="reply-form">
        <div className="sk-qr-label">Быстрый ответ в теме:</div>
        {topic.isArchived ? (
          <div className="sk-archive-note" style={{ marginBottom: 0 }}>
            <b>Тема в архиве.</b> Обсуждение закрыто из-за неактуальности. Если вопрос снова актуален —{" "}
            <a onClick={props.onNewTopic}>создайте новую тему</a>.
          </div>
        ) : topic.isClosed ? (
          <div className="sk-note">Тема закрыта для новых сообщений.</div>
        ) : (
          <>
            {replyTo && (
              <div className="sk-qr-target">
                Ответ для {replyTo.author} (№{replyTo.num}){" "}
                <button onClick={() => setReplyTo(null)}>отменить ×</button>
              </div>
            )}
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Напишите ваше мнение…"
              maxLength={10000}
            />
            <div className="sk-charcount">
              {reply.length > 9000 && <span className={reply.length > 9500 ? "over" : ""}>{reply.length}/10000</span>}
            </div>
            <div>
              <button className="sk-btn-classic" disabled={sending || !reply.trim()} onClick={sendReply}>
                {sending ? "Проверка ИИ…" : "Отправить мнение"}
              </button>
              {!props.user && (
                <span style={{ fontSize: 12.5, color: "#AA3333", marginLeft: 10 }}>
                  Чтобы писать на форуме, войдите или зарегистрируйтесь — ссылка в левой колонке.
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <a className="sk-backlink" onClick={props.onBack}>
        « К списку тем
      </a>

      {complainMsg && (
        <ComplaintModal
          message={complainMsg}
          onClose={() => setComplainMsg(null)}
          onDone={(m) => {
            setComplainMsg(null);
            props.notify(m);
          }}
        />
      )}
      {appealMsg && (
        <AppealModal
          token={token}
          target={{ messageId: appealMsg.id, label: `скрытие сообщения №${appealMsg.num} в теме «${(topic.title as string) || ""}»` }}
          onClose={() => setAppealMsg(null)}
          onDone={(m) => {
            setAppealMsg(null);
            if (appealMsg.id) setAppealedIds((prev) => new Set(prev).add(appealMsg.id));
            props.notify(m);
            load();
          }}
        />
      )}
      {editMsg && (
        <EditMsgModal
          message={editMsg}
          token={token}
          onClose={() => setEditMsg(null)}
          onDone={(m) => {
            setEditMsg(null);
            props.notify(m);
            load();
          }}
          onFail={(m) => props.notify(m)}
        />
      )}
    </>
  );
}
