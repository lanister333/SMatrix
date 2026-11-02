/**
 * Задача ТЗ 2026-09-21 №3: виджет «Приливы и отливы» на /weather.php.
 *
 * Источник: открытый marine-api.open-meteo.com (данные Copernicus Marine,
 * без ключа) — почасовой уровень моря sea_level_height_msl для точки
 * «Залив Анива (порт Корсаков)» (46.63 с.ш., 142.79 в.д.). Экстремумы
 * ряда (полная вода = прилив, малая = отлив) — полуприливным методом:
 * пересечения среднего уровня ряда, max/min между ними (устойчиво к
 * «ступенькам» модели, в отличие от сравнения соседних часов). Шаг ряда
 * 1 час — время экстремумов даётся с точностью до часа (честно подписано
 * в виджете). Выдуманных значений нет: только ряд API и его экстремумы.
 *
 * График «волнами» (2026-09-21, доработка виджета): помимо экстремумов
 * маршрут отдаёт ВЕСЬ почасовой ряд series {iso,label,height} — по нему
 * клиент рисует плавную кривую уровня моря (сутки назад + 3 дня вперёд);
 * all — все очищенные экстремумы окна (метки ▲/▼ на графике), extremes —
 * ближайшие 6 для списка под графиком (как было утверждено ранее).
 *
 * Кеш: память 3 ч + диск db/tides-cache.json (прецедент
 * db/weather-cache.json); при отказе источника отдаётся последний сбор
 * со своим собственным честным штампом времени (максимум 72 ч). Кеш без
 * series (старый формат, до графика) считается недействительным — идём
 * за свежим рядом.
 */

import { readFileSync, writeFileSync } from "fs";
import https from "https";
import path from "path";

export const runtime = "nodejs";

const TTL_MS = 3 * 60 * 60 * 1000;
const STALE_MAX_MS = 72 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6000;
const CACHE_FILE = path.join(process.cwd(), "db", "tides-cache.json");

/** Точка виджета: залив Анива у порта Корсаков (юг Сахалина, рядом с ЮС). */
const POINT = { name: "Залив Анива (порт Корсаков)", lat: 46.63, lon: 142.79 };

interface TideExtreme {
  /** ISO-время локальное («2026-09-23T05:00») — для сортировки. */
  iso: string;
  /** Готовая подпись «23.09 05:00» (локальное время Сахалина). */
  time: string;
  kind: "high" | "low";
  /** Высота уровня моря, м. */
  height: number;
}

/** Точка почасового ряда уровня моря для волнового графика. */
interface SeriesPoint {
  /** Локальное ISO-время («2026-09-23T05:00») — единая ось X графика. */
  iso: string;
  /** Готовая подпись «23.09 05:00» (локальное время Сахалина). */
  label: string;
  /** Уровень моря, м (относительно среднего уровня моря, MSL). */
  height: number;
}

interface TidesPayload {
  point: string;
  source: "live" | "none";
  via: string;
  updated: string;
  step: string;
  /** Ближайшие 6 экстремумов — список под графиком (как утверждено). */
  extremes: TideExtreme[];
  /** Весь почасовой ряд окна — волновая кривая (пустой не бывает). */
  series: SeriesPoint[];
  /** Все очищенные экстремумы окна — метки ▲/▼ на кривой. */
  all: TideExtreme[];
}

function fmtStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

let cache: { at: number; data: TidesPayload } | null = null;

function readDisk(): { at: number; data: TidesPayload } | null {
  try {
    const raw = JSON.parse(readFileSync(CACHE_FILE, "utf8")) as { at: number; data: TidesPayload };
    // series обязателен: кеш старого формата (до волнового графика) — мимо.
    if (
      raw &&
      typeof raw.at === "number" &&
      raw.data &&
      Array.isArray(raw.data.extremes) &&
      Array.isArray(raw.data.series)
    )
      return raw;
  } catch {}
  return null;
}

function writeDisk(data: TidesPayload) {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify({ at: Date.now(), data }));
  } catch {}
}

/** Ключ сравнения «дата hh:00» по локальному времени Сахалина. */
function localKey(isoLocal: string): string {
  // API с timezone=Asia/Sakhalin возвращает локальные строки «2026-09-23T05:00».
  return isoLocal.replace("T", " ").slice(0, 16);
}

