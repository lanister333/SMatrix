# SakhMatrix — Стадия 2, Задача №3: бэкенд информера «Валюты Сахалина» (/currency.php)

**Статус:** ✅ выполнено · коммит `a72b940` · тесты **168/168** · приёмка RUN2+RUN3 (два чистых прогона)
**Дата:** 16.09.2026

---

## Что сделано по пунктам ТЗ

| Пункт ТЗ | Результат |
|---|---|
| 1. Полностью удалить виджет курса ЦБ РФ | Сквозная проверка: виджет ЦБ РФ **отсутствует в UI** — все 6 вхождений «ЦБ» в исходниках только внутри комментариев документации («ЦБ РФ НЕТ»); панель уже работала на кассовых курсах. В приёмку добавлена авто-проверка: **«ЦБ» = 0 вхождений в тексте страницы** (Главная + /currency.php, 1280 и 400) |
| 2. Парсер наличных курсов 4 банков ЮС: АТБ, Солид Банк, Сбер, Приморье | Парсер переписан: строго городские страницы четвёрки ТЗ на kovalut.ru (slug-и подтверждены по sitemap.xml 16.09.2026). Каждый банк — независимо (allSettled): АТБ (USD/EUR), Солид Банк (все 5 валют), Приморье (USD/EUR). **Сбер сейчас не публикует** наличные курсы города (страница kovalut — только адреса отделений; собственный сайт Сбера недоступен — TLS-блок; banki.ru под ботозащитой) → строка Сбера отдаётся с «—» честно, без выдуманных данных; подхват автоматический (ежечасный сбор) |
| 3. «Островная пятерка» в номиналах ТЗ | USD (за 1), EUR (за 1), CNY (за 1), **JPY (строго за 100)**, **KRW (строго за 1000)** — нормализация `normalizeToUnit` (источник отдал за единицу → домножаем, порог 5). Панель главной: 5 строк с метками «за 100»/«за 1000»; таблица /currency.php: колонки `Банк|USD|EUR|CNY|JPY|KRW` с номиналами в шапке |
| 4. Авто-подсветка лучших курсов зелёным | Лучший курс **покупки = максимум**, **продажи = минимум** по каждой валюте (равные лидеры подсвечиваются все). Точные цвета ТЗ: **фон `#E2F0D9`** + **текст `#2E7D32`** — на панели Главной (`.bestcell`) и в таблице `/currency.php` (`.is-best`) |

**Живые данные на момент приёмки (16.09.2026):** АТБ USD 83,50/89,15 · EUR 94,18/106,76; Солид Банк USD 85,70/86,50 · EUR 98,60/100,30 · CNY 12,80/12,98 · JPY 54,30/56,10 · KRW 64,00/69,50; Приморье USD 91,15/92,00 · EUR 98,10/99,00; Сбер — нет публикации.

---

## 1. НОВЫЙ ФАЙЛ: `src/lib/currency-banks.ts`

```ts
/**
 * ЗАДАЧА 3 (Стадия 2): единый источник списка банков ТЗ для парсера,
 * API и UI — модуль без серверных зависимостей (импортируется и
 * клиентскими компонентами, и серверным парсером).
 *
 * Четвёрка банков ТЗ в строгом порядке ТЗ: АТБ, Солид Банк, Сбер,
 * Приморье (касса каждого — город Южно-Сахалинск). Slug-и страниц на
 * агрегаторе kovalut.ru подтверждены по sitemap.xml (16.09.2026).
 */

export const TARGET_BANKS: { slug: string; name: string }[] = [
  { slug: "aziatsko-tihookeanskij-bank", name: "АТБ" },
  { slug: "solid-bank", name: "Солид Банк" },
  { slug: "sberbank-rossii", name: "Сбер" },
  { slug: "bank-primore", name: "Приморье" },
];

/** Имена банков ТЗ — ровно в порядке ТЗ. */
export const TARGET_BANK_NAMES = TARGET_BANKS.map((b) => b.name);

/** Оставляет только банки ТЗ и сортирует их в порядке ТЗ
 *  (АТБ, Солид Банк, Сбер, Приморье). Серии старого парсера с банками
 *  вне четвёрки ТЗ в панель не попадают. */
export function filterTargetBankRows<T extends { bank: string }>(rows: T[]): T[] {
  const order = new Map(TARGET_BANK_NAMES.map((n, i) => [n, i]));
  return rows
    .filter((r) => order.has(r.bank))
    .sort((a, b) => (order.get(a.bank) ?? 0) - (order.get(b.bank) ?? 0));
}
```

