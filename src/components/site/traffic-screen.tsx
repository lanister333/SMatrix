"use client";

/**
 * Шаг 12: полный дорожный хаб «Пробки и дороги Южно-Сахалинска»
 * (роут /traffic.php) — создаётся с нуля по ТЗ. Каркас общий с
 * самостоятельными разделами: бирюзовая шапка, логотип SakhMatrix —
 * ссылка href="/", плотное мобильное меню, футер. Внутри по пунктам ТЗ:
 *   1) в самом верху, внутри контейнера .sakh-card, — полноширинная
 *      тёмно-синяя шапка .mp-paneltitle (модификатор .mp-paneltitle-plain:
 *      БЕЗ треугольника, надпись ПО ЦЕНТРУ — уточнение ТЗ 2026-09-19,
 *      как шапки «Погода» и «Отключения») с названием раздела «Пробки»
 *      (статичная надпись, НЕ кликабельная — Stage 2);
 *   2) интерактивная карта пробок: официальный встраиваемый виджет
 *      API Яндекс Карт (map-widget/v1) со слоем пробок l=trf,
 *      включённым ПО УМОЛЧАНИЮ. Ширина 100% карточки; высота: ПК
 *      (≥1024px, где центральная колонка ровно 850px) — строго 850px
 *      (идеальный квадрат 850×850, директива «Квадратная карта»),
 *      мобайл/планшет — компактные 250px. Центр жёстко сфокусирован на Южно-Сахалинске — перекрёсток
 *      Мира — Пуркаева (координаты 46.9352, 142.7451 вычислены по
 *      геометрии улиц OSM; z=16 — несколько кварталов вокруг
 *      перекрёстка). Тот же подход, что принятая панель «Пробки»
 *      Шага 8 (mp-tr-map): JS API v2.1 требует партнёрский ключ и без
 *      него карту не показывает — виджет API Яндекс Карт работает
 *      без ключа и даёт интерактивную карту со слоем пробок;
 *   3) «Народный лог»: текстовый блок «Оперативные дорожные события» —
 *      лента из 10 последних сообщений из базы данных с тегом/категорией
 *      «Дороги» (внутренняя логика roads-taxonomy через
 *      /api/traffic/reports); текст 12px, автоперенос длинных строк
 *      (overflow-wrap:anywhere) жёстко удерживает правую границу
 *      .sakh-card на телефонах 360–414px;
 *   4) под логом — компактная таблица «Состояние загородных трасс»
 *      (Холмский перевал, Корсаковская трасса, автодорога Южно-Сахалинск
 *      — Оха) со статусами Открыта / Закрыта / Тяжело, подтягивающимися
 *      из базы данных (та же /api/traffic/reports, логика roads-status:
 *      свежайший отчёт по маршруту задаёт статус; отчётов нет — «н/д»).
 */

import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, isStaffRole, MainNav, Masthead, SiteFooter, useAuth, type SiteSettings } from "@/components/site/chrome";
// Шаг №4 (монолит): левая колонка — меню навигации и категорий форума
// (как на Главной), правая — HomeRight (служебные блоки, погодные
// информеры и рекламные модули, как на Главной странице)
import ForumSideNav from "@/components/site/left-nav";
import HomeRight from "@/components/site/home-right";
import DeferredIframe from "@/components/site/deferred-iframe";
import { fmtRecent } from "@/lib/ui";
import { nickGenderClass } from "@/lib/nick-gender";
import type { TrafficReportsData } from "@/lib/roads-status";

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
};

const EMPTY_REPORTS: TrafficReportsData = { source: "none", items: [], routes: [], updated: "" };

/** Центр карты ТЗ: перекрёсток Мира — Пуркаева (Южно-Сахалинск). */
const MAP_SRC = "https://yandex.com/map-widget/v1/?ll=142.74512%2C46.93523&z=16&l=trf";

/** Цветной статус трассы → класс бейджа. */
function stClass(status: string): string {
  if (status === "Открыта") return "trf-badge st-open";
  if (status === "Закрыта") return "trf-badge st-closed";
  if (status === "Тяжело") return "trf-badge st-hard";
  return "trf-badge st-na";
}

