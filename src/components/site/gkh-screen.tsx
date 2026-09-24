"use client";

/**
 * ШАГ 19: самостоятельная страница «ЖКХ и городские проблемы» (роут /gkh).
 * Отдельная страница проекта SakhMatrix — не форум, не «Подслушано Сахалин»,
 * не «Где купить» и не «Нужна помощь». С остальным сайтом её объединяют
 * только общий каркас в одном стиле (бирюзовая шапка с логотипом, синяя
 * навигация, футер), общая авторизация и общая система модерации (ТЗ п.22).
 *
 * Содержимое — проблемы города (components/site/gkh-publications.tsx):
 * три колонки — навигация раздела | лента проблем / история проблемы | правила.
 */

import { useCallback, useEffect, useState } from "react";
import { AuthModal } from "@/components/forum/modals";
import { GkhPage } from "@/components/site/gkh-publications";
import { DEFAULT_SETTINGS, isStaffRole, MainNav, Masthead, SiteFooter, useAuth, type SiteSettings } from "@/components/site/chrome";

export default function GkhScreen() {
  const { user, token, login } = useAuth();
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

  // Навигация из синей полосы: «ЖКХ» — текущая страница, остальные — свои страницы.
  const goNav = useCallback((k: string) => {
    if (k === "gkh") {
      window.scrollTo(0, 0);
      return;
    }
    if (k === "podslyshano") {
      window.location.href = "/podslyshano";
      return;
    }
    if (k === "wheretobuy") {
      window.location.href = "/gde-kupit";
      return;
    }
    if (k === "help") {
      window.location.href = "/help";
      return;
    }
    if (k === "dating") {
      window.location.href = "/znakomstva";
      return;
    }
    if (k === "gdedeshevle") {
      window.location.href = "/gde-deshevle";
      return;
    }
    if (k === "recommend") {
      window.location.href = "/rekomenduyu";
      return;
    }
    if (k === "employers") {
      window.location.href = "/o-rabotodatelyah";
      return;
    }
    window.location.href = k === "home" ? "/" : `/?view=${k}`;
  }, []);

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="gkh" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div className="sk-topbar">
          <span className="tb-title">ЖКХ и городские проблемы</span>
        </div>
        <div className="sk-shell">
          {/* Три колонки раздела: навигация раздела | проблемы / история | правила */}
          <GkhPage user={user} token={token} notify={notify} onNeedAuth={() => setAuthOpen(true)} />
        </div>
        {/* Шаг «Единый футер как на Главной»: общий SiteFooter — тот же футер,
            что на Главной (строка ссылок, сведения, дисклеймер, версия),
            размер/состав 1-в-1; до этого здесь был тонкий .sk-footer */}
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
