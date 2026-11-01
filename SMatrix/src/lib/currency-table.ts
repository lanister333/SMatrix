/**
 * Шаг 9 + ЗАДАЧА 3 (Стадия 2) + 2026-09-23: чистая логика подробной
 * таблицы курсов обмена касс банков Южно-Сахалинска.
 *
 * Данные — из многоисточникового агрегатора (src/lib/currency-sources.ts:
 * bankdep.ru → mainfin.ru → banktop.ru → кэш CurrencyRate) через
 * /api/home/rates: { banks: [{bank, usd..thb: {buy, sell, status, ts, src}}] }.
 * Состав банков — СТРОГО 15 банков ТЗ в порядке ТЗ
 * (filterTargetBankRows, src/lib/currency-banks.ts).
 *
 * РЕСТАВРАЦИЯ 2026-09-23: файл пересоздан по worklog после отката
 * воркспейса (см. шапку currency-banks.ts). Состояние = финал ТЗ
 * «Доработка таблицы курсов»: 6 валют (USD/EUR/CNY/THB за 1,
 * JPY/KRW за 1000), статусы ячеек, плашки «устарело» в UI не
 * рисуются (stale = обычное число, свежесть — в тултипах/подвале).
 *
 * Авто-подсветка: для каждой валюты максимум «Купим» и минимум
 * «Продадим» — мягкий зелёный ТЗ (#E2F0D9 фон, #2E7D32 текст),
 * равные лучшие подсвечиваются у всех лидеров.
 */

/** Ключи валют в ответе /api/home/rates (THB — тайский бат за 1). */
export type RateKey = "usd" | "eur" | "cny" | "jpy" | "krw" | "thb";

/** Статус ячейки (ТЗ 2026-09-23, 4 состояния):
 *  ok — свежее число из свежайшей серии;
 *  stale — кэш последнего успеха (число; UI рисует обычным цветом);
 *  unpublished — источники живы, курса нет («—» + тултип);
 *  error — источники упали («Ошибка» + тултип). */
export type RateCellStatus = "ok" | "stale" | "unpublished" | "error";

/** Тултипы состояний ячеек (ТЗ, дословные подписи). */
export const RATE_CELL_TITLES: Record<RateCellStatus, string> = {
  ok: "",
  stale: "Данные устарели",
  unpublished: "Курс не опубликован",
  error: "Не удалось загрузить курс",
};

export interface RatePair {
  buy: number | null;
  sell: number | null;
}

/** Ячейка v2: пара значений + статус/штамп/источник для тултипов. */
export interface RateCell extends RatePair {
  status: RateCellStatus;
  /** Штамп серии (источника) — «23.09.2026 03:28». */
  ts?: string;
  /** Выигравший источник ячейки: bankdep | mainfin | banktop. */
  src?: string;
}

export interface BankRatesRow {
  bank: string;
  usd: RateCell | null;
  eur: RateCell | null;
  cny: RateCell | null;
  jpy: RateCell | null;
  krw: RateCell | null;
  thb: RateCell | null;
}

/** Колонки таблицы — ОСТРОВНАЯ ШЁСТЁРКА ТЗ: THB за 1 (без unit),
 *  JPY/KRW за 1000. Знаки — как в панели «Курсы валют» на главной. */
export const CUR_COLS: {
  code: string;
  sign: string;
  name: string;
  unit?: string;
  key: RateKey;
}[] = [
  { code: "USD", sign: "$", name: "Доллар", key: "usd" },
  { code: "EUR", sign: "€", name: "Евро", key: "eur" },
  { code: "CNY", sign: "¥", name: "Юань", key: "cny" },
  { code: "JPY", sign: "¥", name: "Иена", unit: "за 1000", key: "jpy" },
  { code: "KRW", sign: "₩", name: "Вона", unit: "за 1000", key: "krw" },
  { code: "THB", sign: "฿", name: "Бат", key: "thb" },
];

/** Последняя колонка — правая граница групп шапки/таблицы
 *  (производная, новые валюты подхватываются без правки UI). */
export const LAST_CUR_KEY = CUR_COLS[CUR_COLS.length - 1].key;

/** «84,90» — запятая и два знака, как принято на сайте. */
export function fmtMoney(v: number | null | undefined): string {
  if (typeof v !== "number" || !isFinite(v)) return "—";
  return v.toFixed(2).replace(".", ",");
}

/** Номиналы котировки ТЗ (строго): THB за 1, иена — за 1000, вона — за 1000. */
const CURRENCY_UNITS_MAP: Record<RateKey, number> = {
  usd: 1,
  eur: 1,
  cny: 1,
  jpy: 1000,
  krw: 1000,
  thb: 1,
};

/** Быстрый конвертер: сумма в валюте → рубли по лучшему курсу
 *  (amount / unit × rate). null — лучшего курса нет. */
export function convertToRub(
  amount: number,
  cur: RateKey,
  op: "buy" | "sell",
  best: BestRates,
): number | null {
  if (!isFinite(amount) || amount <= 0) return null;
  const entry = best[cur]?.[op];
  if (!entry) return null;
  const unit = CURRENCY_UNITS_MAP[cur];
  return Math.round((amount / unit) * entry.value * 100) / 100;
}

export interface BestEntry {
  bank: string;
  value: number;
}

export type BestRates = Record<RateKey, { buy: BestEntry | null; sell: BestEntry | null }>;

/** Пустой каркас best по CUR_COLS — новые валюты подхватываются
 *  автоматически, без ручных списков (реставрация: было дублирование). */
function emptyBest(): BestRates {
  const best = {} as BestRates;
  for (const c of CUR_COLS) {
    best[c.key] = { buy: null, sell: null };
  }
  return best;
}

