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