function currentLocalKey(): string {
  // Текущий момент в поясе Asia/Sakhalin (UTC+11, как часы сайта Asia/Magadan).
  const shifted = new Date(Date.now() + 11 * 60 * 60 * 1000);
  const iso = shifted.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

/** Фетч marine-источника с ФОРСИРОВАННЫМ IPv4 (node:https).
 *
 *  Фикс 2026-09-21: в песочнице IPv6-маршрут мёртв, а getaddrinfo для
 *  marine-api.open-meteo.com отдает AAAA первым — глобальный
 *  dns.setDefaultResultOrder("ipv4first") (instrumentation-node) fetch
 *  (undici) не спасает: соединение уходит в мёртвый IPv6 и падает
 *  ETIMEDOUT (~300 мс), при этом curl -4 работает. Явный family:4 в
 *  node:https заводит соединение по живому A-адресу (SNI/имя сервера
 *  сохраняются — servername по умолчанию равен хосту URL).
 *
 *  Отдаёт { status, json }; ошибки — через reject (обрабатывает вызывающий). */
function fetchMarineIPv4(url: string, timeoutMs: number): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { family: 4, timeout: timeoutMs, headers: { accept: "application/json" } },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c: string) => (body += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode ?? 0, json: JSON.parse(body) as unknown });
          } catch (e) {
            reject(e instanceof Error ? e : new Error("bad json"));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("connect/read timeout")));
    req.on("error", reject);
  });
}

