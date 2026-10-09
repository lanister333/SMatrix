# SakhMatrix — ЗАДАЧА №4. Оживление информера «Коммунальные отключения» (/disconnections.php)

**Стек:** Next.js (Bun) + PHP-крон-близнец · **Дата:** 16.09.2026 · **Тесты:** 204/204 (+36 по Задаче 4)

## Что сделано (по пунктам ТЗ)

1. **Заглушка удалена.** Строка «Актуальная информация сейчас недоступна» не выводится никогда:
   при живых данных — ТОП-3 строк формата ТЗ; при честной пустоте базы — живой статус
   Задачи 13 «…не зафиксировано. Проверено: [время]»; «мёртвого» текста в коде нет
   (авто-проверка тестом «З4-HTML: заглушка удалена из информера»).
2. **Парсеры трёх ведомств (реальные источники, подтверждены 16.09.2026):**
   | Ведомство | Источник | Что берём |
   |---|---|---|
   | Сахалинэнерго (ФРС) | https://sakh-frs.ru/ — филиал «Распределительные сети» ПАО «Сахалинэнерго» (РусГидро) | карточки `.oItem`: дата отключения, пометка «(Плановое)/(Аварийное)», адреса, **точное время публикации** («Время публикации 16.09.2026 11:52») |
   | СКК | https://skk65.ru/wp-json/wp/v2/posts — WordPress REST | `date_gmt` (время публикации), заголовок с периодом, адреса в `content` |
   | Городской Водоканал | https://sakhalin.rosvodokanal.ru/pressroom/news/ — «РВК-Сахалин» | сводки-ограничения статьями («Внимание: ограничение холодного водоснабжения…»), адреса из статей |

   Доступность: ФРС и РВК читаются прямым fetch (РВК требует браузерных заголовков — иначе 403;
   Node-fetch блокируется WAF'ом по TLS-отпечатку → резервный канал SDK-ридер `page_reader`);
   skk65.ru из песочницы недоступен напрямую (гео-фильтр) → SDK-ридер. На боевом хостинге прямой
   fetch работает, SDK остаётся резервом. Сбор — раз в 30 минут (планировщик + PHP-крон).
3. **Формат строки на Главной — СТРОГО по ТЗ:** `[Иконка/Название ведомства] [Краткий адрес/Район] — [Время публикации]`
   (⚡ Сахалинэнерго / 🔥 СКК / 🚰 Водоканал), ТОП-3 самые свежие по `publishedAt`
   (сегодня → «ЧЧ:ММ», раньше → «ДД.ММ ЧЧ:ММ», дата без времени → «ДД.ММ»; Сахалин = UTC+11).
4. **Заголовок плашки «Отключения»** — ссылка на внутреннюю страницу /disconnections.php.

## Выдача кода — в порядке ТЗ: CSS → HTML-структура → PHP/JS-парсеры

### ЧАСТЬ 1. CSS-блок (`src/app/globals.css`)

Заменённые/новые правила (базовый блок + мобильный блок ≤480px):

```css
/* Шаг 7 + ЗАДАЧА №4: сводки отключений — строка формата ТЗ
   [Иконка/Название ведомства] [Краткий адрес/Район] — [Время публикации];
   ТОП-3 самые свежие, каждая строка — ссылка на публикацию ведомства */
.mp-off-list{padding:3px 0}
.mp-off-line{align-items:baseline;gap:6px;border-bottom:1px solid #eef2f6;padding:7px 10px;display:flex;text-decoration:none}
.mp-off-line:last-of-type{border-bottom:0}
.mp-off-line:hover{background:#f2f7fb;color:#0a5caa}
.mp-off-org{color:#0a5caa;font-size:12px;font-weight:700;white-space:nowrap;flex:none}
.mp-off-addr{color:#33415a;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:1.45;flex:1}
.mp-off-time{color:#56657a;font-size:11px;white-space:nowrap;flex:none}

/* --- мобильный блок ≤480px (внутри существующего @media (max-width:480px)) --- */
  .mp-off-list{padding:2px 0}
  .mp-off-line{gap:4px;padding:6px 4px}
  .mp-off-org{font-size:10.5px}
  .mp-off-addr{font-size:11.5px}
  .mp-off-time{font-size:10px}
```

### ЧАСТЬ 2. HTML-структура информера (`src/components/site/home-right.tsx`)

```tsx
// import — добавлена строка:
import { outageOrgBadge, outageWhenLabel } from "@/lib/outages-taxonomy";

// interface OutagesData — добавлено поле Задачи №4:
interface OutagesData {
  source: "aggregated" | "empty" | "none";
  updated: string;
  items: {
    source: string;
    title: string;
    url: string;
    addresses: string[];
    /** Задача №4: краткий адрес/район для строки ТЗ. */
    short?: string;
    when: string;
    /** Шаг №7: время публикации (сортировка «Варианта А» на сервере). */
    publishedAt?: string;
  }[];
}

// useEffect — блок загрузки (при source="none" — автоподталкивание первого сбора POST):
    // Задача №4: если кеша ещё нет (source="none") — подталкиваем первый
    // сбор POST-запросом к парсеру и перечитываем результат
    const loadOutages = () =>
      fetch("/api/home/outages")
        .then(async (r) => (r.ok ? r.json() : EMPTY_OUTAGES))
        .then((d: OutagesData) => {
          if (alive) return d;
          setOutages(d);
          // ТЗ: база парсера действительно пуста — штамп времени проверки
          if (d.source === "empty") setCheckedAt(fmtNowStamp());
          return d;
        })
        .catch(() => EMPTY_OUTAGES);
    loadOutages().then((d) => {
      if (!alive && d.source === "none") {
        void fetch("/api/home/outages", { method: "POST" })
          .catch(() => undefined)
          .then(() => loadOutages());
      }
    });

// Панель 8.3 «Отключения» (заглушка убрана, строки формата ТЗ):
      {/* 8.3 «Отключения» — ЗАДАЧА №4: оживлённый агрегатор сводок
          трёх ведомств — Сахалинэнерго (ФРС, sakh-frs.ru), СКК (skk65.ru,
          WP REST) и Городского Водоканала (РВК-Сахалин); сбор РАЗ В
          30 МИНУТ (планировщик + PHP-крон scripts/cron-outages.php).
          Строка — СТРОГО по формату ТЗ:
            [Иконка/Название ведомства] [Краткий адрес/Район] — [Время публикации]
          на Главной — ТОП-3 самые свежие публикации (сортировку делает
          API pickTopOutages по publishedAt; прежняя зависшая надпись-
          заглушка убрана). Синий заголовок плашки —
          кликабельная ссылка на /disconnections.php (полный архив
          адресов по всем районам острова). */}
      <section className="mp-panel sakh-card" aria-label="Отключения">
        <div className="mp-paneltitle">
          <span className="tri">▼</span>
          <a href="/disconnections.php" title="Полный архив отключений по районам острова">
            Отключения
          </a>
        </div>
        {outages.items.length > 0 ? (
          <div className="mp-off-list">
            {/* Вариант А ТЗ: строго 3 самые свежие публикации (API уже
                отсортировал по publishedAt; slice — страховка UI). */}
            {outages.items.slice(0, 3).map((it, i) => {
              const org = outageOrgBadge(it.source);
              const when = outageWhenLabel(it.publishedAt);
              return (
                <a
                  key={`${it.url}-${i}`}
                  className="mp-off-line"
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={it.title}
                >
                  <span className="mp-off-org">
                    {org.icon} {org.name}
                  </span>
                  <span className="mp-off-addr">{it.short || it.addresses[0] || it.title}</span>
                  <span className="mp-off-time">{when ? `— ${when}` : ""}</span>
                </a>
              );
            })}
            <div className="mp-w-upd">Обновлено: {outages.updated.slice(0, 16).replace("T", " ")}</div>
          </div>
        ) : outages.source === "empty" ? (
          /* Задача 13, п.2: в базе парсера действительно пусто — живой
             текст ТЗ с штампом времени проверки (видно, что автоматика
             работает и проверяет источники прямо сейчас). */
          <div className="mp-off-live">
            <span className="mp-off-dot" aria-hidden="true">
              🟢
            </span>
            <span>
              На данный момент плановых отключений по Южно-Сахалинску не зафиксировано. Проверено: {checkedAt}
            </span>
          </div>
        ) : (
          <div className="mp-offnote">
            <Info size={20} strokeWidth={1.9} aria-hidden="true" />
            <span>Сводки собираются — первая проверка источников выполнится в течение получаса.</span>
          </div>
        )}
      </section>
```

### ЧАСТЬ 3. JS-парсер (`src/lib/outages-parser.ts`) — полный файл

```typescript
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
```

### ЧАСТЬ 4. Дополнение таксономии (`src/lib/outages-taxonomy.ts`) — блок Задачи №4

```typescript
/* ==================== ЗАДАЧА №4 (ТЗ) ==================== */

/** Смещение Сахалина от UTC (Asia/Sakhalin, летнего времени нет). */
const SAKHALIN_OFFSET_MS = 11 * 60 * 60 * 1000;

/**
 * Ведомственный бейдж строки информера на Главной (формат ТЗ Задачи №4:
 * [Иконка/Название ведомства] …): ⚡ Сахалинэнерго (электросети ФРС),
 * 🔥 СКК (тепло/ГВС), 🚰 Водоканал (холодная вода).
 */
export function outageOrgBadge(source: string): { icon: string; name: string } {
  const s = (source ?? "").toLowerCase();
  if (s.includes("скк")) return { icon: "🔥", name: source || "СКК" };
  if (s.includes("водоканал")) return { icon: "🚰", name: source || "Водоканал" };
  return { icon: "⚡", name: source || "Сахалинэнерго" };
}

/**
 * Время публикации для строки ТЗ: сегодня по сахалинскому времени —
 * только «ЧЧ:ММ»; раньше — «ДД.ММ ЧЧ:ММ»; у записей с датой без
 * времени (Водоканал публикует 00:00) — только «ДД.ММ». Пустая строка,
 * если время публикации не распознано.
 */
export function outageWhenLabel(publishedAt?: string): string {
  if (!publishedAt) return "";
  const t = new Date(publishedAt).getTime();
  if (isNaN(t)) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const loc = new Date(t + SAKHALIN_OFFSET_MS);
  const hm = `${pad(loc.getUTCHours())}:${pad(loc.getUTCMinutes())}`;
  const nowLoc = new Date(Date.now() + SAKHALIN_OFFSET_MS);
  const sameDay =
    loc.getUTCDate() === nowLoc.getUTCDate() &&
    loc.getUTCMonth() === nowLoc.getUTCMonth();
  const day = `${pad(loc.getUTCDate())}.${pad(loc.getUTCMonth() + 1)}`;
  if (hm === "00:00") return day;
  return sameDay ? hm : `${day} ${hm}`;
}
```

### ЧАСТЬ 5. PHP-крон-близнец (`scripts/cron-outages.php`) — полный файл

```php
<?php
/**
 * СТАДИЯ 2 (Шаг 7) → ЗАДАЧА №4: авто-агрегатор коммунальных отключений
 * (PHP, cron) — зеркальный близнец JS-парсера src/lib/outages-parser.ts.
 *
 * Собирает оперативные аварийные и плановые сводки с официальных
 * источников ТРЁХ ведомств:
 *
 *   1. Сахалинэнерго (ФРС) — sakh-frs.ru: карточки .oItem с пометкой
 *      «(Плановое)/(Аварийное)», адресами и ТОЧНЫМ временем публикации
 *      («Время публикации 16.09.2026 11:52»);
 *   2. СКК — skk65.ru: WordPress REST /wp-json/wp/v2/posts (date_gmt,
 *      заголовок с периодом, адреса в content);
 *   3. Городской Водоканал — sakhalin.rosvodokanal.ru (РВК-Сахалин):
 *      пресс-центр /pressroom/news/, сводки об ограничениях — статьями;
 *      без браузерных заголовков сайт отвечает 403 — шлём полный набор.
 *
 * Результат атомарно пишется в db/outages.json — тот же файл, что и
 * встроенный планировщик SakhMatrix (src/instrumentation-node.ts).
 * Запуск РАЗ В 30 МИНУТ (Шаг №7):
 *
 *   */30 * * * * php /путь/к/my-project/scripts/cron-outages.php >> /путь/к/my-project/outages-cron.log 2>&1
 *
 * Формат строки на Главной (Задача №4, ТЗ):
 *   [Иконка/Название ведомства] [Краткий адрес/Район] — [Время публикации]
 * поэтому каждая запись несёт short (краткий адрес), kind (вид услуги)
 * и publishedAt (ISO, UTC; Сахалин = UTC+11, летнего времени нет).
 * Источник считается неудачным тихо (пишется в errors) — сайт при этом
 * показывает предыдущие данные.
 */

declare(strict_types=1);

$ROOT = dirname(__DIR__);
$OUT  = $ROOT . '/db/outages.json';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Полные браузерные заголовки: РВК без Accept-Language отдаёт 403. */
const BROWSER_HEADERS = [
    'User-Agent: ' . UA,
    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language: ru-RU,ru;q=0.9',
];

/** Смещение Сахалина от UTC (Asia/Sakhalin, летнего времени нет). */
const SAKHALIN_OFFSET = 11 * 3600;

/** Заголовок-сводка об отключении (PR-заметки о «водоснабжении» отсеяны). */
function isOutageTitle(string $t): bool
{
    return (bool) preg_match('/отключ|ограничен|авари|прекращен|ремонт|негативн|внимание|промывк|опрессовк/iu', $t);
}

function httpGet(string $url, int $timeout = 12): string
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 3,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_CONNECTTIMEOUT => $timeout,
        CURLOPT_HTTPHEADER     => BROWSER_HEADERS,
        CURLOPT_ACCEPT_ENCODING => '',
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($code < 200 || $code >= 300 || !is_string($body) || $body === '') {
        throw new RuntimeException("HTTP $code");
    }
    return $body;
}

function stripTags(string $html): string
{
    $s = preg_replace(['#<script[\s\S]*?</script>#iu', '#<style[\s\S]*?</style>#iu', '#<[^>]+>#u'], [' ', ' ', ' '], $html) ?? '';
    $s = str_replace(['&nbsp;', '&quot;', '&amp;', '&#39;'], [' ', '"', '&', "'"], $s);
    return trim((string) preg_replace('#\s+#u', ' ', $s));
}

/** «16.09.2026», «11:52» — сахалинское локальное время → ISO (UTC). */
function sakhalinIso(string $dateStr, string $timeStr = '00:00'): string
{
    $d = array_map('intval', explode('.', $dateStr));
    $t = array_map('intval', explode(':', $timeStr));
    if (count($d) !== 3 || $d[0] === 0 || $d[1] === 0) return '';
    $utc = gmmktime($t[0] ?? 0, $t[1] ?? 0, 0, $d[1], $d[0], $d[2]) - SAKHALIN_OFFSET;
    return $utc > 0 ? gmdate('c', $utc) : '';
}

/** Краткий адрес строки ТЗ: пункт (кроме г. Южно-Сахалинск) + улица, ≤ 60. */
function composeShort(string $place, string $firstAddr, string $fallback): string
{
    $parts = [];
    $p = trim((string) preg_replace('/:+$/u', '', $place));
    if ($p !== '' && !preg_match('/^(?:г\.\s*)?Южно-Сахалинск$/iu', $p)) $parts[] = $p;
    $a = trim((string) preg_replace(['/[:;]+$/u', '/\.+$/u'], '', $firstAddr));
    if ($a !== '') $parts[] = $a;
    $short = implode(', ', $parts);
    if ($short === '') $short = $fallback;
    return mb_strlen($short) > 60 ? mb_substr($short, 0, 59) . '…' : $short;
}

/** Адресные строки списка (без «г. Южно-Сахалинск:» и «СОЦ объекты»). */
function pickAddressLines(array $lines, string $place, int $cap = 20): array
{
    $out = [];
    foreach ($lines as $raw) {
        $line = trim((string) preg_replace('#\s+#u', ' ', $raw));
        $line = (string) preg_replace('/^[-–—•*]\s*/u', '', $line);
        $len = mb_strlen($line);
        if ($len < 5 || $len > 200) continue;
        if (preg_match('/^(?:г\.\s*)?Южно-Сахалинск\s*:?\s*$/iu', $line)) continue;
        if ($line === $place) continue;
        if (preg_match('/^(СОЦ|соц)\s/u', $line)) continue;
        if (preg_match('/(ул\.|улиц[аы]|пер\.|переулок|проспект|пр-кт|пр-т|кв-л|квартал|мкр\.?|микрорайон|пос\.|поселок|посёлок|с\.|село|шоссе|наб\.|б-р|снт\.?)/iu', $line)
            && preg_match('/\d/u', $line) && !in_array($line, $out, true)) {
            $out[] = $line;
        }
        if (count($out) >= $cap) break;
    }
    return $out;
}

/* ==================== ИСТОЧНИК 1. Сахалинэнерго (ФРС) ==================== */

function frsType(string $capt): string
{
    if (preg_match('/аварийн/iu', $capt)) return 'emergency';
    if (preg_match('/планов/iu', $capt)) return 'planned';
    return 'unspecified';
}

function collectFrs(string $nowIso): array
{
    try {
        $html = httpGet('https://sakh-frs.ru/');
    } catch (Throwable $e) {
        return ['items' => [], 'error' => $e->getMessage()];
    }
    $items = [];
    $chunks = preg_split("#<div class=['\"]oItem['\"][^>]*>#iu", $html) ?: [];
    foreach (array_slice($chunks, 1) as $chunk) {
        if (count($items) >= 10) break;
        if (!preg_match("#<div class=['\"]oiText['\"]>([\s\S]*?)<div class=['\"]oiDate['\"]#iu", $chunk, $tm)) continue;
        $textHtml = $tm[1];
        $capt = stripTags(preg_match("#<div class=['\"]oiCapt['\"]>([\s\S]*?)</div>#iu", $chunk, $cm) ? $cm[1] : '');
        $title = stripTags(preg_match('#<b>([\s\S]*?)</b>#iu', $textHtml, $bm) ? $bm[1] : '') ?: $capt;
        if ($title === '') continue;
        $pubChunk = stripTags(preg_match("#<div class=['\"]oiDate['\"]>([\s\S]*?)</div>#iu", $chunk, $pm) ? $pm[1] : '');
        $publishedAt = $nowIso;
        if (preg_match('/(\d{1,2}\.\d{1,2}\.\d{4})\s+(\d{1,2}:\d{2})/u', $pubChunk, $p2)) {
            $publishedAt = sakhalinIso($p2[1], $p2[2]) ?: $nowIso;
        }
        $body = (string) preg_replace(
            ["#<div class=['\"]oiSep['\"]></div>#iu", '#</?(b|div|p|br)[^>]*>#iu'],
            ["\n", "\n"],
            $textHtml
        );
        $lines = [];
        foreach (preg_split('#\n+#u', $body) ?: [] as $l) {
            $l = trim((string) preg_replace('#\s+#u', ' ', $l));
            if ($l !== '') $lines[] = $l;
        }
        $place = '';
        foreach ($lines as $l) {
            if (preg_match('/:$/u', $l) && mb_strlen($l) <= 80) { $place = rtrim($l, ':'); break; }
        }
        $addresses = pickAddressLines($lines, $place);
        $when = '';
        if (preg_match('/с\s+\d{1,2}[:.]\d{2}\s*[-–—]?\s*(?:до)?\s*\d{1,2}[:.]\d{2}/iu', $title, $wm)) $when = $wm[0];
        $items[] = [
            'source'      => 'Сахалинэнерго',
            'title'       => $title,
            'url'         => 'https://sakh-frs.ru/',
            'addresses'   => $addresses,
            'short'       => composeShort($place, $addresses[0] ?? '', $title),
            'when'        => $when,
            'kind'        => 'electro',
            'type'        => frsType($capt),
            'publishedAt' => $publishedAt,
            'fetchedAt'   => $nowIso,
        ];
    }
    return ['items' => $items];
}

/* ==================== ИСТОЧНИК 2. СКК (skk65.ru, WP REST) ==================== */

/** Терпеливый JSON: ридер может вернуть обрезанный ответ — спасаем
 *  цельные объекты балансировкой фигурных скобок. */
function skkJsonPosts(string $raw): array
{
    $text = trim($raw);
    $s = mb_strpos($text, '[');
    $e = mb_strrpos($text, ']');
    if ($s !== false && $e !== false && $e > $s) $text = mb_substr($text, $s, $e - $s + 1);
    $arr = json_decode($text, true);
    if (is_array($arr)) return $arr;
    $objs = [];
    $i = 0; $n = strlen($text);
    while ($i < $n) {
        while ($i < $n && $text[$i] !== '{') $i++;
        if ($i >= $n) break;
        $depth = 0; $j = $i; $instr = false; $esc = false;
        while ($j < $n) {
            $c = $text[$j];
            if ($instr) {
                if ($esc) $esc = false;
                elseif ($c === '\\') $esc = true;
                elseif ($c === '"') $instr = false;
            } elseif ($c === '"') $instr = true;
            elseif ($c === '{') $depth++;
            elseif ($c === '}') { $depth--; if ($depth === 0) { $j++; break; } }
            $j++;
        }
        $obj = json_decode(substr($text, $i, $j - $i), true);
        if (!is_array($obj)) break;
        $objs[] = $obj;
        $i = $j;
    }
    return $objs;
}

function collectSkk(string $nowIso): array
{
    try {
        $raw = httpGet('https://skk65.ru/wp-json/wp/v2/posts?per_page=12');
    } catch (Throwable $e) {
        return ['items' => [], 'error' => $e->getMessage()];
    }
    $okCats = [
        'category-goryachaya-voda', 'category-holodnaya-voda',
        'category-otoplenie', 'category-remontnye-raboty',
    ];
    $items = [];
    foreach (skkJsonPosts($raw) as $post) {
        if (count($items) >= 6) break;
        $title = stripTags((string) ($post['title']['rendered'] ?? ''));
        if ($title === '') continue;
        $inCat = false;
        foreach (($post['class_list'] ?? []) as $c) {
            if (in_array($c, $okCats, true)) { $inCat = true; break; }
        }
        if (!$inCat && !isOutageTitle($title)) continue;
        $lines = [];
        foreach (preg_split('#\n+#u', (string) preg_replace('#</p>#iu', "\n", (string) ($post['content']['rendered'] ?? ''))) ?: [] as $l) {
            $l = stripTags($l);
            if ($l !== '') $lines[] = $l;
        }
        $addresses = [];
        foreach ($lines as $l) {
            $l = (string) preg_replace('/^[-–—•*]\s*/u', '', $l);
            $len = mb_strlen($l);
            if ($len < 5 || $len > 200) continue;
            if (preg_match('/(ул\.|улиц[аы]|пер\.|переулок|проспект|пр-кт|пр-т|кв-л|квартал|мкр\.?|микрорайон|пос\.|поселок|посёлок|с\.|село|шоссе|наб\.|б-р)/iu', $l)
                && preg_match('/\d/u', $l)) $addresses[] = $l;
            if (count($addresses) >= 20) break;
        }
        $dg = (string) ($post['date_gmt'] ?? '');
        $publishedAt = $nowIso;
        if (preg_match('#^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$#', $dg)) $publishedAt = $dg . 'Z';
        $when = '';
        if (preg_match('/с\s+\d{1,2}[:.]\d{2}\s*[-–—]?\s*(?:до)?\s*\d{1,2}[:.]\d{2}/iu', $title, $wm)) $when = $wm[0];
        $items[] = [
            'source'      => 'СКК',
            'title'       => $title,
            'url'         => (string) ($post['link'] ?? 'https://skk65.ru/'),
            'addresses'   => $addresses,
            'short'       => composeShort('', $addresses[0] ?? '', $title),
            'when'        => $when,
            'kind'        => 'hot',
            'type'        => preg_match('/авари/iu', $title) ? 'emergency' : 'planned',
            'publishedAt' => $publishedAt,
            'fetchedAt'   => $nowIso,
        ];
    }
    return ['items' => $items];
}

/* ==================== ИСТОЧНИК 3. Водоканал (РВК-Сахалин) ==================== */

function collectVodokanal(string $nowIso): array
{
    try {
        $listHtml = httpGet('https://sakhalin.rosvodokanal.ru/pressroom/news/');
    } catch (Throwable $e) {
        return ['items' => [], 'error' => $e->getMessage()];
    }
    $titles = []; $dates = []; $hrefs = [];
    if (preg_match_all('#class="news-item__title">([^<]+)</p>#iu', $listHtml, $m1)) $titles = $m1[1];
    if (preg_match_all('#class="news-item__meta">([^<]+)</p>#iu', $listHtml, $m2)) $dates = $m2[1];
    if (preg_match_all('#href=["\'](/pressroom/news/\d+/)["\']#iu', $listHtml, $m3)) $hrefs = $m3[1];
    $n = min(count($titles), count($dates), count($hrefs), 3);
    $items = []; $seen = [];
    for ($i = 0; $i < $n; $i++) {
        $title = stripTags($titles[$i]);
        if (!isOutageTitle($title) || isset($seen[$hrefs[$i]])) continue;
        $seen[$hrefs[$i]] = true;
        $url = 'https://sakhalin.rosvodokanal.ru' . $hrefs[$i];
        $addresses = []; $when = ''; $artDate = '';
        try {
            $art = httpGet($url);
            $start = mb_strpos($art, 'news-detail');
            $end = mb_strpos($art, 'К списку новостей', $start);
            $frag = $start !== false
                ? mb_substr($art, $start, ($end !== false && $end > $start ? $end : mb_strlen($art)) - $start)
                : $art;
            foreach (preg_split('#(</p>|<br\s*/?>)#iu', $frag) ?: [] as $l) {
                $l = stripTags($l);
                $len = mb_strlen($l);
                if ($len < 5 || $len > 200) continue;
                if (preg_match('/(ул\.|улиц[аы]|пер\.|переулок|проспект|пр-кт|пр-т|кв-л|квартал|мкр\.?|микрорайон|пос\.|поселок|посёлок|с\.|село|шоссе|наб\.|б-р)/iu', $l)
                    && preg_match('/\d/u', $l) && !in_array($l, $addresses, true)) $addresses[] = $l;
                if (count($addresses) >= 20) break;
            }
            $text = stripTags($frag);
            if (preg_match('/\d{1,2}\.\d{1,2}\.\d{4}/u', $text, $dm)) $artDate = $dm[0];
            if (preg_match('/с\s+\d{1,2}[:.]\d{2}\s*[-–—]?\s*(?:до)?\s*\d{1,2}[:.]\d{2}/iu', $text, $wm)) $when = $wm[0];
        } catch (Throwable $e) {
            // статья не открылась — карточка всё равно информативна
        }
        $items[] = [
            'source'      => 'Водоканал',
            'title'       => $title,
            'url'         => $url,
            'addresses'   => $addresses,
            'short'       => composeShort('', $addresses[0] ?? '', $title),
            'when'        => $when,
            'kind'        => 'cold',
            'type'        => preg_match('/авари|негативн/iu', $title) ? 'emergency' : 'planned',
            'publishedAt' => sakhalinIso($dates[$i] ?: $artDate) ?: $nowIso,
            'fetchedAt'   => $nowIso,
        ];
    }
    return ['items' => $items];
}

/* ==================== СБОРКА ==================== */

$nowIso = gmdate('c');
$res = [
    ['Сахалинэнерго', collectFrs($nowIso)],
    ['СКК', collectSkk($nowIso)],
    ['Водоканал', collectVodokanal($nowIso)],
];
$items = []; $errors = []; $seen = [];
foreach ($res as [$name, $r]) {
    foreach (($r['items'] ?? []) as $it) {
        $key = $it['source'] . '|' . mb_substr($it['title'], 0, 80);
        if (isset($seen[$key])) continue;
        $seen[$key] = true;
        $items[] = $it;
    }
    if (!empty($r['error'])) $errors[] = ['source' => $name, 'error' => $r['error']];
}
// сортировка по времени публикации (свежие — вверху), не более 30 записей
usort($items, static function ($a, $b) {
    $ta = @strtotime($a['publishedAt'] ?: $a['fetchedAt']);
    $tb = @strtotime($b['publishedAt'] ?: $b['fetchedAt']);
    return $tb <=> $ta;
});
$items = array_slice($items, 0, 30);

$payload = json_encode(
    ['updated' => $nowIso, 'items' => $items, 'errors' => $errors],
    JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
);

if ($payload !== false) {
    if (!is_dir(dirname($OUT))) mkdir(dirname($OUT), 0775, true);
    $tmp = $OUT . '.tmp';
    file_put_contents($tmp, $payload);
    rename($tmp, $OUT); // атомарная подмена
    fwrite(STDERR, '[' . gmdate('c') . '] outages: ' . count($items) . " items, errors: " . count($errors) . "\n");
    exit(0);
}
fwrite(STDERR, '[' . gmdate('c') . "] outages: json encode failed\n");
exit(1);
```

## Приложение. Фикстуры, тесты, приёмка

- **Фикстуры** (`scripts/fixtures/`): `frs-outages.html` (6 живых карточек ФРС),
  `skk-wp.json` (живой ответ WP REST СКК + 2 дописанных поста-паттерна),
  `rvc-news.html` / `rvc-article.html` (живая разметка списка/статьи РВК).
- **Тесты** (`scripts/test-informers.ts`): секция «Задача 4» — 36 проверок
  (фикстуры трёх ведомств, аварийная сводка, краткие адреса, формат времени,
  ТОП-3, live-сбор ≥5 сводок, CSS- и HTML-проверки). Итого **204/204**.
- **Смок-скрипт:** `scripts/task4-smoke.ts` (bun scripts/task4-smoke.ts).
- **Живая приёмка (16.09.2026):** API `/api/home/outages` — source=aggregated,
  3 записи (СКК ул. Ленина, 304А — 14:11; Сахалинэнерго пер. Энергетиков 1А, 6 — 11:52;
  Сахалинэнерго с. Ключи, снт. "Вагонник" — 11:48); клик заголовка → /disconnections.php;
  /disconnections.php — 16 записей в трёх блоках; мобайл 400 — без прокруток-X,
  компактные строки (10.5px/4px); консоль чиста; скриншоты t4-*.png в download/.
- **Расписание:** планировщик src/instrumentation-node.ts — раз в 30 минут;
  PHP-крон: `*/30 * * * * php scripts/cron-outages.php`.
