"use client";

/**
 * ТЗ 2026-09-23 «Кнопки „Обсудить на форуме“» — п.7: маршрут
 * /forum/topic/<topicId> — КОНКРЕТНАЯ ТЕМА форума как самостоятельная
 * страница (до сих пор существовал только роут-адаптер route.ts с
 * 302-редиректом на /?topic=N; теперь тема открывается по настоящему
 * адресу, а параметры п.4 ТЗ поддерживаются напрямую).
 *
 * Поддержка формата ТЗ (п.4/5):
 *   /forum/topic/177?prefilled_text=<текст>
 *   — числовой ИД темы; prefilled_text читает сам TopicView
 *     (вставляет текст в ПУСТОЕ поле быстрого ответа и вычищает
 *     параметр из адресной строки — см. topic-view.tsx);
 *   /forum/topic/topic-grm-123?prefilled_text=…
 *   — СЛАГИ тем-приёмников из «Ссылок для переноса» ТЗ 2026-09-23
 *     (примеры 1–6 + сценарий 7 Cybex): карта SLUG_TO_TOPIC заменяет
 *     прежнюю карту route.ts. Неизвестный адрес → «Тема не найдена»
 *     со ссылкой на список рубрик.
 *
 * «К списку тем» ведёт в /forum/category/<slug> рубрики темы (получается
 * лёгким запросом GET /api/topics/<id>), «На главную форума» — в /forum.
 */

import { useCallback, useEffect, useState } from "react";
import TopicView from "@/components/forum/topic-view";
import ForumColumns from "@/components/forum/forum-columns";
import { AuthModal, NewTopicModal } from "@/components/forum/modals";
import { DEFAULT_SETTINGS, isStaffRole, MainNav, Masthead, SiteFooter, useAuth, type SiteSettings } from "@/components/site/chrome";
import { forumCategoryHref, forumTopicHref } from "@/lib/forum-links";
import type { ForumUser } from "@/lib/ui";

/** Локальное избранное — тот же localStorage-ключ, что в корневом SPA. */
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

/**
 * Слагы тем из «Ссылок для переноса» ТЗ (примеры 1–6 + сценарий 7 Cybex),
 * прежде — карта route.ts; 177 — приёмник «Где купить», 178 — «Где
 * дешевле», 176 — актуальная тема обсуждения публикации Cybex.
 */
const SLUG_TO_TOPIC: Record<string, number> = {
  "topic-grm-123": 177,
  "topic-shkola-789": 177,
  "topic-sima-555": 177,
  "topic-tyres-456": 178,
  "topic-salmon-888": 178,
  "topic-timber-999": 178,
  "topic-cybex-777": 176,
};

export default function ForumTopicPage(props: { params: Promise<{ topicId: string }> }) {
  const { user, token, login } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [rawId, setRawId] = useState<string>("");
  const [topicId, setTopicId] = useState<number | null>(null);
  const [resolved, setResolved] = useState(false);
  const [backSlug, setBackSlug] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [newTopic, setNewTopic] = useState(false);
  const [toast, setToast] = useState("");
  const favorites = useFavorites();

  useEffect(() => {
    props.params.then((p) => setRawId(p.topicId ?? ""));
  }, [props.params]);

  // Разрешение адреса: числовой ИД или слаг из ТЗ.
  useEffect(() => {
    if (!rawId) return;
    const dec = decodeURIComponent(rawId);
    if (/^\d+$/.test(dec)) {
      setTopicId(Number(dec));
    } else if (SLUG_TO_TOPIC[dec]) {
      setTopicId(SLUG_TO_TOPIC[dec]);
    } else {
      setTopicId(null);
    }
    setResolved(true);
  }, [rawId]);

  // Рубрика темы — для ссылки «К списку тем» (лёгкий запрос, данные
  // самой темы TopicView загружает самостоятельно).
  useEffect(() => {
    if (!topicId) return;
    let alive = false;
    fetch(`/api/topics/${topicId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        setBackSlug(d?.topic?.subSlug || d?.topic?.rubricSlug || null);
      })
      .catch(() => {});
    return () => {
      alive = true;
    };
  }, [topicId]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3500);
  }, []);

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
          <span className="tb-title">Тема форума</span>
        </div>
        <div className="sk-shell">
          {/* 29.09.2026: 3-колоночный layout форума — единый со всеми
              страницами сайта. Слева «О форуме», по центру — TopicView,
              справа Время + «Правила форума». Применимо ко всем страницам
              форума по запросу пользователя. */}
          <ForumColumns>
            <div style={{ margin: "0 auto", maxWidth: 980, padding: "14px 12px 22px" }} data-forum-topic-page="1">
              {!resolved && <div className="sk-empty">Загрузка…</div>}

              {resolved && topicId === null && (
                <div className="sk-empty" data-forum-topic-miss="1">
                  Тема не найдена. <a href="/forum">Открыть список рубрик форума</a>.
                </div>
              )}

              {resolved && topicId !== null && (
                <TopicView
                  topicId={topicId}
                  user={user as ForumUser | null}
                  token={token}
                  favorites={favorites}
                  jumpMsg={null}
                  backParams=""
                  onJumpDone={() => {}}
                  onBack={() => {
                    window.location.href = backSlug ? forumCategoryHref(backSlug) : "/forum";
                  }}
                  onGoForumHome={() => {
                    window.location.href = "/forum";
                  }}
                  onOpenRubric={(r) => {
                    window.location.href = r ? forumCategoryHref(r.slug) : "/forum";
                  }}
                  onNeedAuth={() => setAuthOpen(true)}
                  onNewTopic={() => {
                    if (!user || !token) {
                      setAuthOpen(true);
                      return;
                    }
                    setNewTopic(true);
                  }}
                  onOpenProfile={(n) => {
                    window.location.href = `/?user=${encodeURIComponent(n)}`;
                  }}
                  notify={notify}
                />
              )}
            </div>
          </ForumColumns>
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
      {newTopic && token && (
        <NewTopicModal
          token={token}
          initialRubric={null}
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
