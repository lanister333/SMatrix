/**
 * СТАДИЯ 2 (Шаг 7) → ЗАДАЧА №4: авто-агрегатор коммунальных отключений
 * с РЕАЛЬНЫХ официальных источников трёх ведомств:
 *
 *   1. Сахалинэнерго (ФРС) — ПАО «Сахалинэнерго», филиал
 *      «Распределительные сети» (холдинг ПАО «РусГидро»): сайт
 *      sakh-frs.ru — серверные карточки отключений .oItem с датой
 *      отключения, пометкой «(Плановое)/(Аварийное)», списком адресов
 *      и ТОЧНЫМ временем публикации («Время публикации 16.09.2026 11:52»).
 *
 *   2. СКК — Сахалинская Коммунальная Компания (skk65.ru, WordPress):
 *      официальный REST /wp-json/wp/v2/posts — JSON с date_gmt (время
 *      публикации), заголовком («Отключение горячей воды 16.09.2026 с
 *      14:10 до 20:00») и адресами в content. Из песочницы домен
 *      недоступен напрямую (гео-фильтр) — сайт читает страницу через
 *      SDK-ридер (z-ai-web-dev-sdk, page_reader), на боевом хостинге
 *      работает и прямой fetch.
 *
 *   3. Городской Водоканал — «РВК-Сахалин» (sakhalin.rosvodokanal.ru):
 *      пресс-центр /pressroom/news/ (Bitrix) — карточки новостей с
 *      заголовком и датой; сводки об ограничениях водоснабжения
 *      публикуются статьями («Внимание: ограничение холодного
 *      водоснабжения…») — парсер берёт страницы статей и вытаскивает
 *      адреса. Без браузерных заголовков сайт отвечает 403 — get()
 *      всегда шлёт полный набор заголовков браузера.
 *
 * Брат-близнец этого парсера на PHP (по ТЗ, для системного cron):
 *   scripts/cron-outages.php — пишет тот же файл db/outages.json.
 * Сбор запускается РАЗ В 30 МИНУТ (Шаг №7): планировщик
 * src/instrumentation-node.ts и/или PHP-крон.
 *
 * Формат строки на Главной (Задача №4, ТЗ):
 *   [Иконка/Название ведомства] [Краткий адрес/Район] — [Время публикации]
 * Поэтому каждая запись несёт short (краткий адрес) и publishedAt;
 * топ-3 самых свежих отбирает pickTopOutages (строго по времени
 * публикации, самый свежий — вверху, независимо от ведомства).
 *
 * Время: все источники живут по сахалинскому времени (Asia/Sakhalin,
 * UTC+11, без перехода на летнее). publishedAt хранится в ISO (UTC).
 */

import { promises as fs } from "fs";
import path from "path";

/** Тип коммунальной услуги — выбирает иконку ведомства. */
export type OutageKind = "electro" | "hot" | "cold";
/** Характер сводки: плановая / аварийная / не указано. */
export type OutageType = "planned" | "emergency" | "unspecified";

export interface OutageItem {
  /** Ведомство: «Сахалинэнерго» | «СКК» | «Водоканал». */
  source: string;
  /** Заголовок публикации (со ссылкой на источник). */
  title: string;
  url: string;
  /** Полные адресные строки (для страницы /disconnections.php). */
  addresses: string[];
  /** Задача №4: краткий адрес/район для строки информера на Главной. */
  short?: string;
  /** Период отключения из текста сводки («с 09:00 до 17:00»). */
  when: string;
  /** Задача №4: вид услуги (иконка ведомства). */
  kind?: OutageKind;
  /** Задача №4: плановая или аварийная. */
  type?: OutageType;
  /** Время публикации (ISO, UTC) — основа сортировки топ-3. */
  publishedAt: string;
  fetchedAt: string;
}

export interface OutagesFile {
  updated: string;
  items: OutageItem[];
  errors: { source: string; error: string }[];
}

