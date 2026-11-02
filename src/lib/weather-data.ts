/**
 * Шаг 10: общие данные и математика погодного сервиса /weather.php.
 *
 *  — СЕТКА РАЙОНОВ (ТЗ): текущая температура по ключевым городам
 *    области, разбитым по географии — Юг (Корсаков, Холмск, Анива,
 *    Невельск), Центр (Поронайск, Смирных, Углегорск), Север
 *    (Ноглики, Оха), Курилы (Южно-Курильск, Курильск). Координаты —
 *    общепринятые географические центры городов. Данные — открытый
 *    бесплатный API open-meteo.com (без ключа, стабильно доступен
 *    из этой песочницы — прецедент api/home/weather Шага 5).
 *  — Математика для развёрнутого виджета Южно-Сахалинска (ТЗ):
 *    почасовой прогноз на сегодня, влажность, атмосферное давление
 *    и направление ветра.
 *
 * Модуль чистый (без node-зависимостей) — покрывается юнит-тестами
 * scripts/test-informers.ts (секция Шага 10).
 */

export interface CityPoint {
  name: string;
  lat: number;
  lon: number;
}

export interface CityGroup {
  label: string;
  cities: CityPoint[];
}

/** Город виджета (развёрнутый блок — только Южно-Сахалинск, ТЗ). */
export const YUZHNO = { name: "Южно-Сахалинск", lat: 46.9591, lon: 142.738 };

/** ТЗ: четыре географические группы, порядок городов — как в ТЗ. */
export const CITY_GROUPS: CityGroup[] = [
  {
    label: "Юг",
    cities: [
      { name: "Корсаков", lat: 46.634, lon: 142.782 },
      { name: "Холмск", lat: 47.049, lon: 142.051 },
      { name: "Анива", lat: 46.405, lon: 143.166 },
      { name: "Невельск", lat: 46.362, lon: 141.863 },
    ],
  },
  {
    label: "Центр",
    cities: [
      { name: "Поронайск", lat: 49.228, lon: 143.101 },
      { name: "Смирных", lat: 49.759, lon: 142.923 },
      { name: "Углегорск", lat: 49.082, lon: 142.019 },
    ],
  },
  {
    label: "Север",
    cities: [
      { name: "Ноглики", lat: 51.798, lon: 143.388 },
      { name: "Оха", lat: 53.587, lon: 142.952 },
    ],
  },
  {
    label: "Курилы",
    cities: [
      { name: "Южно-Курильск", lat: 44.032, lon: 145.867 },
      { name: "Курильск", lat: 45.231, lon: 147.895 },
    ],
  },
];

/** Плоский список городов с группой — для мульти-запроса open-meteo. */
export function flatCities(): Array<CityPoint & { group: string }> {
  return CITY_GROUPS.flatMap((g) => g.cities.map((c) => ({ ...c, group: g.label })));
}

/**
 * Метеокод open-meteo (WMO) → короткая русская подпись. Функция та же,
 * что в api/home/weather (Шаг 5, файл не трогаем — там свой экземпляр);
 * здесь она нужна подписям развёрнутого виджета и hourly-ячеек.
 */
export function codeLabel(code: number): string {
  if (code === 0) return "Ясно";
  if (code <= 2) return "Переменная облачность";
  if (code === 3) return "Облачно";
  if (code === 45 || code === 48) return "Туман";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "Дождь";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Снег";
  if (code >= 95) return "Гроза";
  return "Переменная облачность";
}

/** Давление open-meteo (гПа) → привычные мм рт. ст. */
export function hpaToMm(hpa: number): number {
  return Math.round(hpa * 0.750062);
}

/** 8-румбовое направление ветра по градусам (метеорологическое: ОТКУДА дует). */
const RUMBS = ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"];
export function rumbFromDeg(deg: number): string {
  if (!Number.isFinite(deg)) return "—";
  const idx = Math.round(deg / 45) % 8;
  return RUMBS[(idx + 8) % 8];
}

