"use client";

/**
 * Шаг 10: полный погодный сервис «Погода на Сахалине» (роут
 * /weather.php) — заменяет заглушку Шага 5. Открывается по клику на
 * синий заголовок плашки «Погода на Сахалине» на главной.
 *
 *  1. Навигация (ТЗ) + директива «Плашка = верх карточки» (2026-09-19):
 *     заголовок раздела «Погода» — .mp-paneltitle, полноширинная
 *     тёмно-синяя шапка-верхушка карточки .sakh-card (как у «Температура
 *     по районам» ниже), НЕ отдельная рамка .sm-stub-home внутри тела
 *     (статичная надпись, НЕ кликабельная — Stage 2).
 *  2. Развёрнутый виджет Южно-Сахалинска (ТЗ): подробный почасовой
 *     прогноз на сегодня, уровень влажности, атмосферное давление и
 *     направление ветра. Данные — открытый open-meteo.com через
 *     /api/weather/full (аналог meteoblue: бесплатные встраиваемые
 *     виджеты meteoblue этих данных в одном адаптивном блоке не дают;
 *     open-meteo — уже погодный API портала, Шаг 5).
 *  3. Сетка районов Сахалина и Курил (ТЗ): текущая температура по
 *     городам области, разбитым по географии — Юг (Корсаков, Холмск,
 *     Анива, Невельск), Центр (Поронайск, Смирных, Углегорск), Север
 *     (Ноглики, Оха), Курилы (Южно-Курильск, Курильск); сетка
 *     компактных бабблов, данные — тот же open-meteo.
 *  4. «Оперативная обстановка на перевалах» (ТЗ): лог из 3 последних
 *     сообщений форума с тегом «Дороги» (внутренняя логика
 *     roads-taxonomy) через /api/weather/roads.
 *
 * Каркас общий с самостоятельными разделами: бирюзовая шапка,
 * логотип-ссылка на главную, компактная мобильная навигация, футер.
 */

import { useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, isStaffRole, MainNav, Masthead, SiteFooter, useAuth, type SiteSettings } from "@/components/site/chrome";
// Шаг №4 (монолит): левая колонка — меню навигации и категорий форума
// (как на Главной), правая — HomeRight (служебные блоки, погодные
// информеры и рекламные модули, как на Главной странице)
import ForumSideNav from "@/components/site/left-nav";
import HomeRight from "@/components/site/home-right";
import DeferredIframe from "@/components/site/deferred-iframe";
import { CITY_GROUPS, type FullWeather } from "@/lib/weather-data";
import { fmtRecent } from "@/lib/ui";
import type { RoadsData } from "@/lib/roads-taxonomy";

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

const EMPTY_WX: FullWeather = { source: "none", via: "", viaCities: "", city: "Южно-Сахалинск", now: null, hours: [], cities: [], updated: "" };
const EMPTY_ROADS: RoadsData = { source: "none", items: [], updated: "" };

/** ТЗ 2026-09-21 №3: полезная нагрузка /api/weather/tides — экстремумы
 *  уровня моря (marine open-meteo) для залива Анива у порта Корсаков. */
interface TideExtreme {
  /** Локальное ISO-время («2026-09-23T02:00») — ось X меток графика. */
  iso: string;
  time: string;
  kind: "high" | "low";
  height: number;
}
interface TidesData {
  point: string;
  source: "live" | "none";
  via: string;
  updated: string;
  step: string;
  extremes: TideExtreme[];
  /** 2026-09-21 (график «волнами»): весь почасовой ряд уровня моря —
   *  плавная кривая; приходит с сервера (может отсутствовать в старом
   *  кеше — тогда показываем только список, без кривой). */
  series?: TidesSeriesPoint[];
  /** Все очищенные экстремумы окна — метки ▲/▼ на кривой. */
  all?: TideExtreme[];
}
interface TidesSeriesPoint {
  iso: string;
  label: string;
  height: number;
}

/** «+18°» / «−3°» / «0°» / «—» (без данных).
 *  Директива Stage 2: теплая температура — мягкий красный/оранжевый
 *  (#D2691E), холодная — синий (#1976D2). Используется в сетке районов. */
function fmtTemp(t: number | null): string {
  if (t === null || !Number.isFinite(t)) return "—";
  return `${t > 0 ? "+" : ""}${Math.round(t)}°`;
}

/** Stage 2: класс температуры по шкале — холод/ноль/тепло.
 *  ≤ -5° → cold (синий), ≥ +5° → warm (оранжевый), остальные — neutral. */
function tempClass(t: number | null): string {
  if (t === null || !Number.isFinite(t)) return "wth-t-neutral";
  if (t >= 5) return "wth-t-warm";
  if (t <= -5) return "wth-t-cold";
  return "wth-t-neutral";
}

/** ТЗ «Почасовой прогноз» п.1: WMO-код open-meteo → эмодзи-иконка ячейки.
 *  Диапазоны — ТО ЖЕ, что у codeLabel (weather-data.ts), ничего не выдумываем.
 *  Метка источника рядом — title={h.label} («Ясно», «Дождь»…). */
function codeIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "⛅";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "🌧️";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "❄️";
  if (code >= 95) return "⛈️";
  return "⛅";
}

/** ТЗ «Почасовой прогноз» п.4: класс цвета температуры по значению.
 *  +12…+15 cool (бирюзовый) · +16…+19 warm (зелёный) · +20…+24 hot
 *  (оранжевый) · ≥+25 veryhot (красный) · ниже 0 cold (синий).
 *  Диапазон 0…+11 в ТЗ не задан — нейтральный (без класса). */
function hourTempClass(t: number): string {
  if (!Number.isFinite(t)) return "";
  if (t < 0) return "cold";
  if (t >= 25) return "veryhot";
  if (t >= 20) return "hot";
  if (t >= 16) return "warm";
  if (t >= 12) return "cool";
  return "";
}

/** ТЗ 2026-09-21 «ячейки ярко-голубые, темнее/светлее по времени суток»:
 *  класс заливки ячейки по часу суток (час из строки «HH:00»).
 *  21:00–05:59 night — самая тёмная заливка; 06:00–08:59 и 18:00–20:59
 *  twilight — утро/вечер, темнее дня; 11:00–15:59 midday — полдень,
 *  самая светлая; остальное (09/10/16/17 ч) — день, базовая ярко-голубая. */
function hourTodClass(time: string): string {
  const h = parseInt(time, 10);
  if (!Number.isFinite(h)) return "";
  if (h >= 21 || h < 6) return "night";
  if (h < 9 || h >= 18) return "twilight";
  if (h >= 11 && h < 16) return "midday";
  return "";
}

/** ТЗ «Почасовой прогноз» п.5: класс бейджа влажности.
 *  <70% — серый, 70–89% — бирюзовый, 90–100% — синий. */
function humClass(h: number): string {
  if (!Number.isFinite(h)) return "hum-low";
  if (h >= 90) return "hum-high";
  if (h >= 70) return "hum-mid";
  return "hum-low";
}

