/**
 * СТАДИЯ 2 (Шаг 5): погода Южно-Сахалинска для панели «Погода на
 * Сахалине». Живые данные — открытый API open-meteo.com (без ключа),
 * геопривязка — Южно-Сахалинск; таймзония Asia/Sakhalin.
 * После Шага 5 панель «Погода на Сахалине» использует единый адаптивный
 * виджет meteoblue на всех ширинах (мобильный список дней удалён), поэтому
 * панель этот API больше не запрашивает — маршрут сохранён как задел под
 * будущую страницу /weather.php (подробный прогноз по районам острова).
 * Кеш в памяти 20 минут; при недоступности сети source:"none".
 * Ответ:
 * {
 *   source: "live" | "none",
 *   temp: number,              // текущая температура, °C
 *   label: string,             // «Переменная облачность», «Ясно», …
 *   city: "Южно-Сахалинск",
 *   days: [{ day: "Пн", date: "16.09", tmax, tmin, code, label }],
 *   updated: "15.09.2026 10:15"
 * }
 */

export const runtime = "nodejs";

const LAT = 46.9591;
const LON = 142.738;
const CITY = "Южно-Сахалинск";
const TTL_MS = 20 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3500;
const DAYS = 7;

/** Открытый метеокод open-meteo → короткая русская подпись. */
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

/** Короткое имя дня недели с большой буквы: «Пн». */
function dayLabel(iso: string): string {
  const s = new Date(`${iso}T12:00:00`);
  const w = s.toLocaleDateString("ru-RU", { weekday: "short" });
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** «16.09» для плотной строки мобильного списка. */
function dateLabel(iso: string): string {
  const s = new Date(`${iso}T12:00:00`);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(s.getDate())}.${p(s.getMonth() + 1)}`;
}

let cache: { at: number; data: Record<string, unknown> } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return Response.json(cache.data);
  }
  try {
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
    const data = {
      source: "live",
      temp: Math.round(d.current.temperature_2m!),
      label: codeLabel(d.current.weather_code ?? 2),
      city: CITY,
      days,
      updated: fmtStamp(new Date()),
    };
    cache = { at: Date.now(), data };
    return Response.json(data);
  } catch {
    // Честная деградация: без выдуманных значений. Десктопную панель это
    // не затрагивает (там iframe-виджет), мобильный список просто не
    // отрисуется; кеш не пишем, чтобы живые данные пришли сразу.
    return Response.json({ source: "none", city: CITY, days: [], updated: "" });
  }
}
