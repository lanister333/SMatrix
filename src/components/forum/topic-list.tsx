"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Nick, fmtDate, fmtNum, type ForumUser, type TopicRow } from "@/lib/ui";

interface SearchRow {
  type: "message" | "topic";
  topicId: number;
  title: string;
  messageNum: number | null;
  snippet: string;
  rubricName: string;
  author: string;
  authorGender: string;
  isArchived: boolean;
  isClosed: boolean;
}

function NeedAuth({ scope, onNeedAuth }: { scope: string; onNeedAuth: () => void }) {
  return (
    <div className="sk-authneed">
      <div className="an-title">{scope === "mine" ? "Мои темы — вход на форум" : "Мои сообщения — вход на форум"}</div>
      <p>
        Этот раздел собирает {scope === "mine" ? "темы, которые вы создавали" : "темы, где вы оставляли сообщения"}. Доступен только
        авторизованным пользователям — войдите по email или зарегистрируйтесь (email и пароль), это займёт меньше минуты.
      </p>
      <button className="sk-btn-classic" onClick={onNeedAuth}>
        Войти или зарегистрироваться
      </button>
    </div>
  );
}

export default function TopicList(props: {
  scope: string;
  onScope: (s: string) => void;
  rubricFilter: { slug: string; name: string } | null;
  user: ForumUser | null;
  token: string | null;
  favorites: { ids: number[]; toggle: (id: number) => void; has: (id: number) => boolean };
  onOpenTopic: (id: number) => void;
  onOpenTopicAt: (id: number, msg: number) => void;
  onAddTopic: () => void;
  onNeedAuth: () => void;
  onOpenRubric: (r: { slug: string; name: string } | null) => void;
  onOpenProfile: (n: string) => void;
}) {
  const { user, token, favorites, scope, rubricFilter } = props;
  const [q, setQ] = useState("");
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchRes, setSearchRes] = useState<SearchRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [newBadges, setNewBadges] = useState<Record<number, number>>({});

  useEffect(() => {
    const badges: Record<number, number> = {};
    for (const t of topics) {
      try {
        const seen = parseInt(localStorage.getItem(`sk_seen_${t.id}`) || "", 10);
        const diff = t.answers + 1 - seen;
        if (seen >= 1 && diff > 0) badges[t.id] = diff;
      } catch {}
    }
    setNewBadges(badges);
  }, [topics]);

  const [syncKey, setSyncKey] = useState("");
  const lastSync = `${scope}|${rubricFilter?.slug ?? ""}`;
  if (syncKey !== lastSync) {
    setSyncKey(lastSync);
    setPage(1);
    setSearchRes(null);
    setQ("");
  }

  const runSearch = async () => {
    const query = q.trim();
    if (query.length < 2) {
      setSearchRes([]);
      return;
    }
    setSearching(true);
    try {
      const r = await fetch("/api/search?q=" + encodeURIComponent(query));
      const data = await r.json();
      setSearchRes(data.results || []);
    } catch {
      setSearchRes([]);
    } finally {
      setSearching(false);
    }
  };

  const reqId = useRef(0);
  const load = useCallback(() => {
    const id = ++reqId.current;
    if (((scope === "mine" || scope === "participated") && !token) || (scope === "favorites" && favorites.ids.length === 0)) {
      setTopics([]);
      setTotal(0);
      setPages(1);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    const p = new URLSearchParams({ page: String(page), perPage: "25" });
    if (q.trim()) p.set("q", q.trim());
    if (scope === "popular") p.set("sort", "popular");
    if (scope === "unanswered") p.set("sort", "unanswered");
    if (scope === "active") p.set("scope", "active");
    if (scope === "mine" && token) {
      p.set("scope", "mine");
      p.set("token", token);
    }
    if (scope === "participated" && token) {
      p.set("scope", "participated");
      p.set("token", token);
    }
    if (scope === "favorites") p.set("ids", favorites.ids.join(","));
    if (scope === "archive") p.set("scope", "archive");
    if (rubricFilter) p.set("rubric", rubricFilter.slug);
    fetch(`/api/topics?${p}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error || "Ошибка загрузки");
        return data;
      })
      .then((data) => {
        if (id === reqId.current) {
          setTopics(data.topics || []);
          setTotal(data.total || 0);
          setPages(data.pages || 1);
        }
      })
      .catch((e) => {
        if (id === reqId.current) setError(e.message);
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
  }, [scope, page, q, token, favorites.ids, rubricFilter]);

  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const header =
    scope === "new" ? "Последние темы" :
    scope === "popular" ? "Популярные темы" :
    scope === "unanswered" ? "Без ответа" :
    scope === "active" ? "Активные темы" :
    scope === "mine" ? "Мои темы" :
    scope === "participated" ? "Мои сообщения" :
    scope === "favorites" ? "Избранное" :
    scope === "archive" ? "Архив форума" : "Форум";
  const mainHeader = rubricFilter ? rubricFilter.name : header;
  const from = total === 0 ? 0 : (page - 1) * 25 + 1;
  const to = Math.min(25 * page, total);

  const canShowList = !((scope === "mine" || scope === "participated") && !user);

  return (
    <>
      <div className="sk-forumhead">
        <div className="fh-title">Форум Сахалина</div>
        <div className="fh-desc">Обсуждаем жизнь Сахалина, задаём вопросы, делимся опытом и помогаем друг другу.</div>
      </div>
      <div className="sk-mainheader">{mainHeader}</div>
      <div className="sk-toolbar">
        <div className="sk-tabs">
          <button className={scope !== "new" || rubricFilter ? "" : "active"} onClick={() => props.onScope("new")}>
            Все темы
          </button>
          <span className="sep">|</span>
          <button className={scope === "popular" ? "active" : ""} onClick={() => props.onScope("popular")}>
            Популярные
          </button>
          <span className="sep">|</span>
          <button className={scope === "unanswered" ? "active" : ""} onClick={() => props.onScope("unanswered")}>
            Без ответа
          </button>
        </div>
        <span style={{ flex: 1 }} />
        <form
          className="sk-toolbar-form"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
        >
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по названиям тем и сообщениям…"
          />
          <button className="sk-btn-classic" style={{ margin: 0 }} type="submit">
            Найти
          </button>
          <button className="sk-btn-classic" style={{ margin: 0 }} type="button" onClick={props.onAddTopic}>
            + Новая тема
          </button>
        </form>
      </div>
      {rubricFilter && (
        <div className="sk-note">
          Рубрика: <b>{rubricFilter.name}</b> — <a onClick={() => props.onScope("new")}>сбросить фильтр</a>
        </div>
      )}
      {!canShowList ? (
        <NeedAuth scope={scope} onNeedAuth={props.onNeedAuth} />
      ) : searchRes !== null ? (
        searching ? (
          <div className="sk-loading">Идёт поиск…</div>
        ) : (
          <div className="sk-searchres">
            <div className="sk-searchres-head">
              Поиск «{q.trim()}» — найдено: <b>{searchRes.length}</b> ·{" "}
              <a
                onClick={() => {
                  setSearchRes(null);
                  setQ("");
                  setPage(1);
                }}
              >
                вернуться к темам
              </a>
            </div>
            {searchRes.length === 0 ? (
              <div className="sk-loading">
                Ничего не найдено. Поиск ведётся по словам в названиях тем и тексте сообщений — попробуйте часть слова, например «краб».
              </div>
            ) : (
              searchRes.map((r, i) => (
                <div key={`${r.topicId}-${r.messageNum ?? "t"}-${i}`} className="sk-searchrow" onClick={() => props.onOpenTopicAt(r.topicId, r.messageNum ?? 0)}>
                  <div className="sr-title">
                    <a>{r.title}</a>
                    {r.messageNum != null ? (
                      <span className="sr-badge">сообщение №{r.messageNum}</span>
                    ) : (
                      <span className="sr-badge sr-badge-title">в названии темы</span>
                    )}
                    {r.isArchived && <span className="sr-badge sr-badge-lifecycle">В архиве</span>}
                    {!r.isArchived && r.isClosed && <span className="sr-badge sr-badge-lifecycle closed">Закрыта</span>}
                  </div>
                  {r.type === "message" && <div className="sr-snippet">{r.snippet}</div>}
                  <div className="sr-meta">
                    {r.rubricName}
                    {r.rubricName && " · "}
                    <Nick name={r.author} gender={r.authorGender} onOpen={props.onOpenProfile} />
                  </div>
                </div>
              ))
            )}
          </div>
        )
      ) : loading ? (
        <div className="sk-loading">Загрузка тем…</div>
      ) : error ? (
        error.includes("Войдите") ? (
          <NeedAuth scope={scope} onNeedAuth={props.onNeedAuth} />
        ) : (
          <div className="sk-error">{error}</div>
        )
      ) : topics.length === 0 ? (
        <div className="sk-loading">
          {scope === "archive" ? (
            "Архив пуст. Темы автоматически уходят в архив, если с последнего сообщения прошло больше года."
          ) : (
            <>
              Тем не найдено.{" "}
              {scope === "favorites" && "Добавляйте темы в избранное кнопкой «☆ Добавить в избранное» внутри темы."}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="sk-listhead">
            <div>Тема</div>
            <div className="col-author">Автор</div>
            <div className="num">Ответы</div>
            <div className="num col-views">Просмотры</div>
            <div>Последнее</div>
          </div>
          {topics.map((t) => (
            <div key={t.id} className={`sk-row ${t.isPinned ? "pinned" : ""}`}>
              <div className="r-title">
                <a onClick={() => props.onOpenTopic(t.id)}>{t.title}</a>
                {t.isPinned && <span className="sk-status-badge pin">Закреплена</span>}
                {t.isArchived ? (
                  <span className="sk-status-badge archived">В архиве</span>
                ) : (
                  t.isClosed && <span className="sk-status-badge closed">Закрыта</span>
                )}
                {newBadges[t.id] ? (
                  <span className="sk-newbadge" title={`Новых сообщений: ${newBadges[t.id]} (с вашего последнего посещения)`}>
                    Новое
                  </span>
                ) : null}
                <span className="r-sub">
                  <a
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onOpenRubric({ slug: t.rubricSlug || "", name: t.subName ? `${t.rubricName} → ${t.subName}` : t.rubricName });
                    }}
                  >
                    {t.rubricName}
                    {t.subName ? ` → ${t.subName}` : ""}
                  </a>
                </span>
              </div>
              <div className="r-author">
                <Nick name={t.author} gender={t.authorGender} onOpen={props.onOpenProfile} />
              </div>
              <div className="r-num">{t.answers}</div>
              <div className="r-num r-views">{fmtNum(t.views)}</div>
              <div className="r-last">
                <Nick name={t.lastAuthor} gender={t.lastAuthorGender} onOpen={props.onOpenProfile} />
                <span className="r-time">{fmtDate(t.lastActivityAt)}</span>
              </div>
            </div>
          ))}
          {/* ТЗ 2026-09-23 «Компактный форум»: пагинатор плотнее (10→6) */}
          <div className="sk-pager" style={{ marginTop: 6 }}>
            <span>
              Темы {from} - {to} из <b>{fmtNum(total)}</b>
            </span>
            {pages > 1 && (
              <span className="pg-pages">
                <span>страницы:</span>
                {Array.from({ length: Math.min(pages, 12) }, (_, i) => i + 1).map((n) =>
                  n === page ? (
                    <span key={n} className="pg-cur">
                      {n}
                    </span>
                  ) : (
                    <a key={n} className="pg-num" onClick={() => setPage(n)}>
                      {n}
                    </a>
                  )
                )}
                {pages > 12 && <span>…</span>}
              </span>
            )}
          </div>
        </>
      )}
    </>
  );
}