export interface OutageSource {
  key: string;
  name: string;
  /** Главная страница источника. Пустая строка = источник отключён. */
  homepage: string;
  /** Дополнительные служебные пути (страницы сводок). */
  paths: string[];
}

/** Смещение Сахалина от UTC (Asia/Sakhalin, летнего времени нет). */
export const SAKHALIN_OFFSET_MS = 11 * 60 * 60 * 1000;

/**
 * ОФИЦИАЛЬНЫЕ ИСТОЧНИКИ (Задача №4, подтверждены 16.09.2026):
 *  — sakh-frs.ru — карточки отключений на главной (30 живых записей);
 *  — skk65.ru — WordPress REST /wp-json/wp/v2/posts (категории
 *    «Горячая вода»/«Холодная вода»/«Отопление»/«Ремонтные работы»);
 *  — sakhalin.rosvodokanal.ru — пресс-центр «РВК-Сахалин» (Городской
 *    водоканал Южно-Сахалинска), сводки об ограничениях — в новостях.
 */
export const OUTAGE_SOURCES: OutageSource[] = [
  {
    key: "sakhalinenergo",
    name: "Сахалинэнерго",
    homepage: "https://sakh-frs.ru/",
    paths: ["/now", "/tomorrow"],
  },
  {
    key: "skk",
    name: "СКК",
    homepage: "https://skk65.ru/",
    paths: [],
  },
  {
    key: "vodokanal",
    name: "Водоканал",
    homepage: "https://sakhalin.rosvodokanal.ru/",
    paths: ["/pressroom/news/"],
  },
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Полный набор браузерных заголовков: РВК без Accept-Language отдаёт 403. */
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9",
};

const LINK_RE =
  /отключени|ремонт|ограничен|авари|прекращен/i;