/* ============================================================================
 * Волновой график приливов (2026-09-21): SVG-кривая уровня моря по
 * почасовому ряду open-meteo marine. Плавность — Catmull-Rom → кубические
 * Безье. Только фирменные цвета (#1f3a5f/#2a6fa8/#3a9ca5/#d6e4f0/#8a97a3),
 * без градиентов/теней/анимаций; кегль подписей 9–10px, семейство шрифта
 * наследуется (шрифты сайта не трогаем). Ширина 100% через viewBox —
 * адаптив без @media.
 * ========================================================================== */

/** Локальное iso «2026-09-23T05:00» → минуты единой шкалы (Date.UTC —
 *  только согласованный счётчик, не часовой пояс). */
function tideMin(iso: string): number {
  return (
    Date.UTC(
      +iso.slice(0, 4),
      +iso.slice(5, 7) - 1,
      +iso.slice(8, 10),
      +iso.slice(11, 13),
      +iso.slice(14, 16)
    ) / 60000
  );
}

/** Текущий момент Сахалина (UTC+11, пояс как у часов сайта Asia/Magadan)
 *  в формате ряда «2026-09-21T14:00» — для линии «сейчас» на графике. */
function sakhalinNowIso(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Magadan",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:00`;
  } catch {
    return ""; // Intl недоступен — линия «сейчас» честно не рисуется
  }
}

/** 0,35 → «0,35»; −0,45 → «-0,45» (десятичная запятая, как в списке). */
function tideFmt(v: number): string {
  return v.toFixed(2).replace(".", ",");
}

