"use client";

/**
 * СТАДИЯ 2 (Шаги 5-8): правый столбец главной — Сахалинские контентные
 * информеры. Панели несёт класс .sakh-card (пользовательская метка
 * рамки информера; на десктопе стилей у класса нет — только мобильные
 * правила ≤480px):
 *   8.1 «Погода на Сахалине» — готовый бесплатный адаптивный виджет
 *       meteoblue (pogodnik.com закрыт ботам — 403, взят аналогичный
 *       бесплатный сервис), геопривязан к Южно-Сахалинску, резиновая
 *       ширина 100% на всех экранах, включая 360–414px; старая
 *       «таблица прогноза по дням» удалена; синий заголовок плашки —
 *       ссылка «клик вглубь» на /weather.php;
 *   8.2 «Курсы валют» — ТЗ 2026-09-23 (Замена источника + доработки):
 *       реальные курсы покупки/продажи наличной валюты по 6 валютам
 *       (USD/EUR/CNY/THB за 1, JPY/KRW за 1000) и 15 банкам ТЗ
 *       (агрегатор bankdep → mainfin → banktop → кэш БД; см.
 *       src/lib/currency-sources.ts; сбор раз в 30 минут); лучший курс
 *       покупки/продажи подсвечивается мягким зелёным ТЗ
 *       (фон #E2F0D9, текст #2E7D32); плашки «устарело» упразднены —
 *       неактуальное значение показывается обычным числом, свежесть —
 *       в тултипах и строке «обновлено»; синий заголовок плашки —
 *       ссылка «клик вглубь» на /currency.php;
 *   8.3 «Отключения» — авто-агрегатор сводок (Сахалинэнерго/СКК/
 *       Водоканал, cron + instrumentation; Шаг №7: сбор РАЗ В 30 МИНУТ,
 *       строго 3 самые свежие записи по времени публикации, синий
 *       заголовок — ссылка на /disconnections.php). Задача 13: если в
 *       базе парсера пусто (source=empty) — живой текст ТЗ
 *       «🟢 …не зафиксировано. Проверено: [текущее время]» вместо
 *       прежней зависшей надписи;
 *   8.4 «Пробки» — Задача 13: синий заголовок-плашка — ССЫЛКА на
 *       /traffic.php (вниз на большую карту), а под ним — реальный балл
 *       Яндекс.Пробок в формате ТЗ «🟢 3 балла — Дороги свободны»
 *       (серый круг и прежняя надпись о недоступности убраны; балл считает адаптер
 *       lib/traffic.ts из живых trf-тайлов слоя пробок) + официальный
 *       слой пробок в iframe-виджете Яндекс Карт;
 *   8.5 «Службы спасения» (быв. «Полезные телефоны и службы» —
 *       переименован по ТЗ 2026-09-21; состав телефонов не менялся).
 */

import { useEffect, useState } from "react";
import { Info, Phone } from "lucide-react";
import DeferredIframe from "@/components/site/deferred-iframe";
import SakhDatetimeBlock from "@/components/site/sakh-datetime-block";
import { ballPlural, trafficEmoji } from "@/lib/traffic-ui";
import { outageOrgBadge, outageWhenLabel } from "@/lib/outages-taxonomy";

interface RatesPair {
  buy: number | null;
  sell: number | null;
}

/** Ячейка v2 (ТЗ 2026-09-23): статус для тултипов состояния. */
interface RatesCell extends RatesPair {
  status: "ok" | "stale" | "unpublished" | "error";
  ts?: string;
  src?: string;
}

interface RatesData {
  source: "multi" | "cache" | "none";
  updated: string;
  sources?: Record<string, string>;
  banks: {
    bank: string;
    usd: RatesCell | null;
    eur: RatesCell | null;
    cny: RatesCell | null;
    jpy: RatesCell | null;
    krw: RatesCell | null;
    thb: RatesCell | null;
  }[];
}

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

