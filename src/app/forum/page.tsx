"use client";

/**
 * ТЗ 2026-09-23 «Кнопки „Обсудить на форуме“» — п.7: маршрут /forum —
 * СПИСОК РУБРИК форума SakhMatrix как самостоятельная страница.
 *
 * До сих пор форум жил только в корневом SPA (/?view=forum) — прямых
 * адресов /forum не существовало, поэтому ссылки на форум из блоков
 * приходилось вести на URL-параметры корня. Теперь:
 *   /forum                  — эта страница (каталог рубрик);
 *   /forum/category/<slug>  — список тем рубрики;
 *   /forum/topic/<id>       — конкретная тема (+ ?prefilled_text=).
 *
 * Содержимое: дерево рубрик из GET /api/bootstrap (родитель → дочерние,
 * slug есть у всех) в двух карточках — контентные рубрики форума и
 * служебные ветки обсуждений сообщений из блоков сайта. Каждая строка —
 * ссылка на /forum/category/<slug> (п.4 ТЗ). Каркас сайта общий: шапка,
 * синяя навигация, футер (та же сборка, что у самостоятельных страниц
 * «Где купить» / «ЖКХ» и др.).
 */

import { useCallback, useEffect, useState } from "react";
import { AuthModal } from "@/components/forum/modals";
import { DEFAULT_SETTINGS, isStaffRole, MainNav, Masthead, SiteFooter, useAuth, type SiteSettings } from "@/components/site/chrome";
import { forumCategoryHref } from "@/lib/forum-links";

interface RubricNode {
  id: number;
  name: string;
  slug: string;
  isService: boolean;
  children: RubricNode[];
}

export default function ForumIndexPage() {
  const { user, token, login } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [rubrics, setRubrics] = useState<RubricNode[] | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [toast, setToast] = useState("");

  // Общие настройки сайта для шапки и футера (те же, что на форуме)
  useEffect(() => {
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then((r) => {
        if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings });
        setRubrics(Array.isArray(r.rubrics) ? r.rubrics : []);
      })
      .catch(() => setRubrics([]));
  }, []);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3500);
  }, []);

  // Навигация из синей полосы: «Форум» — текущая страница, остальные пункты
  // ведут на свои страницы (та же схема, что у других самостоятельных страниц).
  const goNav = useCallback((k: string) => {
    if (k === "forum") {
      window.scrollTo(0, 0);
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

  const content = rubrics ? rubrics.filter((r) => !r.isService) : [];
  const discuss = rubrics ? rubrics.filter((r) => r.isService) : [];

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="forum" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div className="sk-topbar">
          <span className="tb-title">Форум — рубрики</span>
        </div>
        <div className="sk-shell">
          <div style={{ margin: "0 auto", maxWidth: 980, padding: "14px 12px 22px" }} data-forum-index="1">
            <p style={{ color: "#56657a", fontSize: 13.5, lineHeight: 1.55, margin: "0 0 14px" }}>
              Выберите рубрику — откроется список её тем. С каждой страницы сайта кнопка
              «Обсудить на форуме» ведёт в соответствующую рубрику этого каталога.
            </p>

            {rubrics === null && <div className="sk-empty">Загрузка…</div>}

            {rubrics !== null && (
              <>
                <div className="sk-sideblock" style={{ marginBottom: 14 }}>
                  <div className="sk-blocktitle">
                    <span className="tri">▼</span>Рубрики форума
                  </div>
                  <ul className="forum-index-list" data-forum-index-content="1">
                    {content.map((r) => (
                      <li key={r.id}>
                        <a className="forum-index-parent" href={forumCategoryHref(r.slug)} title={`Темы рубрики «${r.name}»`}>
                          {r.name}
                        </a>
                        {r.children.length > 0 && (
                          <ul>
                            {r.children.map((c) => (
                              <li key={c.id}>
                                <a href={forumCategoryHref(c.slug)} title={`Темы рубрики «${c.name}»`}>
                                  {c.name}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="sk-sideblock" data-forum-index-discuss="1">
                  <div className="sk-blocktitle">
                    <span className="tri">▼</span>Обсуждения сообщений из блоков сайта
                  </div>
                  <ul className="forum-index-list">
                    {discuss.map((r) => (
                      <li key={r.id}>
                        <a className="forum-index-parent" href={forumCategoryHref(r.slug)} title={`Темы рубрики «${r.name}»`}>
                          💬 {r.name}
                        </a>
                        {r.children.length > 0 && (
                          <ul>
                            {r.children.map((c) => (
                              <li key={c.id}>
                                <a href={forumCategoryHref(c.slug)} title={`Темы рубрики «${c.name}»`}>
                                  {c.name}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
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
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-[90] -translate-x-1/2 border-2 border-[#1E3A5F] bg-white px-4 py-2 text-[14px] font-semibold text-[#1E3A5F] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