function TideWaveChart({ tides, nowIso }: { tides: TidesData; nowIso: string }) {
  const pts = (tides.series ?? []).filter((p) => Number.isFinite(p.height));
  if (pts.length < 2) return null;
  const W = 600, H = 212, padL = 42, padR = 14, padT = 30, padB = 30;
  const plotW = W - padL - padR;
  const baseY = padT + (H - padT - padB);
  const t0 = tideMin(pts[0].iso);
  const t1 = tideMin(pts[pts.length - 1].iso);
  if (!(t1 > t0)) return null;
  const hs = pts.map((p) => p.height);
  let lo = Math.min(...hs);
  let hi = Math.max(...hs);
  if (hi - lo < 0.12) {
    const mid = (hi + lo) / 2;
    lo = mid - 0.06;
    hi = mid + 0.06;
  }
  const span = hi - lo;
  lo -= span * 0.1;
  hi += span * 0.1;
  const X = (tm: number) => padL + ((tm - t0) / (t1 - t0)) * plotW;
  const Y = (h: number) => padT + (1 - (h - lo) / (hi - lo)) * (baseY - padT);
  const xy = pts.map((p) => [X(tideMin(p.iso)), Y(p.height)] as const);
  // Catmull-Rom → кубические Безье: дуга проходит через все точки ряда
  let dPath = `M ${xy[0][0].toFixed(1)} ${xy[0][1].toFixed(1)}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[Math.max(0, i - 1)];
    const p1 = xy[i];
    const p2 = xy[i + 1];
    const p3 = xy[Math.min(xy.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    dPath += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  const area = `${dPath} L ${xy[xy.length - 1][0].toFixed(1)} ${baseY} L ${xy[0][0].toFixed(1)} ${baseY} Z`;
  // Сетка по высоте: верх/середина/низ шкалы с честными подписями, м
  const grid = [hi, lo + (hi - lo) / 2, lo];
  // Разделители суток: первая точка каждой даты ряда
  const days: { x: number; label: string }[] = [];
  let cur = "";
  for (const p of pts) {
    const dd = `${p.iso.slice(8, 10)}.${p.iso.slice(5, 7)}`;
    if (dd !== cur) {
      cur = dd;
      days.push({ x: X(tideMin(p.iso)), label: dd });
    }
  }
  // Линия «сейчас» — позиция текущего часа на оси времени
  const nowM = nowIso ? tideMin(nowIso) : NaN;
  const nowX = Number.isFinite(nowM) && nowM >= t0 && nowM <= t1 ? X(nowM) : null;
  // Метки экстремумов ▲/▼ (только те, что внутри окна графика)
  const marks = (tides.all ?? []).filter((e) => {
    const m = tideMin(e.iso);
    return m >= t0 && m <= t1;
  });
  return (
    <figure className="tide-chart">
      <figcaption className="tide-cap">Уровень моря, м — сутки назад и 3 дня вперёд</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="График приливов и отливов: волны уровня моря по часам">
        {grid.map((g, i) => (
          <g key={`g${i}`}>
            <line x1={padL} x2={W - padR} y1={Y(g)} y2={Y(g)} stroke="#d6e4f0" strokeWidth="1" />
            <text x={padL - 5} y={Y(g) + 3} textAnchor="end" fontSize="9" fill="#8a97a3">
              {tideFmt(g)}
            </text>
          </g>
        ))}
        {days
          .filter((d) => d.x > padL + 2)
          .map((d) => (
            <line key={`d${d.label}`} x1={d.x} x2={d.x} y1={padT} y2={baseY} stroke="#d6e4f0" strokeWidth="1" />
          ))}
        {days.map((d) => (
          <text
            key={`dl${d.label}`}
            x={Math.min(d.x + 3, W - padR - 32)}
            y={H - 10}
            fontSize="10"
            fill="#8a97a3"
          >
            {d.label}
          </text>
        ))}
        {/* ТЗ 2026-09-21 (стиль волны): залив волны темнее (#2a6fa8 вместо
            #3a9ca5, op 0.3 вместо 0.16), окантовка волны тоньше — 1.25 с
            vectorEffect non-scaling-stroke (постоянно тонкая на любом
            экране; было 2 единицы viewBox). */}
        <path d={area} fill="#2a6fa8" opacity="0.3" />
        <path d={dPath} fill="none" stroke="#2a6fa8" strokeWidth="1.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {nowX !== null && (
          <g>
            <line x1={nowX} x2={nowX} y1={padT} y2={baseY} stroke="#1f3a5f" strokeWidth="1.5" strokeDasharray="3 3" />
            <text
              x={Math.min(Math.max(nowX, padL + 18), W - padR - 18)}
              y={padT - 8}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill="#1f3a5f"
            >
              сейчас
            </text>
          </g>
        )}
        {marks.map((e) => {
          const x = X(tideMin(e.iso));
          const y = Y(e.height);
          const up = e.kind === "high";
          return (
            <g key={`${e.iso}${e.kind}`}>
              <polygon
                points={
                  up
                    ? `${x},${y - 5} ${x - 4.5},${y + 3.5} ${x + 4.5},${y + 3.5}`
                    : `${x},${y + 5} ${x - 4.5},${y - 3.5} ${x + 4.5},${y - 3.5}`
                }
                fill={up ? "#2a6fa8" : "#3a9ca5"}
              />
              <text x={x} y={up ? y - 9 : y + 15} textAnchor="middle" fontSize="9" fontWeight="700" fill="#1f3a5f">
                {tideFmt(e.height)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/* ============================================================================
 * МИНИМАЛИЗМ-РЕДИЗАЙН сайдбара /weather.php — «Погода» и «Температура
 * по районам» (ТЗ 2026-09-19, второй заход «чтобы точно применилось»).
 *
 * Стили вшиты ПРЯМО В HTML страницы (inline <style> в самом конце body),
 * а не в globals.css: у проекта уже был случай, когда Turbopack отдавал
 * устаревший CSS-чанк и правки «не применялись». Инлайн-блок перебивает
 * любые внешние чанки (идёт в документе позже них) и виден в исходном
 * коде страницы.
 *
 * Селекторы — по aria-label секций и ИСХОДНЫМ классам текущего HTML
 * (.mp-panel/.mp-paneltitle/.wth-*), ничего не выдумано; !important на
 * цветах. СТРОГО: без градиентов, box-shadow, transform, анимаций,
 * жёлтого/оранжевого/красного. Только фирменные цвета: #1f3a5f, #2a6fa8,
 * #3a9ca5, #f4f8fb, #d6e4f0, #8a97a3, #fff. Почасовой прогноз (.hour-*)
 * и структура DOM не тронуты. Шрифтовые семейства не менялись.
 * ТЗ 2026-09-21 (острые углы + окантовка + размер по белой подложке):
 * радиусы ВСЕХ блоков и внутренних ячеек = 0; карточки в видимой
 * окантовке #4a688c (стандарт .mp-panel этой страницы); подложка
 * центральной колонки — ПРОЗРАЧНАЯ (ТЗ 2026-09-21: белая подложка
 * и серая полоса убраны, верх выровнен с боковыми колонками), фон
 * блоков центральной колонки — нежно-голубой.
 * ТЗ 2026-09-21 «блок ярче красивее» (вечер): фон блоков #e8f4fb
 * (светлее прежнего #eef3f8), шапки с бирюзовой полосой #06cdbd снизу
 * (акцент навигации сайта), герой-карточка текущей погоды и метрики
 * влажность/давление/ветер — белые карточки с бирюзовыми полосами.
 * Яркость — контрастом белого/бирюзового, БЕЗ градиентов/теней
 * (директива 2026-09-19 сохранена). Почасовая лента крупнее — размеры
 * .hour-* подняты в глобальных правилах globals.css (десктоп + уже
 * существующий мобильный media-блок, БЕЗ новых @media). Виджет
 * meteoblue «по дням» — компактный ряд 7 дней (?days=7 + JS-масштаб
 * эффектом ниже: виртуальная ширина 1120px, обрез ровно под ночной
 * температурой; днем раньше был обрез посреди иконок при 4 колонках).
 * ========================================================================== */
const WTH_MINIMAL_CSS = `
/* 1. Подложка центральной колонки — ПРОЗРАЧНАЯ (ТЗ 2026-09-21 №2:
      общая белая подложка и серая полоса под блоками убраны; фон
      колонки — как у боковых, блоки стоят прямо на фоне страницы).
      Поля НЕ задаём: на десктопе каркас (≥1024px) сам даёт padding:0 —
      карточки занимают всю ширину колонки; на мобильных боковые поля
      12px даёт globals.css (.sidebar) — карточки не прилипают к краям */
.sk .center-column.sidebar,
.sk .center-column:has(> section[aria-label="Погода в Южно-Сахалинске"]){
  background:transparent !important;
}
/* 2. Карточки — ВИДИМАЯ окантовка #4a688c (как у всех .mp-panel
      этой страницы), ОСТРЫЕ углы, БЕЗ теней (box-shadow:none гасит тень
      .sakh-card и .mp-panel ≥768px). Селектор .sk .sidebar-card остаётся
      БЕЗ скоупа: он держит окантовку/углы и правой колонки; ФОН красит
      правило 2а — строго центральная колонка */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"],
section.mp-panel[aria-label="Температура по районам Сахалина и Курил"],
section.mp-panel[aria-label="Оперативная обстановка на перевалах"],
.sk .sidebar-card{
  border:1px solid #4a688c !important;
  border-radius:0 !important;
  margin-bottom:12px !important;
  overflow:hidden;
  box-shadow:none !important;
}
/* 2а. ТЗ 2026-09-21 №4: фон блоков ЦЕНТРАЛЬНОЙ колонки — нежно-голубой
      (было белым): «Погода», «Приливы и отливы» (mp-panel с
      классом .sidebar-card), «Температура по районам», «Перевалы».
      ТЗ 2026-09-21 «ярче»: #eef3f8 → #e8f4fb — чище/светлее голубой,
      белый карточек-заполнителей читается на нём контрастнее.
      Шапки остаются тёмно-синими (rule 3); карточки боковых колонок —
      белые (глобальный .sk .sidebar-card в globals.css) */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"],
section.mp-panel[aria-label="Температура по районам Сахалина и Курил"],
section.mp-panel[aria-label="Оперативная обстановка на перевалах"],
.sk .center-column.sidebar .sidebar-card,
.sk .center-column:has(> section[aria-label="Погода в Южно-Сахалинске"]) .sidebar-card{
  background:#e8f4fb !important;
}
/* 2б. ТЗ 2026-09-21 «фон как у Перевалов»: тело .card-body (глобальный
      .sk .card-body белый, globals.css) делаем прозрачным — сквозь него
      виден фон секции #e8f4fb из правила 2а, тот же цвет, что у блока
      «Оперативная обстановка на перевалах» (его тело без .card-body,
      поэтому он и был единственным нежно-голубым). Селекторы 1-в-1 как
      в 2а: правая колонка не затронута; внутренние окошки (герой,
      метрики, строки районов, график приливов) остаются белыми */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] > .card-body,
section.mp-panel[aria-label="Температура по районам Сахалина и Курил"] > .card-body,
section.mp-panel[aria-label="Оперативная обстановка на перевалах"] > .card-body,
.sk .center-column.sidebar .sidebar-card > .card-body,
.sk .center-column:has(> section[aria-label="Погода в Южно-Сахалинске"]) .sidebar-card > .card-body{
  background:transparent !important;
}
/* 3. Шапки-плашки — плоский #1f3a5f, белый текст, ПО ЦЕНТРУ, без градиента.
      ТЗ 2026-09-21 «уберем бирюзовые полоски»: полоса 3px #06cdbd снизу
      УДАЛЕНА (и в Погоде, и в остальных центральных блоках страницы —
      частичное удаление сделало бы страницу несогласованной); селекторы
      прежние — правая колонка (.mp-paneltitle без .card-header) не затронута */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] > .mp-paneltitle,
section.mp-panel[aria-label="Температура по районам Сахалина и Курил"] > .mp-paneltitle,
.sk .sidebar-card > .card-header{
  background:#1f3a5f !important;
  color:#fff !important;
  font-weight:600 !important;
  font-size:14px !important;
  padding:8px 12px !important;
  text-align:center !important;
  box-shadow:none !important;
}
/* 3а. ТЗ 2026-09-21 «тонкие синие полоски»: полоса 3px #2196f3 под
      шапками блоков ЦЕНТРАЛЬНОЙ колонки страницы (Приливы,
      Температура по районам, Перевалы). В «Погоде» полоса снята
      (ТЗ 2026-09-21 «под синей шапкой удали голубую линию» —
      правило 3б ниже); цвет совпадает с дневными ячейками
      почасовки; правая колонка (.mp-paneltitle без .card-header)
      не затронута */