interface TrafficData {
  level: number | null;
  label: string;
  updated: string;
  source: string;
}

/** «84,90» — запятая и два знака, как принято на сайте. */
function fmtMoney(v: number | null | undefined): string {
  if (typeof v !== "number" || !isFinite(v)) return "—";
  return v.toFixed(2).replace(".", ",");
}

/** Лучший банк по валюте: максимальная покупка / минимальная продажа.
 *  Приоритет ok → stale (свежая строка бьёт кэш при равных значениях):
 *  плашек «устарело» больше нет, но свежесть учитывается при выборе
 *  имени банка-лидера. */
function bestRate(
  banks: RatesData["banks"],
  cur: "usd" | "eur" | "cny" | "jpy" | "krw" | "thb",
  kind: "buy" | "sell",
): { bank: string; value: number } | null {
  let best: { bank: string; value: number } | null = null;
  for (const b of banks) {
    const cell = b[cur];
    const v = cell?.[kind];
    if (typeof v !== "number" || !isFinite(v)) continue;
    const better =
      !best ||
      v !== best.value ||
      (cell?.status === "ok" && b[cur]?.status !== "ok");
    if (!best || (kind === "buy" ? v > best.value : v < best.value) || (v === best.value && better)) {
      best = { bank: b.bank, value: v };
    }
  }
  return best;
}

/** Строки таблицы курсов — ОСТРОВНАЯ ШЁСТЁРКА ТЗ (2026-09-23): доллар,
 *  евро, юань и тайский бат (за 1 единицу), японская иена и
 *  южнокорейская вона (строго за 1000). */
const RATE_ROWS: {
  code: string;
  sign: string;
  name: string;
  unit?: string;
  key: "usd" | "eur" | "cny" | "jpy" | "krw" | "thb";
}[] = [
  { code: "USD", sign: "$", name: "Доллар", key: "usd" },
  { code: "EUR", sign: "€", name: "Евро", key: "eur" },
  { code: "CNY", sign: "¥", name: "Юань", key: "cny" },
  { code: "JPY", sign: "¥", name: "Иена", unit: "за 1000", key: "jpy" },
  { code: "KRW", sign: "₩", name: "Вона", unit: "за 1000", key: "krw" },
  { code: "THB", sign: "฿", name: "Бат", key: "thb" },
];

/** Домены источников для подвала панели (ТЗ 2026-09-23). */
const SOURCE_DOMAINS: Record<string, string> = {
  bankdep: "bankdep.ru",
  mainfin: "mainfin.ru",
  banktop: "banktop.ru",
};

const EMPTY_RATES: RatesData = { source: "none", updated: "", banks: [] };
const EMPTY_OUTAGES: OutagesData = { source: "none", updated: "", items: [] };

/** «16.09.2026 10:35» — локальное время устройства в момент проверки
 *  (ТЗ: «Проверено: [Текущее Время]» — автоматика проверила прямо сейчас). */
function fmtNowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const PHONES: [string, string][] = [
  ["Экстренные службы", "112"],
  ["Полиция", "102"],
  ["Скорая помощь", "103"],
  ["Аварийная газовая служба", "104"],
  ["Единая справочная служба", "118"],
];