/** Строка с адресом: улица/квартал/микрорайон/посёлок + номер дома. */
const ADDR_RE =
  /(ул\.|улиц[аы]|проспект|пр-кт|пр-т|кв-л|квартал|мкр\.?|микрорайон|пос\.|поселок|посёлок|с\.|село|шоссе)[^;<>{"]{0,90}?\d{1,3}[а-яА-Я]?(?:[^0-9;]{0,12}\d{1,3}[а-яА-Я]?)?/gi;
const WHEN_RE =
  /(?:с|по|в|до)\s+\d{1,2}[.:]\d{2}|\d{1,2}\s+(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-яё]*|\d{1,2}[.\/]\d{1,2}(?:[.\/]\d{2,4})?|\d{1,2}[.:]\d{2}\s*[-–—]\s*\d{1,2}[.:]\d{2}/i;

/** Период отключения «с 14:10 до 20:00» — из заголовков СКК/ФРС. */
const PERIOD_RE = /с\s+\d{1,2}[:.]\d{2}\s*[-–—]?\s*(?:до)?\s*\d{1,2}[:.]\d{2}/i;

/**
 * Заголовок-сводка об отключении. «водоснабжен/водоотвед» НЕ входят:
 * так отсеиваются PR-заметки («…при оплате услуг водоснабжения»).
 */
const OUTAGE_TITLE_RE =
  /отключ|ограничен|авари|прекращен|ремонт|негативн|внимание|промывк|опрессовк/i;

/** Строки-адреса: перечень жилых домов после «по следующим адресам».
 *  снт. — садовые товарищества в сводках ФРС («-снт. "Ключи"»). */
const ADDR_LINE_RE =
  /(ул\.|улиц[аы]|пер\.|переулок|проспект|пр-кт|пр-т|кв-л|квартал|мкр\.?|микрорайон|пос\.|поселок|посёлок|с\.|село|шоссе|наб\.|б-р|снт\.?)/i;

/** Шаг №7: распознавание времени публикации — <time datetime>, «16 сентября
 *  2025», «16.09.2025», «16/09/25», ISO «2025-09-16…». */
const TIME_TAG_RE = /<time\b[^>]*datetime=["']([^"']+)["']/i;
const RU_MONTHS = "январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр";
const PUB_DATE_RE = new RegExp(
  `\\d{1,2}\\s+(?:${RU_MONTHS})[а-яё]*\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[.\\/]\\d{1,2}[.\\/]\\d{2,4}`,
  "i",
);
const RU_MONTH_IDX: [RegExp, number][] = [
  [/январ/i, 0], [/феврал/i, 1], [/март/i, 2], [/апрел/i, 3], [/ма[йя]/i, 4],
  [/июн/i, 5], [/июл/i, 6], [/август/i, 7], [/сентябр/i, 8], [/октябр/i, 9],
  [/ноябр/i, 10], [/декабр/i, 11],
];

/** Дата/время из строки в ISO или пусто, если распознать не удалось. */
function toIso(s: string): string {
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

/** «16.09.2026», «11:52» — сахалинское локальное время → ISO (UTC). */
export function sakhalinIso(dateStr: string, timeStr = "00:00"): string {
  const d = dateStr.split(".").map((n) => parseInt(n, 10));
  const t = timeStr.split(":").map((n) => parseInt(n, 10));
  if (d.length !== 3 || d.some((n) => isNaN(n) || n === 0)) return "";
  const ms =
    Date.UTC(d[2], d[1] - 1, d[0], t[0] || 0, t[1] || 0) - SAKHALIN_OFFSET_MS;
  const iso = new Date(ms);
  return isNaN(iso.getTime()) ? "" : iso.toISOString();
}

/** HTML-теги → пробелы, &nbsp;/&quot;/&amp; → текст, схлопывание пробелов. */
function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Краткий адрес для строки ТЗ: населённый пункт (кроме Южно-Сахалинска —
 *  домашнего города всех трёх источников) + первая улица; ≤ 60 знаков. */
function composeShort(place: string, firstAddr: string, fallback: string): string {
  const parts: string[] = [];
  const p = place.trim().replace(/:$/, "");
  if (p && !/^(?:г\.\s*)?Южно-Сахалинск$/i.test(p)) parts.push(p);
  const a = (firstAddr || "").trim().replace(/:$/, "").replace(/\.+$/, "");
  if (a) parts.push(a);
  const short = parts.join(", ") || fallback || "";
  return short.length > 60 ? `${short.slice(0, 59).trimEnd()}…` : short;
}

/** Первые n адресных строк из списка (без пункта «г. Южно-Сахалинск:»). */
function pickAddressLines(lines: string[], place: string, cap = 20): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/^[-–—•*]\s*/, "").replace(/\s+/g, " ").trim();
    if (line.length < 5 || line.length > 200) continue;
    if (/^(?:г\.\s*)?Южно-Сахалинск\s*:?\s*$/i.test(line)) continue;
    if (line === place) continue;
    if (/^(СОЦ|соц)\s/i.test(line)) continue; // «СОЦ объекты: …» — не адреса
    if (ADDR_LINE_RE.test(line) && (/\d/.test(line) || /снт\.?/i.test(line))) {
      if (!out.includes(line)) out.push(line);
    }
    if (out.length >= cap) break;
  }
  return out;
}

/** Время публикации страницы (Шаг №7): <time datetime> либо первая дата
 *  в тексте («16 сентября 2025», «16.09.2025», «2025-09-16»). */