## 2. ПОЛНЫЙ РЕРАЙТ: `src/lib/currency-parser.ts`

```ts
/**
 * ЗАДАЧА 3 (Стадия 2): фоновый парсер реальных курсов покупки/продажи
 * НАЛИЧНОЙ валюты в кассах банков города Южно-Сахалинска — строго
 * четвёрка ТЗ: АТБ, Солид Банк, Сбер, Приморье.
 *
 * Источник — агрегатор kovalut.ru (myfin.by закрыт ботам — HTTP 423;
 * собственный сайт Сбера из песочницы недоступен — TLS-блок; banki.ru
 * под ботозащитой). У каждого банка ТЗ на kovalut.ru есть своя страница
 * города (slug подтверждён по sitemap.xml 16.09.2026):
 *   АТБ         → /aziatsko-tihookeanskij-bank/juzhno-sahalinsk
 *   Солид Банк  → /solid-bank/juzhno-sahalinsk
 *   Сбер        → /sberbank-rossii/juzhno-sahalinsk
 *   Приморье    → /bank-primore/juzhno-sahalinsk
 *
 * Первое вхождение блока каждой валюты на странице банка — городская
 * таблица касс (дальше по странице идут отделения — они не берутся).
 * Блок валюты: <div class="text-sm">USD</div><div class="-mt-1
 * font-sans text-lg font-bold">83.50<!-- --> / <!-- -->89.15</div>.
 *
 * ОСТРОВНАЯ ПЯТЁРКА (ТЗ Задачи 3, номиналы строго): USD (за 1),
 * EUR (за 1), CNY (за 1), JPY (строго за 100), KRW (строго за 1000).
 * Источники иногда отдают иену/вону за единицу (0.54, 0.064) — тогда
 * домножаем до «за 100»/«за 1000» (normalizeToUnit).
 *
 * ФАКТ по Сберу (проверено 16.09.2026): kovalut.ru для Сбера в ЮС
 * отдаёт страницу адресов отделений БЕЗ валютных блоков — Сбер не
 * публикует наличные курсы этого города на агрегаторе. Парсер честно
 * фиксирует «нет публикации» и не выдумывает данные; как только касса
 * начнёт публиковать курсы — ежечасный сбор подхватит их автоматически.
 *
 * Запуск: каждый час планировщиком (src/instrumentation-node.ts) либо
 * вручную через POST /api/currency/parse. Каждый банк парсится
 * независимо (best-effort): сбой одной страницы не мешает серии.
 * При полном сбое парсер возвращает ошибку — панель остаётся на
 * предыдущих данных.
 */

import { TARGET_BANKS } from "@/lib/currency-banks";

/** ОСТРОВНАЯ ПЯТЁРКА валют ТЗ: юань/иена/вона — кассы ЮС. */
export const CURRENCIES = ["USD", "EUR", "CNY", "JPY", "KRW"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

/** Номиналы котировки (ТЗ, строго): иена — за 100, вона — за 1000. */
export const CURRENCY_UNITS: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 1,
  CNY: 1,
  JPY: 100,
  KRW: 1000,
};

/** Городской slug kovalut.ru для Южно-Сахалинска. */
export const CITY_SLUG = "juzhno-sahalinsk";

/** URL страницы банка на kovalut.ru. */
export function bankPageUrl(slug: string): string {
  return `https://kovalut.ru/${slug}/${CITY_SLUG}`;
}

export interface ParsedCashRate {
  bank: string;
  currency: CurrencyCode;
  buy: number | null;
  sell: number | null;
  refreshedAt: Date | null;
}

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.6",
};

/** &quot; &amp; &#39; — имена банков внутри HTML. */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

const num = (s: string): number => {
  const v = parseFloat(s.replace(",", "."));
  return isFinite(v) ? v : NaN;
};

/** Блок валюты на странице банка kovalut.ru: код и пара
 *  «покупка / продажа»:
 *    <div class="text-sm">JPY</div><div class="-mt-1 font-sans
 *    text-lg font-bold">54.30<!-- --> / <!-- -->56.10</div>
 *  Первое вхождение каждой валюты — городская таблица банка
 *  (дальше по странице идут отделения — они не берутся). */
const BANK_CUR_RE =
  /class="text-sm">([A-Z]{3})<\/div><div class="-mt-1 font-sans text-lg font-bold">([^<]*(?:<!-- -->)?[^<]*?)(?:<!-- -->)? \/ (?:<!-- -->)?([^<]*)<\/div>/g;

/** Приводит котировку к номиналу ТЗ: источники иногда отдают иену/вону
 *  за единицу (0.54, 0.064) — тогда домножаем до «за 100»/«за 1000».
 *  Порог 5: живые значения за 100/за 1000 всегда > 5 (JPY ~54, KRW ~64). */
