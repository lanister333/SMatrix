"use client";

/**
 * ТЗ 2026-09-23 «Кнопки „Обсудить на форуме“» — п.7: маршрут
 * /forum/category/<slug> — СПИСОК ТЕМ РУБРИКИ как самостоятельная страница.
 *
 * Сюда ведут все кнопки «Обсудить на форуме» из блоков сайта, когда у
 * публикации ещё нет собственной связанной темы (п.3/4 ТЗ — единая логика:
 * «если ведём в рубрику — открывается список тем рубрики», п.5).
 *
 * Данные и поведение:
 *  — рубрика разрешается по slug из GET /api/bootstrap (родитель или
 *    дочерняя; дочерние темы попадают в список через /api/topics?rubric=,
 *    который включает темы дочерних рубрик);
 *  — список тем рендерит штатный TopicList форума (как в корневом SPA);
 *  — «Добавить тему» → NewTopicModal с предвыбранной рубрикой
 *    (гостю сначала AuthModal);
 *  — клик по теме → /forum/topic/<id> (реальная страница темы);
 *  — неизвестный слаг → внятное «Рубрика не найдена» со ссылкой на /forum.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import TopicList from "@/components/forum/topic-list";
import { AuthModal, NewTopicModal } from "@/components/forum/modals";
import { DEFAULT_SETTINGS, isStaffRole, MainNav, Masthead, SiteFooter, useAuth, type SiteSettings } from "@/components/site/chrome";
import { forumCategoryHref, forumTopicHref } from "@/lib/forum-links";
import type { ForumUser } from "@/lib/ui";

/** Локальное избранное — тот же localStorage-ключ, что в корневом SPA (lib/ui FAV_KEY). */
const FAV_KEY = "sm_favorites";

function useFavorites() {
  const [ids, setIds] = useState<number[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      if (raw) setIds(JSON.parse(raw));
    } catch {}
  }, []);
  const toggle = useCallback((id: number) => {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);
  const has = useCallback((id: number) => ids.includes(id), [ids]);
  return { ids, toggle, has };
}

interface FoundRubric {
  slug: string;
  name: string;
  parentName: string | null;
}