async function fetchTides(): Promise<TidesPayload | null> {
  const url =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${POINT.lat}&longitude=${POINT.lon}` +
    `&hourly=sea_level_height_msl&timezone=Asia%2FSakhalin&past_days=1&forecast_days=3`;
  let d: {
    hourly?: { time?: string[]; sea_level_height_msl?: Array<number | null> };
  };
  try {
    // Основной путь: node:https с жёстким IPv4 (см. fetchMarineIPv4 —
    // фикс мёртвого IPv6-маршрута песочницы).
    const r = await fetchMarineIPv4(url, FETCH_TIMEOUT_MS);
    if (r.status !== 200) {
      console.warn(`[tides] marine IPv4 http ${r.status}`);
      return null;
    }
    d = r.json as typeof d;
  } catch (e1) {
    const n1 = e1 as { name?: string; message?: string; code?: string };
    console.warn(`[tides] marine IPv4 fail: ${n1.code ?? n1.name ?? "?"}: ${n1.message ?? "?"} — пробую fetch`);
    try {
      // Резерв: обычный fetch (оживёт, если IPv6-маршрут починят).
      const r = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
      if (!r.ok) {
        console.warn(`[tides] marine fetch http ${r.status}`);
        return null;
      }
      d = (await r.json()) as typeof d;
    } catch (e2) {
      const n2 = e2 as { name?: string; message?: string };
      const cause = (e2 as { cause?: { code?: string; message?: string } }).cause;
      console.warn(`[tides] fetch fail: ${n2?.name ?? "?"}: ${n2?.message ?? "?"} | cause: ${cause?.code ?? "?"}: ${cause?.message ?? "?"}`);
      return null;
    }
  }
  const t = d.hourly?.time ?? [];
  const v = d.hourly?.sea_level_height_msl ?? [];
  if (t.length < 3) return null;

  // Волновой график: весь ряд целиком (пропуски null честно пропускаются —
  // кривая их мостит); высоты округляем до см, как и экстремумы.
  const series: SeriesPoint[] = [];
  for (let i = 0; i < t.length; i++) {
    const h = v[i];
    if (typeof h !== "number") continue;
    const iso = t[i];
    series.push({
      iso,
      label: `${iso.slice(8, 10)}.${iso.slice(5, 7)} ${iso.slice(11, 16)}`,
      height: Math.round(h * 100) / 100,
    });
  }
  if (series.length < 2) return null;

  const extremes: TideExtreme[] = [];
  // Экстремумы (полная/малая вода) — классический ПОЛУПРИЛИВНЫЙ метод:
  // средний уровень ряда → пересечения среднего → max/min на отрезке
  // между соседними пересечениями (гребень → прилив, впадина → отлив).
  // Соседний порог (±5 см от соседа) не работает: модель даёт мелкие
  // «ступеньки» (−0,35 / −0,33 / −0,38), и реальные отливы терялись —
  // список сжимался до одной строки. Порог выразительности сдвинут к
  // среднему уровню: экстремум обязан отходить от среднего минимум на
  // 5 см — шум штормового нагона отсечён, оба рода вод находятся.
  const idxs: number[] = [];
  for (let i = 0; i < v.length; i++) if (typeof v[i] === "number") idxs.push(i);
  if (idxs.length < 3) return null;
  const mean = idxs.reduce((s, i) => s + (v[i] as number), 0) / idxs.length;
  const AMP_M = 0.05;
  type Cross = { i: number; dir: 1 | -1 };
  const crosses: Cross[] = [];
  let prevSign = 0;
  for (const i of idxs) {
    const dv = (v[i] as number) - mean;
    const s = dv > 0 ? 1 : dv < 0 ? -1 : 0;
    if (s !== 0 && prevSign !== 0 && s !== prevSign) crosses.push({ i, dir: s as 1 | -1 });
    if (s !== 0) prevSign = s;
  }
  for (let j = 0; j + 1 < crosses.length; j++) {
    const a = crosses[j].i;
    const b = crosses[j + 1].i;
    let best = -1;
    for (const i of idxs) {
      if (i < a || i >= b) continue;
      if (best === -1) {
        best = i;
        continue;
      }
      const cur = v[i] as number;
      const top = v[best] as number;
      if (crosses[j].dir === 1 ? cur > top : cur < top) best = i;
    }
    if (best === -1) continue;
    const h = v[best] as number;
    if (Math.abs(h - mean) < AMP_M) continue;
    // API с timezone=Asia/Sakhalin возвращает УЖЕ локальное сахалинское
    // время («2026-09-23T05:00») — никакого повторного сдвига пояса;
    // берём подпись прямо из строки.
    const iso = t[best];
    extremes.push({
      iso,
      time: `${iso.slice(8, 10)}.${iso.slice(5, 7)} ${iso.slice(11, 16)}`,
      kind: crosses[j].dir === 1 ? "high" : "low",
      height: Math.round(h * 100) / 100,
    });
  }
  if (!extremes.length) return null;

  // Два однотипных экстремума подряд невозможны физически: между двумя
  // полными водами обязана быть малая. Если шум дал подряд два «прилива»
  // (или два «отлива») — оставляем более выраженный из них.
  const cleaned: TideExtreme[] = [];
  for (const e of extremes) {
    const prev = cleaned[cleaned.length - 1];
    if (prev && prev.kind === e.kind) {
      if ((e.kind === "high" && e.height > prev.height) || (e.kind === "low" && e.height < prev.height)) {
        cleaned[cleaned.length - 1] = e;
      }
      continue;
    }
    cleaned.push(e);
  }
  if (!cleaned.length) return null;

  const nowKey = currentLocalKey();
  const upcoming = cleaned
    .filter((e) => localKey(e.iso) >= nowKey)
    .slice(0, 6);
  if (!upcoming.length) return null;

  return {
    point: POINT.name,
    source: "live",
    via: "open-meteo.com (marine)",
    updated: fmtStamp(new Date()),
    step: "1 ч",
    extremes: upcoming,
    series,
    all: cleaned,
  };
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return Response.json(cache.data);
  }
  const disk = readDisk();
  if (disk && Date.now() - disk.at < TTL_MS) {
    cache = disk;
    return Response.json(disk.data);
  }

  const fresh = await fetchTides();
  if (fresh) {
    cache = { at: Date.now(), data: fresh };
    writeDisk(fresh);
    return Response.json(fresh);
  }

  // Источник молчит: последний сбор со своим честным штампом (макс. 72 ч).
  if (disk && Date.now() - disk.at < STALE_MAX_MS) {
    cache = disk;
    return Response.json(disk.data);
  }
  const empty: TidesPayload = {
    point: POINT.name,
    source: "none",
    via: "",
    updated: fmtStamp(new Date()),
    step: "1 ч",
    extremes: [],
    series: [],
    all: [],
  };
  return Response.json(empty);
}