export default function HomeRight() {
  const [rates, setRates] = useState<RatesData>(EMPTY_RATES);
  const [outages, setOutages] = useState<OutagesData>(EMPTY_OUTAGES);
  const [traffic, setTraffic] = useState<TrafficData | null>(null);
  const [checkedAt, setCheckedAt] = useState("");

  useEffect(() => {
    let alive = false;
    fetch("/api/home/rates")
      .then(async (r) => (r.ok ? r.json() : EMPTY_RATES))
      .then((d: RatesData) => {
        if (!alive) setRates(d);
      })
      .catch(() => {});
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
    fetch("/api/traffic")
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d: TrafficData | null) => {
        if (!alive && d) setTraffic(d);
      })
      .catch(() => {});
    return () => {
      alive = true;
    };
  }, []);

  const hasBankRows = rates.banks.length > 0;

  // 2026-10-02: подпись «Наличные курсы касс · bankdep.ru · mainfin.ru»
  // удалена по просьбе пользователя — на главной её больше нет.
  // На отдельной странице /currency.php подпись остаётся (там нужна).

  return (
    <div className="mp-right right-column">
      {/* Директива «Сахалинские часы»: белая плашка .sakh-card с радиусом
          4px и лёгкой тенью, время тикает каждую секунду через JavaScript,
          часовой пояс принудительно Asia/Magadan (GMT+11) — независимо
          от региона пользователя. */}
      <SakhDatetimeBlock />

      {/* 8.1 «Погода на Сахалине» — Шаг 5: старая статичная таблица
          прогноза по дням полностью удалена. Единственный информер блока
          — готовый бесплатный адаптивный HTML-виджет погоды (pogodnik.com
          закрыт ботам — 403, поэтому аналогичный бесплатный meteoblue),
          геопривязка — Южно-Сахалинск. Контейнер .mp-weather резиновый
          width:100% внутри карточки .sakh-card: на смартфонах 360–414px
          виджет подстраивается под ширину и не выходит за белую рамку.
          Синий заголовок плашки — кликабельная ссылка на /weather.php. */}
      <section className="mp-panel sakh-card" aria-label="Погода на Сахалине">
        <div className="mp-paneltitle">
          <span className="tri">▼</span>
          <a href="/weather.php" title="Подробный прогноз по районам Сахалина">
            Погода на Сахалине
          </a>
        </div>
        {/* ТЗ 2026-09-21 «оцентруй надпись Южно-Сахалинск … покрась в
            тёмно-синий»: надпись живёт внутри кросс-доменного iframe
            meteoblue (нашим CSS недостижима) — вместо неё СВОЯ шапка
            .mp-w-cap (по центру, var(--sm-navy)); текст = статичные
            данные виджета (город/координаты/высота — константы, не
            прогноз). Внутренняя шапка iframe подрезана стилями
            (globals: .mp-w-frame -50px / .mp-weather overflow). */}
        <div className="mp-w-cap">
          <b>Южно-Сахалинск</b>
          <small>46.95°С 142.74°В 48м над уровнем моря</small>
        </div>
        <div className="mp-weather">
          {/* src откладывается до window.load: медленный/подвисший ответ
              meteoblue в сети пользователя не должен удерживать событие
              загрузки страницы (вечный спиннер панели предпросмотра). */}
          <DeferredIframe
            className="mp-w-frame"
            src="https://www.meteoblue.com/ru/weather/widget/daily/yuzhno-sakhalinsk_russia_2119441"
            title="Погода в Южно-Сахалинске — виджет meteoblue"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>

      {/* 8.2 «Курсы валют» — ТЗ 2026-09-23: наличные курсы касс 15 банков
          ТЗ по шести валютам (THB за 1, JPY/KRW за 1000; агрегатор
          bankdep → mainfin → banktop → кэш, сбор раз в 30 минут).
          Колонки «Покупка» и «Продажа», в ячейке — лучший курс и имя
          лучшего банка, ячейки-победители подсвечены цветами ТЗ
          (#E2F0D9 фон, #2E7D32 текст). Состояния: число / «—»+тултип /
          «Ошибка»; плашек «устарело» нет — старое значение = обычное
          число, свежесть — в тултипах и подвале. Синий заголовок
          плашки — кликабельная ссылка на /currency.php. */}
      <section className="mp-panel sakh-card" aria-label="Курсы валют">
        <div className="mp-paneltitle">
          <span className="tri">▼</span>
          <a href="/currency.php" title="Рейтинг всех обменников острова — скоро">
            Курсы валют
          </a>
        </div>
        <div className="mp-rates">
          {hasBankRows ? (
            <table className="mp-rt-table mp-rt-best">
              <thead>
                <tr>
                  <th scope="col">Валюта</th>
                  <th scope="col" className="num">Покупка</th>
                  <th scope="col" className="num">Продажа</th>
                </tr>
              </thead>
              <tbody>
                {RATE_ROWS.map((row) => {
                  const bb = bestRate(rates.banks, row.key, "buy");
                  const bs = bestRate(rates.banks, row.key, "sell");
                  return (
                    <tr key={row.code}>
                      <th scope="row">
                        <span className="cur-ic" aria-hidden="true">
                          {row.sign}
                        </span>
                        {row.name}
                        {row.unit ? <small title={row.unit}>{row.unit}</small> : null}
                      </th>
                      <td className="bestcell">
                        <b>{fmtMoney(bb?.value ?? null)}</b>
                        <i>{bb?.bank ?? "—"}</i>
                      </td>
                      <td className="bestcell">
                        <b>{fmtMoney(bs?.value ?? null)}</b>
                        <i>{bs?.bank ?? "—"}</i>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="mp-offnote">
              <Info size={20} strokeWidth={1.9} aria-hidden="true" />
              <span>Курсы обновляются…</span>
            </div>
          )}
        </div>
      </section>

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

      {/* 8.4 «Пробки» — Задача 13: синий заголовок-плашка — ссылка на
          /traffic.php (как у «Погоды»/«Валют»/«Отключений»); под ним —
          реальный балл Яндекс.Пробок в формате ТЗ
          «🟢 3 балла — Дороги свободны» (адаптер lib/traffic.ts считает
          его из живых trf-тайлов слоя пробок — у города в системе
          Яндекса числового балла нет; серый круг и прежняя надпись
          о недоступности убраны); ниже — официальный слой пробок в iframe-виджете. */}
      <section className="mp-panel sakh-card" aria-label="Пробки">
        <div className="mp-paneltitle">
          <span className="tri">▼</span>
          <a href="/traffic.php" title="Карта пробок и дороги Южно-Сахалинска">
            Пробки
          </a>
        </div>
        {traffic && traffic.level !== null ? (
          <div className="mp-tr-live">
            <span className="mp-tr-emoji" aria-hidden="true">
              {trafficEmoji(traffic.level)}
            </span>
            <b>
              {traffic.level} {ballPlural(traffic.level)} — {traffic.label}
            </b>
          </div>
        ) : (
          <div className="mp-tr-live is-wait">
            <b>Балл обновляется — актуальный слой пробок на карте ниже</b>
          </div>
        )}
        <DeferredIframe
          className="mp-tr-map"
          src="https://yandex.com/map-widget/v1/?ll=142.738%2C46.959&z=12&l=trf"
          title="Пробки Южно-Сахалинска — Яндекс.Карты"
          loading="lazy"
        />
        {traffic ? <div className="mp-w-upd">Обновлено: {traffic.updated}</div> : null}
      </section>

      {/* 8.5 «Службы спасения» — переименование из «Полезные телефоны и
          службы» по ТЗ 2026-09-21; содержимое (PHONES) не менялось */}
      <section className="mp-panel" aria-label="Службы спасения">
        <div className="mp-paneltitle">
          <span className="tri">▼</span>Службы спасения
        </div>
        <ul className="mp-phones">
          {PHONES.map(([name, num]) => (
            <li key={num}>
              <Phone size={13} strokeWidth={2.2} aria-hidden="true" />
              <span className="mp-ph-name">{name}</span>
              <a className="mp-ph-num" href={`/poleznoe?service=phones`} title="Смотреть в разделе «Полезное»">
                {num}
              </a>
            </li>
          ))}
        </ul>
        <div className="mp-all">
          <a href="/poleznoe">Показать все →</a>
        </div>
      </section>
    </div>
  );
}
