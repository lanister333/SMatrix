/**
 * Шаг 10: погодный сервис страницы /weather.php — развёрнутый виджет
 * Южно-Сахалинска + сетка районов Сахалина и Курил (один запрос).
 *
 * ТЗ: развёрнутая версия виджета meteoblue «или аналогичного
 * адаптивного сервиса», показывающая подробный почасовой прогноз на
 * сегодня, уровень влажности, атмосферное давление и направление
 * ветра для Южно-Сахалинска; сетка районов — через бесплатное и
 * стабильное API (например, Open-Meteo).
 *
 * Источники (оба бесплатные, без ключей):
 *  1) ОСНОВНОЙ — открытый open-meteo.com (уже погодный API портала,
 *     Шаг 5, api/home/weather — файл не тронут):
 *       — Южно-Сахалинск: current (температура/ощущается/влажность/
 *         давление/ветер с направлением) + hourly на сегодня
 *         (прошедшие часы дня отрезаются — todayHourIndexes);
 *       — 11 городов сетки районов — 11 отдельных 1-юнитных запросов
 *         (мульти-запрос по спискам координат стоит те же 11 юнитов
 *         дневной квоты, но отклоняется целиком при её нехватке —
 *         общий IP песочницы; одиночные проходят).
 *  2) РЕЗЕРВ — открытый api.met.no (Yr.no, Норвежский метеоинститут):
 *         почасовая серия locationforecast/2.0/compact со всем
 *         нужным набором (температура/влажность/давление/ветер м/с
 *         и направление). Подключён по прецеденту аналогов проекта
 *         (kovalut.ru вместо myfin.by 423, meteoblue вместо
 *         pogodnik.com 403): дневная квота open-meteo делится между
 *         проектами общего IP песочницы и к вечеру исчерпывается.
 *
 * Дисковый кеш db/weather-cache.json (прецедент db/outages.json):
 * последняя успешная серия переживает рестарт сервера (каждый рестарт
 * иначе стоит 12 запросов квоты), а при полном отказе обоих источников
 * отдаётся с её собственным честным штампом времени сбора (максимум
 * сутки) — выдуманных значений нет нигде; отказавший город честно
 * даёт «—». Кеш памяти — 20 минут (паттерн api/home/weather).
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  YUZHNO,
  flatCities,
  codeLabel,
  hpaToMm,
  rumbFromDeg,
  todayHourIndexes,
  metSymbolLabel,
  sakhalinLocal,
  sakhalinToday,
  type FullWeather,
  type WeatherNow,
  type WeatherHour,
} from "@/lib/weather-data";

export const runtime = "nodejs";

const TTL_MS = 20 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3500;
const STALE_MAX_MS = 24 * 60 * 60 * 1000;
const CACHE_FILE = path.join(process.cwd(), "db", "weather-cache.json");
/** met.no требует опознавательный User-Agent (политика сервиса). */
const METNO_UA = "SakhMatrix/1.0 (island community portal)";

function fmtStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

let cache: { at: number; data: FullWeather } | null = null;

function readDisk(): { at: number; data: FullWeather } | null {
  try {
    const raw = JSON.parse(readFileSync(CACHE_FILE, "utf8")) as { at: number; data: FullWeather };
    if (raw && typeof raw.at === "number" && raw.data && Array.isArray(raw.data.cities)) return raw;
  } catch {}
  return null;
}

function writeDisk(data: FullWeather) {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify({ at: Date.now(), data }));
  } catch {}
}

/* ---------- open-meteo (основной) ---------- */

