/**
 * 2026-10-24: реальное расписание транспорта Сахалина (3 источника).
 *   1) Авиа (Хомутово / UUS) — airportus.ru/board/ (онлайн-табло вылетов
 *      и прилётов, обновление ~30 минут; парсер берёт все строки с
 *      классом .board-table__row.depart / .arrived).
 *   2) Паромы (Холмск ↔ Ванино) — sasco.ru/service/ferry/ (блоки
 *      .voyage-block с приходами/отходами паромов «Сахалин-8/9/10»).
 *   3) ЖД (Сахалинская железная дорога) — travel65.ru/railway (полная
 *      таблица поездов и электропоездов с днями следования).
 *
 * Кеш в памяти: авиа — 30 мин, паромы — 60 мин, ЖД — 24 часа.
 * Если источник не ответил — отдаём пустой массив для секции (UI
 * покажет «нет данных», без ошибки). Деградация graceful: частичный
 * ответ лучше чем stub с выдуманными рейсами.
 *
 * Прежний stubData() сохранён как fallback на случай полного отказа
 * всех трёх источников (например, на стороне агрегаторов).
 */

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 30;
export const revalidate = 300;

interface TransportFlight {
  time: string;
  type: string;
  route: string;
  direction: string;
  status?: string;
  alert?: boolean;
}

interface TransportSection {
  id: "aviation" | "water" | "railway";
  emoji: string;
  title: string;
  flights: TransportFlight[];
}

interface TransportResponse {
  source: "live" | "stub" | "partial";
  note: string;
  sections: TransportSection[];
  updated?: string;
}

/* ===================== УТИЛИТЫ ===================== */

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.6",
};

async function getPage(url: string, timeoutMs = 15000): Promise<string> {
  const r = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

/** Кеш в памяти: { data, fetchedAt }. TTL — в минутах. */
interface CacheEntry<T> { data: T; fetchedAt: number; }
const g = globalThis as unknown as {
  __transportAviation?: CacheEntry<TransportFlight[]>;
  __transportWater?: CacheEntry<TransportFlight[]>;
  __transportRailway?: CacheEntry<TransportFlight[]>;
};

function isFresh(entry: { fetchedAt: number } | undefined, ttlMs: number): boolean {
  return !!entry && Date.now() - entry.fetchedAt < ttlMs;
}

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ===================== 1) АВИА — airportus.ru/board/ ===================== */

/** Парсит блоки .board-table__row.depart и .board-table__row.arrived.
 *  Структура строки: item--1 (номер), item--2 (логотип), item--3 (город),
 *  item--4 (время по расписанию), item--5 (фактическое), item--6 (статус). */
async function fetchAviation(): Promise<TransportFlight[]> {
  const html = await getPage("https://airportus.ru/board/");
  const flights: TransportFlight[] = [];

  // Регулярка: ловит всю строку от <div class="board-table__row (depart|arrived)"
  // до следующей такой же строки или конца списка.
  // Берём по одной строке за раз.
  const rowRe = /<div class="board-table__row (depart|arrived)(?:[^"]*)"[^>]*>([\s\S]*?)(?=<div class="board-table__row |<div class="board-table__row--head|$)/g;

  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const direction = m[1]; // "depart" или "arrived"
    const body = m[2];

    // Извлечь 6 ячеек item--N
    const items: string[] = [];
    for (let n = 1; n <= 6; n++) {
      const re = new RegExp(`board-table__item--${n}[^"]*"[^>]*>([\\s\\S]*?)</div>`, "");
      const im = body.match(re);
      // Очистить от тегов и &nbsp;
      const text = im
        ? im[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
        : "";
      items.push(text);
    }

    const code = items[0]; // "S7-6422" или "HZ-3034 SU-4666"
    const city = items[2]; // "Иркутск"
    const schedTime = (items[3].match(/\d{1,2}:\d{2}/) || [])[0] || "";
    const actualTime = (items[4].match(/\d{1,2}:\d{2}/) || [])[0] || "";
    const status = items[5]; // "Вылетел" / "Прибыл" / "Задержан до ..." / "В полёте"

    if (!code || !schedTime) continue;

    // Авиакомпания по префиксу кода рейса
    const airline = code.startsWith("SU")
      ? "Аэрофлот"
      : code.startsWith("HZ")
      ? "Аврора"
      : code.startsWith("S7")
      ? "S7 Airlines"
      : code.startsWith("FV")
      ? "Россия"
      : code.startsWith("IO")
      ? "ИрАэро"
      : code.startsWith("DP")
      ? "Победа"
      : "А/к";

    flights.push({
      time: schedTime,
      type: direction === "depart" ? "вылет" : "прилёт",
      route: `${airline} ${code.replace(/\s+/g, " ")}`,
      direction: direction === "depart" ? `Южно-Сахалинск → ${city}` : `${city} → Южно-Сахалинск`,
      status: status || undefined,
      alert: /задержан|отменён|отменен/i.test(status),
    });
  }

  // Сортировка по времени
  flights.sort((a, b) => a.time.localeCompare(b.time));
  return flights;
}

