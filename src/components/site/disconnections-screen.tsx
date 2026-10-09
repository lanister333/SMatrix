"use client";

/**
 * Шаг №7.5 → Шаг №11: полная страница коммунальных отключений (роут
 * /disconnections.php) — «полноценное наполнение» по финальному ТЗ.
 * Каркас общий с самостоятельными разделами: бирюзовая шапка (логотип
 * SakhMatrix — ссылка href="/"), синяя навигация с компактной мобильной
 * шторкой, футер. Внутри по пунктам ТЗ:
 *   1) верхняя карточка .sakh-card — директива «Плашка = верх карточки»
 *      (2026-09-19): заголовок «Отключения» — .mp-paneltitle, шапка-
 *      верхушка карточки (как у «Электроэнергия (Сахалинэнерго)» ниже),
 *      НЕ отдельная рамка .sm-stub-home (статичная надпись, НЕ
 *      кликабельная — Stage 2), и под ней горизонтальный скролл-ряд
 *      круглых кнопок-бабблов районного
 *      фильтра: [Все районы], [Южно-Сахалинск], [Корсаков], [Холмск],
 *      [Анива], [Оха] — тап по городу мгновенно фильтрует список ниже без
 *      перезагрузки (JS-состояние); тап по активному городу или по
 *      «Все районы» возвращает весь массив;
 *   2) весь массив данных парсеров, разбитый на три плотных блока с
 *      иконками и источниками: «⚡ Электроэнергия (Сахалинэнерго)»,
 *      «💧 Горячая вода и Тепло (СКК)», «🚰 Холодная вода (Водоканал)»;
 *      адреса — 12px, длинные строки переносятся и не ломают правый край
 *      рамки .sakh-card на 360–414px;
 *   3) внизу — компактная таблица «Телефоны экстренных служб» (ФРС
 *      782-782, СКК 72-30-13, Водоканал 72-32-40) — номера как ссылки
 *      href="tel:...": тап с телефона сразу набирает вызов.
 * Данные: GET /api/outages — весь массив db/outages.json, свежие вверху.
 */

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SETTINGS, isStaffRole, MainNav, Masthead, SiteFooter, useAuth, type SiteSettings } from "@/components/site/chrome";
// Шаг №4 (монолит): левая колонка — меню навигации и категорий форума
// (как на Главной), правая — HomeRight (служебные блоки, погодные
// информеры и рекламные модули, как на Главной странице)
import ForumSideNav from "@/components/site/left-nav";
import HomeRight from "@/components/site/home-right";
import type { OutageItem } from "@/lib/outages-parser";
import { EMERGENCY_PHONES, FILTER_CHIPS, groupOutagesByUtility, outageDistrict, outageOrgBadge, outageWhenLabel } from "@/lib/outages-taxonomy";

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

interface OutagesPayload {
  source: string;
  updated: string;
  items: OutageItem[];
}

/** Три блока по ТЗ Шага №11: иконка + название + источник в скобках. */
const BLOCKS: { key: "electro" | "hot" | "cold"; title: string }[] = [
  { key: "electro", title: "⚡ Электроэнергия (Сахалинэнерго)" },
  { key: "hot", title: "💧 Горячая вода и Тепло (СКК)" },
  { key: "cold", title: "🚰 Холодная вода (Водоканал)" },
];