section.mp-panel[aria-label="Температура по районам Сахалина и Курил"] > .mp-paneltitle,
section.mp-panel[aria-label="Оперативная обстановка на перевалах"] > .mp-paneltitle,
.sk .sidebar-card > .card-header{
  border-bottom:3px solid #2196f3 !important;
}
/* 3б. ТЗ 2026-09-21 «блок погода: под синей шапкой удали голубую
      линию»: полоска 3px #2196f3 под шапкой «Погоды» убрана совсем,
      вместе с базовой 1px линией .mp-paneltitle (--sm-navy-deep,
      globals 1769) — под шапкой сразу начинается тело блока #e8f4fb.
      Скоуп только Погода: у Районов, Перевалов и Приливов полоски
      3px остаются (правило 3а) */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] > .mp-paneltitle{
  border-bottom:0 !important;
}
/* 4. Крупная температура — фирменный тёмно-синий. ТЗ 2026-09-21
      «ячейка с +15 сливается с нижними — сделай поменьше»: 48px → 38px,
      герой ниже и не давит на ряды под ним (до этого была 40px, потом
      48px по ТЗ «ярче»). Размер БЕЗ !important — мобильный media-блок
      globals.css держит свои 38px !important и побеждает на телефоне */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-now-t,
.sk .big-temp{
  color:#1f3a5f !important;
  font-size:38px;
  font-weight:800 !important;
  line-height:1 !important;
}
/* 5. Описание погоды — средний синий #2a6fa8, чуть крупнее (ТЗ «ярче») */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-now-l,
.sk .weather-desc{
  color:#2a6fa8 !important;
  font-size:16px !important;
  font-weight:600 !important;
}
/* 6. Второстепенный текст («ощущается как», подписи влажность/давление/
      ветер) — серый #8a97a3, мелкий */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-now-r small,
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-metric small,
.sk .feels-like{
  color:#8a97a3 !important;
  font-size:12px !important;
}
/* 7. Строки районов — каждая отдельная мини-карточка: белый фон,
      рамка 1px #2196f3 (ТЗ 2026-09-21 «ячейки обведи самой тонкой
      синей полосой» — прежде была бледная #d6e4f0), ОСТРЫЕ углы
      (радиус 0), padding 10px 14px; интервал между строками даёт
      gap:6px сетки. БЕЗ теней, БЕЗ анимаций. */
section.mp-panel[aria-label="Температура по районам Сахалина и Курил"] .wth-bub,
.sk .district-row{
  display:flex;
  justify-content:space-between;
  align-items:center;
  background:#fff !important;
  border:1px solid #2196f3 !important;
  border-radius:0 !important;
  padding:10px 14px !important;
  box-shadow:none !important;
}
/* hover: рамка темнеет до #1a6fd4 — мгновенно, без анимаций
   (базовая рамка теперь тоже синяя #2196f3) */
section.mp-panel[aria-label="Температура по районам Сахалина и Курил"] .wth-bub:hover,
.sk .district-row:hover{
  border-color:#1a6fd4 !important;
}
/* Название района — тёмно-синее */
section.mp-panel[aria-label="Температура по районам Сахалина и Курил"] .wth-bub-n,
.sk .district-name{
  color:#1f3a5f !important;
  font-size:14px !important;
}
/* Температура района — тёмно-синяя, жирная (!important перебивает
      оранжевый #D2691E / синий #1976D2 шкалы Stage 2) */
section.mp-panel[aria-label="Температура по районам Сахалина и Курил"] .wth-bub-t,
.sk .district-temp{
  color:#1f3a5f !important;
  font-size:16px !important;
  font-weight:700 !important;
}
/* 8. Заголовки групп (ЮГ/ЦЕНТР/СЕВЕР/КУРИЛЫ) — плашки: фон #f4f8fb,
      текст #1f3a5f, weight 600, ОСТРЫЕ углы (радиус 0). ТЗ 2026-09-21
      «в ячейках север, центр, юг, курилы удали окантовку»: синяя
      полоска 3px слева убрана (border-left:0 перебивает и базовую
      бирюзовую #3a9ca5 из globals 3396, и бывшую синюю #2196f3) */