export function extractPubDate(html: string): string {
  const tm = html.match(TIME_TAG_RE);
  if (tm) {
    const iso = toIso(tm[1]);
    if (iso) return iso;
  }
  const text = stripTags(html);
  const m = text.match(PUB_DATE_RE);
  if (!m) return "";
  const s = m[0];
  // «16 сентября 2025» (год обязателен — иначе это дата отключения)
  const ru = s.match(new RegExp(`^(\\d{1,2})\\s+(${RU_MONTHS})[а-яё]*\\s+(\\d{4})$`, "i"));
  if (ru) {
    const mi = RU_MONTH_IDX.find(([re]) => re.test(ru[2]));
    if (mi) return toIso(`${ru[3]}-${String(mi[1] + 1).padStart(2, "0")}-${ru[1].padStart(2, "0")}T00:00:00Z`);
  }
  // «2025-09-16» — Date() понимает напрямую
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return toIso(`${s}T00:00:00Z`);
  // «16.09.2025» / «16/09/25» — день/месяц/год руками (без локалей)
  const p = s.split(/[.\/]/);
  if (p.length === 3) {
    const day = p[0].padStart(2, "0");
    const mon = p[1].padStart(2, "0");
    const year = p[2].length === 2 ? `20${p[2]}` : p[2];
    return toIso(`${year}-${mon}-${day}T00:00:00Z`);
  }
  return "";
}

/** Шаг №7, «Вариант А»: строго n самых свежих записей, сортировка строго
 *  по времени публикации (publishedAt, fallback fetchedAt) по убыванию —
 *  самое свежее отключение всегда вверху, независимо от источника. */
export function pickTopOutages(items: OutageItem[], n = 3): OutageItem[] {
  const ts = (it: OutageItem) => {
    const t = new Date(it.publishedAt || it.fetchedAt).getTime();
    return isNaN(t) ? 0 : t;
  };
  return [...items].sort((a, b) => ts(b) - ts(a)).slice(0, n);
}

function absUrl(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return "";
  }
}

/** Страница источника: полный набор браузерных заголовков (РВК без них
 *  отвечает 403), таймаут 12 с, кеш отключён. */
async function get(url: string, timeoutMs = 12000): Promise<string> {
  const r = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

/**
 * SDK-ридер (z-ai-web-dev-sdk, page_reader) — резервный канал чтения для
 * источников, недоступных из песочницы напрямую (skk65.ru отвечает
 * соединением-отказ на любой fetch). На боевом хостинге прямой fetch
 * обычно доступен, SDK остаётся запасным путём.
 */
async function sdkPageReader(url: string): Promise<string> {
  const mod = await import("z-ai-web-dev-sdk");
  const ZAI = (mod as { default?: unknown }).default ?? mod;
  const zai = await (ZAI as { create: () => Promise<unknown> }).create();
  const res = await (
    zai as {
      functions: {
        invoke: (name: string, args: { url: string }) => Promise<unknown>;
      };
    }
  ).functions.invoke("page_reader", { url });
  const data =
    (res as { data?: { html?: string; text?: string } })?.data ?? res;
  const html = String((data as { html?: string; text?: string })?.html ??
    (data as { text?: string })?.text ?? "");
  if (!html.trim()) throw new Error("page_reader: пустой ответ");
  return html;
}

/** Страница источника: сначала прямой fetch, при сбое — SDK-ридер. */
async function fetchSourcePage(url: string, allowSdk = false): Promise<string> {
  try {
    return await get(url);
  } catch (e) {
    if (allowSdk) {
      const note = e instanceof Error ? e.message : String(e);
      try {
        return await sdkPageReader(url);
      } catch (e2) {
        throw new Error(`прямой: ${note}; SDK: ${
          e2 instanceof Error ? e2.message : String(e2)
        }`);
      }
    }
    throw e;
  }
}

/** Ссылки со страниц, похожие на сводки об отключениях (служебный
 *  универсальный экстрактор — используется разведчиком источников). */
export function findLinks(html: string, base: string, limit = 4): { url: string; title: string }[] {
  const out: { url: string; title: string }[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < limit) {
    const title = m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const url = absUrl(base, m[1]);
    if (!url || !/https?:/.test(url)) continue;
    if (!LINK_RE.test(title) && !LINK_RE.test(decodeURIComponent(m[1]))) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, title: title.slice(0, 140) });
  }
  return out;
}

/** Адресные строки и указания времени из текста страницы (служебный
 *  универсальный экстрактор). */
