/**
 * СТАДИЯ 2 (Шаг 5): погода Южно-Сахалинска для панели «Погода на
 * Сахалине». Живые данные — открытый API open-meteo.com (без ключа),
 * геопривязка — Южно-Сахалинск; таймзония Asia/Sakhalin.
 * 
 * 2026-10-21: open-meteo.com стал недоступен с сервера (таймаут).
 * Добавлен fallback на met.no (api.met.no locationforecast/2.0/compact),
 * который работает стабильно. Если open-meteo не отвечает за 5 сек —
 * используется met.no.
 */

export const runtime = "nodejs";

const LAT = 46.9591;
const LON = 142.738;
const CITY = "Южно-Сахалинск";
const TTL_MS = 20 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const DAYS = 7;

function codeLabel(code: number): string {
  if (code === 0) return "Ясно";
  if (code <= 2) return "Переменная облачность";
  if (code === 3) return "Облачно";
  if (code === 45 || code === 48) return "Туман";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "Дождь";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Снег";
  if (code >= 95) return "Гроза";
  return "Переменная облачность";
}

function fmtStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function dayLabel(iso: string): string {
  const s = new Date(`${iso}T12:00:00`);
  const w = s.toLocaleDateString("ru-RU", { weekday: "short" });
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function dateLabel(iso: string): string {
  const s = new Date(`${iso}T12:00:00`);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(s.getDate())}.${p(s.getMonth() + 1)}`;
}

let cache: { at: number; data: Record<string, unknown> } | null = null;

/** Получить прогноз от open-meteo.com (основной источник). */
async function fetchOpenMeteo(): Promise<Record<string, unknown>> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&timezone=Asia%2FSakhalin&forecast_days=${DAYS}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
  if (!r.ok) throw new Error(String(r.status));
  const d = (await r.json()) as {
    current?: { temperature_2m?: number; weather_code?: number };
    daily?: { time?: string[]; weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[] };
  };
  if (typeof d.current?.temperature_2m !== "number" || !d.daily?.time?.length) throw new Error("bad payload");
  const days = d.daily.time.slice(0, DAYS).map((iso, i) => {
    const code = d.daily!.weather_code![i] ?? 2;
    return {
      day: dayLabel(iso),
      date: dateLabel(iso),
      tmax: Math.round(d.daily!.temperature_2m_max![i]),
      tmin: Math.round(d.daily!.temperature_2m_min![i]),
      code,
      label: codeLabel(code),
    };
  });
  return {
    source: "live",
    temp: Math.round(d.current.temperature_2m!),
    label: codeLabel(d.current.weather_code ?? 2),
    city: CITY,
    days,
    updated: fmtStamp(new Date()),
  };
}

/** Получить прогноз от met.no (fallback). */
async function fetchMetNo(): Promise<Record<string, unknown>> {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${LAT}&lon=${LON}`;
  const r = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
    headers: { "User-Agent": "SakhMatrix/1.0 contact@sakhmatrix.ru" },
  });
  if (!r.ok) throw new Error(String(r.status));
  const d = (await r.json()) as {
    properties?: { timeseries?: Array<{ time: string; data?: { instant?: { details?: { air_temperature?: number; wind_speed?: number } }; next_1_hours?: { summary?: { symbol_code?: string } }; next_6_hours?: { summary?: { symbol_code?: string } } } }> };
  };
  const ts = d.properties?.timeseries;
  if (!ts || ts.length === 0) throw new Error("bad met.no payload");

  // Текущая температура
  const current = ts[0];
  const temp = Math.round(current.data?.instant?.details?.air_temperature ?? 0);

  // Группировка по дням — берём max/min температуры
  const dayMap: Record<string, { tmax: number; tmin: number; symbol: string }> = {};
  for (const t of ts) {
    const date = t.time.substring(0, 10);
    const tval = t.data?.instant?.details?.air_temperature;
    if (typeof tval !== "number") continue;
    if (!dayMap[date]) dayMap[date] = { tmax: tval, tmin: tval, symbol: "partlycloudy_day" };
    dayMap[date].tmax = Math.max(dayMap[date].tmax, tval);
    dayMap[date].tmin = Math.min(dayMap[date].tmin, tval);
    const sym = t.data?.next_1_hours?.summary?.symbol_code || t.data?.next_6_hours?.summary?.symbol_code;
    if (sym) dayMap[date].symbol = sym;
  }

  // met.no symbol_code → WMO code (упрощённо)
  function symbolToCode(sym: string): number {
    if (sym.includes("clearsky")) return 0;
    if (sym.includes("fair")) return 1;
    if (sym.includes("partlycloudy")) return 2;
    if (sym.includes("cloudy")) return 3;
    if (sym.includes("fog")) return 45;
    if (sym.includes("rain")) return 61;
    if (sym.includes("snow")) return 71;
    if (sym.includes("thunder")) return 95;
    return 2;
  }

  const dates = Object.keys(dayMap).slice(0, DAYS);
  const days = dates.map((iso) => {
    const info = dayMap[iso];
    const code = symbolToCode(info.symbol);
    return {
      day: dayLabel(iso),
      date: dateLabel(iso),
      tmax: Math.round(info.tmax),
      tmin: Math.round(info.tmin),
      code,
      label: codeLabel(code),
    };
  });

  const currentSymbol = current.data?.next_1_hours?.summary?.symbol_code || "partlycloudy_day";
  const currentCode = symbolToCode(currentSymbol);

  return {
    source: "live",
    temp,
    label: codeLabel(currentCode),
    city: CITY,
    days,
    updated: fmtStamp(new Date()),
  };
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return Response.json(cache.data);
  }
  try {
    // Основной источник — open-meteo
    const data = await fetchOpenMeteo();
    cache = { at: Date.now(), data };
    return Response.json(data);
  } catch {
    // Fallback — met.no
    try {
      const data = await fetchMetNo();
      cache = { at: Date.now(), data };
      return Response.json(data);
    } catch {
      // Оба источника недоступны
      const data = {
        source: "none",
        city: CITY,
        days: [],
        updated: "",
      };
      return Response.json(data);
    }
  }
}