section.mp-panel[aria-label="Температура по районам Сахалина и Курил"] .wth-gt,
.sk .district-group-title{
  display:inline-block;
  background:#f4f8fb !important;
  border-left:0 !important;
  color:#1f3a5f !important;
  font-size:12px !important;
  font-weight:600 !important;
  padding:3px 10px !important;
  border-radius:0 !important;
  margin:10px 0 6px !important;
}
/* 9. ТЗ 2026-09-21: острые углы у ВСЕХ внутренних ячеек погодного
      сервиса (метрики Влажность/Давление/Ветер, ячейки почасовки,
      бейдж «сейчас», бейджи влажности, панель деталей часа) и строк
      экстремумов приливов — перебивает радиусы исходного виджета */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-metric,
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .hour-cell,
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .hour-now,
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .hour-humidity,
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .hour-details,
.tide-row{
  border-radius:0 !important;
}
/* 10. ТЗ 2026-09-21 «вообще удали эту чейку, а надписи оставь»:
       герой текущей погоды больше НЕ карточка — белая подложка и
       рамка 1px #2196f3 (постановки «обведи ячейки» и «сделай
       поменьше») сняты полностью; остались только надписи — крупная
       температура, описание и «ощущается как» — прямо на фоне секции
       #e8f4fb. Padding не форсируется: работают базовые 2px 0 6px
       (globals 2317) и мобильные 0 0 4px (globals 2687) */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-now{
  background:transparent !important;
  border:0 !important;
}
/* 11. Метрики (влажность/давление/ветер) — белые карточки с рамкой
       1px #2196f3 («ячейки обведи самой тонкой синей полосой»);
       подписи капсом #2a6fa8, значения крупнее (15px). Размер значения
       БЕЗ !important: мобильный media-блок globals.css держит свои
       12.5px !important и побеждает на телефоне */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-metrics{
  gap:8px !important;
}
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-metric{
  background:#fff !important;
  border:1px solid #2196f3 !important;
  padding:9px 10px !important;
  gap:3px !important;
}
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-metric small{
  color:#2a6fa8 !important;
  font-size:11px !important;
  font-weight:600 !important;
  text-transform:uppercase;
  letter-spacing:.03em;
}
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-metric b{
  font-size:15px;
}
/* 12. Заголовок «Почасовой прогноз на сегодня» — белая плашка с рамкой
       1px #2196f3 («ячейки обведи самой тонкой синей полосой») */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-hours-l{
  display:inline-block;
  background:#fff !important;
  border:1px solid #2196f3 !important;
  color:#1f3a5f !important;
  font-size:12px !important;
  padding:4px 10px !important;
}
/* 13. Панель деталей часа — белая, крупнее; рамка 1px #2196f3
       («ячейки обведи самой тонкой синей полосой») */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .hour-details{
  background:#fff !important;
  border:1px solid #2196f3 !important;
  font-size:13px !important;
  padding:10px 14px !important;
}
/* 14. Метка и рамка блока «Прогноз по дням» (meteoblue, ряд 7 дней):
       плашка + тонкая рамка вокруг виджета — 1px #2196f3
       («ячейки обведи самой тонкой синей полосой»). Подпись meteoblue
       в плашке — атрибуция источника: нижний логотип виджета остаётся
       за срезом */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-daily-l{
  display:inline-block;
  background:#fff;
  border:1px solid #2196f3;
  color:#1f3a5f;
  font-size:12px;
  font-weight:700;
  padding:4px 10px;
  margin:10px 0 6px;
  text-transform:uppercase;
  letter-spacing:.02em;
}
.wth-daily-box{border:1px solid #2196f3;background:#fff;padding:6px;overflow:hidden}
.wth-daily-in{overflow:hidden}
/* 15. ТЗ 2026-09-21 «ячейки обведи самой тонкой синей полосой»:
      ячейки лога «Обстановка на перевалах» — белые карточки с рамкой
      1px #2196f3 и острыми углами (как строки районов и ряды приливов);
      прежний разделитель border-bottom #eef2f6 заменён полной рамкой,
      между ячейками отступ 6px */
section.mp-panel[aria-label="Оперативная обстановка на перевалах"] .wth-pass{
  background:#fff !important;
  border:1px solid #2196f3 !important;
  border-radius:0 !important;
  padding:7px 10px !important;
  margin:0 0 6px !important;
}

/* 2026-10-01: КОМПАКТНОСТЬ ПО ВЕРТИКАЛИ. ТЗ: «на странице погода слишком
   много воздуха по вертикали — надо всё сделать компактнее». Уменьшаем
   paddings, margins, gaps; размер шрифтов и температурной ячейки
   уменьшаем умеренно — чтобы читаемость сохранилась, но лишний воздух
   ушёл. Все правила с !important, чтобы перебить более ранние правила
   этого же блока. */

/* Между блоками — 12px → 5px */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"],
section.mp-panel[aria-label="Температура по районам Сахалина и Курил"],
section.mp-panel[aria-label="Оперативная обстановка на перевалах"],
.sk .sidebar-card{
  margin-bottom:5px !important;
}

/* Шапки блоков — 8px 12px → 4px 10px */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] > .mp-paneltitle,
section.mp-panel[aria-label="Температура по районам Сахалина и Курил"] > .mp-paneltitle,
section.mp-panel[aria-label="Оперативная обстановка на перевалах"] > .mp-paneltitle,
.sk .sidebar-card > .card-header{
  padding:4px 10px !important;
  font-size:13px !important;
}

/* Крупная температура 38px → 28px; line-height 1 → 0.95 */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-now-t,
.sk .big-temp{
  font-size:28px !important;
  line-height:.95 !important;
}

/* Описание погоды 16px → 14px */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-now-l,
.sk .weather-desc{
  font-size:14px !important;
}

/* Метрики (влажность/давление/ветер): gap 8 → 4, padding 9px 10px → 4px 8px */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-metrics{
  gap:4px !important;
}
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-metric{
  padding:4px 8px !important;
  gap:1px !important;
}
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-metric b{
  font-size:13px;
}

/* Строки районов — padding 10px 14px → 4px 10px */
section.mp-panel[aria-label="Температура по районам Сахалина и Курил"] .wth-bub,
.sk .district-row{
  padding:4px 10px !important;
}
section.mp-panel[aria-label="Температура по районам Сахалина и Курил"] .wth-bub-n,
.sk .district-name{
  font-size:13px !important;
}
section.mp-panel[aria-label="Температура по районам Сахалина и Курил"] .wth-bub-t,
.sk .district-temp{
  font-size:14px !important;
}

/* Заголовки групп (ЮГ/ЦЕНТР/...) — margin 10/6 → 3/1; padding 3/10 → 2/8 */
section.mp-panel[aria-label="Температура по районам Сахалина и Курил"] .wth-gt,
.sk .district-group-title{
  margin:3px 0 1px !important;
  padding:2px 8px !important;
  font-size:11px !important;
}

/* Панель деталей часа — padding 10px 14px → 4px 10px */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .hour-details{
  padding:4px 10px !important;
  font-size:12px !important;
}

/* Метка «Почасовой прогноз на сегодня» — padding 4/10 → 2/8 */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-hours-l{
  padding:2px 8px !important;
  font-size:11px !important;
}

/* Ячейки почасовки hour-cell — компактнее по высоте */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .hour-cell{
  padding:2px 4px !important;
}

/* Прогноз по дням (meteoblue) — плашка и коробка компактнее */
section.mp-panel[aria-label="Погода в Южно-Сахалинске"] .wth-daily-l{
  margin:4px 0 2px !important;
  padding:2px 8px !important;
}
.wth-daily-box{padding:3px !important}

/* Ячейки лога «Обстановка на перевалах» — padding 7/10 → 3/8; margin 6 → 2 */
section.mp-panel[aria-label="Оперативная обстановка на перевалах"] .wth-pass{
  padding:3px 8px !important;
  margin:0 0 2px !important;
}

/* График приливов — компактнее */
.tide-chart{margin:0 0 4px !important;padding:4px !important}
.tide-cap{margin:0 0 2px !important;font-size:10px !important}
/* 2026-10-01 (правка 2): блок «Приливы и отливы» — сжать по вертикали.
   SVG-график: ограничиваем max-height — viewBox сохраняет пропорции,
   волна остаётся читаемой, но высота режется с 315px до ~180px.
   tide-row: padding 7px → 2px; margin-bottom 6px → 1px; font 13/15 → 11/13.
   mp-w-upd (строка источника): padding 4px → 1px; font 11.5px → 10.5px.
   Итог: блок 605px → ~360px (−245px). */
.tide-chart svg{display:block;width:100%;max-height:180px !important;height:auto}
.tide-row{padding:2px 8px !important;margin-bottom:1px !important;border-radius:0 !important;font-size:11px !important}
.tide-kind{font-size:11px !important}
.tide-time{font-size:11px !important}
.tide-h{font-size:13px !important}
.tides-list{gap:0 !important}
.tide-note{margin-top:1px !important;font-size:10.5px !important}
.tides-body .mp-w-upd{padding:1px 8px !important;font-size:10.5px !important;margin-top:2px !important}
.tides-body{padding:4px !important}