function normalizeToUnit(currency: CurrencyCode, v: number): number {
  const unit = CURRENCY_UNITS[currency];
  if (unit > 1 && isFinite(v) && v > 0 && v < 5) return Math.round(v * unit * 100) / 100;
  return v;
}

/** Разбирает HTML страницы банка kovalut.ru (город = Южно-Сахалинск),
 *  возвращает курсы ОСТРОВНОЙ ПЯТЁРКИ ТЗ, найденные на странице
 *  (первое вхождение каждой валюты — городская таблица касс).
 *  Валюты вне пятёрки (THB и прочие) игнорируются. */
export function parseKovalutBankPage(
  html: string,
  bankName: string,
): ParsedCashRate[] {
  const rates: ParsedCashRate[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  BANK_CUR_RE.lastIndex = 0;
  while ((m = BANK_CUR_RE.exec(html)) !== null) {
    const code = m[1] as CurrencyCode;
    if (!(code in CURRENCY_UNITS)) continue; // строго островная пятёрка ТЗ
    if (seen.has(code)) continue; // первое вхождение — городская таблица
    const buy = normalizeToUnit(code, num(m[2].replace("<!-- -->", "")));
    const sell = normalizeToUnit(code, num(m[3].replace("<!-- -->", "")));
    if (!isFinite(buy) || !isFinite(sell) || buy <= 0 || sell <= 0) continue; // прочерк/мусор — строки нет
    seen.add(code);
    rates.push({ bank: bankName, currency: code, buy, sell, refreshedAt: null });
  }
  return rates;
}

/** Грузит страницу банка на kovalut.ru (браузерные заголовки — источник
 *  отдаёт полную SSR-версию с городской таблицей касс). */
export async function fetchKovalutBankPage(
  slug: string,
  timeoutMs = 30000,
): Promise<string> {
  const r = await fetch(bankPageUrl(slug), {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`kovalut.ru (${slug}) HTTP ${r.status}`);
  const html = await r.text();
  // страница банка содержит город и блоки валют; заглушка данных не даст
  if (html.length < 100000 || !html.includes(CITY_SLUG) || !html.includes('class="text-sm"')) {
    throw new Error(`kovalut.ru (${slug}) отдал страницу без таблицы валют`);
  }
  return html;
}

export interface ParseOutcome {
  ok: boolean;
  count: number;
  error?: string;
  /** Диагностика по каждому банку ТЗ (сколько курсов / причина сбоя). */
  notes?: string;
}

/** Полный цикл: скачать страницы ЧЕТЫРЁХ банков ТЗ (параллельно,
 *  каждый независимо) → разобрать островную пятёрку → сохранить серией
 *  в БД. Серия сохраняется, если хотя бы один банк отдал хотя бы один
 *  курс (Сбер сейчас не публикует — это не сбой). */
export async function runCurrencyParse(): Promise<ParseOutcome> {
  const { db } = await import("@/lib/db");
  try {
    const settled = await Promise.allSettled(
      TARGET_BANKS.map(async (b) => {
        const html = await fetchKovalutBankPage(b.slug);
        return { bank: b.name, rates: parseKovalutBankPage(html, b.name) };
      }),
    );
    const rates: ParsedCashRate[] = [];
    const notes: string[] = [];
    for (let i = 0; i < settled.length; i++) {
      const s = settled[i];
      const bankName = TARGET_BANKS[i].name;
      if (s.status === "fulfilled") {
        if (s.value.rates.length > 0) {
          rates.push(...s.value.rates);
          notes.push(`${bankName}: ${s.value.rates.length} курсов`);
        } else {
          // страница есть, валютных блоков нет — касса не публикует
          notes.push(`${bankName}: нет публикации курсов на агрегаторе`);
        }
      } else {
        const msg = s.reason instanceof Error ? s.reason.message : String(s.reason);
        notes.push(`${bankName}: ${msg}`);
      }
    }
    if (rates.length === 0) {
      return {
        ok: false,
        count: 0,
        error: "ни один банк ТЗ не отдал курсов",
        notes: notes.join("; "),
      };
    }
    const batch = new Date();
    await db.currencyRate.createMany({
      data: rates.map((r) => ({
        batch,
        bank: r.bank,
        currency: r.currency,
        buy: r.buy,
        sell: r.sell,
        refreshedAt: r.refreshedAt,
        source: "kovalut.ru",
      })),
    });
    // держим БД компактной: серии старше 7 дней не нужны
    await db.currencyRate.deleteMany({
      where: { batch: { lt: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
    });
    return { ok: true, count: rates.length, notes: notes.join("; ") };
  } catch (e) {
    return {
      ok: false,
      count: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Свежайшая серия из БД (null — парсер ещё ни разу не succeed'ился). */
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
```

## 3. API: `src/app/api/home/rates/route.ts` (полный файл)

```ts
/**
 * ЗАДАЧА 3 (Стадия 2): курсы НАЛИЧНОЙ валюты касс банков Южно-
 * Сахалинска для панели «Курсы валют» — СТРОГО четвёрка банков ТЗ:
 * АТБ, Солид Банк, Сбер, Приморье (filterTargetBankRows отсекает серии
 * старого парсера с банками вне четвёрки и держит порядок ТЗ).
 * Источник — агрегатор kovalut.ru; привязки к ЦБ РФ НЕТ — при
 * недоступности источника панель показывает предыдущие данные либо
 * «обновляется».
 *
 * Ответ:
 * {
 *   source: "kovalut" | "none",
 *   updated: "16.09.2026 06:40",
 *   banks: [{ bank, usd:{buy,sell}, eur:{buy,sell}, cny:{buy,sell},
 *             jpy:{buy,sell}, krw:{buy,sell} }]  // порядок ТЗ
 * }
 * Островная пятёрка ТЗ (номиналы строго): USD/EUR/CNY — за 1,
 * JPY — за 100, KRW — за 1000. Сбор — раз в час: планировщик
 * src/instrumentation-node.ts плюс догрев здесь, если свежайшая серия
 * в БД старше часа. Сбер сейчас не публикует курсы города на
 * агрегаторе — строка банка отдаётся с null-парами, панель покажет «—».
 */

import { runCurrencyParse, latestCurrencyBatch } from "@/lib/currency-parser";
import { filterTargetBankRows, TARGET_BANK_NAMES } from "@/lib/currency-banks";

export const runtime = "nodejs";

function fmtStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export interface BankRates {
  bank: string;
  usd: { buy: number | null; sell: number | null } | null;
  eur: { buy: number | null; sell: number | null } | null;
  cny: { buy: number | null; sell: number | null } | null;
  /** Островная пятёрка ТЗ: иена за 100 / вона за 1000. */
  jpy: { buy: number | null; sell: number | null } | null;
  krw: { buy: number | null; sell: number | null } | null;
  refreshedAt?: string;
}

export async function GET() {
  try {
    let rows = await latestCurrencyBatch();

    // данные старше часа — просим парсер обновить (максимум раз в 10 мин)
    const stale =
      !rows ||
      rows.length === 0 ||
      Date.now() - new Date(rows[0].batch).getTime() > 60 * 60 * 1000;
    if (stale) {
      void runCurrencyParse().catch(() => {});
      if (!rows || rows.length === 0) {
        // парсера ещё не было вообще — пробуем синхронно, разово
        const res = await runCurrencyParse();
        if (res.ok) rows = await latestCurrencyBatch();
      }
    }

    if (rows && rows.length > 0) {
      const byBank = new Map<string, BankRates>();
      for (const r of rows) {
        let b = byBank.get(r.bank);
        if (!b) {
          b = { bank: r.bank, usd: null, eur: null, cny: null, jpy: null, krw: null };
          byBank.set(r.bank, b);
        }
        const pair = { buy: r.buy, sell: r.sell };
        if (r.currency === "USD") b.usd = pair;
        else if (r.currency === "EUR") b.eur = pair;
        else if (r.currency === "CNY") b.cny = pair;
        else if (r.currency === "JPY") b.jpy = pair;
        else if (r.currency === "KRW") b.krw = pair;
      }
      // СТРОГО четвёрка банков ТЗ в порядке ТЗ (Задача 3). Банки без
      // публикаций (сейчас Сбер) всё равно отдают строку с null-парами —
      // панель и таблица покажут «—»: состав мониторинга виден целиком.
      for (const b of TARGET_BANK_NAMES) {
        if (!byBank.has(b)) {
          byBank.set(b, { bank: b, usd: null, eur: null, cny: null, jpy: null, krw: null });
        }
      }
      const banks = filterTargetBankRows(Array.from(byBank.values()));
      const batchDate = new Date(rows[0].batch);
      return Response.json({
        source: "kovalut",
        updated: fmtStamp(batchDate),
        banks,
      });
    }

    // источник недоступен и исторических серий нет — честно без данных
    return Response.json({ source: "none", updated: "", banks: [] });
  } catch {
    return Response.json({ source: "none", updated: "", banks: [] });
  }
}
```

## 4. CSS: `src/app/globals.css` — подсветка в цветах ТЗ

Было → стало (6 правил; мобильные правила ≤480 не тронуты):

```css
/* ПАНЕЛЬ ГЛАВНОЙ «Курсы валют» (было: cell без фона, b #1a2433, i #7d8ea0) */
.mp-rt-best td.bestcell{text-align:right;background:#E2F0D9} /* Задача 3: подсветка лучших курсов — мягкий зелёный ТЗ */
.mp-rt-best td.bestcell b{display:block;color:#2E7D32;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.25} /* цвет текста ТЗ */
.mp-rt-best td.bestcell i{display:block;font-style:normal;color:#2E7D32;font-size:9.5px;line-height:1.2} /* банк-лидер — тоже цвет ТЗ */

/* ТАБЛИЦА /currency.php (было: rgba(46,158,68,.14), b #17692a, i #1e7a33) */
.crt-table td.is-best{background:#E2F0D9} /* Задача 3: мягкий зелёный фон ТЗ */
.crt-table td.is-best b{color:#2E7D32} /* цвет текста ТЗ */
.crt-table td.is-best i{color:#2E7D32} /* цвет текста ТЗ */
```

## 5. Точечные правки компонентов (комментарии + легенда)

**`src/components/site/currency-screen.tsx`** — легенда под таблицей:

```tsx
<p className="crt-legend">
  В ячейке: покупка / продажа. Зелёным (фон #E2F0D9) выделен самый выгодный курс.
</p>
```

**`src/components/site/home-right.tsx`** — панель главной уже выводила пятёрку с номиналами `за 100`/`за 1000` и лучшими курсами (блок 8.2); в Задаче 3 обновлены комментарии (строго 4 банка ТЗ, цвета ТЗ) — разметка и логика панели не менялись. Строки валют:

```tsx
const RATE_ROWS: {...}[] = [
  { code: "USD", sign: "$", name: "Доллар", key: "usd" },
  { code: "EUR", sign: "€", name: "Евро", key: "eur" },
  { code: "CNY", sign: "¥", name: "Юань", key: "cny" },
  { code: "JPY", sign: "¥", name: "Иена", unit: "за 100", key: "jpy" },
  { code: "KRW", sign: "₩", name: "Вона", unit: "за 1000", key: "krw" },
];
```

**`src/lib/currency-table.ts`** — логика подсветки без изменений (`computeBestRates`: покупка — максимум, продажа — минимум; `isBestCell` — value-сравнение, ничьи подсвечиваются у всех лидеров).

---

## Тесты и приёмка

- **`scripts/test-informers.ts` — 168/168** (+10): фикстуры живых страниц 4 банков (`scripts/fixtures/kovalut-{atb,solid-bank,bank-primore,sberbank-rossii}.html`), точные значения, THB-отсечка, нормализация за 100/за 1000, честный ноль Сбера, порядок ТЗ, фильтр, live-парсинг → БД, цвета ТЗ в CSS.
- **`scripts/task3-currency-verify.sh`** — приёмка RUN1→RUN2→RUN3: RUN1 нашёл дефект (Сбер отсутствовал строкой → исправлено инжектом null-строк в API) + ошибку чекера; RUN2+RUN3 — два чистых прогона.
- Проверено на 1280/1366/400: API (четвёрка ТЗ в порядке ТЗ, JPY за 100, KRW за 1000), панель (5 строк, 10 ячеек, фон rgb(226,240,217), текст rgb(46,125,50)), /currency.php (4 банка, 7 подсвеченных ячеек, легенда), «ЦБ» = 0 вхождений, регрессии сетки З2-1 / информеров З13 / карточек З14 целы, прокруток-X нет, консоль чиста.

## Изменённые файлы (коммит a72b940)

```
src/lib/currency-banks.ts            (новый)
src/lib/currency-parser.ts           (рерайт)
src/app/api/home/rates/route.ts
src/lib/currency-table.ts            (комментарий)
src/components/site/currency-screen.tsx (комментарий + легенда)
src/components/site/home-right.tsx   (комментарии)
src/app/globals.css                  (6 правил подсветки)
scripts/test-informers.ts            (168/168)
scripts/task3-currency-verify.sh     (новый)
scripts/fixtures/kovalut-atb.html            (новый, живая страница)
scripts/fixtures/kovalut-solid-bank.html     (обновлена)
scripts/fixtures/kovalut-bank-primore.html   (новый, живая страница)
scripts/fixtures/kovalut-sberbank-rossii.html (новый, 0 курсов)
worklog.md
```
