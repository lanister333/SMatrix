"use client";

/**
 * ТЗ 2026-09-23 «Знакомства (Love Sakh)»: самостоятельная страница «Знакомства»
 * (роут /znakomstva) в ТРЁХ КОЛОНКАХ по образцу других разделов проекта
 * («Рекомендую / Не рекомендую», «Нужна помощь»): стандартный плотный виджет
 * слева (Доступ + Место), лента Flat 2.0 в центре, «О разделе» и «Правила
 * раздела» справа. С остальным сайтом страницу объединяют общий каркас
 * (шапка, синяя навигация, футер), общая авторизация и общая система
 * модерации.
 *
 * Содержимое — components/site/znakomstva-publications.tsx (LoveSakhPage):
 * три колонки — Доступ+Место | заголовок/поиск/вкладки/лента/пагинация |
 * О разделе + Правила.
 * Прежний однострочный FlatBoard (FLAT_DATING_BOARD) снят с монтирования
 * с этой страницы (остался у блока «Объявления» на /obyavleniya).
 */

import { useCallback, useEffect, useState } from "react";
import { AuthModal } from "@/components/forum/modals";
import LoveSakhPage from "@/components/site/znakomstva-publications";
import { DEFAULT_SETTINGS, isStaffRole, MainNav, Masthead, SiteFooter, useAuth, type SiteSettings } from "@/components/site/chrome";

export default function ZnakomstvaScreen() {
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

  // Навигация из синей полосы: «Знакомства» — текущая страница.
  const goNav = useCallback((k: string) => {
    if (k === "dating") {
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
    if (k === "help") {
      window.location.href = "/help";
      return;
    }
    if (k === "gkh") {
      window.location.href = "/gkh";
      return;
    }
    window.location.href = k === "home" ? "/" : `/?view=${k}`;
  }, []);

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="dating" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div className="sk-topbar">
          <span className="tb-title">Знакомства</span>
        </div>
        <div className="sk-shell">
          {/* ТЗ 2026-09-23 «Знакомства (Love Sakh)»: трёхколоночная страница —
              левая: Доступ («+ Разместить анкету» + текст) и Место («Южно-
              Сахалинск, Холмск...» + «Показать»); центральная: заголовок,
              подзаголовок, кнопка, поиск, 4 вкладки, лента карточек (город +
              ник + дата + текст с открытыми контактами, тонкая рамка на белом,
              без аватаров/фото/возраста, новые сверху), пагинация; правая:
              «О разделе» и «Правила раздела» (тексты ТЗ дословно). */}
          <LoveSakhPage
            user={user}
            token={token}
            notify={notify}
            onNeedAuth={() => setAuthOpen(true)}
          />
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