export default function DisconnectionsScreen() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [data, setData] = useState<OutagesPayload | null>(null);
  // Значение фильтра: "" = чип «Все районы» (по ТЗ сначала выводится весь
  // массив данных); тап по активному городу тоже возвращает к «Все районы».
  const [district, setDistrict] = useState("");

  // Общие настройки сайта для шапки и футера (те же, что на форуме)
  useEffect(() => {
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then((r) => {
        if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings });
      })
      .catch(() => {});
  }, []);

  // Весь массив сводок (без ограничения топ-3 главной)
  useEffect(() => {
    fetch("/api/outages")
      .then((r) => r.json())
      .then((r: OutagesPayload) => setData(r))
      .catch(() => {});
  }, []);

  // Навигация из синей полосы: каждый пункт — свой адрес, остальное — главная.
  const goNav = (k: string) => {
    window.location.href = NAV_ROUTES[k] ?? "/";
  };

  // Фильтрация без перезагрузки + разбивка на три блока (порядок внутри
  // блока сохраняется: API уже отсортировал всё по времени публикации).
  const groups = useMemo(() => {
    const items = data?.items ?? [];
    const filtered = district ? items.filter((it) => outageDistrict(it) === district) : items;
    return groupOutagesByUtility(filtered);
  }, [data, district]);

  const overallEmpty = data !== null && data.items.length === 0;
  const emptyText =
    data === null
      ? "Загрузка сводок…"
      : data.source === "none"
        ? "Сводки собираются — первая проверка источников выполнится в течение получаса."
        : "Оперативных отключений не объявлено.";

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="disconnections" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div className="sk-topbar">
          <span className="tb-title">Отключения</span>
        </div>
        <div className="sk-shell">
          {/* Шаг №4 (директива «Трехколоночный монолит внутренних страниц»):
              контейнер несёт класс .main-grid-container — архитектура СТРОГО
              та же, что у Главной (≥1024px: flex по центру до 1800px, зазор
              20px, левая 240px / центр .center-column flex:1, max-width:1200px
              / правая 300px). Левая колонка (ForumSideNav) — развернутое меню
              навигации и категорий форума, центральная — районный фильтр,
              сводки служб, телефоны, правая (HomeRight) — служебные блоки.
              Контент «на всю ширину» запрещён. */}
          <div className="sk-layout sk-layout-page main-grid-container">
          <ForumSideNav />
          <div className="sk-col-main center-column">
          {/* 1. Верхняя карточка + директива «Плашка = верх карточки»:
              заголовок «Отключения» — .mp-paneltitle, полноширинная
              тёмно-синяя шапка панели (верхняя ЧАСТЬ карточки, как у
              «Электроэнергия (Сахалинэнерго)» ниже), а не отдельная
              рамка .sm-stub-home внутри тела. Уточнение ТЗ: у этой
              шапки НЕТ треугольника, надпись ПО ЦЕНТРУ (модификатор
              .mp-paneltitle-plain) — эталонные .mp-paneltitle
              («Электроэнергия…», «Горячая вода…», «Холодная вода…»)
              остаются с треугольником и выравниванием влево. В теле
              карточки — районный фильтр (горизонтальный скролл-ряд
              компактных кнопок); фильтрация обновляет содержимое,
              не меняя структуру «шапка + тело». */}
          <section className="mp-panel sakh-card" aria-label="Отключения и районный фильтр">
            <div className="mp-paneltitle mp-paneltitle-plain">Отключения</div>
            <div className="dis-cardbody">
              <div className="dis-filters" role="group" aria-label="Фильтр по районам">
                {FILTER_CHIPS.map((chip) => {
                  const val = chip === "Все районы" ? "" : chip;
                  const active = district === val;
                  return (
                    <button
                      key={chip}
                      type="button"
                      className={active ? "dis-chip active" : "dis-chip"}
                      aria-pressed={active}
                      onClick={() => setDistrict(active ? "" : val)}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 2. Весь массив данных, разбитый на три блока служб */}
          {BLOCKS.map((b) => {
            const items = groups[b.key];
            const blockEmpty =
              items.length === 0 &&
              (overallEmpty || (district !== "" && data !== null && data.items.length > 0));
            return (
              <section className="mp-panel sakh-card" aria-label={b.title} key={b.key}>
                <div className="mp-paneltitle">
                  <span className="tri">▼</span>
                  {b.title}
                </div>
                {blockEmpty ? (
                  <div className="dis-empty">
                    {overallEmpty
                      ? emptyText
                      : `По району «${district}» сводок нет.`}
                  </div>
                ) : (
                  <div className="dis-list">
                    {/* Stage 2 «Спойлеры-аккордеоны»: каждая сводка —
                        нативный <details>/<summary>. В закрытом виде
                        пользователь видит только плотную строку-заголовок
                        с маркером ведомства, городом и временем: ⚡ ... ▾.
                        При клике — плавное раскрытие (CSS transition
                        на .dis-item) показывает список адресов и домов.
                        Высота страницы сокращается в 5 раз. */}
                    {items.map((it, i) => {
                      const org = outageOrgBadge(it.source);
                      const when = outageWhenLabel(it.publishedAt);
                      const short = it.short || it.addresses[0] || it.title;
                      const summary = `${org.icon} ${org.name} — ${short}${when ? ` (${when})` : ""}`;
                      return (
                        <details key={`${it.url}-${i}`} className="dis-item">
                          <summary className="dis-summary">
                            <span className="dis-summary-text">{summary}</span>
                            <span className="dis-summary-arr" aria-hidden="true">▾</span>
                          </summary>
                          <div className="dis-details">
                            {it.title ? <div className="dis-title">{it.title}</div> : null}
                            {it.when ? <div className="dis-when">{it.when}</div> : null}
                            {it.addresses.length > 0 ? (
                              <ul className="dis-addr">
                                {it.addresses.map((a) => (
                                  <li key={a}>{a}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
          {data && data.updated ? (
            <div className="mp-w-upd dis-upd">
              Обновлено: {data.updated.slice(0, 16).replace("T", " ")}
            </div>
          ) : null}

          {/* 3. Компактная таблица «Телефоны экстренных служб» — номера как
              ссылки href="tel:...": тап с телефона сразу набирает вызов */}
          <section className="mp-panel sakh-card" aria-label="Телефоны экстренных служб">
            <div className="mp-paneltitle">
              <span className="tri">▼</span>Телефоны экстренных служб
            </div>
            <table className="dis-phones">
              <tbody>
                {EMERGENCY_PHONES.map((p) => (
                  <tr key={p.number}>
                    <td className="dis-ph-svc">{p.label}</td>
                    <td className="dis-ph-num">
                      <a className="dis-ph-tel" href={`tel:${p.number}`}>
                        {p.number}
                      </a>
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