export default function ForumCategoryPage(props: { params: Promise<{ slug: string }> }) {
  const { user, token, login } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [slug, setSlug] = useState<string>("");
  const [found, setFound] = useState<FoundRubric | null>(null);
  const [bootDone, setBootDone] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [newTopic, setNewTopic] = useState(false);
  const [scope, setScope] = useState("new");
  const [toast, setToast] = useState("");
  const favorites = useFavorites();

  /**
   * ТЗ 2026-09-24 «Обсудить на форуме из отзыва/вопроса/трудового опыта»:
   * предзаполнение формы новой темы. URL вида
   *   /forum/category/<slug>?new=1&postId=<id>&kind=<section>&source=<url>
   * означает «пришёл пользователь с кнопки «Обсудить на форуме» под
   * публикацией; открой форму создания темы и подставь заголовок/текст».
   *
   * Логика:
   *  1. useSearchParams() читает query (Next 16 client-component API).
   *  2. Если new=1 && postId — делаем fetch к /api/<kind>/<postId>.
   *     kind определяет тип публикации:
   *       recommend   → /api/recommend/<id>      (отзывы)
   *       wheretobuy  → /api/wheretobuy/<id>     (вопросы «Где купить»)
   *       gdedeshevle → /api/gdedeshevle/<id>    (вопросы «Где дешевле»)
   *       employers   → /api/employers/<id>      (карточки «О работодателях»)
   *  3. Формирование prefillTitle / prefillMessage зависит от типа:
   *       • recommend/wheretobuy/gdedeshevle — title из d.title, message из d.text
   *       • employers — title = «<employer> (<city>)», message = опыт + упоминание
   *  4. К сообщению всегда добавляется ссылка-источник из ?source=...:
   *       «— из публикации: <origin><source>» — обратная навигация к исходной карточке.
   *  5. После загрузки — автоматически открываем NewTopicModal (если гость —
   *     сначала AuthModal; после входа откроется NewTopicModal).
   */
  const searchParams = useSearchParams();
  const prefillNew = searchParams.get("new") === "1";
  const prefillPostId = searchParams.get("postId");
  const prefillKind = searchParams.get("kind") || "recommend"; // default для обратной совместимости
  const prefillSource = searchParams.get("source");

  const [prefillTitle, setPrefillTitle] = useState("");
  const [prefillMessage, setPrefillMessage] = useState("");
  const [prefillLoaded, setPrefillLoaded] = useState(false);
  const [prefillError, setPrefillError] = useState("");

  // Шаг 1: подгрузка публикации по postId, формирование prefill-строк.
  useEffect(() => {
    if (!prefillNew || !prefillPostId) {
      setPrefillLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/${prefillKind}/${encodeURIComponent(prefillPostId)}`);
        if (!r.ok) {
          setPrefillError(r.status === 404 ? "Публикация не найдена" : "Не удалось загрузить публикацию");
          return;
        }
        const d = await r.json();
        if (cancelled) return;

        // Универсальный формат: заголовок + текст + ссылка-источник.
        // Специфика employers — собирается из нескольких полей.
        let title = "";
        let message = "";
        if (prefillKind === "employers") {
          // Заголовок темы = «<employer> (<city>)» — как в карточке.
          const city = d.city ? ` (${d.city})` : "";
          title = `${d.employer || ""}${city}`.slice(0, 150).trim();
          // Текст сообщения = период + опыт + упоминание человека.
          const parts: string[] = [];
          if (d.workPeriod) parts.push(`Период работы: ${d.workPeriod}`);
          if (d.experience) parts.push(`\nЛичный опыт:\n${d.experience}`);
          if (d.personMention) parts.push(`\n\nОтдельно хочу отметить человека:\n${d.personMention}`);
          message = parts.join("\n\n");
        } else {
          // recommend / wheretobuy / gdedeshevle — стандартные title + text.
          title = (d.title || d.subject || "").slice(0, 150);
          message = d.text || "";
        }

        // Ссылка-источник в конец сообщения — обратная навигация.
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const srcLine = prefillSource ? `\n\n— из публикации: ${origin}${prefillSource}` : "";
        setPrefillTitle(title);
        setPrefillMessage(`${message}${srcLine}`.slice(0, 20000));
      } catch {
        if (!cancelled) setPrefillError("Сеть недоступна — откройте форму вручную");
      } finally {
        if (!cancelled) setPrefillLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [prefillNew, prefillPostId, prefillKind, prefillSource]);

  // Шаг 2: после загрузки prefill и найденной рубрики — авто-открытие формы.
  useEffect(() => {
    if (!prefillLoaded || !prefillTitle || !found) return;
    // Если уже открыто (повторный заход) — пропускаем.
    if (newTopic || authOpen) return;
    // Гостю — сначала AuthModal; после входа user/token станут не-null и
    // этот эффект перезапустится и откроет NewTopicModal.
    if (!user || !token) {
      setAuthOpen(true);
      return;
    }
    setNewTopic(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillLoaded, prefillTitle, found, user, token]);

  // Слаг маршрута (Next 15/16: params — промис).
  useEffect(() => {
    props.params.then((p) => setSlug(p.slug ? decodeURIComponent(p.slug) : ""));
  }, [props.params]);

  useEffect(() => {
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then((r) => {
        if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings });
        const list = (r.rubrics || []) as Array<{ id: number; name: string; slug: string; children: Array<{ id: number; name: string; slug: string }> }>;
        if (slug) {
          const flat = list.flatMap((p2) => [{ name: p2.name, slug: p2.slug, parentName: null as string | null }, ...p2.children.map((c) => ({ name: c.name, slug: c.slug, parentName: p2.name as string | null }))]);
          const hit = flat.find((x) => x.slug === slug) || null;
          setFound(hit);
        } else {
          setFound(null);
        }
        setBootDone(true);
      })
      .catch(() => {
        setBootDone(true);
      });
  }, [slug]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3500);
  }, []);

  const rubricFilter = useMemo(() => (found ? { slug: found.slug, name: found.name } : null), [found]);

  const goNav = useCallback((k: string) => {
    if (k === "forum") {
      window.location.href = "/forum";
      return;
    }
    if (k === "podslyshano") { window.location.href = "/podslyshano"; return; }
    if (k === "wheretobuy") { window.location.href = "/gde-kupit"; return; }
    if (k === "gkh") { window.location.href = "/gkh"; return; }
    if (k === "dating") { window.location.href = "/znakomstva"; return; }
    if (k === "gdedeshevle") { window.location.href = "/gde-deshevle"; return; }
    if (k === "recommend") { window.location.href = "/rekomenduyu"; return; }
    if (k === "employers") { window.location.href = "/o-rabotodatelyah"; return; }
    if (k === "help") { window.location.href = "/help"; return; }
    window.location.href = k === "home" ? "/" : `/?view=${k}`;
  }, []);

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="forum" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div className="sk-topbar">
          <span className="tb-title">{found ? found.name : "Рубрика форума"}</span>
        </div>
        <div className="sk-shell">
          <div style={{ margin: "0 auto", maxWidth: 980, padding: "14px 12px 22px" }} data-forum-category="1">
            {/* Хлебные крошки: Форум → [Родитель] → Рубрика */}
            <div className="forum-cat-crumbs" data-forum-crumbs="1">
              <a href="/forum">Форум</a>
              {found?.parentName && (
                <>
                  <span className="crumb-sep">→</span>
                  <span>{found.parentName}</span>
                </>
              )}
              {found && (
                <>
                  <span className="crumb-sep">→</span>
                  <b>{found.name}</b>
                </>
              )}
            </div>

            {!bootDone && <div className="sk-empty">Загрузка…</div>}

            {bootDone && !found && (
              <div className="sk-empty" data-forum-category-miss="1">
                Рубрика не найдена. <a href="/forum">Открыть список рубрик форума</a>.
              </div>
            )}

            {found && (
              <TopicList
                scope={scope}
                onScope={setScope}
                rubricFilter={rubricFilter}
                user={user as ForumUser | null}
                token={token}
                favorites={favorites}
                onOpenTopic={(id) => {
                  window.location.href = forumTopicHref(id);
                }}
                onOpenTopicAt={(id, msg) => {
                  window.location.href = `${forumTopicHref(id)}?msg=${msg}`;
                }}
                onAddTopic={() => {
                  if (!user || !token) {
                    setAuthOpen(true);
                    return;
                  }
                  setNewTopic(true);
                }}
                onNeedAuth={() => setAuthOpen(true)}
                onOpenRubric={(r) => {
                  window.location.href = r ? forumCategoryHref(r.slug) : "/forum";
                }}
                onOpenProfile={(n) => {
                  window.location.href = `/?user=${encodeURIComponent(n)}`;
                }}
              />
            )}
          </div>
        </div>
        <SiteFooter settings={settings} />
      </div>
      {authOpen && (
        <AuthModal
          standalone
          onClose={() => setAuthOpen(false)}
          onLogin={(t, u) => {
            login(t, u);
            notify(`Вы вошли как ${u.nickname}`);
          }}
        />
      )}
      {newTopic && token && found && (
        <NewTopicModal
          token={token}
          initialRubric={{ slug: found.slug, name: found.name }}
          initialTitle={prefillTitle}
          initialMessage={prefillMessage}
          onClose={() => setNewTopic(false)}
          onCreated={(id) => {
            setNewTopic(false);
            notify("Тема создана");
            window.location.href = forumTopicHref(id);
          }}
        />
      )}
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-[90] -translate-x-1/2 border-2 border-[#1E3A5F] bg-white px-4 py-2 text-[14px] font-semibold text-[#1E3A5F] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