/* ===================== 2) ПАРОМЫ — sasco.ru/service/ferry/ ===================== */

/** Парсит блоки .voyage-block (Сахалин-8/9/10). Берёт только ОТХОДЫ
 *  (когда паром отправляется) — это самое важное для пассажиров.
 *  Структура: voyage-title (название), затем 4 пары port/action/date:
 *  Ванино/Приход/дата, Ванино/Отход/дата, Холмск/Приход/дата, Холмск/Отход/дата. */
async function fetchFerries(): Promise<TransportFlight[]> {
  const html = await getPage("https://www.sasco.ru/service/ferry/");
  const flights: TransportFlight[] = [];

  // Найти блок voyages-wrapper
  const wrapMatch = html.match(/<div class="voyages-wrapper">([\s\S]*?)<div class="block-columns-2 offset-top-80">/);
  if (!wrapMatch) return flights;
  const block = wrapMatch[1];

  // Разбить на voyage-block (по заголовкам)
  const blockRe = /<div class="voyage-block"[^>]*>([\s\S]*?)(?=<div class="voyage-block"|<\/div>\s*<\/div>\s*<\/div>\s*<div class="block-columns-2|$)/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(block)) !== null) {
    const body = m[1];

    // Название парома
    const titleM = body.match(/<div class="voyage-title">([^<]+)<\/div>/);
    if (!titleM) continue;
    const ferry = titleM[1].trim();

    // Все порты и действия
    const ports = [...body.matchAll(/<div class="port">([^<]+)<\/div>/g)].map((x) => x[1].trim());
    const actions = [...body.matchAll(/<div class="action">([^<]+)<\/div>/g)].map((x) => x[1].trim());
    const dates = [...body.matchAll(/<div class="date">([^<]+)<\/div>/g)].map((x) => x[1].trim());

    // Группируем по 4: для каждого порта 2 действия (Приход + Отход)
    // Структура: Ванино Приход, Ванино Отход, Холмск Приход, Холмск Отход
    for (let i = 0; i < ports.length; i++) {
      const port = ports[i];
      const action = actions[i] || "";
      const date = dates[i] || "";

      // Только отходы
      if (!/Отход/i.test(action)) continue;

      // Парсим дату "24.10.2026 17:00"
      const dm = date.match(/(\d{2}\.\d{2}\.\d{4})\s+(\d{1,2}:\d{2})/);
      if (!dm) continue;
      const dateStr = dm[1];
      const timeStr = dm[2];

      const direction = port === "Холмск" ? "Холмск → Ванино" : port === "Ванино" ? "Ванино → Холмск" : port;

      flights.push({
        time: timeStr,
        type: "отпр.",
        route: `Паром «${ferry}»`,
        direction,
        status: dateStr,
      });
    }
  }

  // Сортировка по дате+времени (DD.MM.YYYY HH:MM → YYYY-MM-DD HH:MM)
  flights.sort((a, b) => {
    const toSort = (s: string) => {
      const m = s.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
    };
    return (toSort(a.status || "") + " " + a.time).localeCompare(toSort(b.status || "") + " " + b.time);
  });
  return flights;
}

/* ===================== 3) ЖД — travel65.ru/railway ===================== */

/** Парсит таблицу с расписанием поездов Сахалинской железной дороги.
 *  Колонки: №, Откуда, Куда, Отправление (с днями), Прибытие. */
