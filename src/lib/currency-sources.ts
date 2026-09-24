/**
 * ЗАДАЧА «Замена источника курсов» (2026-09-23): многоисточниковый
 * агрегатор наличных курсов касс банков Южно-Сахалинска. ПОЛНАЯ
 * замена прежнего парсера (src/lib/currency-parser.ts — kovalut.ru и
 * прямые сайты atb.su/primbank.ru/dolinskbank.ru — УДАЛЕНЫ).
 *
 * Цепочка ТЗ (по каждому банку/валюте, приоритет сверху вниз):
 *   1) Bankdep.ru  — основной: страницы города
 *      /currency/yuzhno-sahalinsk/{usd,eur,cny}, таблица
 *      #official_courses_tb («Банк / Покупка / Продажа / Обновление»).
 *      По данным сайта обновление с официальных ресурсов банков
 *      каждые 30 минут. Для Южно-Сахалинска per-bank таблицы у
 *      источника сегодня НЕТ (только архив ЦБ) — парсер честно
 *      возвращает «пусто» и подхватит таблицу, как только та
 *      появится (структура снята со страницы /currency/moskva/usd).
 *   2) Mainfin.ru  — дополнительный: сводная таблица банков города
 *      /currency/yuzhno-sahalinsk (USD/EUR/CNY у tr[data-bank-alias],
 *      значения в span[data-curse-val]) + /currency/jpy/yuzhno-sahalinsk
 *      (JPY за 100, data-curse-multi="100" — по сложившейся конвенции
 *      сайта per-100 значение хранится как есть) + THB:
 *      /currency/thb/yuzhno-sahalinsk (за 1 бат; по замеру 2026-09-23
 *      публикуют Приморье 27/28.4 и Совкомбанк 25.5/28.5).
 *   3) Banktop.ru  — резервный: /city/yuzhno-sahalinsk/kursy-valut/;
 *      обновление каждые 10 минут в рабочие дни. Страницы курсов
 *      касс для Южно-Сахалинска у источника сейчас нет (мягкий
 *      фолбэк на общую страницу ЦБ) — парсер распознаёт это и
 *      возвращает «пусто», не помечая источник ошибкой.
 *   4) Кэш БД (таблица CurrencyRate) — последнее успешное значение
 *      по каждой паре «банк + валюта» (пишется каждым успешным
 *      циклом агрегатора; чтение/статусы — в /api/home/rates).
 *
 * Каждая строка свежей серии хранит выигравший источник в поле
 * source («bankdep» / «mainfin» / «banktop»). Запуск: планировщик
 * src/instrumentation-node.ts (раз в 30 минут — темп обновления
 * основного источника), догрев в /api/home/rates, ручной прогрев —
 * POST /api/currency/parse.
 */

import { TARGET_BANKS, matchTargetBank } from "@/lib/currency-banks";

/** Валюты ТЗ: USD/EUR/CNY/THB — за 1, JPY/KRW — кассы ЮС (за 1000).
 *  THB (тайский бат, ТЗ 2026-09-23) — шестая колонка; в ЮС бат
 *  публикуют Приморье и Совкомбанк (Сбербанк — если начнёт). */
export const CURRENCIES = ["USD", "EUR", "CNY", "JPY", "KRW", "THB"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

/** Городской slug Южно-Сахалинска у всех трёх источников. */
export const CITY_SLUG = "yuzhno-sahalinsk";

/** Коды источников (поле source в БД + диагностика ответа API). */
export type SourceId = "bankdep" | "mainfin" | "banktop";
export const SOURCE_IDS: SourceId[] = ["bankdep", "mainfin", "banktop"];

export interface SourceRate {
  bank: string; // каноническое имя ТЗ (после matchTargetBank)
  currency: CurrencyCode;
  buy: number;
  sell: number | null; // null — источник отдал заглушку при живой покупке
  /** Штамп самого источника («23.09.2026 04:00») — для тултипов. */
  sourceStamp: string | null;
}

export interface SourceOutcome {
  ok: boolean; // страница(ы) источника отвечали и разбирались
  empty: boolean; // источник healthy, но курсов для города нет
  rows: SourceRate[];
  error?: string;
}

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.6",
};

const num = (s: string): number => {
  const v = parseFloat(String(s).replace(",", ".").replace(/\s/g, ""));
  return isFinite(v) ? v : NaN;
};

/** Санитарный фильтр значений: живые курсы касс — положительные и
 *  разумные по величине; «0» mainfin = «не публикуем». */
function validRate(v: number): boolean {
  return isFinite(v) && v > 0 && v < 10000;
}