function omYsUrl(): string {
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${YUZHNO.lat}&longitude=${YUZHNO.lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,wind_speed_10m,wind_direction_10m,weather_code` +
    `&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,wind_speed_10m,wind_direction_10m,weather_code` +
    `&wind_speed_unit=ms&timezone=Asia%2FSakhalin&forecast_days=1`
  );
}

function omCityUrl(lat: number, lon: number): string {
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Asia%2FSakhalin`;
}

function omGet(url: string): Promise<unknown> {
  return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

/* ---------- met.no (резерв) ---------- */

interface MetNoEntry {
  time?: string;
  data?: {
    instant?: { details?: { air_temperature?: number; relative_humidity?: number; air_pressure_at_sea_level?: number; wind_speed?: number; wind_from_direction?: number } };
    next_1_hours?: { summary?: { symbol_code?: string } };
    next_12_hours?: { summary?: { symbol_code?: string } };
  };
}

function metNoPoint(lat: number, lon: number): Promise<{ now: WeatherNow; hours: WeatherHour[] } | null> {
  const t0 = Date.now();
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
  return fetch(url, { headers: { "User-Agent": METNO_UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" })
    .then(async (r) => {
      if (!r.ok) {
        console.warn(`[weather] met.no ${lat},${lon}: HTTP ${r.status} за ${Date.now() - t0}мс`);
        return null;
      }
      const d = (await r.json()) as { properties?: { timeseries?: MetNoEntry[] } };
      const ts = d?.properties?.timeseries ?? [];
      if (!ts.length) {
        console.warn(`[weather] met.no ${lat},${lon}: пустая timeseries за ${Date.now() - t0}мс`);
        return null;
      }
      const today = sakhalinToday();
      const curHour = sakhalinLocal(new Date().toISOString()).hh.slice(0, 2);
      const todayEntries = ts.filter((e) => e.time && sakhalinLocal(e.time).date === today);
      if (!todayEntries.length) return null;
      const det = (e: MetNoEntry) => e.data?.instant?.details ?? {};
      const hours: WeatherHour[] = todayEntries
        .filter((e) => sakhalinLocal(e.time!).hh.slice(0, 2) >= curHour)
        .map((e) => {
          const x = det(e);
          return {
            time: sakhalinLocal(e.time!).hh,
            temp: Math.round(x.air_temperature ?? 0),
            // В compact met.no ощущаемой температуры нет — не выдумываем,
            // показываем фактическую (та же величина; как в now.feels).
            feels: Math.round(x.air_temperature ?? 0),
            hum: Math.round(x.relative_humidity ?? 0),
            press: hpaToMm(x.air_pressure_at_sea_level ?? 0),
            wind: Math.round((x.wind_speed ?? 0) * 10) / 10,
            wdeg: typeof x.wind_from_direction === "number" ? Math.round(x.wind_from_direction) : null,
            rumb: rumbFromDeg(x.wind_from_direction ?? NaN),
            code: 2,
            label: metSymbolLabel(e.data?.next_1_hours?.summary?.symbol_code ?? e.data?.next_12_hours?.summary?.symbol_code),
          };
        });
      if (!hours.length) {
        console.warn(`[weather] met.no ${lat},${lon}: часов на сегодня 0 (записей ${todayEntries.length}, sakhalinToday=${today}, curHour=${curHour}) за ${Date.now() - t0}мс`);
        return null;
      }
      const past = todayEntries.filter((e) => sakhalinLocal(e.time!).hh.slice(0, 2) <= curHour);
      const ne = past.length ? past[past.length - 1] : todayEntries[0];
      const x = det(ne);
      const now: WeatherNow = {
        temp: Math.round(x.air_temperature ?? 0),
        // В compact met.no ощущаемой температуры нет — не выдумываем,
        // показываем фактическую (та же величина).
        feels: Math.round(x.air_temperature ?? 0),
        code: 2,
        label: metSymbolLabel(ne.data?.next_1_hours?.summary?.symbol_code ?? ne.data?.next_12_hours?.summary?.symbol_code),
        hum: Math.round(x.relative_humidity ?? 0),
        press: hpaToMm(x.air_pressure_at_sea_level ?? 0),
        wind: Math.round((x.wind_speed ?? 0) * 10) / 10,
        rumb: rumbFromDeg(x.wind_from_direction ?? NaN),
      };
      return { now, hours };
    })
    .catch((e: unknown) => {
      const n = e as { name?: string };
      console.warn(`[weather] met.no ${lat},${lon}: ${n?.name ?? "ошибка"} за ${Date.now() - t0}мс`);
      return null;
    });
}

/** Резерв с одноразовым ретраем: первый в процессе HTTPS-вызов к met.no
 * (холодный DNS+TLS) иногда не успевает в 3.5с — второй проходит сразу. */
async function metNoPointRetry(lat: number, lon: number): Promise<{ now: WeatherNow; hours: WeatherHour[] } | null> {
  const first = await metNoPoint(lat, lon);
  if (first) return first;
  await new Promise((r) => setTimeout(r, 250));
  return metNoPoint(lat, lon);
}

/* ---------- GET ---------- */

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return Response.json(cache.data);
  }
  const disk = readDisk();
  if (disk && Date.now() - disk.at < TTL_MS) {
    // Свежая серия пережила рестарт сервера — не тратим квоту источников.
    cache = disk;
    return Response.json(disk.data);
  }

  const cities = flatCities();
  const data: FullWeather = {
    source: "none",
    via: "",
    viaCities: "",
    city: YUZHNO.name,
    now: null,
    hours: [],
    cities: [],
    updated: fmtStamp(new Date()),
  };

  // Основной источник: ЮС + 11 городов параллельно, каждый город — свой
  // 1-юнитный запрос (неудача одного города не роняет остальные).
  const [ysRaw, cityRaw] = await Promise.all([
    omGet(omYsUrl()),
    Promise.all(cities.map((c) => omGet(omCityUrl(c.lat, c.lon)))),
  ]);

  // Парсим ЮС из open-meteo.
  try {
    const d = ysRaw as {
      current?: Record<string, number | string>;
      hourly?: Record<string, Array<number | string>>;
    } | null;
    const cur = d?.current;
    const hr = d?.hourly;
    if (cur && typeof cur.temperature_2m === "number" && hr && Array.isArray(hr.time)) {
      const wind = (v: unknown) => (typeof v === "number" ? Math.round(v * 10) / 10 : 0);
      data.now = {
        temp: Math.round(cur.temperature_2m),
        feels: typeof cur.apparent_temperature === "number" ? Math.round(cur.apparent_temperature) : Math.round(cur.temperature_2m),
        code: typeof cur.weather_code === "number" ? cur.weather_code : 2,
        label: codeLabel(typeof cur.weather_code === "number" ? cur.weather_code : 2),
        hum: typeof cur.relative_humidity_2m === "number" ? Math.round(cur.relative_humidity_2m) : 0,
        press: typeof cur.surface_pressure === "number" ? hpaToMm(cur.surface_pressure) : 0,
        wind: wind(cur.wind_speed_10m),
        rumb: rumbFromDeg(typeof cur.wind_direction_10m === "number" ? cur.wind_direction_10m : NaN),
      };
      const idxs = todayHourIndexes(hr.time as string[], String(cur.time ?? ""));
      data.hours = idxs.map((i) => {
        const code = typeof hr.weather_code?.[i] === "number" ? (hr.weather_code![i] as number) : 2;
        return {
          time: String(hr.time![i]).slice(11, 16),
          temp: Math.round(Number(hr.temperature_2m?.[i] ?? 0)),
          feels: Math.round(Number(hr.apparent_temperature?.[i] ?? hr.temperature_2m?.[i] ?? 0)),
          hum: Math.round(Number(hr.relative_humidity_2m?.[i] ?? 0)),
          press: hpaToMm(Number(hr.surface_pressure?.[i] ?? 0)),
          wind: wind(hr.wind_speed_10m?.[i]),
          wdeg: typeof hr.wind_direction_10m?.[i] === "number" ? Math.round(hr.wind_direction_10m![i] as number) : null,
          rumb: rumbFromDeg(typeof hr.wind_direction_10m?.[i] === "number" ? (hr.wind_direction_10m![i] as number) : NaN),
          code,
          label: codeLabel(code),
        };
      });
      data.source = "live";
      data.via = "open-meteo.com";
    }
  } catch {
    // Честная деградация ЮС: выдуманных значений нет.
  }

  // Города из open-meteo: не ответивший город — null (потом «—»).
  const omCities = (cityRaw ?? []) as Array<{ current?: { temperature_2m?: number; weather_code?: number } } | null>;
  data.cities = cities.map((c, i) => {
    const e = omCities[i];
    const t = e?.current?.temperature_2m;
    return {
      name: c.name,
      group: c.group,
      temp: typeof t === "number" ? Math.round(t) : null,
      code: typeof e?.current?.weather_code === "number" ? e.current.weather_code : null,
    };
  });

  // РЕЗЕРВ met.no: достраиваем то, что open-meteo не дал.
  // ФИКС 2026-09-21 (задача «восстанови погоду по часам»): было if (!data.source) —
  // но source инициализирован строкой "none", поэтому резерв НЕ ЗАПУСКАЛСЯ никогда
  // (в т.ч. при исчерпанной дневной квоте open-meteo — hours оставались пустыми).
  // Проверяем фактическое наличие данных для ЮС.
  if (!data.now) {
    const mn = await metNoPointRetry(YUZHNO.lat, YUZHNO.lon);
    if (mn) {
      data.now = mn.now;
      data.hours = mn.hours;
      data.source = "live";
      data.via = "met.no (Yr)";
    }
  }
  const needIdx = data.cities.map((c, i) => (c.temp === null ? i : -1)).filter((i) => i >= 0);
  if (needIdx.length) {
    const mnTemps = await Promise.all(needIdx.map((i) => metNoPointRetry(cities[i].lat, cities[i].lon)));
    needIdx.forEach((idx, k) => {
      const t = mnTemps[k]?.now.temp;
      if (typeof t === "number") {
        data.cities[idx] = { ...data.cities[idx], temp: t };
        if (!data.viaCities) data.viaCities = "met.no (Yr)";
      }
    });
  }

  const anyCity = data.cities.some((c) => c.temp !== null);
  if (data.source === "live" || anyCity) {
    // Частичный сбор не затирает лучшие прошлые данные по городам.
    if (disk && disk.data.cities.length === data.cities.length) {
      data.cities = data.cities.map((c, i) => (c.temp === null ? disk.data.cities[i] : c));
    }
    cache = { at: Date.now(), data };
    // ФИКС 2026-09-21: на диск пишем ТОЛЬКО удачную серию ЮС (source live) —
    // иначе пустышка (now:null, hours:[]) затирала последнюю удачную и потом
    // сутки раздавалась по ветке STALE_MAX_MS вместо живых данных.
    if (data.source === "live") writeDisk(data);
    return Response.json(data);
  }

  // Оба источника молчат (например, исчерпана дневная квота open-meteo):
  // отдаём последнюю успешную серию с её собственным честным штампом
  // «обновлено» (максимум сутки) — либо честное пустое состояние.
  if (disk && Date.now() - disk.at < STALE_MAX_MS) {
    cache = disk;
    return Response.json(disk.data);
  }
  return Response.json(data);
}