export function extractAddresses(html: string): { addresses: string[]; when: string } {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&");
  const addresses = new Set<string>();
  let when = "";
  for (const rawLine of text.split(/\n+/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (line.length < 8 || line.length > 220) continue;
    if (addresses.size < 40) {
      // все адресные фрагменты строки (после «;» тоже)
      ADDR_RE.lastIndex = 0;
      let am: RegExpExecArray | null;
      while ((am = ADDR_RE.exec(line)) !== null && addresses.size < 40) {
        addresses.add(am[0].trim());
        if (am.index === ADDR_RE.lastIndex) ADDR_RE.lastIndex++;
      }
    }
    if (!when) {
      const w = line.match(WHEN_RE);
      if (w) when = w[0].trim();
    }
  }
  return { addresses: Array.from(addresses), when };
}

/* =====================================================================
 * ИСТОЧНИК 1. Сахалинэнерго (ФРС) — sakh-frs.ru
 * Карточки отключений на главной:
 *   <div class='oItem' alt='55993'>
 *     <div class='oiCapt'>30&nbsp;сентября&nbsp;2026 (Плановое)</div>
 *     <div class='oiText'><b>Плановые работы … с 00:00 до 03:00</b>
 *       <div class='oiSep'></div>г. Южно-Сахалинск:<div class='oiSep'></div>
 *       -ул. Сергея Лазо 5, 7, 9, 11<div class='oiSep'></div>…</div>
 *     <div class='oiDate'>Время публикации 16.09.2026 11:52</div>
 *   </div>
 * ===================================================================== */

/** Тип сводки из шапки карточки: «(Аварийное)» → emergency. */
function frsType(capt: string): OutageType {
  if (/аварийн/i.test(capt)) return "emergency";
  if (/планов/i.test(capt)) return "planned";
  return "unspecified";
}

/** Разбор HTML ФРС (sakh-frs.ru) → записи OutageItem. */
export function parseSakhalinEnergoHtml(html: string, nowIso = ""): OutageItem[] {
  const items: OutageItem[] = [];
  const fetchedAt = nowIso || new Date().toISOString();
  // oItem-блоки: разбиваем по открывающим div и парсим каждый кусок
  const chunks = html.split(/<div class=['"]oItem['"][^>]*>/gi).slice(1);
  for (const chunk of chunks) {
    // oiText заканчивается ровно перед oiDate (внутри только oiSep)
    const textHtml = (chunk.match(/<div class=['"]oiText['"]>([\s\S]*?)<div class=['"]oiDate['"]/i) || [])[1] ?? "";
    const capt = stripTags((chunk.match(/<div class=['"]oiCapt['"]>([\s\S]*?)<\/div>/i) || [])[1] ?? "");
    const title = stripTags((textHtml.match(/<b>([\s\S]*?)<\/b>/i) || [])[1] ?? "") || capt;
    // «Время публикации 16.09.2026 11:52» (&nbsp; тоже учитываем)
    const pubChunk = stripTags((chunk.match(/<div class=['"]oiDate['"]>([\s\S]*?)<\/div>/i) || [])[1] ?? "");
    const pub = pubChunk.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s+(\d{1,2}:\d{2})/);
    const publishedAt = pub ? sakhalinIso(pub[1], pub[2]) : fetchedAt;
    // строки тела: «г. Южно-Сахалинск:», «-ул. Сергея Лазо 5, 7, 9, 11», …
    const body = textHtml
      .replace(/<div class=['"]oiSep['"]><\/div>/gi, "\n")
      .replace(/<\/?(b|div|p|br)[^>]*>/gi, "\n");
    const lines = body
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const place = (lines.find((l) => /:$/.test(l) && l.length <= 80) ?? "").replace(/:$/, "").trim();
    const addresses = pickAddressLines(lines, place);
    if (!title) continue;
    items.push({
      source: "Сахалинэнерго",
      title,
      url: "https://sakh-frs.ru/",
      addresses,
      short: composeShort(place, addresses[0] ?? "", title),
      when: (title.match(PERIOD_RE) ?? [""])[0].trim(),
      kind: "electro",
      type: frsType(capt),
      publishedAt,
      fetchedAt,
    });
  }
  return items;
}

/* =====================================================================
 * ИСТОЧНИК 2. СКК — skk65.ru (WordPress REST)
 *   /wp-json/wp/v2/posts → [{date_gmt, title.rendered, content.rendered,
 *   link, class_list: […category-goryachaya-voda]}]
 * content — список адресов («<p>ул. Ленина, 304А.</p>»).
 * ===================================================================== */

/** Категории СКК с оперативными сводками. */
const SKK_OUTAGE_CATEGORIES = new Set([
  "category-goryachaya-voda",
  "category-holodnaya-voda",
  "category-otoplenie",
  "category-remontnye-raboty",
]);

/**
 * Терпеливый JSON-парсер: SDK-ридер может вернуть JSON целиком в <pre>
 * ИЛИ обрезать длинный ответ. Сначала обычный JSON.parse (после снятия
 * <pre>-обёртки); при обрыве — «спасатель» достаёт цельные объекты
 * балансировкой фигурных скобок (строковые кавычки/эскейпы учитываются).
 */
function skkJsonPosts(raw: string): Record<string, unknown>[] {
  let text = raw.trim();
  const s = text.indexOf("[");
  const e = text.lastIndexOf("]");
  if (s >= 0 && e > s) text = text.slice(s, e + 1);
  try {
    const arr = JSON.parse(text);
    if (Array.isArray(arr)) return arr as Record<string, unknown>[];
  } catch {
    // обрезанный ответ — спасаем цельные объекты ниже
  }
  const objs: Record<string, unknown>[] = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && text[i] !== "{") i++;
    if (i >= text.length) break;
    let depth = 0;
    let j = i;
    let instr = false;
    let esc = false;
    while (j < text.length) {
      const c = text[j];
      if (instr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') instr = false;
      } else if (c === '"') instr = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
      j++;
    }
    try {
      objs.push(JSON.parse(text.slice(i, j)));
    } catch {
      // оборванный хвост — дальше данных нет
      break;
    }
    i = j;
  }
  return objs;
}

/** Разбор ответа /wp-json/wp/v2/posts → записи OutageItem. */
export function parseSkkPosts(raw: string, nowIso = ""): OutageItem[] {
  const items: OutageItem[] = [];
  const fetchedAt = nowIso || new Date().toISOString();
  for (const post of skkJsonPosts(raw)) {
    const titleBox = post.title as { rendered?: string } | undefined;
    const title = stripTags(titleBox?.rendered ?? "");
    if (!title) continue;
    const classList = Array.isArray(post.class_list)
      ? (post.class_list as string[])
      : [];
    const inOutageCategory = classList.some((c) => SKK_OUTAGE_CATEGORIES.has(c));
    // «Заявка на ввод…»/«Информация о выводе…»/PR — не оперативные сводки
    if (!inOutageCategory && !OUTAGE_TITLE_RE.test(title)) continue;
    const contentBox = post.content as { rendered?: string } | undefined;
    const lines = (contentBox?.rendered ?? "")
      .replace(/<\/p>/gi, "\n")
      .split("\n")
      .map((l) => stripTags(l))
      .filter(Boolean);
    const addresses: string[] = [];
    for (const line of lines) {
      const clean = line.replace(/^[-–—•*]\s*/, "").trim();
      if (clean.length < 5 || clean.length > 200) continue;
      if (ADDR_LINE_RE.test(clean) && /\d/.test(clean)) addresses.push(clean);
      if (addresses.length >= 20) break;
    }
    // date_gmt — UTC без суффикса Z (WordPress), date — сахалинское
    const dg = String(post.date_gmt ?? "");
    const publishedAt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dg)
      ? `${dg}Z`
      : extractPubDate(String(post.date ?? "")) || fetchedAt;
    const link = String(post.link ?? "https://skk65.ru/");
    items.push({
      source: "СКК",
      title,
      url: link,
      addresses,
      short: composeShort("", addresses[0] ?? "", title),
      when: (title.match(PERIOD_RE) ?? [""])[0].trim(),
      kind: "hot",
      type: /авари/i.test(title) ? "emergency" : "planned",
      publishedAt,
      fetchedAt,
    });
  }
  return items;
}

/* =====================================================================
 * ИСТОЧНИК 3. Городской Водоканал — sakhalin.rosvodokanal.ru («РВК
 * Сахалин»). Пресс-центр /pressroom/news/: карточки
 *   <a href="/pressroom/news/6481/" …>…<p class="news-item__title">
 *   Внимание: ограничение холодного водоснабжения </p>
 *   …<p class="news-item__meta">16.09.2026</p>
 * Сводка об ограничении — статья со списком адресов. Дата в карточке и
 * статье — только ДД.ММ.ГГГГ (без времени) — публикуем в 00:00 Сахалина.
 * ===================================================================== */

export interface VodokanalCard {
  url: string;
  title: string;
  date: string;
}

/** Разбор списка новостей РВК → карточки-кандидаты (отфильтрованные). */
export function parseVodokanalNewsList(html: string, limit = 3): VodokanalCard[] {
  const titles = Array.from(
    html.matchAll(/class="news-item__title">([^<]+)<\/p>/g),
    (m) => stripTags(m[1]),
  );
  const dates = Array.from(
    html.matchAll(/class="news-item__meta">([^<]+)<\/p>/g),
    (m) => stripTags(m[1]),
  );
  const hrefs = Array.from(
    html.matchAll(/href=["'](\/pressroom\/news\/\d+\/)["']/g),
    (m) => m[1],
  );
  const cards: VodokanalCard[] = [];
  const seen = new Set<string>();
  const n = Math.min(titles.length, dates.length, hrefs.length);
  for (let i = 0; i < n; i++) {
    const title = titles[i];
    // только сводки об отключениях/ограничениях (PR-заметки отсеяны)
    if (!OUTAGE_TITLE_RE.test(title)) continue;
    if (seen.has(hrefs[i])) continue;
    seen.add(hrefs[i]);
    cards.push({
      url: `https://sakhalin.rosvodokanal.ru${hrefs[i]}`,
      title,
      date: dates[i],
    });
    if (cards.length >= limit) break;
  }
  return cards;
}

/** Разбор статьи РВК: дата, адреса, период. */
export function parseVodokanalArticleHtml(
  html: string,
): { date: string; addresses: string[]; when: string } {
  // news-detail → до «К списку новостей»; если блок не найден — вся страница
  const start = html.indexOf("news-detail");
  const end = html.indexOf("К списку новостей", start);
  const frag = start >= 0
    ? html.slice(start, end > start ? end : undefined)
    : html;
  const text = stripTags(frag);
  const date = (text.match(/\d{1,2}\.\d{1,2}\.\d{4}/) ?? [""])[0];
  const addresses: string[] = [];
  for (const rawLine of frag.split(/<\/p>|<br\s*\/?>/i)) {
    const line = stripTags(rawLine);
    if (line.length < 5 || line.length > 200) continue;
    if (ADDR_LINE_RE.test(line) && /\d/.test(line) && !addresses.includes(line)) {
      addresses.push(line);
    }
    if (addresses.length >= 20) break;
  }
  const when = (text.match(PERIOD_RE) ?? [""])[0].trim();
  return { date, addresses, when };
}

/* =====================================================================
 * СБОРКА. Каждое ведомство — независимый сборщик (сбой одного не мешает
 * остальным), все три — параллельно. Результат атомарно пишется в
 * db/outages.json.
 * ===================================================================== */

const FRS_HOMEPAGE = "https://sakh-frs.ru/";
const SKK_POSTS_URL = "https://skk65.ru/wp-json/wp/v2/posts?per_page=12";
const RVC_BASE = "https://sakhalin.rosvodokanal.ru";
const RVC_NEWS_URL = `${RVC_BASE}/pressroom/news/`;

async function collectFrs(nowIso: string): Promise<{ items: OutageItem[]; error?: string }> {
  try {
    const html = await fetchSourcePage(FRS_HOMEPAGE);
    // сводки «сегодня/завтра» дублируют главную — одной страницы достаточно
    return { items: parseSakhalinEnergoHtml(html, nowIso).slice(0, 10) };
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : String(e) };
  }
}

async function collectSkk(nowIso: string): Promise<{ items: OutageItem[]; error?: string }> {
  try {
    // skk65.ru из песочницы напрямую недоступен (гео-фильтр) — SDK-ридер
    const raw = await fetchSourcePage(SKK_POSTS_URL, true);
    return { items: parseSkkPosts(raw, nowIso).slice(0, 6) };
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : String(e) };
  }
}

async function collectVodokanal(nowIso: string): Promise<{ items: OutageItem[]; error?: string }> {
  try {
    // WAF РВК блокирует Node-fetch по TLS-отпечатку (403) — SDK-ридер проходит
    const listHtml = await fetchSourcePage(RVC_NEWS_URL, true);
    const cards = parseVodokanalNewsList(listHtml);
    const items: OutageItem[] = [];
    for (const card of cards) {
      try {
        const artHtml = await fetchSourcePage(card.url, true);
        const { date, addresses, when } = parseVodokanalArticleHtml(artHtml);
        items.push({
          source: "Водоканал",
          title: card.title,
          url: card.url,
          addresses,
          short: composeShort("", addresses[0] ?? "", card.title),
          when,
          kind: "cold",
          type: /авари|негативн/i.test(card.title) ? "emergency" : "planned",
          // дата публикации карточки; fallback — дата из статьи; 00:00 Сахалина
          publishedAt: sakhalinIso(card.date || date) || extractPubDate(artHtml) || nowIso,
          fetchedAt: nowIso,
        });
      } catch {
        // статья не открылась — берём следующую
      }
    }
    return { items };
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export function outagesFilePath(): string {
  return path.join(process.cwd(), "db", "outages.json");
}

export async function readOutages(): Promise<OutagesFile | null> {
  try {
    const raw = await fs.readFile(outagesFilePath(), "utf8");
    return JSON.parse(raw) as OutagesFile;
  } catch {
    return null;
  }
}

export async function writeOutages(data: OutagesFile): Promise<void> {
  const file = outagesFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file); // атомарная подмена — крон и сайт не конфликтуют
}

/**
 * Полный проход по всем трём ведомствам (Шаг №7: крон/планировщик — раз
 * в 30 минут). Ведомства собираются ПАРАЛЛЕЛЬНО (Promise.allSettled —
 * как в валютном парсере Задачи 3), сбой источника не мешает серии.
 * Дедупликация по «источник + заголовок», сортировка по времени
 * публикации, в файле — максимум 30 свежих записей.
 */
export async function runOutagesParse(): Promise<{ ok: boolean; count: number }> {
  const nowIso = new Date().toISOString();
  const results = await Promise.allSettled([
    collectFrs(nowIso),
    collectSkk(nowIso),
    collectVodokanal(nowIso),
  ]);
  const items: OutageItem[] = [];
  const errors: OutagesFile["errors"] = [];
  const names = ["Сахалинэнерго", "СКК", "Водоканал"];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      items.push(...r.value.items);
      if (r.value.error) errors.push({ source: names[i], error: r.value.error });
    } else {
      errors.push({
        source: names[i],
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  });
  // дедупликация: одна и та же сводка может прийти из разных путей
  const seen = new Set<string>();
  const unique = items.filter((it) => {
    const key = `${it.source}|${it.title.slice(0, 80)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const sorted = pickTopOutages(unique, Math.max(unique.length, 1));
  await writeOutages({
    updated: nowIso,
    items: sorted.slice(0, 30),
    errors,
  });
  return { ok: sorted.length > 0 || errors.length < names.length, count: sorted.length };
}
