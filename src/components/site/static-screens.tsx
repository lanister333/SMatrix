"use client";

/**
 * Директива «Чистка навигации» (задача nav-cleanup-2026-09-18):
 * самостоятельные страницы трёх оставшихся пунктов меню «Ещё» —
 *   /rules.php     — «Правила форума»;
 *   /feedback.php  — «Обращение к администратору»;
 *   /about.php     — «О проекте».
 *
 * Роуты *.php — в едином легаси-стиле проекта (как /traffic.php,
 * /weather.php, /currency.php, /disconnections.php). Экраны собираются
 * по эталону внутренних страниц (ЗАДАЧА 14, Шаг №4): общий каркас
 * (бирюзовая шапка, синяя навигация, футер) + СТРОГО трёхколоночная
 * архитектура Главной — левая колонка ForumSideNav (с карточкой
 * «Обсудить на форуме»), центральная колонка с содержимым
 * (RulesPage/AppealPage/AboutPage из components/forum/pages.tsx — те же
 * компоненты, что рендерили прежние SPA-виды view=rules/appeal/about),
 * правая HomeRight. Контент «на всю ширину» запрещён.
 *
 * Содержимое НЕ дублируется: тексты правил/обращения/о проекте живут
 * в одном источнике (components/forum/pages.tsx), новые экраны только
 * обёртка-каркас. Пункты «Ещё» — обычные ссылки (chrome.tsx), поэтому
 * страницы работают одинаково на ВСЕХ страницах сайта, без SPA-контекста.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AuthModal } from "@/components/forum/modals";
import { AboutPage, AppealPage, RulesPage } from "@/components/forum/pages";
import ForumSideNav from "@/components/site/left-nav";
import HomeRight from "@/components/site/home-right";
import {
  DEFAULT_SETTINGS,
  isStaffRole,
  MainNav,
  Masthead,
  SiteFooter,
  useAuth,
  type SiteSettings,
} from "@/components/site/chrome";

/** Общий каркас трёх страниц меню «Ещё» — как на сервисных страницах. */
function StaticShell(props: {
  title: string;
  /** Ключ текущей страницы для goNav («rules» / «appeal» / «about»). */
  current: string;
  children: (notify: (m: string) => void) => ReactNode;
}) {
  const { user, login } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [authOpen, setAuthOpen] = useState(false);
  const [toast, setToast] = useState("");

  // Общие настройки сайта для шапки и футера (те же, что на форуме)
  useEffect(() => {
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then((r) => {
        if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings });
      })
      .catch(() => {});
  }, []);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3500);
  }, []);

  // Навигация из синей полосы: текущая страница — вверх, остальные —
  // по своим адресам (как в help-screen: fallback /?view=<key>, где
  // «Объявления»/«Полезное» сами перебрасывают на свои роуты).
  const goNav = useCallback(
    (k: string) => {
      if (k === props.current) {
        window.scrollTo(0, 0);
        return;
      }
      window.location.href = k === "home" ? "/" : `/?view=${k}`;
    },
    [props.current]
  );

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current={props.current} isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div className="sk-topbar">
          <span className="tb-title">{props.title}</span>
        </div>
        <div className="sk-shell">
          {/* Трёхколоночный монолит внутренних страниц (как на /weather.php):
              левая — меню навигации и рубрик форума + «Обсудить на форуме»,
              центральная — содержимое страницы, правая — служебные блоки */}
          <div className="sk-layout sk-layout-page main-grid-container">
            <ForumSideNav />
            <div className="sk-col-main center-column">{props.children(notify)}</div>
            <HomeRight />
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

/** /rules.php — «Правила форума» (пункт меню «Ещё» №1). */
export function RulesScreen() {
  return (
    <StaticShell title="Правила форума" current="rules">
      {() => (
        <RulesPage
          onOpenTopic={(id: number) => {
            window.location.href = `/?topic=${id}`;
          }}
        />
      )}
    </StaticShell>
  );
}

/** /feedback.php — «Обращение к администратору» (пункт меню «Ещё» №2). */
export function FeedbackScreen() {
  return (
    <StaticShell title="Обращение к администратору" current="appeal">
      {(notify) => <AppealPage notify={notify} />}
    </StaticShell>
  );
}

/** /about.php — «О проекте» (пункт меню «Ещё» №3). */
export function AboutScreen() {
  return (
    <StaticShell title="О проекте" current="about">
      {() => <AboutPage />}
    </StaticShell>
  );
}
