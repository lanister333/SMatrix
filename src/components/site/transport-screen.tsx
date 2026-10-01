"use client";

/**
 * 2026-10-01: страница «Расписание транспорта Сахалина» (роут /transport.php).
 * Каркас общий с другими разделами «Полезное»: бирюзовая шапка (логотип
 * SakhMatrix — ссылка href="/"), синяя навигация, плотное мобильное меню,
 * футер. В центре — блок TransportScheduleBlock (3 вкладки: ✈️ Авиа /
 * 🚢 Вода / 🚂 ЖД), источник — env YANDEX_RASP_KEY → Яндекс.Расписания,
 * иначе — демонстрационная заглушка с пометкой «демо-данные».
 */

import { useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  isStaffRole,
  MainNav,
  Masthead,
  SiteFooter,
  useAuth,
  type SiteSettings,
} from "@/components/site/chrome";
import ForumSideNav from "@/components/site/left-nav";
import HomeRight from "@/components/site/home-right";
import TransportScheduleBlock from "@/components/site/transport-schedule-block";

/** Ключи синей навигации → URL самостоятельных разделов / видов форума. */
const NAV_ROUTES: Record<string, string> = {
  home: "/",
  forum: "/?view=forum",
  ads: "/obyavleniya",
  podslyshano: "/podslyshano",
  wheretobuy: "/gde-kupit",
  gdedeshevle: "/gde-deshevle",
  recommend: "/rekomenduyu",
  employers: "/o-rabotodatelyah",
  gkh: "/gkh",
  help: "/help",
  dating: "/znakomstva",
  weather: "/weather.php",
  currency: "/currency.php",
  disconnections: "/disconnections.php",
  traffic: "/traffic.php",
  transport: "/transport.php",
};

export default function TransportScreen() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);

  // Общие настройки сайта для шапки и футера (те же, что на форуме)
  useEffect(() => {
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then((r) => {
        if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings });
      })
      .catch(() => {});
  }, []);

  // Навигация из синей полосы: «Транспорт» — текущая страница,
  // остальные — свои адреса.
  const goNav = (k: string) => {
    window.location.href = NAV_ROUTES[k] ?? "/";
  };

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="useful" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div className="sk-topbar">
          <span className="tb-title">Расписание транспорта</span>
        </div>
        <div className="sk-shell">
          {/* Трёхколоночный монолит: левая (ForumSideNav) — меню навигации,
              центральная (.center-column) — TransportScheduleBlock,
              правая (HomeRight) — служебные блоки (часы, погода, реклама). */}
          <div className="sk-layout sk-layout-page main-grid-container">
            <ForumSideNav />
            <div className="sk-col-main center-column">
              {/* Заголовок страницы — статичная надпись, как на других
                  разделах «Полезное» (Погода / Курсы валют / Отключения). */}
              <div className="sm-stub-home crt-back">Расписание транспорта Сахалина</div>
              <div className="crt-body" style={{ padding: "8px 9px" }}>
                <p style={{ color: "#56657a", fontSize: "13px", lineHeight: 1.5, margin: "0 0 10px" }}>
                  Авиа (Южно-Сахалинск — Москва, Владивосток, Хабаровск, Якутск, Новосибирск), вода (Холмск — Ванино, Корсаков — Холмск, Южно-Курильск), ЖД (Южно-Сахалинск — Ноглики, Холмск). Источник: Яндекс.Расписания при наличии API-ключа.
                </p>
                <TransportScheduleBlock />
              </div>
            </div>
            <HomeRight />
          </div>
        </div>
        <SiteFooter settings={settings} />
      </div>
    </div>
  );
}