async function fetchRailway(): Promise<TransportFlight[]> {
  const html = await getPage("https://travel65.ru/railway/");
  const flights: TransportFlight[] = [];

  // Найти все строки таблицы <tr>...</tr>
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html)) !== null) {
    const tr = m[1];
    // Извлечь все <td>...</td>
    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) =>
      x[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
    );
    if (tds.length < 5) continue;

    const num = tds[0];
    const from = tds[1];
    const to = tds[2];
    const departureRaw = tds[3];
    const arrivalRaw = tds[4];

    // Пропустить заголовок
    if (!/^\d/.test(num)) continue;

    // Извлечь время отправления (первое HH:MM)
    const depTimeM = departureRaw.match(/\d{1,2}:\d{2}/);
    if (!depTimeM) continue;
    const depTime = depTimeM[0];

    // Дни следования — всё остальное после времени
    const days = departureRaw.replace(depTime, "").trim() || "ежедневно";

    // Тип: поезд (номер 3xx, 5xx, 6xx с буквой или без) или электропоезд (6xxx)
    const isTrain = /^(303|304|505|506|601|602|603|604)/.test(num);
    const typeLabel = isTrain ? "поезд" : "электропоезд";

    flights.push({
      time: depTime,
      type: "отпр.",
      route: `${typeLabel} №${num}`,
      direction: `${from} → ${to}`,
      status: days,
    });
  }

  // Сортировка по времени
  flights.sort((a, b) => a.time.localeCompare(b.time));
  return flights;
}

/* ===================== СТАРЫЙ STUB (fallback) ===================== */

function stubData(): TransportResponse {
  return {
    source: "stub",
    note: "Источники временно недоступны. Демонстрационные данные. Реальное время сверяйте у перевозчиков.",
    sections: [
      {
        id: "aviation",
        emoji: "✈️",
        title: "Авиа (Хомутово / UUS)",
        flights: [],
      },
      {
        id: "water",
        emoji: "🚢",
        title: "Водный транспорт (паромы Холмск — Ванино)",
        flights: [],
      },
      {
        id: "railway",
        emoji: "🚂",
        title: "ЖД (Сахалинская железная дорога)",
        flights: [],
      },
    ],
  };
}

/* ===================== GET ===================== */

export async function GET() {
  try {
    const TTL_AVIATION = 30 * 60 * 1000; // 30 минут
    const TTL_WATER = 60 * 60 * 1000; // 1 час
    const TTL_RAILWAY = 24 * 60 * 60 * 1000; // 24 часа

    // Параллельно получаем все 3 секции (используя кеш или свежие данные)
    const [aviation, water, railway] = await Promise.allSettled([
      (async () => {
        if (isFresh(g.__transportAviation, TTL_AVIATION)) return g.__transportAviation!.data;
        const data = await fetchAviation();
        g.__transportAviation = { data, fetchedAt: Date.now() };
        return data;
      })(),
      (async () => {
        if (isFresh(g.__transportWater, TTL_WATER)) return g.__transportWater!.data;
        const data = await fetchFerries();
        g.__transportWater = { data, fetchedAt: Date.now() };
        return data;
      })(),
      (async () => {
        if (isFresh(g.__transportRailway, TTL_RAILWAY)) return g.__transportRailway!.data;
        const data = await fetchRailway();
        g.__transportRailway = { data, fetchedAt: Date.now() };
        return data;
      })(),
    ]);

    const aviationFlights = aviation.status === "fulfilled" ? aviation.value : [];
    const waterFlights = water.status === "fulfilled" ? water.value : [];
    const railwayFlights = railway.status === "fulfilled" ? railway.value : [];

    // Все 3 пустые → fallback на stub с предупреждением
    const totalFlights = aviationFlights.length + waterFlights.length + railwayFlights.length;
    if (totalFlights === 0) {
      return NextResponse.json(stubData());
    }

    // Определить источник: все 3 ok → "live", иначе "partial"
    const allOk = aviation.status === "fulfilled" && water.status === "fulfilled" && railway.status === "fulfilled";
    const source: "live" | "partial" = allOk ? "live" : "partial";

    // Сформировать note
    const notes: string[] = [];
    if (aviation.status !== "fulfilled") notes.push("авиа: нет данных");
    if (water.status !== "fulfilled") notes.push("паромы: нет данных");
    if (railway.status !== "fulfilled") notes.push("ЖД: нет данных");
    const note = notes.length
      ? `Частично: ${notes.join(", ")}. Обновлено ${nowStamp()}.`
      : `Данные на ${nowStamp()}. Источники: airportus.ru, sasco.ru, travel65.ru.`;

    return NextResponse.json({
      source,
      note,
      updated: nowStamp(),
      sections: [
        { id: "aviation", emoji: "✈️", title: "Авиа (Хомутово / UUS)", flights: aviationFlights },
        { id: "water", emoji: "🚢", title: "Водный транспорт (паромы Холмск — Ванино)", flights: waterFlights },
        { id: "railway", emoji: "🚂", title: "ЖД (Сахалинская железная дорога)", flights: railwayFlights },
      ],
    } satisfies TransportResponse);
  } catch (e) {
    return handleApiError(e);
  }
}