/* Уменьшить размер контейнера виджета (метеоблю/погода) по высоте */
.wth-daily-in{max-height:200px}
`;

/* Стили волнового графика приливов (2026-09-21): только фирменные цвета,
 * без градиентов/теней/анимаций; ширина 100% через viewBox — адаптив без
 * @media; шрифтовое семейство не задаём (наследуется). */
const TIDES_CSS = `
/* ТЗ 2026-09-21 №3: график упакован в рамку — окантовка 1px #2196f3
   («ячейки обведи самой тонкой синей полосой»), одинаковые внутренние
   отступы 10px, острые углы, белое поле под кривой — как у ячеек блоков */
.tide-chart{margin:0 0 10px;border:1px solid #2196f3;background:#fff;padding:10px;border-radius:0}
.tide-cap{font-size:11px;color:#8a97a3;margin:0 0 4px;text-align:left}
.tide-chart svg{display:block;width:100%;height:auto}
`;

export default function WeatherScreen() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [wx, setWx] = useState<FullWeather>(EMPTY_WX);
  const [roads, setRoads] = useState<RoadsData>(EMPTY_ROADS);
  // ТЗ 2026-09-21 №3: приливы и отливы (залив Анива у порта Корсаков,
  // marine open-meteo, кеш сервера 3 ч); null = ещё загружается.
  const [tides, setTides] = useState<TidesData | null>(null);
  // График «волнами»: позиция линии «сейчас» (сахалинский текущий час,
  // формат ряда «2026-09-21T14:00») — считается один раз при монтировании.
  const [tideNowIso, setTideNowIso] = useState<string>("");
  // ТЗ п.2: текущий час (Сахалин, UTC+11 — тот же пояс, что у часов
  // сайта Asia/Magadan) для подсветки ячейки «сейчас»; часовая ячейка
  // данных — «HH:00» локального времени open-meteo (Asia/Sakhalin).
  const [nowHour, setNowHour] = useState<string>("");
  // ТЗ п.7: время выбранной кликом ячейки — панель деталей под рядом.
  const [openHour, setOpenHour] = useState<string>("");

  // Общие настройки сайта для шапки и футера (те же, что на форуме)
  useEffect(() => {
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then((r) => {
        if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings });
      })
      .catch(() => {});
  }, []);

  // Развёрнутый виджет ЮС + сетка районов (open-meteo, кеш 20 мин)
  useEffect(() => {
    fetch("/api/weather/full")
      .then(async (r) => (r.ok ? r.json() : EMPTY_WX))
      .then((d: FullWeather) => setWx(d))
      .catch(() => {});
  }, []);

  // Лог «Обстановка на перевалах» — 3 последних сообщения с тегом «Дороги»
  useEffect(() => {
    fetch("/api/weather/roads")
      .then(async (r) => (r.ok ? r.json() : EMPTY_ROADS))
      .then((d: RoadsData) => setRoads(d))
      .catch(() => {});
  }, []);

  // ТЗ 2026-09-21 №3: приливы и отливы — экстремумы уровня моря (open-meteo marine)
  useEffect(() => {
    fetch("/api/weather/tides")
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d: TidesData | null) => {
        if (d && Array.isArray(d.extremes)) setTides(d);
      })
      .catch(() => {});
  }, []);

  // Линия «сейчас» на волновом графике — текущий час Сахалина (UTC+11)
  useEffect(() => {
    setTideNowIso(sakhalinNowIso());
  }, []);

  // ТЗ 2026-09-21 «по дням уменьшить»: компактный ряд прогноза на 7 дней.
  // Срез iframe по ширине/высоте вычисляется: виртуальная ширина виджета
  // ВСЕГДА 1120px (zoom = ширина колонки / 1120, замерено: при 1120px
  // нижняя кромка ночных температур ~289px), поэтому обрез ровно под
  // ночными температурами при ЛЮБОЙ ширине колонки — раньше при 200px
  // виджет резался посреди иконок (выглядел сломанным). Телефон (колонка
  // <520px): виджет на всю ширину без зума — 7 мини-колонок, кромка
  // ~207px, высота 218px. Замеры самих секций виджета — см. worklog.
  const dailyBoxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const box = dailyBoxRef.current;
    if (!box) return;
    const frame = box.querySelector("iframe");
    if (!frame) return;
    const apply = () => {
      const W = box.clientWidth;
      if (W <= 0) return;
      if (W < 520) {
        frame.style.width = "100%";
        frame.style.setProperty("zoom", "1");
        frame.style.height = "215px";
      } else {
        frame.style.width = "1120px";
        frame.style.setProperty("zoom", String(W / 1120));
        frame.style.height = "296px";
      }
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  // Текущий час Сахалина (UTC+11): сразу + пересчёт раз в минуту
  // (часCycle h23 — ровно «00…23», без «24»).
  useEffect(() => {
    const tick = () => {
      try {
        const hh = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Magadan", hour: "2-digit", hourCycle: "h23" }).format(new Date());
        setNowHour(`${hh}:00`);
      } catch {
        /* Intl недоступен — подсветка текущего часа честно не ставится */
      }
    };
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, []);

  // Навигация из синей полосы: каждый пункт — свой адрес, остальное — главная.
  const goNav = (k: string) => {
    window.location.href = NAV_ROUTES[k] ?? "/";
  };

  const now = wx.now;

  return (
    <div className="sm-page flex min-h-screen flex-col">
      <Masthead settings={settings} />
      <MainNav current="weather" isAdmin={isStaffRole(user?.role)} onNavigate={goNav} />
      <div className="sk" style={{ minHeight: 0, flex: "1 0 auto" }}>
        <div className="sk-topbar">
          <span className="tb-title">Погода на Сахалине</span>
        </div>
        <div className="sk-shell">
          {/* Шаг №4 (директива «Трехколоночный монолит внутренних страниц»):
              контейнер несёт класс .main-grid-container — архитектура СТРОГО
              та же, что у Главной (≥1024px: flex по центру до 1800px, зазор
              20px, левая 240px / центр .center-column flex:1, max-width:1200px
              / правая 300px). Левая колонка (ForumSideNav) — развернутое меню
              навигации и категорий форума, центральная — виджет погоды,
              районы, перевалы, правая (HomeRight) — служебные блоки. Контент
              «на всю ширину» запрещён. */}
          <div className="sk-layout sk-layout-page main-grid-container">
          <ForumSideNav />
          {/* ТЗ «Минимализм-редизайн сайдбара» (2026-09-19); ТЗ 2026-09-21:
              контейнеру блоков «Погода» и «Температура по районам» добавлен
              класс .sidebar; подложка колонки — БЕЛАЯ #fff без полей
              (карточки занимают её целиком), стиль переопределён в
              WTH_MINIMAL_CSS ниже. Структура колонки не менялась. */}
          <div className="sk-col-main center-column sidebar">
          {/* ТЗ п.1–2 + директива «Плашка = верх карточки»: заголовок
              «Погода» — .mp-paneltitle, полноширинная тёмно-синяя шапка
              панели (верхняя ЧАСТЬ карточки, как у «Температура по
              районам» ниже), а не отдельная рамка .sm-stub-home внутри
              тела. Уточнение ТЗ: у этой шапки НЕТ треугольника, надпись
              ПО ЦЕНТРУ (модификатор .mp-paneltitle-plain) — эталонные
              .mp-paneltitle с треугольником не затронуты. Под шапкой —
              .wth-body той же карточки: развёрнутый виджет Южно-Сахалинска
              (текущая погода, влажность, давление, ветер и почасовой
              прогноз на сегодня). */}
          {/* ТЗ «Минимализм-редизайн» п.1–2; ТЗ 2026-09-21: карточка
              .sidebar-card (белая, ВИДИМАЯ окантовка #4a688c, ОСТРЫЕ углы,
              БЕЗ теней), шапка .card-header (плоский #1f3a5f, по центру),
              тело .card-body (padding 12px). Крупная температура —
              .big-temp (#1f3a5f, 40px/800), описание — .weather-desc
              (#2a6fa8), «Ощущается как» — .feels-like (#8a97a3).
              Блок «Почасовой прогноз» ниже НЕ тронут. */}
          <section className="mp-panel sakh-card sidebar-card" aria-label="Погода в Южно-Сахалинске">
            <div className="mp-paneltitle mp-paneltitle-plain card-header">Погода</div>
            <div className="wth-body card-body">
              {/* ТЗ 2026-09-21 (обмен графиков): почасовой прогноз поднят
                  наверх карточки, дневной график meteoblue опущен ПОД него
                  (блок перенесён в конец тела без изменений кода). */}
              {now ? (
                <>
                  <div className="wth-now">
                    <b className="wth-now-t big-temp">{fmtTemp(now.temp)}</b>
                    <span className="wth-now-r">
                      <span className="wth-now-l weather-desc">{now.label}</span>
                      <small className="feels-like">Ощущается как {fmtTemp(now.feels)}</small>
                    </span>
                  </div>
                  <div className="wth-metrics">
                    <div className="wth-metric">
                      <small>Влажность</small>
                      <b>{now.hum}%</b>
                    </div>
                    <div className="wth-metric">
                      <small>Давление</small>
                      <b>{now.press} мм рт. ст.</b>
                    </div>
                    <div className="wth-metric">
                      <small>Ветер</small>
                      <b>
                        {now.wind} м/с · {now.rumb}
                      </b>
                    </div>
                  </div>
                  <div className="wth-hours-l">Почасовой прогноз на сегодня</div>
                  {/* ТЗ «Почасовой прогноз» (2026-09-19): snap-скролл ряд
                      ячеек; в каждой — время, иконка WMO (title = подпись
                      источника), температура в цвете значения, бейдж
                      влажности, ветер со стрелкой (поворот = метеоградусы
                      ОТКУДА дует: Ю→↓, С→↑, как в примере ТЗ); текущий час
                      подсвечен (.current + подпись «сейчас» под ячейкой);
                      клик по ячейке открывает .hour-details с полным набором
                      (температура/ощущается/влажность/давление/ветер). */}
                  <div className="hourly-forecast" role="list" aria-label="Почасовой прогноз на сегодня">
                    {wx.hours.map((h) => {
                      const tod = hourTodClass(h.time);
                      return (
                      <div
                        key={h.time}
                        role="listitem"
                        /* ТЗ 2026-09-21 «ярко-голубые по времени суток»:
                           заливку ячейки задаёт hourTodClass (night/twilight/
                           midday; без класса = день); цвет бейджа температуры
                           задаёт hourTempClass-класс на самом .hour-temp
                           (шкала синий→жёлтый→оранжевый в globals.css) */
                        className={`hour-cell${tod ? ` ${tod}` : ""}${h.time === nowHour ? " current" : ""}${openHour === h.time ? " selected" : ""}`}
                        onClick={() => setOpenHour(openHour === h.time ? "" : h.time)}
                      >
                        <div className="hour-time">{h.time}</div>
                        <div className="hour-icon" title={h.label}>{codeIcon(h.code)}</div>
                        <div className={`hour-temp ${hourTempClass(h.temp)}`.trim()}>{fmtTemp(h.temp)}</div>
                        <div className={`hour-humidity ${humClass(h.hum)}`}>влажн. {h.hum}%</div>
                        <div className="hour-wind">
                          <span
                            className="wind-arrow"
                            aria-hidden="true"
                            style={typeof h.wdeg === "number" ? { transform: `rotate(${h.wdeg}deg)` } : undefined}
                          >
                            ↑
                          </span>{" "}
                          {h.wind} м/с · {h.rumb}
                        </div>
                        {h.time === nowHour ? <span className="hour-now">сейчас</span> : null}
                      </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const d = wx.hours.find((x) => x.time === openHour);
                    if (!d) return null;
                    return (
                      <div className="hour-details" role="status">
                        <b>
                          {d.time} · {d.label}
                        </b>
                        <span>Температура {fmtTemp(d.temp)}</span>
                        <span>Ощущается как {fmtTemp(typeof d.feels === "number" ? d.feels : d.temp)}</span>
                        <span>Влажность {d.hum}%</span>
                        <span>Давление {d.press} мм рт. ст.</span>
                        <span>
                          Ветер {d.wind} м/с · {d.rumb}
                        </span>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="wth-empty">Прогноз обновляется…</div>
              )}
              <div className="mp-w-upd">
                {wx.source === "live" ? `Почасовой прогноз · обновлено: ${wx.updated} | ${wx.via || "open-meteo.com"}` : ""}
              </div>
              {/* ТЗ 2026-09-21 (обмен графиков): дневной график meteoblue —
                  под почасовым прогнозом. Директива «Интеграция Погоды»:
                  адаптивный информер-виджет meteoblue с жёсткой геопривязкой
                  к Южно-Сахалинску (slug виджета —
                  yuzhno-sakhalinsk_russia_2119441). Все внешние клики из
                  виджета открываются в новом окне (target="_blank") — это
                  поведение самого meteoblue-виджета daily; дополнительно
                  sandbox разрешает popups, но НЕ даёт виджету перехватить
                  top-навигацию родительской страницы (allow-top-navigation
                  отключён — пользователь останется на SakhMatrix, meteoblue
                  откроется новой вкладкой). src откладывается до window.load:
                  подвисший ответ meteoblue не задерживает load страницы.
                  ТЗ 2026-09-21 «по дням уменьшить»: параметр ?days=7 строит
                  ОДИН ряд из 7 дней (замерено: count-7 → одна строка;
                  count-4 давал 2 ряда с обрезом посреди иконок), размеры
                  задаёт эффект dailyBoxRef выше — виджет 1120px, масштаб
                  по ширине колонки, срез под ночными температурами. */}
              <div className="mp-weather">
                <div className="wth-daily-l">Прогноз по дням · meteoblue</div>
                <div className="wth-daily-box">
                  <div ref={dailyBoxRef} className="wth-daily-in">
                    <DeferredIframe
                      className="mp-w-frame mp-w-frame-sm"
                      src="https://www.meteoblue.com/ru/weather/widget/daily/yuzhno-sakhalinsk_russia_2119441?days=7"
                      title="Прогноз по дням на 7 дней — виджет meteoblue"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ТЗ 2026-09-21 №3: виджет «Приливы и отливы» — та же карточка
              .sidebar-card/.card-header/.card-body минимализма сайдбара;
              точка — залив Анива у порта Корсаков (marine open-meteo,
              Copernicus Marine); шаг данных 1 ч — подписано честно;
              ближайший экстремум выделен рамкой .tide-next.
              ТЗ 2026-09-21 (позиция): блок перенесён сразу под карточку
              «Погода» — приливы идут сразу за погодой (прежде стояли
              после «Температура по районам»); сам код блока не менялся. */}
          <section className="mp-panel sakh-card sidebar-card" aria-label="Приливы и отливы — залив Анива (порт Корсаков)">
            <div className="mp-paneltitle mp-paneltitle-plain card-header">Приливы и отливы</div>
            <div className="tides-body card-body">
              {tides && ((tides.series?.length ?? 0) > 1 || tides.extremes.length > 0) ? (
                <>
                  {/* График «волнами» (2026-09-21): плавная кривая уровня моря
                      по почасовому ряду marine open-meteo; метки ▲/▼ —
                      экстремумы, пунктир — «сейчас», сетка — сутки/высоты.
                      График и список независимы: если series не пришла
                      (старый кеш) — честно без кривой; если экстремумов нет —
                      честно без списка. */}
                  {tides.series && tides.series.length > 1 ? <TideWaveChart tides={tides} nowIso={tideNowIso} /> : null}
                  {tides.extremes.length > 0 ? (
                    <>
                      <div className="tides-list" role="list" aria-label="График приливов и отливов на ближайшие дни">
                        {tides.extremes.map((e, i) => (
                          <div className={`tide-row${i === 0 ? " tide-next" : ""}`} key={e.iso + e.kind} role="listitem">
                            <span className={`tide-kind ${e.kind === "high" ? "high" : "low"}`}>
                              {e.kind === "high" ? "▲ Прилив" : "▼ Отлив"}
                            </span>
                            <span className="tide-time">{e.time}</span>
                            <b className="tide-h">{e.height.toFixed(2).replace(".", ",")} м</b>
                          </div>
                        ))}
                      </div>
                      <div className="tide-note">
                        {tides.point} · шаг данных 1 ч · ближайший выделен
                      </div>
                    </>
                  ) : null}
                  <div className="mp-w-upd">
                    {`Источник: ${tides.via || "open-meteo.com (marine)"} · обновлено: ${tides.updated}`}
                  </div>
                </>
              ) : (
                <div className="tides-empty">Данные приливов обновляются…</div>
              )}
            </div>
          </section>

          {/* ТЗ п.3 + «Минимализм-редизайн» п.3 (2026-09-19): строки
              районов — отдельные мини-карточки .district-row (рамка
              #d6e4f0, hover-рамка #3a9ca5), температура .district-temp —
              СТРОГО фирменный тёмно-синий #1f3a5f (прежняя оранжево/
              синяя шкала wth-t-* в этом блоке перекрыта), группы —
              .district-group-title (светло-голубая плашка с бирюзовой
              полоской слева). Структура DOM (группы, 2-колоночная сетка,
              треугольник в шапке) не менялась. */}
          <section className="mp-panel sakh-card sidebar-card" aria-label="Температура по районам Сахалина и Курил">
            <div className="mp-paneltitle card-header">
              <span className="tri">▼</span>Температура по районам
            </div>
            <div className="wth-dirs card-body">
              {wx.cities.length > 0 ? (
                CITY_GROUPS.map((g) => {
                  const gc = wx.cities.filter((c) => c.group === g.label);
                  if (gc.length === 0) return null;
                  return (
                    <div className="wth-g" key={g.label}>
                      <div className="wth-gt district-group-title">{g.label}</div>
                      {/* «Минимализм-редизайн» п.3: двухколоночная сетка
                          сохранена; каждая плашка — мини-карточка
                          .district-row с рамкой #d6e4f0 (hover —
                          бирюзовый #3a9ca5); температура .district-temp —
                          жирный фирменный #1f3a5f для ЛЮБОГО значения
                          (цветовая шкала Stage 2 в этом блоке отключена). */}
                      <div className="wth-grid wth-grid-2col">
                        {gc.map((c) => (
                          <div className="wth-bub district-row" key={c.name}>
                            <span className="wth-bub-n district-name">{c.name}</span>
                            <b className={`wth-bub-t district-temp ${tempClass(c.temp)}`}>{fmtTemp(c.temp)}</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="wth-empty">Температура по районам обновляется…</div>
              )}
              <div className="mp-w-upd">{wx.cities.length > 0 ? `Текущая температура · ${wx.viaCities || wx.via || "open-meteo.com"}` : ""}</div>
            </div>
          </section>

          {/* ТЗ п.4: «Оперативная обстановка на перевалах» — лог из 3
              последних сообщений форума с тегом «Дороги» (данные БД,
              /api/weather/roads); текст переносится по строкам и не
              ломает правую границу .sakh-card на телефонах. */}
          <section className="mp-panel sakh-card" aria-label="Оперативная обстановка на перевалах">
            <div className="mp-paneltitle">
              <span className="tri">▼</span>Оперативная обстановка на перевалах
            </div>
            {roads.items.length > 0 ? (
              <div className="wth-passes">
                {roads.items.map((m) => (
                  <div className="wth-pass" key={m.id}>
                    <div className="wth-pass-h">
                      <b>{m.author}</b>
                      <span>{fmtRecent(m.createdAt)}</span>
                    </div>
                    <p className="wth-pass-t">{m.body}</p>
                  </div>
                ))}
                <div className="mp-w-upd">Тег «Дороги» · последние сообщения форума</div>
              </div>
            ) : (
              <div className="wth-empty">Отчётов о перевалах и дорогах пока нет — добавьте свой на форуме.</div>
            )}
          </section>
          </div>
          <HomeRight />
          </div>
        </div>
        {/* Шаг «Единый футер как на Главной»: общий SiteFooter — тот же футер,
            что на Главной (строка ссылок, сведения, дисклеймер, версия),
            размер/состав 1-в-1; до этого здесь был тонкий .sk-footer */}
        <SiteFooter settings={settings} />
        {/* ТЗ «Минимализм» (второй заход): стили блоков «Погода» и
            «Температура по районам» — ОДНИМ куском прямо в HTML страницы,
            в самом конце (перебивает внешние CSS-чанки; react-dom сохраняет
            <style>-элементы при гидрации и клиентских перерисовках).
            WTH_MINIMAL_CSS — см. константу выше: без градиентов/теней/
            transform/анимаций, только фирменные цвета. */}
        <style id="wth-minimal-css" dangerouslySetInnerHTML={{ __html: WTH_MINIMAL_CSS }} />
        {/* Стили волнового графика приливов — тем же приёмом (в конце body,
            перебивает внешние чанки; см. TIDES_CSS выше). */}
        <style id="tide-chart-css" dangerouslySetInnerHTML={{ __html: TIDES_CSS }} />
      </div>
    </div>
  );
}