/** Самый выгодный курс по каждой валюте: покупка — максимум,
 *  продажа — минимум. Считаются ЧИСЛА (ok и stale одинаково —
 *  плашки «устарело» упразднены, значение остаётся значением). */
export function computeBestRates(banks: BankRatesRow[]): BestRates {
  const best = emptyBest();
  for (const b of banks) {
    for (const col of CUR_COLS) {
      const pair = b[col.key];
      if (!pair) continue;
      const buy = typeof pair.buy === "number" && isFinite(pair.buy) ? pair.buy : null;
      const sell = typeof pair.sell === "number" && isFinite(pair.sell) ? pair.sell : null;
      if (buy !== null && (!best[col.key].buy || buy > best[col.key].buy!.value)) {
        best[col.key].buy = { bank: b.bank, value: buy };
      }
      if (sell !== null && (!best[col.key].sell || sell < best[col.key].sell!.value)) {
        best[col.key].sell = { bank: b.bank, value: sell };
      }
    }
  }
  return best;
}

/** Подсветить ли ячейку «Купим» (максимальная покупка — человеку
 *  выгодно сдать дороже). Равные лидеры подсвечиваются все. */
export function isBestBuy(
  pair: RatePair | null,
  best: { buy: BestEntry | null; sell: BestEntry | null } | undefined,
): boolean {
  if (!pair || !best || best.buy === null) return false;
  return typeof pair.buy === "number" && pair.buy === best.buy.value;
}

/** Подсветить ли ячейку «Продадим» (минимальная продажа — человеку
 *  выгодно купить дешевле). Равные лидеры подсвечиваются все. */
export function isBestSell(
  pair: RatePair | null,
  best: { buy: BestEntry | null; sell: BestEntry | null } | undefined,
): boolean {
  if (!pair || !best || best.sell === null) return false;
  return typeof pair.sell === "number" && pair.sell === best.sell.value;
}

/** Справочник «Отделения и кассы банков» (ТЗ 2026-09-23: состав = 15
 *  банков таблицы; шестёрка сохранена байт-в-байт, девятка — реальные
 *  адреса/телефоны ЮС, проверены поиском 2026-09-23; Т-Банку — честная
 *  подпись «отделений нет — онлайн-банк» вместо выдуманного адреса). */
export const BANK_BRANCHES: {
  bank: string;
  addr: string;
  tels: { label: string; href: string }[];
}[] = [
  {
    bank: "АТБ",
    addr: "проспект Победы, 39 — операционный офис № 40",
    tels: [{ label: "(4242) 72-00-34", href: "tel:4242720034" }],
  },
  {
    bank: "Солид Банк",
    addr: "ул. Ленина, 281 — головной офис",
    tels: [
      { label: "8-800-775-56-06", href: "tel:88007755606" },
      { label: "(4242) 55-67-77", href: "tel:4242556777" },
    ],
  },
  {
    bank: "Сбербанк",
    addr: "проспект Мира, 149 — отделение с валютной кассой",
    tels: [
      { label: "900", href: "tel:900" },
      { label: "8-800-555-55-50", href: "tel:88005555550" },
    ],
  },
  {
    bank: "ВТБ",
    addr: "ул. Ленина, 234 — офис «Южно-Сахалинск»",
    tels: [{ label: "8-800-100-24-24", href: "tel:88001002424" }],
  },
  {
    bank: "Приморье",
    addr: "ул. Амурская, 88 — операционный офис",
    tels: [
      { label: "8-800-200-20-86", href: "tel:88002002086" },
      { label: "(4242) 39-69-00", href: "tel:4242396900" },
    ],
  },
  {
    bank: "Долинск",
    addr: "г. Долинск — операционный офис",
    tels: [{ label: "(42442) 2-15-65", href: "tel:4244221565" }],
  },
  {
    bank: "Экспобанк",
    addr: "ул. Чехова, 78",
    tels: [{ label: "(4242) 33-41-02", href: "tel:4242334102" }],
  },
  {
    bank: "Газпромбанк",
    addr: "проспект Победы, 30 — офис № 042/2008",
    tels: [{ label: "8-800-100-07-01", href: "tel:88001000701" }],
  },
  {
    bank: "Совкомбанк",
    addr: "ул. Сахалинская, 69",
    tels: [{ label: "8-800-100-00-06", href: "tel:88001000006" }],
  },
  {
    bank: "Россельхозбанк",
    addr: "проспект Мира, 107",
    tels: [
      { label: "8-800-100-78-70", href: "tel:88001007870" },
      { label: "(4242) 55-67-98", href: "tel:4242556798" },
    ],
  },
  {
    bank: "Альфа-Банк",
    addr: "проспект Мира, 113 — ККО «Океанский»",
    tels: [{ label: "+7 (495) 137-82-93", href: "tel:+74951378293" }],
  },
  {
    bank: "МТС-Банк",
    addr: "проспект Мира, 245 — офис № 2",
    tels: [{ label: "8-800-234-35-80", href: "tel:88002343580" }],
  },
  {
    bank: "ДВ банк",
    addr: "ул. Дзержинского, 40 — офис № 31",
    tels: [
      { label: "(4242) 43-62-48", href: "tel:4242436248" },
      { label: "(4242) 43-73-65", href: "tel:4242437365" },
    ],
  },
  {
    bank: "Банк «Итуруп»",
    addr: "Коммунистический проспект, 32 — головной офис",
    tels: [{ label: "8-800-301-53-11", href: "tel:88003015311" }],
  },
  {
    bank: "Т-Банк",
    addr: "отделений в городе нет — онлайн-банк",
    tels: [{ label: "8-800-555-77-78", href: "tel:88005557778" }],
  },
];