/** Загрузка страницы с браузерными заголовками и таймаутом. */
async function getPage(url: string, timeoutMs = 20000): Promise<string> {
  const r = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

/* ------------------------------------------------------------------ */
/* 1) BANKDEP.RU — основной источник                                   */
/* ------------------------------------------------------------------ */

/** Строка per-bank таблицы bankdep (#official_courses_tb):
 *  <td class="offic_bank_title…"><a … data-bank="Авангард">Авангард</a></td>
 *  <td class="offic_curr_buy…"><span … data-course-value="86.00">…</span></td>
 *  <td class="offic_curr_sell…"><span … data-course-value="88.00">…</span></td>
 *  <td …>22.09.2026 19:00</td> (штамп достаётся из тела строки отдельно) */
const BANKDEP_ROW_RE =
  /class="offic_bank_title[^"]*">\s*<a[^>]*data-bank="([^"]+)"[\s\S]*?class="offic_curr_buy[^"]*">\s*<span[^>]*data-course-value="([0-9.,]+)"[\s\S]*?class="offic_curr_sell[^"]*">\s*<span[^>]*data-course-value="([0-9.,]+)"[\s\S]*?<\/tr>/g;
const BANKDEP_STAMP_RE = /(\d{2}\.\d{2}\.\d{4} \d{2}:\d{2})/;

/** Банкdep: страница города по каждой валюте → курсы банков ТЗ.
 *  Per-bank таблицы может не быть (Южно-Сахалинск сегодня) — тогда
 *  ok:true + empty:true (источник healthy, данных нет).
 *  ТЗ 2026-09-23: добавлен THB — страница города у bankdep есть
 *  (пустая per-bank таблица, как и по остальным валютам), парсер
 *  подхватит её, как только источник заполнит. */
export async function fetchBankdep(): Promise<SourceOutcome> {
  const rows: SourceRate[] = [];
  let pages = 0;
  for (const code of ["USD", "EUR", "CNY", "THB"] as const) {
    const url = `https://bankdep.ru/currency/${CITY_SLUG}/${code.toLowerCase()}`;
    let html: string;
    try {
      html = await getPage(url);
      pages++;
    } catch (e) {
      // 404 города/валюты — источник не публикует эту валюту для города
      const msg = e instanceof Error ? e.message : String(e);
      if (/HTTP 404/.test(msg)) continue;
      throw new Error(`bankdep.ru (${code}): ${msg}`);
    }
    if (!html.includes("official_courses_tb")) continue; // таблицы банков нет
    let m: RegExpExecArray | null;
    BANKDEP_ROW_RE.lastIndex = 0;
    while ((m = BANKDEP_ROW_RE.exec(html)) !== null) {
      const bank = matchTargetBank(m[1]);
      if (!bank) continue;
      const buy = num(m[2]);
      const sell = num(m[3]);
      if (!validRate(buy)) continue;
      rows.push({
        bank,
        currency: code,
        buy,
        sell: validRate(sell) && sell <= buy * 1.5 ? sell : null,
        sourceStamp: m[0].match(BANKDEP_STAMP_RE)?.[1] ?? null,
      });
    }
  }
  if (pages === 0) throw new Error("bankdep.ru: ни одна страница города не отвечает");
  return { ok: true, empty: rows.length === 0, rows };
}

/* ------------------------------------------------------------------ */
/* 2) MAINFIN.RU — дополнительный источник                             */
/* ------------------------------------------------------------------ */

/** Строка сводной таблицы mainfin: tr[data-bank-alias], имя банка в
 *  alt логотипа, значения в span#{alias}_{buy|sell}_{cur}
 *  data-curse-val="82", штамп в <div class="actual-currency">. */
const MAINFIN_ROW_RE =
  /<tr[^>]*data-bank-alias="([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/tr>/g;
const MAINFIN_CELL_RE = new RegExp(
  `id="([a-z0-9-]+)_(buy|sell)_(usd|eur|cny|jpy|krw|thb)"[^>]*data-curse-val="([0-9.,]+)"`,
  "g",
);
const MAINFIN_NAME_RE = /alt="([^"]+)"\s*data-url-img|data-url-img[^>]*alt="([^"]+)"/;
const MAINFIN_STAMP_RE = /class="actual-currency">([^<]+)</;

/** Mainfin: сводная страница города (USD/EUR/CNY) + страницы JPY и
 *  THB. JPY отдаётся за 100 единиц (data-curse-multi="100") — по
 *  сложившейся конвенции островной таблицы значение хранится как есть
 *  (per-100 под лейблом «за 1000», как прежние источники: 53.7 ≈ курс
 *  за ~1000¥). THB — за 1 бат (multi="1"), значения как есть.
 *  Страницы независимы: упавшая JPY/THB не рушит USD/EUR/CNY — ошибкой
 *  источник считается только если не ответила НИ ОДНА страница. */
export async function fetchMainfin(): Promise<SourceOutcome> {
  const pages = await Promise.allSettled([
    getPage(`https://mainfin.ru/currency/${CITY_SLUG}`),
    getPage(`https://mainfin.ru/currency/jpy/${CITY_SLUG}`),
    getPage(`https://mainfin.ru/currency/thb/${CITY_SLUG}`),
  ]);
  const htmls: string[] = [];
  for (const p of pages) {
    if (p.status === "fulfilled") htmls.push(p.value);
  }
  if (htmls.length === 0) {
    const msg = pages.find((p) => p.status === "rejected");
    const reason = msg && msg.status === "rejected" ? msg.reason : null;
    throw new Error(`mainfin.ru: ${reason instanceof Error ? reason.message : String(reason ?? "страницы города не отвечают")}`);
  }

  const rows: SourceRate[] = [];
  for (const html of htmls) {
    if (!html.includes("data-bank-alias")) continue; // не таблица курсов
    let m: RegExpExecArray | null;
    MAINFIN_ROW_RE.lastIndex = 0;
    while ((m = MAINFIN_ROW_RE.exec(html)) !== null) {
      const alias = m[1];
      const body = m[2];
      const nm = body.match(MAINFIN_NAME_RE);
      const rawName = nm?.[1] || nm?.[2] || alias;
      const bank = matchTargetBank(rawName) ?? matchTargetBank(alias);
      if (!bank) continue;
      const stamp = body.match(MAINFIN_STAMP_RE)?.[1]?.trim() ?? null;
      const vals: Record<string, { buy?: number; sell?: number }> = {};
      let c: RegExpExecArray | null;
      MAINFIN_CELL_RE.lastIndex = 0;
      while ((c = MAINFIN_CELL_RE.exec(body)) !== null) {
        // id: {alias}_{buy|sell}_{cur} — берём только ячейки этого банка
        if (c[1] !== alias) continue;
        const cur = c[3].toUpperCase() as CurrencyCode;
        const v = num(c[4]);
        if (!validRate(v)) continue;
        (vals[cur] ??= {})[c[2] as "buy" | "sell"] = v;
      }
      for (const code of CURRENCIES) {
        const v = vals[code];
        if (!v || v.buy === undefined) continue;
        rows.push({
          bank,
          currency: code,
          buy: v.buy,
          sell: v.sell !== undefined && v.sell <= v.buy * 1.5 ? v.sell : null,
          sourceStamp: stamp,
        });
      }
    }
  }
  return { ok: true, empty: rows.length === 0, rows };
}

/* ------------------------------------------------------------------ */
/* 3) BANKTOP.RU — резервный источник                                  */
/* ------------------------------------------------------------------ */

/** Банкtop: страница города /city/{city}/kursy-valut/. Сегодня для
 *  Южно-Сахалинска у источника страниц касс нет (неизвестный город
 *  мягко подменяется Москвой/ЦБ-страницей) — распознаём подмену по
 *  маркеру города и возвращаем «пусто». Если банкtop добавит город и
 *  таблицу банков (строки со ссылками /bank/{slug}/{city}/ и курсами),
 *  парсер подхватит их автоматически. */
export async function fetchBanktop(): Promise<SourceOutcome> {
  let html: string;
  try {
    html = await getPage(`https://banktop.ru/city/${CITY_SLUG}/kursy-valut/`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 404 — город не заведён: healthy-«пусто», а не ошибка источника
    if (/HTTP 404/.test(msg)) return { ok: true, empty: true, rows: [] };
    throw new Error(`banktop.ru: ${msg}`);
  }
  // Подмена города (фолбэк на Москву/ЦБ) — данных по городу нет.
  if (!html.toLowerCase().includes(CITY_SLUG)) {
    return { ok: true, empty: true, rows: [] };
  }
  // Универсальный разбор на будущее: строки таблиц с ссылкой на банк
  // города и парой чисел «покупка/продажа».
  const rows: SourceRate[] = [];
  const rowRe =
    /<tr[^>]*>[\s\S]*?href="\/bank\/([a-z0-9-]+)\/[^"]*"[\s\S]*?<\/tr>/g;
  const numRe = /(?:^|>)(\d{2,4}[.,]\d{1,2})(?:<|$)/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const body = m[0];
    const nums: number[] = [];
    let n: RegExpExecArray | null;
    numRe.lastIndex = 0;
    while ((n = numRe.exec(body)) !== null) nums.push(num(n[1]));
    if (nums.length < 2) continue;
    // banktop не даёт в строке код валюты — страница города всегда USD;
    // при появлении города таблица расширяется валютными страницами,
    // до тех пор трактуем первую пару как USD (актуализация при запуске).
    const bank = matchTargetBank(m[1]);
    if (!bank) continue;
    const buy = nums[0];
    const sell = nums[1];
    if (!validRate(buy)) continue;
    rows.push({
      bank,
      currency: "USD",
      buy,
      sell: validRate(sell) && sell <= buy * 1.5 ? sell : null,
      sourceStamp: null,
    });
  }
  return { ok: true, empty: rows.length === 0, rows };
}

/* ------------------------------------------------------------------ */
/* 4) Сборка: приоритет bankdep → mainfin → banktop + запись серии     */
/* ------------------------------------------------------------------ */

export interface AggregateOutcome {
  ok: boolean;
  count: number;
  /** Диагностика по каждому источнику (строки для логов/ответа API). */
  notes: string;
  perSource: Record<SourceId, { ok: boolean; empty: boolean; error?: string }>;
}

/** Один цикл агрегации: три источника параллельно → merge с
 *  приоритетом ТЗ → свежая серия в БД (source = выигравший источник).
 *  Серии старше 7 дней подчищаются. Полный сбой источников ошибкой НЕ
 *  считается (ok:true, count:0) — панель уйдёт на кэш. */
export async function runCurrencyAggregate(): Promise<AggregateOutcome> {
  const tasks: [SourceId, () => Promise<SourceOutcome>][] = [
    ["bankdep", fetchBankdep],
    ["mainfin", fetchMainfin],
    ["banktop", fetchBanktop],
  ];
  const settled = await Promise.allSettled(tasks.map(([, f]) => f()));

  const perSource = {} as Record<SourceId, { ok: boolean; empty: boolean; error?: string }>;
  const bySource = new Map<SourceId, SourceRate[]>();
  for (let i = 0; i < tasks.length; i++) {
    const id = tasks[i][0];
    const s = settled[i];
    if (s.status === "fulfilled") {
      perSource[id] = { ok: s.value.ok, empty: s.value.empty };
      bySource.set(id, s.value.rows);
      if (!s.value.ok) perSource[id] = { ok: false, empty: true, error: s.value.error };
    } else {
      const msg = s.reason instanceof Error ? s.reason.message : String(s.reason);
      perSource[id] = { ok: false, empty: true, error: msg };
      bySource.set(id, []);
    }
  }

  // Merge по приоритету ТЗ: по каждой паре «банк+валюта» первый
  // источник цепочки, у которого есть значение, забирает ячейку.
  const merged = new Map<string, { rate: SourceRate; source: SourceId }>();
  for (const id of SOURCE_IDS) {
    for (const r of bySource.get(id) ?? []) {
      const key = `${r.bank}|${r.currency}`;
      if (!merged.has(key)) merged.set(key, { rate: r, source: id });
    }
  }
  const rows = Array.from(merged.values());
  const notes = SOURCE_IDS.map((id) => {
    const p = perSource[id];
    const n = (bySource.get(id) ?? []).length;
    return p.ok ? `${id}: ${p.empty ? "нет курсов по городу" : `${n} курсов`}` : `${id}: ошибка (${p.error})`;
  }).join("; ");

  if (rows.length === 0) {
    return { ok: true, count: 0, notes, perSource };
  }

  const { db } = await import("@/lib/db");
  const batch = new Date();
  await db.currencyRate.createMany({
    data: rows.map(({ rate: r, source }) => ({
      batch,
      bank: r.bank,
      currency: r.currency,
      buy: r.buy,
      sell: r.sell,
      refreshedAt: null,
      source,
    })),
  });
  await db.currencyRate.deleteMany({
    where: { batch: { lt: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
  });
  return { ok: true, count: rows.length, notes, perSource };
}

/** Свежайшая серия из БД (null — агрегатор ещё ни разу не succeed'ился). */
export async function latestCurrencyBatch() {
  const { db } = await import("@/lib/db");
  const newest = await db.currencyRate.findFirst({
    orderBy: { batch: "desc" },
    select: { batch: true },
  });
  if (!newest) return null;
  const rows = await db.currencyRate.findMany({
    where: { batch: newest.batch },
    orderBy: [{ bank: "asc" }, { currency: "asc" }],
  });
  return rows;
}