/**
 * Почасовая серия «на сегодня»: индексы часов от текущего часа
 * (локальное время open-meteo, таймзона Asia/Sakhalin — сервер только
 * сравнивает ISO-строки, ничего не конвертирует). Прошедшие часы дня
 * в «почасовом прогнозе» не показываются.
 */
export function todayHourIndexes(times: string[], nowLocalIso: string): number[] {
  if (!nowLocalIso) return [];
  const hh = nowLocalIso.slice(0, 13); // «2026-09-16T14»
  const out: number[] = [];
  (times ?? []).forEach((t, i) => {
    if (typeof t === "string" && t.slice(0, 13) >= hh) out.push(i);
  });
  return out;
}

/**
 * Резервный источник (met.no/Yr.no): символ погоды → русская подпись.
 * Маппинг в тот же набор ярлыков, что у метеокодов open-meteo; порядок
 * проверок важен: «rainandthunder» — гроза, а не дождь.
 */
export function metSymbolLabel(symbol: string | undefined): string {
  const s = (symbol ?? "").toLowerCase();
  if (!s) return "Переменная облачность";
  if (s.startsWith("clearsky")) return "Ясно";
  if (s.includes("thunder")) return "Гроза";
  if (s.includes("snow") || s.includes("sleet")) return "Снег";
  if (s.includes("rain")) return "Дождь";
  if (s.startsWith("fog")) return "Туман";
  if (s === "cloudy") return "Облачно";
  return "Переменная облачность"; // fair, partlycloudy
}

/** Сдвиг таймзоны Asia/Sakhalin (UTC+11) в миллисекундах. */
export const SAKHALIN_OFFSET_MS = 11 * 3600 * 1000;

/** Локальная дата «YYYY-MM-DD» и время «HH:MM» (Сахалин) из ISO-UTC. */
export function sakhalinLocal(isoUtc: string): { date: string; hh: string } {
  const shifted = new Date(new Date(isoUtc).getTime() + SAKHALIN_OFFSET_MS);
  const iso = shifted.toISOString();
  return { date: iso.slice(0, 10), hh: iso.slice(11, 16) };
}

/** Сегодняшняя дата на Сахалине (для фильтра «почасовой на сегодня»). */
export function sakhalinToday(): string {
  return new Date(Date.now() + SAKHALIN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Развёрнутый виджет: текущие условия. */
export interface WeatherNow {
  temp: number;
  feels: number;
  code: number;
  label: string;
  hum: number;
  press: number; // мм рт. ст.
  wind: number; // м/с
  rumb: string;
}

/** Почасовая ячейка «на сегодня».
 *  2026-09-19 (редизайн почасового прогноза): добавлены feels —
 *  ощущаемая температура для панели деталей по клику (met.no compact
 *  ощущаемой не имеет — берём фактическую, как в WeatherNow) и wdeg —
 *  метеорологические градусы ветра (ОТКУДА дует) для поворота стрелки. */
export interface WeatherHour {
  time: string; // «14:00»
  temp: number;
  feels: number;
  hum: number;
  press: number; // мм рт. ст.
  wind: number; // м/с
  wdeg: number | null;
  rumb: string;
  code: number;
  label: string;
}

/** Город сетки районов. */
export interface CityTemp {
  name: string;
  group: string;
  temp: number | null;
  code: number | null;
}

/** Ответ /api/weather/full. */
export interface FullWeather {
  source: "live" | "none";
  /** Источник развёрнутого виджета — для честного штампа («open-meteo.com» / «met.no (Yr)»). */
  via: string;
  /** Источник сетки районов, если отличался; «» — совпадает с via. */
  viaCities: string;
  city: string;
  now: WeatherNow | null;
  hours: WeatherHour[];
  cities: CityTemp[];
  updated: string;
}