export default function TrafficScreen() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [reports, setReports] = useState<TrafficReportsData>(EMPTY_REPORTS);

  // Общие настройки сайта для шапки и футера (те же, что на форуме)
  useEffect(() => {
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then((r) => {
        if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings });
      })
      .catch(() => {});
  }, []);

  // Лог «Оперативные дорожные события» (10 последних тега «Дороги»)
  // и статусы трасс — один запрос /api/traffic/reports
  useEffect(() => {
    fetch("/api/traffic/reports")
      .then(async (r) => (r.ok ? r.json() : EMPTY_REPORTS))
      .then((d: TrafficReportsData) => setReports(d))
      .catch(() => {});
  }, []);

  // Навигация из синей полосы: каждый пункт — свой адрес, остальное — главная.
  const goNav = (k: string) => {
    window.location.href = NAV_ROUTES[k] ?? "/";
  };

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="traffic" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div className="sk-topbar">
          <span className="tb-title">Пробки и дороги Южно-Сахалинска</span>
        </div>
        <div className="sk-shell">
          {/* Шаг №4 (директива «Трехколоночный монолит внутренних страниц»):
              контейнер несёт класс .main-grid-container — архитектура СТРОГО
              та же, что у Главной (≥1024px: flex по центру до 1800px, зазор
              20px, левая 240px / центр .center-column flex:1, max-width:1200px
              / правая 300px). Левая колонка (ForumSideNav) — развернутое меню
              навигации и категорий форума, центральная — карта дорог,
              лог событий, трассы, правая (HomeRight) — служебные блоки.
              Контент «на всю ширину» запрещён. */}
          <div className="sk-layout sk-layout-page main-grid-container">
          <ForumSideNav />
          <div className="sk-col-main center-column">
          {/* ТЗ п.1–2 + директива «Плашка = верх карточки» (уточнение
              2026-09-19): заголовок «Пробки» — .mp-paneltitle
              .mp-paneltitle-plain — полноширинная шапка-верхушка карточки
              (без треугольника, надпись по центру), как на /weather.php и
              /disconnections.php. Под ней — .trf-body той же карточки с
              интерактивной картой пробок API Яндекс Карт со слоем l=trf,
              включённым по умолчанию: 100% ширины; высота 850px на ПК
              ≥1024px (квадрат 850×850, CSS-блок в конце globals.css),
              250px на мобайле; центр — перекрёсток Мира — Пуркаева.
              .trf-map НЕ тронут. */}
          <section className="mp-panel sakh-card" aria-label="Карта пробок Южно-Сахалинска">
            <div className="mp-paneltitle mp-paneltitle-plain">Пробки</div>
            <div className="trf-body">
              <div className="trf-mapwrap">
                {/* src откладывается до window.load — см. deferred-iframe.tsx */}
                <DeferredIframe className="trf-map" src={MAP_SRC} title="Пробки Южно-Сахалинска — Яндекс.Карты" loading="lazy" />
              </div>
            </div>
          </section>

          {/* ТЗ п.3: «Народный лог» — «Оперативные дорожные события»:
              лента из 10 последних сообщений БД с тегом «Дороги»; текст
              12px с автопереносом строк, правую границу .sakh-card на
              360–414px не ломает. */}
          <section className="mp-panel sakh-card" aria-label="Оперативные дорожные события">
            <div className="mp-paneltitle">
              <span className="tri">▼</span>Оперативные дорожные события
            </div>
            {reports.items.length > 0 ? (
              <div className="trf-log">
                {reports.items.map((m) => (
                  <div className="trf-log-item" key={m.id}>
                    <div className="trf-log-h">
                      <b className={nickGenderClass(m.author)}>{m.author}</b>
                      <span>{fmtRecent(m.createdAt)}</span>
                    </div>
                    <p className="trf-log-t">{m.body}</p>
                  </div>
                ))}
                <div className="mp-w-upd">Тег «Дороги» · последние сообщения форума</div>
              </div>
            ) : (
              <div className="trf-empty">Дорожных сводок пока нет — добавьте свою на форуме.</div>
            )}
          </section>

          {/* ТЗ п.4: «Состояние загородных трасс» — компактная таблица
              трёх островных направлений со статусами из БД (Открыта /
              Закрыта / Тяжело; отчётов нет — «н/д»). */}
          <section className="mp-panel sakh-card" aria-label="Состояние загородных трасс">
            <div className="mp-paneltitle">
              <span className="tri">▼</span>Состояние загородных трасс
            </div>
            <table className="trf-roads">
              <tbody>
                {reports.routes.map((r) => (
                  <tr key={r.key}>
                    <td className="trf-rd-name">{r.name}</td>
                    <td className="trf-rd-st">
                      <span className={stClass(r.status)}>{r.status || "н/д"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          </div>
          <HomeRight />
          </div>
        </div>
        {/* Шаг «Единый футер как на Главной»: общий SiteFooter — тот же футер,
            что на Главной (строка ссылок, сведения, дисклеймер, версия),
            размер/состав 1-в-1; до этого здесь был тонкий .sk-footer */}
        <SiteFooter settings={settings} />
      </div>
    </div>
  );
}
