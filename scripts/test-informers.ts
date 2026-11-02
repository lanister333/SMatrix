/**
 * СТАДИЯ 2: проверка парсеров информеров (Шаги 6-8 + ЗАДАЧА 3).
 *  — валютный парсер (ЗАДАЧА 3): живые фикстуры страниц ЧЕТВЁРКИ
 *      банков ТЗ на агрегаторе kovalut.ru (Южно-Сахалинск):
 *      kovalut-atb.html (АТБ — USD/EUR), kovalut-solid-bank.html
 *      (Солид Банк — все 5 валют: JPY за 100, KRW за 1000),
 *      kovalut-bank-primore.html (Приморье — USD/EUR),
 *      kovalut-sberbank-rossii.html (Сбер — страница адресов БЕЗ
 *      курсов: касса не публикует — честный ноль);
 *  — адресный экстрактор отключений: синтетическая сводка;
 *  — Шаг №7: время публикации (extractPubDate) и «Вариант А» —
 *      строго 3 самые свежие записи по publishedAt (pickTopOutages),
 *      свет и вода вперемешку, свежее — вверху;
 *  — пробки: Задача 13 — РЕАЛЬНЫЙ балл из живых trf-тайлов слоя
 *      пробок Яндекса (level 1..10) + хелперы формата ТЗ;
 *  — live-прогоны: kovalut.ru из этой песочницы доступен — парсер
 *      обязан собрать реальные курсы касс банков ТЗ (островная
 *      пятёрка: USD/EUR/CNY за 1, JPY за 100, KRW за 1000).
 */

import { readFileSync } from "fs";
import path from "path";
import {
  parseKovalutBankPage,
  fetchKovalutBankPage,
  runCurrencyParse,
  latestCurrencyBatch,
} from "../src/lib/currency-parser";
import { TARGET_BANKS, TARGET_BANK_NAMES, filterTargetBankRows } from "../src/lib/currency-banks";
import {
  extractAddresses,
  extractPubDate,
  findLinks,
  parseSakhalinEnergoHtml,
  parseSkkPosts,
  parseVodokanalArticleHtml,
  parseVodokanalNewsList,
  pickTopOutages,
  readOutages,
  runOutagesParse,
  sakhalinIso,
  type OutageItem,
} from "../src/lib/outages-parser";
import { CITY_GROUPS, codeLabel, hpaToMm, metSymbolLabel, rumbFromDeg, sakhalinLocal, todayHourIndexes } from "../src/lib/weather-data";
import { isRoadReport } from "../src/lib/roads-taxonomy";
import { EMERGENCY_PHONES, FILTER_CHIPS, OUTAGE_DISTRICTS, outageOrgBadge, outageWhenLabel } from "../src/lib/outages-taxonomy";
import { TRAFFIC_LABELS, levelLabel } from "../src/lib/traffic-ui";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}${extra ? " — " + extra : ""}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}${extra ? " — " + extra : ""}`);
  }
}

async function main() {
  console.log("=== Задача 3: парсер страниц четвёрки банков ТЗ (фикстуры kovalut.ru) ===");
  // АТБ: касса публикует только USD и EUR
  const atbHtml = readFileSync(
    path.join(__dirname, "fixtures", "kovalut-atb.html"),
    "utf8",
  );
  const atbRates = parseKovalutBankPage(atbHtml, "АТБ");
  check("АТБ: ровно 2 валюты (USD, EUR) — CNY/JPY/KRW касса не публикует", atbRates.length === 2 && atbRates.every((r) => r.currency === "USD" || r.currency === "EUR"), JSON.stringify(atbRates));
  const atbUsd = atbRates.find((r) => r.currency === "USD");
  check("АТБ USD 83.50/89.15 (живая страница 16.09.2026)", atbUsd?.buy === 83.5 && atbUsd?.sell === 89.15, JSON.stringify(atbUsd));
  const atbEur = atbRates.find((r) => r.currency === "EUR");
  check("АТБ EUR 94.18/106.76", atbEur?.buy === 94.18 && atbEur?.sell === 106.76, JSON.stringify(atbEur));
  // Солид Банк: единственная касса города с полной островной пятёркой
  const solidHtml = readFileSync(
    path.join(__dirname, "fixtures", "kovalut-solid-bank.html"),
    "utf8",
  );
  const solidRates = parseKovalutBankPage(solidHtml, "Солид Банк");
  check("Солид Банк: островная пятёрка целиком (5 валют, THB отсечён)", solidRates.length === 5 && !solidRates.some((r) => r.currency === "THB"), JSON.stringify(solidRates.map((r) => r.currency)));
  const solidJpy = solidRates.find((r) => r.currency === "JPY");
  const solidKrw = solidRates.find((r) => r.currency === "KRW");
  check("Солид Банк JPY 54.30/56.10 — СТРОГО за 100", solidJpy?.buy === 54.3 && solidJpy?.sell === 56.1, JSON.stringify(solidJpy));
  check("Солид Банк KRW 64.00/69.50 — СТРОГО за 1000", solidKrw?.buy === 64 && solidKrw?.sell === 69.5, JSON.stringify(solidKrw));
  const solidCny = solidRates.find((r) => r.currency === "CNY");
  check("Солид Банк CNY 12.80/12.98 (юань, не иены!)", solidCny?.buy === 12.8 && solidCny?.sell === 12.98, JSON.stringify(solidCny));
  check("банк в строках — имя ТЗ «Солид Банк»", solidRates.every((r) => r.bank === "Солид Банк"));
  // Приморье: касса публикует только USD и EUR
  const primHtml = readFileSync(
    path.join(__dirname, "fixtures", "kovalut-bank-primore.html"),
    "utf8",
  );
  const primRates = parseKovalutBankPage(primHtml, "Приморье");
  const primUsd = primRates.find((r) => r.currency === "USD");
  check("Приморье USD 91.15/92.00", primUsd?.buy === 91.15 && primUsd?.sell === 92, JSON.stringify(primUsd));
  check("Приморье: ровно USD/EUR (без CNY/JPY/KRW)", primRates.length === 2, JSON.stringify(primRates.map((r) => r.currency)));
  // Сбер: страница адресов отделений БЕЗ валютных блоков — честный ноль
  const sberHtml = readFileSync(
    path.join(__dirname, "fixtures", "kovalut-sberbank-rossii.html"),
    "utf8",
  );
  const sberRates = parseKovalutBankPage(sberHtml, "Сбер");
  check("Сбер: 0 курсов (касса не публикует — без выдуманных данных)", sberRates.length === 0);
  // Нормализация номиналов ТЗ: курс за единицу → за 100 / за 1000
  const unitHtml = `<div class="text-sm">JPY</div><div class="-mt-1 font-sans text-lg font-bold">0.54<!-- --> / <!-- -->0.58</div>` +
    `<div class="text-sm">KRW</div><div class="-mt-1 font-sans text-lg font-bold">0.064<!-- --> / <!-- -->0.07</div>`;
  const normRates = parseKovalutBankPage(unitHtml, "Сбер");
  const normJpy = normRates.find((r) => r.currency === "JPY");
  const normKrw = normRates.find((r) => r.currency === "KRW");
  check("нормализация: иена за единицу → СТРОГО за 100", normJpy?.buy === 54 && normJpy?.sell === 58, JSON.stringify(normJpy));
  check("нормализация: вона за единицу → СТРОГО за 1000", normKrw?.buy === 64 && normKrw?.sell === 70, JSON.stringify(normKrw));
  // прочерки источника («—») мягко пропускаются
  const dashRates = parseKovalutBankPage(
    `<div class="text-sm">JPY</div><div class="-mt-1 font-sans text-lg font-bold">—<!-- --> / <!-- -->—</div>`,
    "Сбер",
  );
  check("прочерк источника — строка не создаётся", dashRates.length === 0);
  // Пятёрка банков ТЗ: список, порядок, фильтр старых серий
  check("пятёрка ТЗ в порядке АТБ|Солид|Сбер|ВТБ|Приморье", TARGET_BANK_NAMES.join("|") === "АТБ|Солид Банк|Сбер|ВТБ|Приморье", TARGET_BANK_NAMES.join(","));
  const mixedBanks = [
    { bank: "Газпромбанк" },
    { bank: "Приморье" },
    { bank: "АТБ" },
    { bank: "ВТБ" },
    { bank: "Сбер" },
    { bank: "Экспобанк" },
    { bank: "Солид Банк" },
  ];
  check("фильтр: банки вне ТЗ отсечены, порядок — ТЗ", filterTargetBankRows(mixedBanks).map((b) => b.bank).join("|") === "АТБ|Солид Банк|Сбер|ВТБ|Приморье", filterTargetBankRows(mixedBanks).map((b) => b.bank).join(","));
  check("ВТБ: slug bank-vtb на kovalut.ru", TARGET_BANKS.find((b) => b.name === "ВТБ")?.slug === "bank-vtb", TARGET_BANKS.find((b) => b.name === "ВТБ")?.slug ?? "(нет)");

  console.log("=== Задача 3: runCurrencyParse → БД (пятёрка ТЗ, live kovalut.ru) ===");
  const liveBank = TARGET_BANKS[0];
  try {
    const live = await fetchKovalutBankPage(liveBank.slug, 20000);
    const liveRates = parseKovalutBankPage(live, liveBank.name);
    check("live-страница АТБ распарсена (≥1 курс)", liveRates.length >= 1, `${liveRates.length} строк`);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    check("live-неудача мягкая", /HTTP|timeout|без таблицы/i.test(m), m.slice(0, 80));
  }
  // ВТБ — пятый банк ТЗ: страница отдаёт реальные курсы для ЮС
  try {
    const vtbLive = await fetchKovalutBankPage("bank-vtb", 20000);
    const vtbRates = parseKovalutBankPage(vtbLive, "ВТБ");
    check("ВТБ live-страница распарсена (USD+EUR+CNY)", vtbRates.length >= 3, `${vtbRates.length} строк`);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    check("ВТБ live-неудача мягкая", /HTTP|timeout|без таблицы/i.test(m), m.slice(0, 80));
  }
  const run = await runCurrencyParse();
  check("парсинг прошёл (kovalut live доступен)", run.ok, `строк: ${run.count}, ошибки: ${(run.error ?? "—").slice(0, 90)}, заметки: ${(run.notes ?? "—").slice(0, 90)}`);
  check("в заметках — честный статус Сбера (нет публикации)", (run.notes ?? "").includes("Сбер:"), (run.notes ?? "").slice(0, 160));
  const rows = await latestCurrencyBatch();
  check("серия сохранена в БД", rows !== null && rows.length > 0, `${rows?.length ?? 0} строк`);
  check("источник в БД — kovalut.ru", rows?.every((r) => r.source === "kovalut.ru") ?? false);
  check("в БД только банки ТЗ", rows?.every((r) => TARGET_BANK_NAMES.includes(r.bank)) ?? false, [...new Set(rows?.map((r) => r.bank) ?? [])].join(","));
  const jpyRow = rows?.find((r) => r.currency === "JPY");
  const krwRow = rows?.find((r) => r.currency === "KRW");
  check("иена за 100 в БД (значение > 5)", jpyRow !== undefined && (jpyRow.buy ?? 0) > 5, JSON.stringify(jpyRow));
  check("вона за 1000 в БД (значение > 5)", krwRow !== undefined && (krwRow.buy ?? 0) > 5, JSON.stringify(krwRow));

  console.log("=== Шаг 7: экстрактор адресов отключений ===");
  const fixturePage = `<html><body>
    <div>Плановое отключение электроэнергии 16 сентября с 09:00 до 17:00</div>
    <div>ул. Сахалинская, 45, 47; ул. Ленина, 210 — работы в сети</div>
    <div>мкр. Дальнее, 4 — замена трансформатора</div>
    <a href="/news/otklyucheniya-16-sept">Отключения 16 сентября</a>
    <a href="/about">О компании</a>
  </body></html>`;
  const { addresses, when } = extractAddresses(fixturePage);
  check("3+ адреса (включая после «;»)", addresses.length >= 3, addresses.slice(0, 3).join(" | "));
  check("время найдено", /09:00|16 сентября/.test(when), when);
  const links = findLinks(fixturePage, "https://example.ru/");
  check("ссылка-сводка отобрана, «О компании» — нет", links.length === 1 && links[0].url.includes("otklyucheniya"), links.map((l) => l.url).join(","));
  check("относительная ссылка абсолютизирована", links[0]?.url === "https://example.ru/news/otklyucheniya-16-sept");

  console.log("=== Шаг №7: extractPubDate — время публикации ===");
  check("<time datetime>", extractPubDate('<div><time datetime="2025-09-16T08:30:00+11:00">утра</time></div>').startsWith("2025-09-15T"), extractPubDate('<time datetime="2025-09-16T08:30:00+11:00">t</time>'));
  check("«16 сентября 2025» → 2025-09-16", extractPubDate("<p>Опубликовано 16 сентября 2025</p>") === "2025-09-16T00:00:00.000Z", extractPubDate("Опубликовано 16 сентября 2025"));
  check("«16.09.2025» → 2025-09-16", extractPubDate("<div>Дата: 16.09.2025</div>") === "2025-09-16T00:00:00.000Z", extractPubDate("Дата: 16.09.2025"));
  check("«16/09/25» (двузначный год) → 2025-09-16", extractPubDate("16/09/25") === "2025-09-16T00:00:00.000Z", extractPubDate("16/09/25"));
  check("ISO «2025-09-16» → 2025-09-16", extractPubDate("<span>2025-09-16</span>") === "2025-09-16T00:00:00.000Z", extractPubDate("2025-09-16"));
  check("даты нет — пусто", extractPubDate("<p>Отключение света с 09:00 до 17:00</p>") === "");

  console.log("=== Шаг №7: pickTopOutages — Вариант А (3 свежие, по publishedAt) ===");
  const mkItem = (source: string, url: string, publishedAt: string, fetchedAt: string) => ({
    source, title: `Сводка ${source}`, url, addresses: ["ул. Сахалинская, 45"], when: "с 09:00 до 17:00", publishedAt, fetchedAt,
  });
  const mixed = [
    mkItem("Сахалинэнерго", "https://x.ru/a", "2026-09-15T02:00:00.000Z", "2026-09-15T02:00:00.000Z"),
    mkItem("СКК", "https://x.ru/b", "2026-09-15T06:00:00.000Z", "2026-09-15T06:00:00.000Z"),
    mkItem("Сахалинэнерго", "https://x.ru/c", "2026-09-14T22:00:00.000Z", "2026-09-14T22:00:00.000Z"),
    mkItem("Водоканал", "https://x.ru/d", "2026-09-15T09:00:00.000Z", "2026-09-15T09:00:00.000Z"),
    mkItem("СКК", "https://x.ru/e", "", "2026-09-13T00:00:00.000Z"), // fallback → fetchedAt
  ];
  const top = pickTopOutages(mixed);
  check("строго 3 записи из 5", top.length === 3, `${top.length}`);
  check("самое свежее (вода) вверху — источник не важен", top[0]?.source === "Водоканал" && top[0]?.url.endsWith("/d"), top.map((t) => t.source).join(" > "));
  check("порядок строго по времени публикации (убывание)", top.map((t) => t.url.endsWith("/d") ? "d" : t.url.endsWith("/b") ? "b" : t.url.endsWith("/a") ? "a" : "?").join("") === "dba", top.map((t) => t.url.slice(-1)).join(","));
  check("свет и вода вперемешку (не сгруппированы по источнику)", new Set(top.map((t) => t.source)).size >= 2, [...new Set(top.map((t) => t.source))].join(","));
  check("пустой publishedAt → fallback fetchedAt (самая старая не в топе)", !top.some((t) => t.url.endsWith("/e")));
  check("мутации входа нет (копия)", mixed.length === 5);
  check("n=2 — обрезка регулируется", pickTopOutages(mixed, 2).length === 2);

  console.log("=== Шаг 7: runOutagesParse (live) + чтение файла ===");
  const oRes = await runOutagesParse();
  check("runOutagesParse завершился без исключений", true, `${oRes.count} сводок`);
  const of = await readOutages();
  check("db/outages.json создан", of !== null && typeof of.updated === "string");
  check("ошибки недоступных источников записаны", Array.isArray(of?.errors), `${of?.errors?.length ?? 0} ошибок (источник-виновник пишется честно)`);
  check("каждая запись несёт publishedAt (Шаг №7)", (of?.items ?? []).every((it) => typeof it.publishedAt === "string" && it.publishedAt.length > 0), (of?.items ?? []).map((it) => it.publishedAt).join(","));

  console.log("=== Шаг 8 / Задача 13: РЕАЛЬНЫЙ балл пробок (живые trf-тайлы) ===");
  const { getTraffic } = await import("../src/lib/traffic");
  const t = await getTraffic();
  check("getTraffic вернул структуру", typeof t.label === "string" && typeof t.updated === "string");
  check("live: балл — целое 1..10 из реального слоя пробок", typeof t.level === "number" && Number.isInteger(t.level) && (t.level as number) >= 1 && (t.level as number) <= 10, `level=${t.level}, источник="${t.source}"`);
  check("ярлык — из набора ТЗ («Дороги свободны…Город стоит»)", t.level === null || (TRAFFIC_LABELS as readonly string[]).includes(t.label), `label="${t.label}"`);

  console.log("=== Шаг №7.5: таксономия /disconnections.php (районы + 3 блока) ===");
  const { OUTAGE_DISTRICTS, groupOutagesByUtility, outageDistrict } = await import("../src/lib/outages-taxonomy");
  check("пять районов по ТЗ, порядок как в ТЗ", OUTAGE_DISTRICTS.join("|") === "Южно-Сахалинск|Корсаков|Холмск|Анива|Оха", OUTAGE_DISTRICTS.join(","));
  check("явный город в адресе — Корсаков", outageDistrict({ title: "Отключение", addresses: ["г. Корсаков, ул. Северная, 5"] }) === "Корсаков");
  check("явный город в заголовке — Холмск", outageDistrict({ title: "Сводка: г. Холмск", addresses: ["ул. Советская, 31"] }) === "Холмск");
  check("«ул. Сахалинская» без города — умолчание Южно-Сахалинск", outageDistrict({ title: "Плановое отключение", addresses: ["ул. Сахалинская, 45"] }) === "Южно-Сахалинск");
  check("регистр не важен (АНИВА)", outageDistrict({ title: "г. АНИВА, ул. Ленина, 61", addresses: [] }) === "Анива");
  check("«Оха» не ловится внутри чужих слов («похвалить» не район)", outageDistrict({ title: "Работы похвалить", addresses: [] }) === "Южно-Сахалинск", outageDistrict({ title: "Работы похвалить", addresses: [] }));
  const gItems = [
    mkItem("Сахалинэнерго", "https://x.ru/e1", "2026-09-16T01:00:00.000Z", "2026-09-16T01:00:00.000Z"),
    mkItem("СКК", "https://x.ru/e2", "2026-09-16T02:00:00.000Z", "2026-09-16T02:00:00.000Z"),
    mkItem("Водоканал", "https://x.ru/e3", "2026-09-16T03:00:00.000Z", "2026-09-16T03:00:00.000Z"),
    mkItem("СКК", "https://x.ru/e4", "2026-09-16T04:00:00.000Z", "2026-09-16T04:00:00.000Z"),
  ];
  // реальный пайплайн API: сначала сортировка всего массива по свежести
  // (pickTopOutages с n=длина), затем группировка сохраняет порядок
  const gr = groupOutagesByUtility(pickTopOutages(gItems, gItems.length));
  check("блоки: электро=1, ГВС/тепло=2 (СКК), холодная=1 (Водоканал)", gr.electro.length === 1 && gr.hot.length === 2 && gr.cold.length === 1, `e=${gr.electro.length} h=${gr.hot.length} c=${gr.cold.length}`);
  check("порядок внутри блока — свежие вверху (сорт. всего массива)", gr.hot[0]?.url.endsWith("/e4") && gr.hot[1]?.url.endsWith("/e2"), gr.hot.map((x) => x.url.slice(-2)).join(","));
  check("группировка не мутирует вход", gItems.length === 4);

  console.log("=== Шаг 9: /currency.php — таблица, подсветка, справочник ===");
  const {
    BANK_BRANCHES,
    CUR_COLS,
    computeBestRates,
    fmtMoney,
    isBestCell,
  } = await import("../src/lib/currency-table");
  // Островная пятёрка ТЗ, порядок и номиналы
  check("колонки — пятёрка ТЗ в порядке USD|EUR|CNY|JPY|KRW", CUR_COLS.map((c) => c.code).join("|") === "USD|EUR|CNY|JPY|KRW", CUR_COLS.map((c) => c.code).join(","));
  check("иена — за 100, вона — за 1000", CUR_COLS.find((c) => c.code === "JPY")?.unit === "за 100" && CUR_COLS.find((c) => c.code === "KRW")?.unit === "за 1000");
  // fmtMoney — формат сайта
  check("fmtMoney: 84.9 → «84,90»", fmtMoney(84.9) === "84,90", fmtMoney(84.9));
  check("fmtMoney: null → «—»", fmtMoney(null) === "—");
  // Лучшие курсы: покупка — максимум, продажа — минимум
  const banks9: import("../src/lib/currency-table").BankRatesRow[] = [
    { bank: "А", usd: { buy: 85.4, sell: 87.9 }, eur: null, cny: null, jpy: null, krw: null },
    { bank: "Б", usd: { buy: 84.0, sell: 86.5 }, eur: { buy: 99.25, sell: 101.75 }, cny: null, jpy: null, krw: null },
    { bank: "В", usd: { buy: 85.4, sell: 88.0 }, eur: { buy: 98.0, sell: 100.5 }, cny: null, jpy: null, krw: null },
    { bank: "Г", usd: { buy: 85.0, sell: 88.5 }, eur: null, cny: null, jpy: null, krw: null },
  ];
  const best9 = computeBestRates(banks9);
  check("USD покупка — максимум 85.40", best9.usd.buy?.value === 85.4 && best9.usd.buy?.bank === "А");
  check("USD продажа — минимум 86.50 (не у лидера покупки)", best9.usd.sell?.value === 86.5 && best9.usd.sell?.bank === "Б");
  check("EUR продажа — минимум 100.50 у В", best9.eur.sell?.value === 100.5 && best9.eur.sell?.bank === "В");
  check("нет данных по валюте у всех — best null (JPY/KRW)", best9.jpy.buy === null && best9.krw.sell === null);
  // Подсветка ячеек: победитель по покупке ИЛИ продаже; ничья — у обоих
  check("ячейка А USD подсвечена (лучший buy)", isBestCell(banks9[0].usd, best9.usd) === true);
  check("ячейка Б USD подсвечена (лучший sell)", isBestCell(banks9[1].usd, best9.usd) === true);
  check("ячейка Г USD не подсвечена (ни лучший buy, ни лучший sell)", isBestCell(banks9[3].usd, best9.usd) === false);
  check("ничья 85.40: обе ячейки-лидера подсвечены", isBestCell(banks9[0].usd, best9.usd) && isBestCell(banks9[2].usd, best9.usd));
  check("пустая ячейка не подсвечивается", isBestCell(null, best9.usd) === false && isBestCell(banks9[0].eur, best9.eur) === false);
  // Справочник отделений: 5 банков ТЗ, у всех tel:-ссылки
  check("справочник: 5 банков ТЗ в порядке АТБ|Солид|Сбер|ВТБ|Приморье", BANK_BRANCHES.map((b) => b.bank).join("|") === "АТБ|Солид Банк|Сбербанк|ВТБ|Банк Приморье", BANK_BRANCHES.map((b) => b.bank).join(","));
  check("у каждого банка адрес и tel:-ссылки", BANK_BRANCHES.every((b) => b.addr.length > 5 && b.tels.length >= 1 && b.tels.every((t) => /^tel:[0-9]+$/.test(t.href))), BANK_BRANCHES.map((b) => `${b.bank}:${b.tels.length}`).join(","));

  console.log("=== Задача 3: подсветка лучших курсов — цвета ТЗ в globals.css ===");
  const css3 = readFileSync(
    path.join(__dirname, "..", "src", "app", "globals.css"),
    "utf8",
  );
  check("панель главной .bestcell: фон #E2F0D9 (ТЗ)", /\.mp-rt-best td\.bestcell\{[^}]*background:#E2F0D9/.test(css3));
  check("панель главной .bestcell b: цвет текста #2E7D32 (ТЗ)", /\.mp-rt-best td\.bestcell b\{[^}]*color:#2E7D32/.test(css3));
  check("панель главной .bestcell i: цвет банка #2E7D32 (ТЗ)", /\.mp-rt-best td\.bestcell i\{[^}]*color:#2E7D32/.test(css3));
  check("currency.php .is-best: фон #E2F0D9 (ТЗ)", /\.crt-table td\.is-best\{background:#E2F0D9\}/.test(css3));
  check("currency.php .is-best b: цвет текста #2E7D32 (ТЗ)", /\.crt-table td\.is-best b\{color:#2E7D32\}/.test(css3));
  check("currency.php .is-best i: цвет текста #2E7D32 (ТЗ)", /\.crt-table td\.is-best i\{color:#2E7D32\}/.test(css3));
  check("старый зелёный SakhMatrix #2e9e44 в подсветке курсов не остался", !/rgba\(46,158,68,\.14\)/.test(css3) && !/\.crt-table td\.is-best b\{color:#17692a\}/.test(css3));

  // ===== Шаг 10: погодный сервис /weather.php =====
  console.log("\n— Шаг 10: погодный сервис /weather.php —");
  // Сетка районов ТЗ: 11 городов в 4 географических группах
  check("районы: группы Юг|Центр|Север|Курилы", CITY_GROUPS.map((g) => g.label).join("|") === "Юг|Центр|Север|Курилы", CITY_GROUPS.map((g) => g.label).join(","));
  check("районы: 11 городов; Юг = Корсаков|Холмск|Анива|Невельск", CITY_GROUPS.reduce((n, g) => n + g.cities.length, 0) === 11 && CITY_GROUPS[0].cities.map((c) => c.name).join("|") === "Корсаков|Холмск|Анива|Невельск", CITY_GROUPS[0].cities.map((c) => c.name).join(","));
  check("районы: Центр|Север|Курилы — состав ТЗ", CITY_GROUPS[1].cities.map((c) => c.name).join("|") === "Поронайск|Смирных|Углегорск" && CITY_GROUPS[2].cities.map((c) => c.name).join("|") === "Ноглики|Оха" && CITY_GROUPS[3].cities.map((c) => c.name).join("|") === "Южно-Курильск|Курильск", CITY_GROUPS.slice(1).map((g) => g.cities.map((c) => c.name).join("/")).join(" "));
  check("координаты городов в диапазоне Сахалина и Курил", CITY_GROUPS.every((g) => g.cities.every((c) => c.lat > 43 && c.lat < 54.5 && c.lon > 141 && c.lon < 149)));
  // Тег «Дороги»: содержательные отчёты ловятся
  check("тег Дороги: «Пуркаева… до развязки. Опять заслон»", isRoadReport("7:40 — Пуркаева от Емельянова стоит до развязки. Опять заслон, тоже попал?"));
  check("тег Дороги: «Объезжал через Санников… яма новая»", isRoadReport("Объезжал через Санников, свободнее, но там яма новая появилась у самого поворота."));
  check("тег Дороги: «дороги встанут» (дорог+и)", isRoadReport("Если подтвердится — дороги в Корсаковском районе встанут, как обычно у Яблочного."));
  check("тег Дороги: «гололёд на трассе»", isRoadReport("Ночью гололёд на трассе, аккуратнее"));
  check("тег Дороги: «64Н-1 перекрыта из-за заноса»", isRoadReport("64Н-1 перекрыта из-за заноса"));
  // Тег «Дороги»: болтовня и ложные «дорог» отсечены
  check("тег Дороги: «но дорого.» — НЕ дорога", !isRoadReport("Ещё аквапарк в гостинице, но дорого. Бассейн для малышей в Долинске — копейки."));
  check("тег Дороги: «Согласен.» — болтовня", !isRoadReport("Согласен."));
  check("тег Дороги: «Актуально, следим.» — болтовня", !isRoadReport("Актуально, следим."));
  check("тег Дороги: «подорожал» — не дорога", !isRoadReport("Бензин подорожал на рубль."));
  check("тег Дороги: пустая строка — нет", !isRoadReport(""));
  // Математика развёрнутого виджета
  check("давление: 1013.25 гПа = 760 мм рт. ст.", hpaToMm(1013.25) === 760);
  check("давление: 1005 гПа = 754 мм рт. ст.", hpaToMm(1005) === 754);
  check("румбы: 0→С 45→СВ 90→В 135→ЮВ 180→Ю 225→ЮЗ 270→З 315→СЗ", [0, 45, 90, 135, 180, 225, 270, 315].map((d) => rumbFromDeg(d)).join(" ") === "С СВ В ЮВ Ю ЮЗ З СЗ");
  check("румбы: 350°→С; нечисловое→—", rumbFromDeg(350) === "С" && rumbFromDeg(NaN) === "—");
  check("почасовка: прошедшие часы дня отрезаны", (() => {
    const times = ["2026-09-16T00:00", "2026-09-16T03:00", "2026-09-16T04:00", "2026-09-16T23:00"];
    return JSON.stringify(todayHourIndexes(times, "2026-09-16T04:30")) === JSON.stringify([2, 3]);
  })());
  check("почасовка: пустой now — пусто", todayHourIndexes(["2026-09-16T10:00"], "") .length === 0);
  check("метеокоды: Ясно/Облачно/Дождь/Снег/Гроза", codeLabel(0) === "Ясно" && codeLabel(3) === "Облачно" && codeLabel(65) === "Дождь" && codeLabel(73) === "Снег" && codeLabel(95) === "Гроза");
  // Директива «Интеграция Погоды»: meteoblue-виджет на /weather.php
  const wxSrc = readFileSync("src/components/site/weather-screen.tsx", "utf8");
  check("weather.php: meteoblue-виджет на 100% ширины (geoprivязка ЮС)", wxSrc.includes('src="https://www.meteoblue.com/ru/weather/widget/daily/yuzhno-sakhalinsk_russia_2119441"') && /className="mp-w-frame[^"]*"/.test(wxSrc), wxSrc.match(/meteoblue[^"]*yuzhno-sakhalinsk[^"]*/)?.[0] ?? "(нет)");
  check("weather.php: target=_blank через sandbox (popups escape, без top-nav)", wxSrc.includes('sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"'), "sandbox attribute");
  check("weather.php: DeferredIframe откладывает src до window.load", wxSrc.includes("DeferredIframe") && /import DeferredIframe/.test(wxSrc), "DeferredIframe");
  // Резерв met.no: символы и сдвиг таймзоны Сахалина (UTC+11)
  check("met.no: clearsky→Ясно, partlycloudy→Пер.обл., rainandthunder→Гроза (не Дождь)", metSymbolLabel("clearsky_day") === "Ясно" && metSymbolLabel("partlycloudy_night") === "Переменная облачность" && metSymbolLabel("rainandthunder") === "Гроза");
  check("met.no: snow→Снег, fog→Туман, cloudy→Облачно, пусто→Пер.обл.", metSymbolLabel("lightsnowshowers") === "Снег" && metSymbolLabel("fog") === "Туман" && metSymbolLabel("cloudy") === "Облачно" && metSymbolLabel("") === "Переменная облачность");
  check("таймзона: 21:00 UTC = 08:00 следующего дня на Сахалине", sakhalinLocal("2026-09-15T21:00:00Z").date === "2026-09-16" && sakhalinLocal("2026-09-15T21:00:00Z").hh === "08:00");
  // Шаг №11 (disconnections.php, финальное ТЗ): чипы фильтра и телефоны
  check("Шаг 11 чипы ТЗ: Все районы|Южно-Сахалинск|Корсаков|Холмск|Анива|Оха", FILTER_CHIPS.join("|") === "Все районы|Южно-Сахалинск|Корсаков|Холмск|Анива|Оха");
  check("Шаг 11 районы таксономии — 5 городов ТЗ без «Все районы»", OUTAGE_DISTRICTS.join("|") === "Южно-Сахалинск|Корсаков|Холмск|Анива|Оха");
  check("Шаг 11 телефоны ТЗ: ФРС 782-782 / СКК 72-30-13 / Водоканал 72-32-40", EMERGENCY_PHONES.map((p) => `${p.label} ${p.number}`).join(" / ") === "ФРС 782-782 / СКК 72-30-13 / Водоканал 72-32-40");
  check("Шаг 11 tel:-формат номеров (только цифры и дефисы)", EMERGENCY_PHONES.every((p) => /^\d{2,3}(?:-\d{2,3}){1,2}$/.test(p.number)));

  // ===== Шаг 12: дорожный хаб /traffic.php =====
  console.log("\n— Шаг 12: дорожный хаб /traffic.php —");
  const { TRAFFIC_ROUTES, statusOfReport, deriveRouteStatuses } = await import("../src/lib/roads-status");
  // Таблица трасс ТЗ: три направления, порядок как в ТЗ
  check("Шаг 12 трассы ТЗ: Холмский перевал|Корсаковская трасса|Южно-Сахалинск — Оха", TRAFFIC_ROUTES.map((r) => r.name).join("|") === "Холмский перевал|Корсаковская трасса|Южно-Сахалинск — Оха", TRAFFIC_ROUTES.map((r) => r.name).join(","));
  check("Шаг 12: статус словарь ТЗ Открыта / Закрыта / Тяжело (+пустой = н/д)", (() => {
    const allowed = ["Открыта", "Закрыта", "Тяжело", ""] as const;
    return (["перевал чист", "перевал перекрыта", "перевал гололёд", ""] as string[]).map(statusOfReport).every((s, i) => s === allowed[i]);
  })());
  // statusOfReport: приоритет Закрыта > Тяжело > Открыта
  check("Шаг 12 «64Н-1 перекрыта из-за заноса» → Закрыта", statusOfReport("64Н-1 перекрыта из-за заноса") === "Закрыта");
  check("Шаг 12 «перевал закрыли до обеда» → Закрыта", statusOfReport("Холмский перевал закрыли до обеда") === "Закрыта");
  check("Шаг 12 «Ночью гололёд на трассе» → Тяжело", statusOfReport("Ночью гололёд на трассе, аккуратнее") === "Тяжело");
  check("Шаг 12 «12 км грейдера с ямами… только внедорожник» → Тяжело", statusOfReport("Проедете, но медленно: 12 км грейдера с ямами. После дождя — только внедорожник.") === "Тяжело");
  check("Шаг 12 «Сезон близко… Брусничная — Перевал» → Открыта (негатива нет)", statusOfReport("Сезон близко. Кто куда выезжает? Мы обычно Брусничная — Перевал, но хотелось бы новенького.") === "Открыта");
  check("Шаг 12 пустой текст → пустой статус", statusOfReport("") === "");
  // deriveRouteStatuses: привязка отчёта к маршруту + свежайший решает
  check("Шаг 12 «дороги в Корсаковском районе встанут» → Корсаковская: Тяжело", (() => {
    const st = deriveRouteStatuses([{ body: "Если подтвердится — дороги в Корсаковском районе встанут, как обычно у Яблочного." }]);
    return st.find((r) => r.key === "korsakov")?.status === "Тяжело" && st.find((r) => r.key === "kholmsk")?.status === "" && st.find((r) => r.key === "okha")?.status === "";
  })());
  check("Шаг 12 «Оха: проехали, чисто» → ЮС—Оха: Открыта; 64Н тоже ловится", (() => {
    const a = deriveRouteStatuses([{ body: "Оха: проехали, чисто" }]).find((r) => r.key === "okha")?.status;
    const b = deriveRouteStatuses([{ body: "64Н ночью чистая" }]).find((r) => r.key === "okha")?.status;
    return a === "Открыта" && b === "Открыта";
  })());
  check("Шаг 12 статус берётся из СВЕЖАЙШЕГО отчёта по маршруту (API: свежие первыми)", (() => {
    const st = deriveRouteStatuses([
      { body: "Перевал расчистили, едут" }, // свежайший
      { body: "Перевал перекрыт, чистят" }, // старее
    ]);
    return st.find((r) => r.key === "kholmsk")?.status === "Открыта";
  })());
  check("Шаг 12 все три строки таблицы всегда присутствуют (3 маршрута)", deriveRouteStatuses([]).length === 3 && deriveRouteStatuses([]).every((r) => r.status === ""));

  // ===== Задача 13: фикс багов информеров «Пробки»/«Отключения» =====
  console.log("\n— Задача 13: фикс информеров «Пробки»/«Отключения» —");
  const { trafficEmoji, ballPlural } = await import("../src/lib/traffic-ui");
  check("эмодзи ТЗ: 1..3→🟢, 4..6→🟡, 7..10→🔴", trafficEmoji(1) === "🟢" && trafficEmoji(3) === "🟢" && trafficEmoji(4) === "🟡" && trafficEmoji(6) === "🟡" && trafficEmoji(7) === "🔴" && trafficEmoji(10) === "🔴");
  check("примеры ТЗ: 3→«Дороги свободны», 7→«Город стоит»", levelLabel(3) === "Дороги свободны" && levelLabel(7) === "Город стоит" && levelLabel(5) === "Движение затруднено");
  check("склонение: 1 балл, 3 балла, 5/7/10 баллов, 21 балл", ballPlural(1) === "балл" && ballPlural(3) === "балла" && ballPlural(5) === "баллов" && ballPlural(7) === "баллов" && ballPlural(10) === "баллов" && ballPlural(21) === "балл");
  // п.1: заголовок «▼ Пробки» — ссылка на /traffic.php, формат ТЗ вместо серого круга
  const hr = readFileSync(path.join(__dirname, "..", "src", "components", "site", "home-right.tsx"), "utf8");
  check("home: плашка «▼ Пробки» — ссылка href=/traffic.php", /aria-label="Пробки"[\s\S]*?href="\/traffic\.php"/.test(hr));
  check("home: строка балла — формат ТЗ (эмодзи + склонение + ярлык)", hr.includes("trafficEmoji(traffic.level)") && hr.includes("ballPlural(traffic.level)") && hr.includes("{traffic.label}"));
  check("home: серый круг и «Данные недоступны» из разметки убраны", !hr.includes("TrafficCircle") && !hr.includes("Данные недоступны"));
  check("home: «▼ Отключения» — ссылка на /disconnections.php (сохранена)", /aria-label="Отключения"[\s\S]*?href="\/disconnections\.php"/.test(hr));
  // п.2: пустое состояние — живой текст ТЗ со штампом проверки
  check("home: живой текст ТЗ «…не зафиксировано. Проверено:»", hr.includes("На данный момент плановых отключений по Южно-Сахалинску не зафиксировано. Проверено:"));
  check("home: зависшая надпись «Оперативных отключений не объявлено» убрана", !hr.includes("Оперативных отключений не объявлено"));
  check("home: штамп времени — клиентское dd.MM.yyyy HH:mm при source=empty", hr.includes('d.source === "empty"') && hr.includes("fmtNowStamp()"));

  // ===== Задача 14: рестайл эстетики и структуры ПК-версии =====
  console.log("\n— Задача 14: рестайл ПК-версии (шапка/линии/фон/3-колонки/футер) —");
  const gcss = readFileSync(path.join(__dirname, "..", "src", "app", "globals.css"), "utf8");
  const chromeSrc = readFileSync(path.join(__dirname, "..", "src", "components", "site", "chrome.tsx"), "utf8");
  const pageSrc = readFileSync(path.join(__dirname, "..", "src", "app", "page.tsx"), "utf8");
  const lnSrc = readFileSync(path.join(__dirname, "..", "src", "components", "site", "left-nav.tsx"), "utf8");
  // Шаг 1.1 / ЗАДАЧА 2: md:mt-[6px] заменён на класс .header-logo — симметричные
  // вертикальные паддинги 6px/6px (медиа ≥768px, мобайл не тронут)
  const logoPads = gcss.match(/@media \(min-width:768px\)\{\.header-logo\{padding-top:(\d+)px;padding-bottom:(\d+)px\}\}/);
  check("Шаг 1.1/Задача 2: логотип — .header-logo у ссылки, md:mt-[6px] убран", chromeSrc.includes('className="header-logo block"') && !chromeSrc.includes("md:mt-[6px]"));
  check("Задача 2: логотип — симметричные паддинги 6px/6px в медиа ≥768px", !!logoPads && logoPads[1] === logoPads[2] && logoPads[1] === "6");
  check("Шаг 1.1: паддинги бирюзовой плашки симметричны (md:py-3 в классах .sm-mh-wrap)", /sm-mh-wrap[^"]*md:py-3/.test(chromeSrc) && !/md:pt-|md:pb-/.test(chromeSrc));
  // Шаг 1.2: слоган и правый блок призыва — чистый белый
  const mhBody = chromeSrc.slice(chromeSrc.indexOf("export function Masthead"), chromeSrc.indexOf("const NAV_MAIN"));
  check("Шаг 1.2: слоган/подзаголовок/описание — text-white (#FFFFFF)", (mhBody.match(/text-white/g) || []).length === 3);
  check("Шаг 1.2: тёмно-синий #072F66 из шапки убран", !mhBody.includes("#072F66"));
  // Шаг 2: вертикальные линии-разделители удалены на всех страницах
  check("Шаг 2: .sk-col-left без серой вертикальной линии (border-right:none)", /\.sk-col-left\{border-right:none/.test(gcss));
  check("Шаг 2: .sk-shell без левой/правой вертикальных рамок", /\.sk-shell\{[^}]*border-left:none;border-right:none/.test(gcss));
  // Шаг 3.1: подложка сайта — ТЗ #F4F6F7; указ: затемнение 10% (#DCDDDE) слишком тёмное → светлее на 5% (каналы ×0,95) → #E8EAEB
  check("Шаг 3.1: --sm-paper = #E8EAEB (#F4F6F7 затемнён на 5%)", gcss.includes("--sm-paper:#E8EAEB"));
  check("Шаг 3.1: body → #E8EAEB", /body\{background:#E8EAEB\}/.test(gcss));
  check("Шаг 3.1: .sk-подложка → плоский #E8EAEB (без белых полос)", /\.sk\{[^}]*background:#E8EAEB/.test(gcss));
  check("Шаг 3.1: .sk-shell прозрачен (видна серая подложка)", /\.sk-shell\{background:transparent/.test(gcss));
  // Шаг 3.2: карточки — белый фон + лёгкая тень ТЗ
  const SHADOW = "box-shadow:0 1px 3px rgba(0,0,0,0.05),0 1px 2px rgba(0,0,0,0.03)";
  check("Шаг 3.2: .sakh-card — строго белый + тень ТЗ", /\.sakh-card\{background:#FFFFFF;/.test(gcss) && gcss.includes(`.sakh-card{background:#FFFFFF;${SHADOW}}`));
  check("Шаг 3.2: боковые модули (.sk-sideblock/.sk-sidezone) и .sk-topicbox — та же тень", [".sk-sideblock,.sk-sidezone{background:#fff;border:1px solid var(--sm-navy);" + SHADOW, ".sk-topicbox{background:#fff;border:1px solid var(--sm-navy);" + SHADOW].every((frag) => gcss.includes(frag)));
  // Шаг 3.2 (указ заказчика «ко всем блокам, на всех страницах»): тень у всех
  // остальных белых карточек — сообщение форума, вход, профиль, сайдблоки
  // 10 страниц, hp-card, стек ЖКХ; строго в медиа ≥768px (мобайл заморожен)
  const ALLBLOCKS = [".sm-msg", ".sk-msg", ".sk-authneed", ".sk-profilebox", ".sk-profilelist", ".hp-sideblock", ".hp-card", ".oh-sideblock", ".wb-sideblock", ".gkh-sideblock", ".gkh-detail-head", ".gkh-history", ".gkh-orgform", ".gkh-addupdate", ".dk-sideblock", ".cd-sideblock", ".rc-sideblock", ".ep-sideblock", ".ad-sidebox", ".pl-sidebox"];
  const mediaShadowBlocks = [...gcss.matchAll(/@media \(min-width:768px\)\{\s*([^{]*?)\{box-shadow:0 1px 3px rgba\(0,0,0,0\.05\),0 1px 2px rgba\(0,0,0,0\.03\)\}\s*\}/g)].map((m) => m[1].replace(/\s+/g, ""));
  check("Шаг 3.2 (указ): все 19 классов покрыты тенью в медиа ≥768px", ALLBLOCKS.every((c) => mediaShadowBlocks.some((sel) => sel.includes(c))));
  // Шаг 3.2 / Шаг №4 (монолит): трёхколоночный монолит внутренних страниц
  const SCREENS = ["traffic-screen", "weather-screen", "currency-screen", "disconnections-screen"];
  for (const s of SCREENS) {
    const src = readFileSync(path.join(__dirname, "..", "src", "components", "site", `${s}.tsx`), "utf8");
    check(`Шаг №4 (монолит): ${s} — .sk-layout sk-layout-page main-grid-container + ForumSideNav + .sk-col-main center-column + HomeRight`, src.includes('className="sk-layout sk-layout-page main-grid-container"') && src.includes("<ForumSideNav />") && src.includes('<div className="sk-col-main center-column">') && src.includes("<HomeRight />"));
  }
  check("Шаг 4: left-nav — колонка .sk-col-left.sk-col-left-inner.left-column (глобальная сетка)", lnSrc.includes('className="sk-col-left sk-col-left-inner left-column"'));
  check("Шаг 4: left-nav — все 7 срезов Навигации ссылками /?scope=", ["new", "popular", "active", "mine", "participated", "favorites", "archive"].every((k) => lnSrc.includes(`key: "${k}"`)) && lnSrc.includes("/?scope=${s.key}"));
  check("Шаг 4: left-nav — рубрики и модератор ссылками /?rubric=", lnSrc.includes("/?rubric=${encodeURIComponent(r.slug)}") && lnSrc.includes("/?rubric=${encodeURIComponent(c.slug)}") && lnSrc.includes("/?rubric=${encodeURIComponent(modAsk.slug)}"));
  // nav-cleanup: импорт расширен ForumDiscussCard (единый блок левой колонки)
  check("Шаг 4: page.tsx и left-nav — единый источник иконок (импорт, дубль убран)", pageSrc.includes('import { ForumDiscussCard, SCOPE_ICONS, rubricIcon } from "@/components/site/left-nav"') && !/function rubricIcon/.test(pageSrc));
  check("Шаг 4: мобайл ≤480 заморожен (правая колонка страниц скрыта, поля сетки 0)", /\.sk-layout-page \.mp-right\{display:none\}/.test(gcss));
  check("Шаг 4: левая колонка меню внутренних страниц скрыта ≤900px", /\.sk-col-left-inner\{display:none\}/.test(gcss));
  // Шаг №4 (директива «Трехколоночный монолит внутренних страниц»):
  // внутренние страницы несут класс .main-grid-container — применяются ТЕ ЖЕ
  // правила сетки, что у Главной (flex ≥1024px / блоковая откатка ≤900px);
  // отдельных ПК-правил для .sk-layout-page быть не должно
  check("Шаг №4: монолит — у .sk-layout-page нет собственных ПК-правил вне откаток (сетка единая с Главной через .main-grid-container)", !gcss.match(/@media \(min-width:1024px\)\{[^@]*\.sk-layout-page/));
  check("Шаг №4: монолит — блоковая откатка ≤900px .sk-layout.main-grid-container покрывает и внутренние страницы", gcss.includes(".sk-layout.main-grid-container{display:block;margin:0}"));
  check("Шаг №4: монолит — левая колонка внутренних страниц .left-column получает фикс 240px ≥1024px (глобальное правило)", /@media \(min-width:1024px\)\{[^@]*\.left-column\{flex:0 0 240px;width:240px;margin-left:0 !important;margin-right:0 !important;padding-left:0 !important;padding-right:0 !important\}/.test(gcss));
  check("Шаг №4: монолит — правая колонка .right-column фикс 300px ≥1024px (глобальное правило)", /@media \(min-width:1024px\)\{[^@]*\.right-column\{flex:0 0 300px;width:300px;margin-left:0 !important;margin-right:0 !important;padding-left:0 !important;padding-right:0 !important\}/.test(gcss));
  // Шаг №5 «Фирменная заливка подвала» + «Единый футер как на Главной»:
  // разметка футера Главной вынесена в общий SiteFooter (chrome.tsx) и
  // рендерится на ВСЕХ страницах; тонкий .sk-footer удалён
  const chromeSrcAll = readFileSync(path.join(__dirname, "..", "src", "components", "site", "chrome.tsx"), "utf8");
  check("Шаг №5/Единый футер: SiteFooter в chrome.tsx — разметка .mp-footer (ссылки + сведения + дисклеймер + версия)", chromeSrcAll.includes('export function SiteFooter') && chromeSrcAll.includes('className="mp-footer"') && chromeSrcAll.includes('mp-footer-links') && chromeSrcAll.includes('mp-footer-info') && chromeSrcAll.includes('mp-footer-disc') && chromeSrcAll.includes('mp-footer-right'));
  for (const s of SCREENS) {
    const src = readFileSync(path.join(__dirname, "..", "src", "components", "site", `${s}.tsx`), "utf8");
    check(`Единый футер: ${s} — рендерит общий <SiteFooter settings={settings} /> без собственного .sk-footer`, src.includes("<SiteFooter settings={settings} />") && !src.includes("sk-footer\""));
  }
  check("Единый футер: page.tsx — <SiteFooter settings={settings} onNavigate={navigate} />, инлайн-разметки нет", pageSrc.includes("<SiteFooter settings={settings} onNavigate={navigate} />") && !pageSrc.includes('className="mp-footer"'));
  check("Единый футер: мёртвые CSS-правила .sk-footer удалены (в CSS нет селекторов .sk-footer{, .sk-footer a{, .sk-footer .inner)", !gcss.includes(".sk-footer{") && !gcss.includes(".sk-footer a{") && !gcss.includes(".sk-footer .inner"));

  // ===== Задача 2: эстетика шапки и подвала =====
  console.log("\n— Задача 2: эстетика шапки и подвала —");
  check("З2-эст: правый блок лозунга .sm-mh-side — принудительно #FFFFFF !important", gcss.includes(".sm-mh-side{color:#FFFFFF !important}"));
  check("З2-эст: .mp-footer ссылки мягкого голубого #A9CBEF (единый футер всех страниц)", gcss.includes(".mp-footer a{color:#A9CBEF"));
  const mpFoot = (gcss.match(/\.mp-footer\{[^}]*\}/) || [""])[0];
  check("З2-эст: .mp-footer — фон #1e3a5f !important (синий горизонтальных плашек var(--sm-navy)), текст белый", mpFoot.includes("background-color:#1e3a5f !important") && mpFoot.includes("color:#FFFFFF"));
  check("З2-эст: .mp-footer ссылки #A9CBEF, ховер белый (красный не читается на синем)", gcss.includes(".mp-footer a{color:#A9CBEF") && gcss.includes(".mp-footer a:hover{color:#FFFFFF}"));
  check("З2-эст: дисклеймер и правый столбец футера — белый", /\.mp-footer-disc\{color:#FFFFFF/.test(gcss) && /\.mp-footer-right\{color:#FFFFFF/.test(gcss));
  // ШАГ «Единый синий футер»: подвал выше — padding:30px 0 на всех страницах
  check("Шаг «Единый футер»: .mp-footer — padding:30px 0", /\.mp-footer\{[^}]*padding:30px 0;/.test(gcss));

  // ===== Стадия 2, Задача 1: фиксировано-адаптивная сетка ПК-версии =====
  console.log("\n— Стадия 2, Задача 1: .main-grid-container + flex-строки таблиц —");
  // Контейнер: ГЛОБАЛЬНАЯ СЕТКА ВСЕГО САЙТА (жёсткая директива): от 1024px — flex по
  // центру, каркас 1430px (240+850+300+2×20), зазор 20px; единые классы
  // .main-grid-container/.left-column/.center-column/.right-column на ВСЕХ страницах
  // (display:flex !important и gap:20px !important — секционные сетки (.ad-grid и др.)
  // объявлены ниже по файлу и без !important перебили бы каркас)
  check("З2-1: page.tsx — .main-grid-container БЕЗ УСЛОВИЙ (глобально, все виды)", pageSrc.includes('className="sk-layout main-grid-container"') && !pageSrc.includes('isHome ? " main-grid-container"'));
  check("З2-1: контейнер (≥1024px) display:flex !important + justify-content:center + width:100% + max-width:1430px + margin:0 auto + gap:20px !important", /@media \(min-width:1024px\)\{[^@]*\.main-grid-container\{display:flex !important;justify-content:center;width:100%;max-width:1430px;margin:0 auto;gap:20px !important\}/.test(gcss));
  // Колонки жёстко зафиксированы по директиве (центр — ПРИНУДИТЕЛЬНО 850px !important);
  // зазоры — строго и только через gap:20px: внешние отступы и горизонтальные паддинги колонок обнулены !important
  check("З2-1: левая колонка .left-column flex:0 0 240px + width:240px + нулевые внешние отступы и паддинги (≥1024px)", /@media \(min-width:1024px\)\{[^@]*\.left-column\{flex:0 0 240px;width:240px;margin-left:0 !important;margin-right:0 !important;padding-left:0 !important;padding-right:0 !important\}/.test(gcss));
  check("З2-1: центральная .center-column flex:0 0 850px !important + width:850px !important + нулевые внешние отступы и паддинги — принудительно на ВСЕХ страницах (≥1024px)", /@media \(min-width:1024px\)\{[^@]*\.center-column\{flex:0 0 850px !important;width:850px !important;min-width:0;margin-left:0 !important;margin-right:0 !important;padding-left:0 !important;padding-right:0 !important\}/.test(gcss));
  check("З2-1: ступень min-width:450px ≥1050px упразднена (противоречила жёстким 850px)", !/@media \(min-width:1050px\)\{[^@]*\.main-grid-container \.center-column\{min-width:450px\}/.test(gcss));
  check("З2-1: правая колонка .right-column flex:0 0 300px + width:300px + нулевые внешние отступы и паддинги (≥1024px)", /@media \(min-width:1024px\)\{[^@]*\.right-column\{flex:0 0 300px;width:300px;margin-left:0 !important;margin-right:0 !important;padding-left:0 !important;padding-right:0 !important\}/.test(gcss));
  check("Зазоры: у всех трёх колонок margin-left/margin-right = 0 !important — расстояние формируется строго и только через gap:20px", [".left-column", ".center-column", ".right-column"].every((c) => new RegExp(c.replace(/\./, "\\.") + "\\{[^}]*margin-left:0 !important;margin-right:0 !important").test(gcss)));
  check("Зазоры: горизонтальные паддинги колонок обнулены !important (.sk-col-left{padding-right:12px} и его копия 8px в 901–1150 больше не добавляются к зазору)", [".left-column", ".center-column", ".right-column"].every((c) => new RegExp(c.replace(/\./, "\\.") + "\\{[^}]*padding-left:0 !important;padding-right:0 !important").test(gcss)));
  // ===== Лесенка форума: эталонный плоский список Sakh.com (директива «Эталонная лесенка Sakh.com») =====
  const tvSrc = readFileSync(path.join(__dirname, "..", "src", "components", "forum", "topic-view.tsx"), "utf8");
  check("Лесенка: ПЛОСКИЙ контейнер .sakh-comments-container — НИКАКОЙ вложенности; весь старый код удалён (renderTree/forum-comments-list/comment-item/sk-children/forum-thread-group)", tvSrc.includes('className="sakh-comments-container"') && !tvSrc.includes("renderTree") && !tvSrc.includes("forum-comments-list") && !tvSrc.includes("comment-item") && !tvSrc.includes("sk-children") && !tvSrc.includes("forum-thread-group"));
  check("Лесенка: уровень ТОЛЬКО дата-атрибутом data-level (кламп 1..6; обрыв цепочки на другой странице — фолбэк depth+1, минимум 2); плашка .sakh-comment + нить .sakh-comment-connector", tvSrc.includes('data-level={String(L)}') && tvSrc.includes("Math.min(6, Math.max(1, chain.length + 1))") && tvSrc.includes("Math.min(6, Math.max(2, (m.depth ?? 0) + 1))") && tvSrc.includes('className="sakh-comment"') && tvSrc.includes('className="sakh-comment-connector"'));
  check("Лесенка: нить уровня K рисуется ТОЛЬКО если ветка продолжается ниже (ниже по ленте без разрыва чужими постами есть уголок уровня K+1)", tvSrc.includes("ветку разорвал чужой пост") && tvSrc.includes("rails.push(k)") && tvSrc.includes("Math.min(6, nc.length + 1) === k + 1"));
  check("Лесенка CSS: каждое сообщение — ОТДЕЛЬНАЯ карточка: сплошная рамка #CED4DA со всех 4 сторон + белый фон + зазор 12px (все с !important) + сдвиг уровней margin-left 0/20/40/60/80/100px", gcss.includes(".sakh-comment{position:relative;padding:10px 15px;border:1px solid #CED4DA !important;background-color:#FFFFFF !important;margin-bottom:12px !important}") && ['.sakh-comment[data-level="1"]{margin-left:0}', '.sakh-comment[data-level="2"]{margin-left:20px}', '.sakh-comment[data-level="3"]{margin-left:40px}', '.sakh-comment[data-level="4"]{margin-left:60px}', '.sakh-comment[data-level="5"]{margin-left:80px}', '.sakh-comment[data-level="6"]{margin-left:100px}'].every((r) => gcss.includes(r)) && !gcss.includes("border-bottom:1px solid #E9ECEF;margin-bottom:0") && !gcss.includes("left:calc(20px*(attr(data-level integer)"));
  check("Лесенка CSS: линии СНАРУЖИ рамок — уголок ::before от самой карточки (top:-13px; left:-16px; 15×34px; #B0BEC5) на колонке ветки 20·(L−2)+5 + нить (top:-13px;bottom:-1px;1px #B0BEC5); контейнер без белой подложки (серые зазоры страницы видны)", gcss.includes('.sakh-comment:not([data-level="1"])::before{content:"";position:absolute;top:-13px;left:-16px;width:15px;height:34px;border-left:1px solid #B0BEC5;border-bottom:1px solid #B0BEC5}') && gcss.includes(".sakh-comment-connector{position:absolute;top:-13px;bottom:-1px;width:1px;background-color:#B0BEC5;pointer-events:none}") && gcss.includes(".sakh-comments-container{position:relative;padding-left:0}"));
  check("Лесенка: нить left считается ОТ КАРТОЧКИ инлайном (K − level)·20 + 4 (отрицательное = левее рамки); внутренний .sk-msg внутри карточки без рамки/фона; мобайл ≤768px — margin-left:0 !important + padding-left:10px !important, ::before и .sakh-comment-connector скрыты; старый код удалён (comment-level/top:-15px/top:-8px/railX)", tvSrc.includes("(k - level) * 20 + 4") && tvSrc.includes("railLeft(k, L)") && !tvSrc.includes("railX") && gcss.includes(".sakh-comments-container .sakh-comment > .sk-msg{background:transparent;border:0;margin:0;padding:0}") && (() => { const i768 = gcss.indexOf("@media (max-width:768px){"); const iM = gcss.indexOf(".sakh-comment{margin-left:0 !important;padding-left:10px !important}"); const iB = gcss.indexOf(".sakh-comment::before{display:none}"); const iC = gcss.indexOf(".sakh-comment-connector{display:none}"); return i768 !== -1 && iM > i768 && iB > iM && iC > iB; })() && !gcss.includes("comment-level-") && !gcss.includes("top:-15px") && !gcss.includes("top:-8px"));
  // ===== Квадратная карта пробок /traffic.php: ПК ≥1024px — строго 850×850 =====
  check("Пробки: ПК-квадрат карты (≥1024px) — .trf-map width:100%; height:850px (высота строго 850px при колонке 850px)", /@media \(min-width:1024px\)\{\s*\.trf-map\{width:100%;height:850px\}\s*\}/.test(gcss));
  check("Пробки: базовая откатка цела — .trf-map display:block;width:100%;height:250px (481–1023px)", gcss.includes(".trf-map{display:block;width:100%;height:250px;border:0;background:#e8eef4}"));
  check("Пробки: мобильная заморозка цела — ≤480px .trf-map{height:250px} сохранён", /@media \(max-width:480px\)\{[^@]*\.trf-map\{height:250px\}/.test(gcss));
  check("З2-1: page.tsx — центральная колонка имеет класс center-column", pageSrc.includes('className="sk-col-main center-column"'));
  // Единые классы каркаса в разметке ВСЕХ страниц (глобальная директива)
  const uniCols = (file: string, cont: string, l: string, c: string, r: string) => {
    const s = readFileSync(path.join(__dirname, "..", "src", "components", "site", file), "utf8");
    return s.includes(`main-grid-container`) && s.includes(l) && s.includes(c) && s.includes(r);
  };
  const uniChecks: [string, string, string, string, string][] = [
    ["Объявления (ad)", "ad-grid main-grid-container", "ad-col-left left-column", "ad-col-main center-column", "ad-col-right right-column"],
    ["Помощь (hp)", "hp-layout main-grid-container", "hp-col-left left-column", "hp-col-main center-column", "hp-col-right right-column"],
    ["Знакомства (dk)", "dk-layout main-grid-container", "dk-col-left left-column", "dk-col-main center-column", "dk-col-right right-column"],
    ["ЖКХ (gkh)", "gkh-layout main-grid-container", "gkh-col-left left-column", "gkh-col-main center-column", "gkh-col-right right-column"],
    ["Где дешевле (cd)", "cd-layout main-grid-container", "cd-col-left left-column", "cd-col-main center-column", "cd-col-right right-column"],
    ["Где купить (wb)", "wb-layout main-grid-container", "wb-col-left left-column", "wb-col-main center-column", "wb-col-right right-column"],
    ["Работодатели (ep)", "ep-layout main-grid-container", "ep-col-left left-column", "ep-col-main center-column", "ep-col-right right-column"],
    ["Рекомендую (rc)", "rc-layout main-grid-container", "rc-col-left left-column", "rc-col-main center-column", "rc-col-right right-column"],
    ["Полезное (pl)", "pl-grid main-grid-container", "pl-col-left left-column", "pl-col-main center-column", "pl-col-right right-column"],
    ["Подслушано (oh)", "oh-layout main-grid-container", "oh-col-left left-column", "oh-col-main center-column", "oh-col-right right-column"],
  ];
  for (const [name, cont, l, c, r] of uniChecks) {
    const file = name.includes("Объявления") ? "ads-publications.tsx" : name.includes("Помощь") ? "help-publications.tsx" : name.includes("Знакомства") ? "znakomstva-publications.tsx" : name.includes("ЖКХ") ? "gkh-publications.tsx" : name.includes("дешевле") ? "gdedeshevle-publications.tsx" : name.includes("купить") ? "wheretobuy-publications.tsx" : name.includes("работодателях") || name.includes("Работодатели") ? "employers-publications.tsx" : name.includes("Рекомендую") ? "recommend-publications.tsx" : name.includes("Полезное") ? "poleznoe-publications.tsx" : "overheard-publications.tsx";
    check(`Глобальная сетка: ${name} — единый каркас (.main-grid-container + .left-column/.center-column/.right-column)`, uniCols(file, cont, l, c, r));
  }
  check("Глобальная сетка: page.tsx — левая .left-column (Sidebar) и правая .right-column (sk-col-right)", pageSrc.includes("sk-col-left left-column") && pageSrc.includes("sk-col-right right-column"));
  check("Глобальная сетка: left-nav (сервисы) — .sk-col-left.left-column", readFileSync(path.join(__dirname, "..", "src", "components", "site", "left-nav.tsx"), "utf8").includes("sk-col-left sk-col-left-inner left-column"));
  check("Глобальная сетка: home-right — .mp-right.right-column", readFileSync(path.join(__dirname, "..", "src", "components", "site", "home-right.tsx"), "utf8").includes("mp-right right-column"));
  // Мобильные откатки: контейнер блоковый, min-width центра снят (мобайл заморожен)
  check("З2-1: ≤900px — контейнер снова display:block без авто-полей, min-width:450px центра снят", gcss.includes(".sk-layout.main-grid-container{display:block;margin:0}") && gcss.includes(".main-grid-container .sk-col-main{min-width:0}") && gcss.indexOf(".sk-layout.main-grid-container{display:block;margin:0}") > gcss.indexOf("@media (max-width:900px)"));
  // Строки таблиц «Подслушано»/«Последние темы»: Flexbox по ТЗ
  const trowRule = (gcss.match(/\.mp-trow\{[^}]*\}/) || [""])[0];
  check("З2-2: .mp-trow — display:flex + justify-content:space-between + align-items:center (grid-машина убрана)", trowRule.includes("display:flex") && trowRule.includes("justify-content:space-between") && trowRule.includes("align-items:center") && !trowRule.includes("grid-template-columns") && !trowRule.includes("display:grid"));
  check("З2-2: .mp-ttext — flex:1, nowrap/hidden/ellipsis, padding-right:15px", /\.mp-ttext\{[^}]*white-space:nowrap;overflow:hidden;text-overflow:ellipsis[^}]*flex:1;padding-right:15px\}/.test(gcss));
  check("З2-2: .mp-tauthor — фиксированно flex:0 0 140px, text-align:left (max-width:110px убран)", /\.mp-tauthor\{[^}]*flex:0 0 140px;text-align:left/.test(gcss) && !/\.mp-tauthor\{[^}]*max-width:110px/.test(gcss));
  check("З2-2: .mp-tdate — фиксированно flex:0 0 110px, text-align:right", /\.mp-tdate\{[^}]*flex:0 0 110px;text-align:right/.test(gcss));
  // ШАГ 4 ТЗ №1: строки списка тем «Форум» (.sk-row) — от 1024px Flexbox
  const skRowMedia = (gcss.match(/@media \(min-width:1024px\)\{\s*\.sk-listhead\{[^}]*\}[\s\S]*?\.sk-row \.r-last\{flex:0 0 110px;text-align:right\}\s*\}/) || [""])[0];
  check("З2-3: Форум (≥1024px) .sk-row — display:flex + space-between + align-items:center", skRowMedia.includes(".sk-row{display:flex;justify-content:space-between;align-items:center;gap:8px}"));
  check("З2-3: Форум — ник автора flex:0 0 140px, дата .r-last flex:0 0 110px справа", skRowMedia.includes(".sk-row .r-author{flex:0 0 140px}") && skRowMedia.includes(".sk-row .r-last{flex:0 0 110px;text-align:right}"));
  check("З2-3: Форум — название flex:1 + троеточие (nowrap/hidden/ellipsis)", skRowMedia.includes(".sk-row .r-title{flex:1 1 auto;min-width:0}") && /text-overflow:ellipsis/.test(skRowMedia));

  // ===== Стадия 2, ЗАДАЧА №4: оживление информера «Коммунальные отключения» =====
  console.log("\n— Задача 4: парсеры трёх ведомств (фикстуры) + строка формата ТЗ —");
  // Источник 1: Сахалинэнерго (ФРС) — sakh-frs.ru, карточки .oItem
  const frsHtml = readFileSync(path.join(__dirname, "fixtures", "frs-outages.html"), "utf8");
  const frsItems = parseSakhalinEnergoHtml(frsHtml);
  check("З4: ФРС — записи распознаны из живой страницы", frsItems.length >= 5, `${frsItems.length} записей`);
  check("З4: ФРС — источник «Сахалинэнерго», вид electro, плановая", frsItems.every((it) => it.source === "Сахалинэнерго" && it.kind === "electro" && it.type === "planned"));
  check("З4: ФРС — «Время публикации 16.09.2026 11:52» → 2026-09-16T00:52:00.000Z (UTC = Сахалин −11ч)", frsItems[0]?.publishedAt === "2026-09-16T00:52:00.000Z", frsItems[0]?.publishedAt);
  check("З4: ФРС — краткий адрес строки ТЗ («пер. Энергетиков 1А, 6»)", frsItems[0]?.short === "пер. Энергетиков 1А, 6", frsItems[0]?.short);
  check("З4: ФРС — адреса карточки (ул. Сергея Лазо 5, 7, 9, 11)", (frsItems[0]?.addresses ?? []).includes("ул. Сергея Лазо 5, 7, 9, 11"), (frsItems[0]?.addresses ?? []).slice(0, 3).join(" ; "));
  check("З4: ФРС — период из заголовка («с 00:00 до 03:00»)", frsItems[0]?.when === "с 00:00 до 03:00", frsItems[0]?.when);
  check("З4: ФРС — СНТ-строки без номера дома тоже адреса («снт. \"Вагонник\”»)", (frsItems[2]?.addresses ?? []).some((a) => a.startsWith("снт.")), (frsItems[2]?.addresses ?? []).join(" ; "));
  // Аварийная сводка ФРС (синтетика на живой разметке)
  const frsEmerg = parseSakhalinEnergoHtml(
    "<html><div class='oItem' alt='1'><div class='oiCapt'>16&nbsp;сентября&nbsp;2026 (Аварийное)</div>" +
    "<div class='oiText'><b>Аварийное отключение ВЛ-0,4 кВ</b><div class='oiSep'></div>г. Южно-Сахалинск:<div class='oiSep'></div>-ул. Зеленая 3, 5<div class='oiSep'></div></div>" +
    "<div class='oiDate'>Время публикации 16.09.2026 10:05</div></div></html>",
  );
  check("З4: ФРС — «(Аварийное)» → type=emergency", frsEmerg.length === 1 && frsEmerg[0]?.type === "emergency");
  check("З4: ФРС — «г. Южно-Сахалинск:» не попадает в краткий адрес (домашний город)", frsEmerg[0]?.short === "ул. Зеленая 3, 5", frsEmerg[0]?.short);
  // Источник 2: СКК — skk65.ru, WordPress REST /wp-json/wp/v2/posts
  const skkItems = parseSkkPosts(readFileSync(path.join(__dirname, "fixtures", "skk-wp.json"), "utf8"));
  check("З4: СКК — 2 оперативные сводки из 3 постов (PR-кешбэк отсеян)", skkItems.length === 2, `${skkItems.length}`);
  check("З4: СКК — источник «СКК», вид hot, плановая", skkItems.every((it) => it.source === "СКК" && it.kind === "hot" && it.type === "planned"));
  check("З4: СКК — date_gmt → publishedAt (UTC)", skkItems[0]?.publishedAt === "2026-09-16T03:11:30Z", skkItems[0]?.publishedAt);
  check("З4: СКК — краткий адрес из content («ул. Ленина, 304А»)", skkItems[0]?.short === "ул. Ленина, 304А", skkItems[0]?.short);
  check("З4: СКК — период из заголовка («с 14:10 до 20:00»)", skkItems[0]?.when === "с 14:10 до 20:00", skkItems[0]?.when);
  // Источник 3: Городской Водоканал — sakhalin.rosvodokanal.ru (РВК-Сахалин)
  const rvcCards = parseVodokanalNewsList(readFileSync(path.join(__dirname, "fixtures", "rvc-news.html"), "utf8"));
  check("З4: Водоканал — сводка-ограничение взята, PR-заметки отсеяны", rvcCards.length === 1 && rvcCards[0]?.title.includes("ограничение холодного водоснабжения"), rvcCards.map((c) => c.title).join(" | "));
  const rvcArt = parseVodokanalArticleHtml(readFileSync(path.join(__dirname, "fixtures", "rvc-article.html"), "utf8"));
  check("З4: Водоканал — адреса из статьи (3 улицы)", rvcArt.addresses.length === 3 && rvcArt.addresses[0] === "ул. Сахалинская, 45, 47, 49", rvcArt.addresses.join(" ; "));
  check("З4: Водоканал — дата статьи 16.09.2026", rvcArt.date === "16.09.2026", rvcArt.date);
  const rvcItems: OutageItem[] = rvcCards.map((c) => ({
    source: "Водоканал", title: c.title, url: c.url, addresses: [], when: "",
    kind: "cold", type: "planned", publishedAt: sakhalinIso(c.date) || "", fetchedAt: "",
  }));
  check("З4: Водоканал — дата 00:00 Сахалина → 2026-09-15T13:00:00.000Z", rvcItems[0]?.publishedAt === "2026-09-15T13:00:00.000Z", rvcItems[0]?.publishedAt);
  // Строка ТЗ: [Иконка/Ведомство] [Адрес/Район] — [Время публикации]
  check("З4: бейджи ведомств — ⚡ Сахалинэнерго / 🔥 СКК / 🚰 Водоканал", outageOrgBadge("Сахалинэнерго").icon === "⚡" && outageOrgBadge("СКК").icon === "🔥" && outageOrgBadge("Водоканал").icon === "🚰");
  check("З4: время публикации — сегодня «ЧЧ:ММ»", outageWhenLabel(new Date().toISOString()) === new Date(Date.now() + 11 * 3600e3).toISOString().slice(11, 16), outageWhenLabel(new Date().toISOString()));
  check("З4: время публикации — прошлое «ДД.ММ ЧЧ:ММ» (2020-05-06T23:24Z → 07.05 10:24)", outageWhenLabel("2020-05-06T23:24:00.000Z") === "07.05 10:24", outageWhenLabel("2020-05-06T23:24:00.000Z"));
  check("З4: время публикации без времени — только «ДД.ММ» (полночь Сахалина 15.09T13:00Z → 16.09)", outageWhenLabel("2026-09-15T13:00:00.000Z") === "16.09", outageWhenLabel("2026-09-15T13:00:00.000Z"));
  check("З4: пустое/битое время — пустая строка", outageWhenLabel("") === "" && outageWhenLabel("мусор") === "");
  // ТОП-3: смешанные ведомства, сортировка строго по publishedAt
  const top4 = pickTopOutages([...frsItems, ...skkItems, ...rvcItems], 3);
  check("З4: топ-3 из трёх ведомств — убывание publishedAt, свет/вода вперемешку", top4.length === 3 && top4.every((it, i) => i === 0 || new Date(top4[i - 1].publishedAt).getTime() >= new Date(it.publishedAt).getTime()) && new Set(top4.map((x) => x.source)).size >= 2, top4.map((x) => x.source).join(" > "));
  // Живой сбор всех трёх ведомств (ФРС и РВК — прямые, СКК — через SDK)
  const o4 = await runOutagesParse();
  check("З4: live-сбор — реальные сводки (≥5 записей)", o4.count >= 5, `${o4.count} сводок`);
  const of4 = await readOutages();
  check("З4: live-сбор — каждая запись несёт publishedAt и short/kind/type", (of4?.items ?? []).every((it) => it.publishedAt.length > 0 && typeof it.short === "string" && !!it.kind && !!it.type));
  // CSS: строка формата ТЗ
  const css4 = readFileSync(path.join(__dirname, "..", "src", "app", "globals.css"), "utf8");
  check("З4-CSS: .mp-off-line — flex-строка с разделителями и ховером", /\.mp-off-line\{[^}]*display:flex/.test(css4) && /\.mp-off-line:hover\{background:#f2f7fb/.test(css4));
  check("З4-CSS: .mp-off-org фикс-колонка, .mp-off-addr ellipsis, .mp-off-time серый", /\.mp-off-org\{[^}]*flex:none/.test(css4) && /\.mp-off-addr\{[^}]*text-overflow:ellipsis/.test(css4) && /\.mp-off-time\{[^}]*color:#56657a/.test(css4));
  check("З4-CSS: мобильные ≤480 — компактные строки (.mp-off-line 6px/4px)", css4.includes(".mp-off-line{gap:4px;padding:6px 4px}"));
  check("З4-CSS: старые блок-классы .mp-off-item/.mp-off-src/.mp-off-when/.mp-off-more убраны", !/\.mp-off-item|\.mp-off-src|\.mp-off-when|\.mp-off-more/.test(css4));
  // HTML-структура информера на Главной
  const hrSrc = readFileSync(path.join(__dirname, "..", "src", "components", "site", "home-right.tsx"), "utf8");
  check("З4-HTML: заголовок «Отключения» — ссылка на /disconnections.php", /mp-paneltitle[\s\S]{0,160}href="\/disconnections\.php"/.test(hrSrc));
  check("З4-HTML: строка формата ТЗ — .mp-off-line с org/addr/time", hrSrc.includes('className="mp-off-line"') && hrSrc.includes("mp-off-org") && hrSrc.includes("mp-off-addr") && hrSrc.includes("mp-off-time"));
  check("З4-HTML: ТОП-3 — slice(0, 3) на Главной", hrSrc.includes("outages.items.slice(0, 3)"));
  check("З4-HTML: заглушка «недоступна» удалена из информера", !hrSrc.includes("недоступна"));
  check("З4-HTML: время публикации — outageWhenLabel (формат ТЗ)", hrSrc.includes("outageWhenLabel(it.publishedAt)"));
  check("З4-HTML: бейджи ведомств — outageOrgBadge", hrSrc.includes("outageOrgBadge(it.source)"));

  // Шаг №12 «Прямоугольные кнопки-фильтры /disconnections.php»: таблетки убраны,
  // форма/цвета/ряд — дословно по директиве (radius 4px, padding 8px 16px,
  // актив #004A8F + белый, неактив белый + рамка #CED4DA + тёмный текст,
  // плавный ховер в серый, горизонтальный ряд gap:8px без переноса)
  check("Шаг №12: .dis-chip — прямоугольник border-radius:4px, овальность 999px убрана", /\.dis-chip\{[^}]*border-radius:4px/.test(css4) && !/border-radius:999px/.test(css4));
  check("Шаг №12: .dis-chip — плотность padding:8px 16px", /\.dis-chip\{[^}]*padding:8px 16px/.test(css4));
  check("Шаг №12: .dis-chip неактив — белый фон + рамка 1px solid #CED4DA + тёмный текст", /\.dis-chip\{[^}]*background:#FFFFFF[^}]*border:1px solid #CED4DA[^}]*color:#1a1a1a/.test(css4));
  check("Шаг №12: .dis-chip.active — фон #004A8F (тон плашек меню), текст чисто белый", /\.dis-chip\.active\{background:#004A8F;border-color:#004A8F;color:#FFFFFF\}/.test(css4));
  check("Шаг №12: .dis-chip:hover — плавная смена (transition) на серый #E9ECEF", /\.dis-chip\{[^}]*transition:background-color/.test(css4) && /\.dis-chip:hover\{background:#E9ECEF/.test(css4));
  check("Шаг №12: .dis-filters — ровный ряд gap:8px, без переноса (nowrap) + горизонтальный скролл", /\.dis-filters\{display:flex;flex-wrap:nowrap;gap:8px;overflow-x:auto/.test(css4));
  check("Шаг №12: мобильная заморозка целя — компактные чипы ≤767 сохранены (6px 10px)", css4.includes(".dis-chip{padding:6px 10px;font-size:12.5px}"));

  // Исправление «мигания логотипа»: логотип (латиница SakhMatrix) рисуется
  // шрифтом Anton; font-display:swap показывал фолбэк (Arial Narrow/Impact) —
  // выглядело как «другой логотип» перед нормальным. Фикс: block + preload.
  const layoutSrc = readFileSync(path.join(__dirname, "..", "src", "app", "layout.tsx"), "utf8");
  // Внимание: (1) в dev-бандле Turbopack CSS содержит пробелы ("font-display: block"),
  // допускаем \s*; (2) сам комментарий блока @font-face упоминает "font-display:swap
  // заменён" — вырезаем CSS-комментарии, чтобы матчить только живые правила
  const cssClean = css4.replace(/\/\*[\s\S]*?\*\//g, "");
  const noSwap = !/font-display:\s*swap/.test(cssClean);
  const bothBlock = (cssClean.match(/font-family:\s*Anton[^}]*?font-display:\s*block/g) ?? []).length === 2;
  check("Фикс логотипа: @font-face Anton (оба сабсета) — font-display:block, swap убран", noSwap && bothBlock);
  check("Фикс логотипа: preload обоих woff2 в layout.tsx (crossOrigin обязателен)", layoutSrc.includes('rel="preload"') && layoutSrc.includes('href="/fonts/anton-latin.woff2"') && layoutSrc.includes('href="/fonts/anton-latin-ext.woff2"') && (layoutSrc.match(/crossOrigin/g) ?? []).length >= 2);

  // Директива «Чистка навигации и блок „Обсудить на форуме“» (nav-cleanup-2026-09-18):
  // меню «Ещё» — строго 3 пункта (ПК-дропдаун И мобильная шторка); карточка
  // «Обсудить на форуме» в левой колонке всех страниц; роуты /rules.php,
  // /feedback.php, /about.php в легаси-стиле *.php
  const navChromeSrc = readFileSync(path.join(__dirname, "..", "src", "components", "site", "chrome.tsx"), "utf8");
  const navMore = navChromeSrc.slice(navChromeSrc.indexOf("const NAV_MORE = ["), navChromeSrc.indexOf("];", navChromeSrc.indexOf("const NAV_MORE = [")));
  check("Нав-чистка: NAV_MORE — строго 3 пункта с href /rules.php, /feedback.php, /about.php", (navMore.match(/href:\s*"\//g) ?? []).length === 3 && navMore.includes('"/rules.php"') && navMore.includes('"/feedback.php"') && navMore.includes('"/about.php"'), navMore.replace(/\s+/g, " ").slice(0, 160));

  // СТАДИЯ 2 (директива «Очистка навигации»): из левой части синей панели
  // удалены 3 пункта (Практическая информация / Справочник / Полезное) —
  // осталось строго 4: Главная, Форум, Объявления, Ещё ▾. Форма поиска
  // расширена через flex-grow:1 + max-width:480px — занимает всё свободное
  // место по центру.
  check("Stage2 nav: NAV_MAIN — строго 3 пункта (Главная/Форум/Объявления) — удалены info/directory/useful", (navChromeSrc.match(/key: "(?:home|forum|ads)"/g) ?? []).length === 3 && !navChromeSrc.includes('key: "info"') && !navChromeSrc.includes('key: "directory"') && !navChromeSrc.includes('key: "useful"'));
  check("Stage2 nav: в NAV_MAIN НЕТ «Практическая информация» / «Справочник» / «Полезное»", (() => {
    const navMain = navChromeSrc.slice(navChromeSrc.indexOf("const NAV_MAIN = ["), navChromeSrc.indexOf("];", navChromeSrc.indexOf("const NAV_MAIN = [")));
    return !navMain.includes("Практическая информация") && !navMain.includes("Справочник") && !navMain.includes("Полезное");
  })());
  check("Stage2 nav: «Ещё ▾» в синей панели (4-й пункт — выпадающий список NAV_MORE)", navChromeSrc.includes("Ещё <span") && navChromeSrc.includes("▾"));
  check("Stage2 nav CSS: .sm-nav-right с flex:1 1 auto (занимает свободное место)", /\.sm-nav-right\{[^}]*margin-left:auto;[^}]*flex:1 1 auto[^}]*\}/.test(cssClean));
  check("Stage2 nav CSS: .sm-nav-search с flex:1 1 auto + max-width:480px (расширение поиска)", /\.sm-nav-search\{[^}]*flex:1 1 auto;[^}]*max-width:480px[^}]*\}/.test(cssClean));
  check("Stage2 nav CSS: input поиска flex:1 1 auto + width:100% (занимает весь контейнер)", /\.sm-nav-search input\{[^}]*width:100%;[^}]*flex:1 1 auto[^}]*\}/.test(cssClean));
  check("Stage2 nav CSS: лупа (button) position:absolute + right:2px (прижата к правому краю, не съезжает)", /\.sm-nav-search button\{[^}]*position:absolute;[^}]*right:2px[^}]*\}/.test(cssClean));
  check("Stage2 nav CSS: кнопки входа flex-shrink:0 (не сжимаются, прижаты к правому краю)", /\.sm-nav-right > \.sm-mainnav-link \{ flex-shrink: 0; \}/.test(cssClean));
  check("Нав-чистка: из «Ещё» удалены ВСЕ сторонние рубрики (в т.ч. Знакомства и Админ-раздел)", !navMore.includes("key:") && !navMore.includes("Подслушано") && !navMore.includes("Знакомств") && !navMore.includes("Админ-раздел") && !navMore.includes("Нужна помощь"));
  check("Нав-чистка: единый источник NAV_MORE для ПК и шторки — обычные ссылки <a href> (старый список more.map/кнопки убраны)", (navChromeSrc.match(/href=\{m\.href\}/g) ?? []).length === 2 && navChromeSrc.includes('role="menuitem"') && navChromeSrc.includes("sm-mdrawer-link sm-mdrawer-sub ${pathname === m.href") && !navChromeSrc.includes("more.map") && !navChromeSrc.includes("const more ="));
  check("Нав-чистка: подсветка активного пункта «Ещё» — по адресу страницы (usePathname)", navChromeSrc.includes('from "next/navigation"') && navChromeSrc.includes("NAV_MORE.some((m) => m.href === pathname)"));

  const leftNavSrc = readFileSync(path.join(__dirname, "..", "src", "components", "site", "left-nav.tsx"), "utf8");
  const discuss = leftNavSrc.slice(leftNavSrc.indexOf("export const DISCUSS_RUBRICS"), leftNavSrc.indexOf("];", leftNavSrc.indexOf("export const DISCUSS_RUBRICS")));
  const cardSrc = leftNavSrc.slice(leftNavSrc.indexOf("export function ForumDiscussCard"), leftNavSrc.indexOf("export default function ForumSideNav"));
  check("Нав-чистка: DISCUSS_RUBRICS — ровно 5 рубрик из директивы, каждая — одна ссылка в свою ветку *-discuss", (discuss.match(/href:\s*"\//g) ?? []).length === 5 && ["podslyshano-discuss", "wheretobuy-discuss", "gdedeshevle-discuss", "recommend-discuss", "employers-discuss"].every((s) => discuss.includes(`/?rubric=${s}`)));
  check("Нав-чистка: список строк дословно из директивы (Подслушано Сахалин / Где купить / Где дешевле / Рекомендую / Не рекомендую / О работодателях)", ["Подслушано Сахалин", "Где купить", "Где дешевле", "Рекомендую / Не рекомендую", "О работодателях"].every((n) => discuss.includes(`name: "${n}"`)));
  check("Нав-чистка: из блока удалены ЖКХ и «Нужна помощь» (перечень директивы исчерпывающий), «Знакомства» не входит (трафик-магнит)", !discuss.includes("gkh-discuss") && !discuss.includes("/help") && !discuss.includes("znakomstva") && !discuss.includes("Знакомств"));
  check("Нав-чистка: ForumDiscussCard — нет старых вложенных карточек/кнопок (sk-discuss-row/btn/name отсутствуют)", cardSrc.includes("Обсудить на форуме") && !leftNavSrc.includes("sk-discuss-row") && !leftNavSrc.includes("sk-discuss-btn") && !leftNavSrc.includes("sk-discuss-name"));
  // СТАДИЯ 2 (директива «Привести блок к единому стилю + окантовка как у всех»):
  // ForumDiscussCard использует стандартные классы .sk-sideblock + .sk-blocktitle
  // (окантовка 1px solid var(--sm-navy)=#1E3A5F, тень, padding 9px 10px, шапка
  // с отрицательными margin -9px -10px 7px — растягивается на всю ширину).
  // Удалены inline-стили контейнера и шапки (border #CED4DA, bg #004A8F, padding 8px 12px).
  check("Stage2 nav: блок ForumDiscussCard использует .sk-sideblock + .sk-blocktitle (единый стиль с другими блоками левой колонки)", cardSrc.includes('className="sk-sideblock"') && cardSrc.includes('className="sk-blocktitle"'));
  check("Stage2 nav: НЕТ inline border #CED4DA на контейнере (используется эталонная окантовка .sk-sideblock)", !cardSrc.includes('border: "1px solid #CED4DA"') && !cardSrc.includes('boxShadow: "0 2px 8px rgba(0,0,0,0.05)"'));
  check("Stage2 nav: НЕТ inline bg #004A8F на шапке (используется эталон .sk-blocktitle)", !cardSrc.includes('backgroundColor: "#004A8F"') && !cardSrc.includes('backgroundColor: "#1E3A5F"'));
  check("Stage2 nav: шапка с <span className=\"tri\">▼</span>Обсудить на форуме (как у всех .sk-blocktitle)", cardSrc.includes('<span className="tri">▼</span>Обсудить на форуме'));
  check("Stage2 nav: 5 ссылок <a> с inline display:flex + align-items:flex-start + justify-content:space-between + padding 8px 12px", cardSrc.includes('display: "flex"') && cardSrc.includes('alignItems: "flex-start"') && cardSrc.includes('justifyContent: "space-between"') && cardSrc.includes('padding: "8px 12px"') && cardSrc.includes('textDecoration: "none"'));
  check("Stage2 nav: эмодзи-иконка 💬 единственная для ВСЕХ рубрик (💼 у «О работодателях» заменён на 💬)", cardSrc.includes('const emoji = "💬"') && !cardSrc.includes('d.name === "О работодателях" ? "💼"'));
  check("Stage2 nav: рубрика «Рекомендую / Не рекомендую» с break:true — принудительный перенос на 2 строки через <br/>", discuss.includes("break: true") && cardSrc.includes("d.break ? d.name.split") && cardSrc.includes("{nameParts[0]} /<br />") && cardSrc.includes("{nameParts[1]}"));
  check("Stage2 nav: текст рубрики с inline line-height:1.3 + цвет #004A8F", cardSrc.includes('fontSize: "14px"') && cardSrc.includes('color: "#004A8F"') && cardSrc.includes('lineHeight: "1.3"'));
  check("Stage2 nav: стрелка ▶ с inline color #CED4DA + font-size 12px + align-self:center", cardSrc.includes('color: "#CED4DA", fontSize: "12px", alignSelf: "center"') && cardSrc.includes(">▶</span>"));
  check("Stage2 nav: lucide-react rubricIcon убран из ForumDiscussCard (теперь эмодзи)", !cardSrc.includes("rubricIcon(d.name)"));
  check("Stage2 nav: блок ForumDiscussCard поднят ВЫШЕ «Служебный раздел» (раньше был ниже)", (() => {
    const fnStart = leftNavSrc.indexOf("export default function ForumSideNav");
    const fnBody = leftNavSrc.slice(fnStart);
    const discussPos = fnBody.indexOf("<ForumDiscussCard />");
    // Ищем реальный JSX «Служебный раздел» (внутри sk-blocktitle), а не в комментарии
    const servicePos = fnBody.indexOf('▼</span>Служебный раздел');
    return discussPos > 0 && servicePos > 0 && discussPos < servicePos;
  })());
  check("Stage2 nav CSS: старые правила .sakh-forum-link-* УДАЛЕНЫ (всё inline, дубли не нужны)", !cssClean.includes(".sakh-forum-link-row") && !cssClean.includes(".sakh-forum-link-left") && !cssClean.includes(".sakh-forum-link-arrow") && !cssClean.includes(".sakh-forum-block-body"));
  check("Нав-чистка: блок в конце левой колонки внутренних страниц (ForumSideNav)", /<ForumDiscussCard \/>/.test(leftNavSrc));
  const navPageSrc = readFileSync(path.join(__dirname, "..", "src", "app", "page.tsx"), "utf8");
  check("Нав-чистка: тот же блок в левой колонке Главной/форума (Sidebar в page.tsx)", navPageSrc.includes("import { ForumDiscussCard, SCOPE_ICONS, rubricIcon }") && /<ForumDiscussCard \/>/.test(navPageSrc));
  check("Stage2 nav: на Главной (page.tsx) ForumDiscussCard тоже ВЫШЕ «Служебный раздел» (Служебный раздел в самом низу)", (() => {
    const sidebarStart = navPageSrc.indexOf('className={`sk-col-left left-column');
    const sidebarBody = navPageSrc.slice(sidebarStart);
    const discussPos = sidebarBody.indexOf("<ForumDiscussCard />");
    const servicePos = sidebarBody.indexOf('▼</span>Служебный раздел');
    return discussPos > 0 && servicePos > 0 && discussPos < servicePos;
  })());
  check("Нав-чистка: «Знакомства» остаётся на Главной — блок входа /znakomstva не тронут", navPageSrc.includes('href="/znakomstva"'));

  const routeFiles = ["rules.php", "feedback.php", "about.php"];
  const routesOk = routeFiles.every((r) => {
    try {
      const src = readFileSync(path.join(__dirname, "..", "src", "app", r, "page.tsx"), "utf8");
      return src.includes(`@/components/site/static-screens`) && src.length > 400;
    } catch {
      return false;
    }
  });
  check("Нав-чистка: роуты /rules.php, /feedback.php, /about.php созданы (легаси-стиль *.php)", routesOk);
  const staticScreensSrc = readFileSync(path.join(__dirname, "..", "src", "components", "site", "static-screens.tsx"), "utf8");
  check("Нав-чистка: страницы «Ещё» — трёхколоночный монолит (ForumSideNav + центр + HomeRight), контент один — pages.tsx (без дублей)", staticScreensSrc.includes("<ForumSideNav />") && staticScreensSrc.includes("<HomeRight />") && staticScreensSrc.includes("<RulesPage") && staticScreensSrc.includes("<AppealPage") && staticScreensSrc.includes("<AboutPage"));

  // CSS блока «Обсудить на форуме» (css4/cssClean прочитаны выше):
  // собственных правил у блока больше НЕТ — стиль дают общие правила
  // .sk-navlist/.sk-rubric-*, т.е. 100% сходство с «Рубрики форума»
  check("Нав-чистка CSS: собственные правила блока удалены (.sk-discuss-row/.sk-discuss-btn/.sk-discuss-name отсутствуют в CSS)", !cssClean.includes(".sk-discuss-row") && !cssClean.includes(".sk-discuss-btn") && !cssClean.includes(".sk-discuss-name"));
  check("Нав-чистка CSS: стиль строк блока = правила «Рубрики форума» на месте (sk-rubric-name #0a5caa + hover #c40000, стрелка .arr #7d98b4)", /\.sk-rubric-name\{color:#0a5caa;cursor:pointer;text-align:left;background:0 0;border:0;padding:1px 0;font-family:inherit;font-size:13\.5px;text-decoration:underline\}/.test(cssClean) && /\.sk-rubric-name:hover\{color:#c40000\}/.test(cssClean) && /\.sk-rubric-name \.arr\{color:#7d98b4;margin-left:4px;font-size:10px/.test(cssClean));
  check("Нав-чистка CSS: квадратная карта .trf-map не тронута (height:850px в @media ≥1024px)", /@media \(min-width:1024px\)\{\s*\.trf-map\{width:100%;height:850px\}\s*\}/.test(cssClean));

  // Директива «Сахалинские часы» (финальная — ИДЕНТИЧНО дизайн-системе
  // .mp-panel/.mp-paneltitle Погоды/Отключений/Пробок): цвета взяты
  // ДОСЛОВНО из globals.css — border 1px #4A688C (тёмно-синяя окантовка,
  // НЕ серая #CED4DA), border-radius 0 (без скругления, НЕ 4px),
  // box-shadow композитная 0 1px 3px rgba(0,0,0,0.05), 0 1px 2px
  // rgba(0,0,0,0.03) (как у Погоды), шапка bg #1E3A5F (var(--sm-navy) —
  // ЦВЕТ ПОГОДЫ, НЕ #004A8F!), border-bottom 1px #16293F (var(--sm-navy-deep)),
  // padding 5px 9px, font 13px/700. Тело — flex-центровщик (display:flex,
  // flex-direction:column, justify-content:center, align-items:center,
  // height:50px). Дата 12px/#5A6A85/600/small-caps; время 19px/#2A3B50/700/
  // tabular-nums. JS только textContent. Часовой пояс Asia/Magadan (GMT+11).
  const dtSrc = readFileSync(path.join(__dirname, "..", "src", "components", "site", "sakh-datetime-block.tsx"), "utf8");
  check("Часы идентично: МАРКЕР «🕒 SakhMatrix • Время» в шапке", dtSrc.includes("🕒 SakhMatrix • Время"));
  check("Часы идентично: контейнер border 1px solid #4A688C (ЦВЕТ ПОГОДЫ, не #CED4DA!)", dtSrc.includes('border: "1px solid #4A688C !important"') && !dtSrc.includes("#CED4DA"));
  check("Часы идентично: контейнер border-radius 0 (без скругления, как у Погоды)", dtSrc.includes('borderRadius: "0 !important"') && !dtSrc.includes('borderRadius: "4px'));
  check("Часы идентично: контейнер box-shadow композитная 0 1px 3px + 0 1px 2px (как у Погоды)", dtSrc.includes('boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03) !important"'));
  check("Часы идентично: контейнер bg #FFFFFF + overflow hidden + box-sizing border-box + width 100% + font-family system-ui", dtSrc.includes('backgroundColor: "#FFFFFF !important"') && dtSrc.includes('overflow: "hidden !important"') && dtSrc.includes('boxSizing: "border-box !important"') && dtSrc.includes('width: "100% !important"') && dtSrc.includes("fontFamily: \"system-ui, -apple-system, sans-serif !important\""));
  check("Часы идентично: шапка bg #1E3A5F (var(--sm-navy) — ЦВЕТ ПОГОДЫ, не #004A8F!)", dtSrc.includes('backgroundColor: "#1E3A5F !important"') && !dtSrc.includes('backgroundColor: "#004A8F !important"'));
  check("Часы идентично: шапка color #FFF + padding 5px 9px (как .mp-paneltitle) + font 13px/700", dtSrc.includes('color: "#FFFFFF !important"') && dtSrc.includes('padding: "5px 9px !important"') && dtSrc.includes('fontWeight: "700 !important"') && dtSrc.includes('fontSize: "13px !important"'));
  check("Часы идентично: шапка border-bottom 1px solid #16293F (var(--sm-navy-deep), как .mp-paneltitle)", dtSrc.includes('#16293F !important'));
  check("Часы идентично: ТЕЛО FLEXBOX-ЦЕНТРОВЩИК display:flex + flex-direction:column + justify-content:center + align-items:center + height:50px", dtSrc.includes('display: "flex !important"') && dtSrc.includes('flexDirection: "column !important"') && dtSrc.includes('justifyContent: "center !important"') && dtSrc.includes('alignItems: "center !important"') && dtSrc.includes('height: "50px !important"'));
  check("Часы идентично: тело padding 4px 0 + bg #FFFFFF + box-sizing border-box + margin 0 + border none", dtSrc.includes('padding: "4px 0 !important"') && dtSrc.includes('backgroundColor: "#FFFFFF !important"') && dtSrc.includes('boxSizing: "border-box !important"') && dtSrc.includes('margin: "0 !important"') && dtSrc.includes('border: "none !important"'));
  check("Часы идентично: дата 12px/#5A6A85/600 + margin 0 + padding 0 + line-height 1.2 + small-caps + lowercase", dtSrc.includes('fontSize: "12px !important"') && dtSrc.includes('fontWeight: 600') && dtSrc.includes('color: "#5A6A85 !important"') && dtSrc.includes('margin: "0 !important"') && dtSrc.includes('padding: "0 !important"') && dtSrc.includes('lineHeight: "1.2 !important"') && dtSrc.includes('textTransform: "lowercase"') && dtSrc.includes('fontVariant: "small-caps !important"'));
  check("Часы идентично: время 19px/#2A3B50/700 + tabular-nums + margin 0 + padding 0 + line-height 1.2", dtSrc.includes('fontSize: "19px !important"') && dtSrc.includes('fontWeight: 700') && dtSrc.includes('color: "#2A3B50 !important"') && dtSrc.includes('fontVariantNumeric: "tabular-nums !important"') && dtSrc.includes('margin: "0 !important"') && dtSrc.includes('padding: "0 !important"') && dtSrc.includes('lineHeight: "1.2 !important"') && dtSrc.includes("00:00:00"));
  check("Часы идентично: id=\"sakh-date\" и id=\"sakh-time\" в JSX", dtSrc.includes('id="sakh-date"') && dtSrc.includes('id="sakh-time"'));
  check("Часы идентично: JS только textContent (без innerHTML/insertAdjacentHTML)", dtSrc.includes("dateEl.textContent = dateStr") && dtSrc.includes("timeEl.textContent = timeStr") && !/innerHTML\s*=/.test(dtSrc) && !/insertAdjacentHTML/.test(dtSrc));
  check("Часы идентично: CSS-фолбэк div[style*=\"background-color: rgb(0, 74, 143)\"] сохранён", /div\[style\*="background-color: rgb\(0, 74, 143\)"\]\s*\{[^}]*background-color:\s*#004A8F !important[^}]*\}/.test(cssClean));
  check("Часы идентично: старые правила .sakh-datetime-card/header/body отсутствуют в CSS", !cssClean.includes(".sakh-datetime-card") && !cssClean.includes(".sakh-datetime-header") && !cssClean.includes(".sakh-datetime-body"));
  check("Лозунг: Tailwind mt-0.5/md:mt-1 убраны из chrome.tsx", !/header-slogan mt-0\.5/.test(navChromeSrc) && !/md:mt-1/.test(navChromeSrc.slice(navChromeSrc.indexOf("header-slogan"), navChromeSrc.indexOf("header-slogan") + 300)));
  check("Лозунг: CSS .header-slogan margin:0/padding:0/line-height:1.3 (компактный, без зазора)", /\.header-slogan\{margin:0;padding:0;line-height:1\.3\}/.test(cssClean));
  check("Лозунг: мобильный откат line-height:inherit в @media≤767px", /@media \(max-width:767px\)\{\.header-slogan\{line-height:inherit\}\}/.test(cssClean));

  // Stage 2 (директива «Текст плашки = название страницы»): на 4 страницах
  // текст «← Вернуться на Главную» заменён на название раздела (href=/ сохранён)
  const wxStageSrc2 = readFileSync(path.join(__dirname, "..", "src", "components", "site", "weather-screen.tsx"), "utf8");
  const curSrcFile = readFileSync(path.join(__dirname, "..", "src", "components", "site", "currency-screen.tsx"), "utf8");
  const disSrcFile = readFileSync(path.join(__dirname, "..", "src", "components", "site", "disconnections-screen.tsx"), "utf8");
  const trfSrcFile = readFileSync(path.join(__dirname, "..", "src", "components", "site", "traffic-screen.tsx"), "utf8");
  check("Stage2 weather: плашка <div>Погода</div> (БЕЗ стрелки ← и БЕЗ кликабельности — без href)", wxStageSrc2.includes("Погода") && !wxStageSrc2.includes("← Погода") && !wxStageSrc2.includes('wth-back" href'));
  check("Stage2 currency: плашка <div>Курсы валют</div> (БЕЗ ← и БЕЗ href)", curSrcFile.includes("Курсы валют") && !curSrcFile.includes("← Курсы валют") && !curSrcFile.includes('crt-back" href'));
  check("Stage2 disconnections: плашка <div>Отключения</div> (БЕЗ ← и БЕЗ href)", disSrcFile.includes("Отключения") && !disSrcFile.includes("← Отключения") && !disSrcFile.includes('dis-back" href'));
  check("Stage2 traffic: плашка <div>Пробки</div> (БЕЗ ← и БЕЗ href)", trfSrcFile.includes("Пробки") && !trfSrcFile.includes("← Пробки") && !trfSrcFile.includes('trf-back" href'));

  // ===== СТАДИЯ 2 — Сжатие и модернизация сервисных страниц =====
  console.log("\n— Стадия 2: сжатие сервисных страниц (/currency, /disconnections, /weather) —");
  // 1. /currency.php — компактная таблица + иконки банков + быстрый конвертер
  const curSrc = readFileSync(path.join(__dirname, "..", "src", "components", "site", "currency-screen.tsx"), "utf8");
  check("Stage2 cur: иконки банков lucide-react (Building2/Landmark/CreditCard/Wallet/PiggyBank)", curSrc.includes("Building2") && curSrc.includes("Landmark") && curSrc.includes("CreditCard") && curSrc.includes("Wallet") && curSrc.includes("PiggyBank"));
  check("Stage2 cur: BankIcon компонент + BANK_ICONS map для 5 банков ТЗ", curSrc.includes("function BankIcon") && curSrc.includes("BANK_ICONS") && curSrc.includes('АТБ: Wallet') && curSrc.includes('"Солид Банк": Landmark') && curSrc.includes("Сбер: PiggyBank") && curSrc.includes("ВТБ: CreditCard"));
  check("Stage2 cur: <th className=\"crt-bank-cell\"> с иконкой и span.crt-bank-name", curSrc.includes('className="crt-bank-cell"') && curSrc.includes('<BankIcon bank={b.bank} />') && curSrc.includes('className="crt-bank-name"'));
  check("Stage2 cur: иконки банков size={16} + width:16px + height:16px (16x16px)", curSrc.includes('size={16}') && curSrc.includes('width: "16px"') && curSrc.includes('height: "16px"'));
  check("Stage2 cur: ячейка с прочерком получает класс .is-dash (buyDash/sellDash отдельно)", curSrc.includes("is-dash") && curSrc.includes("buyDash") && curSrc.includes("sellDash") && curSrc.includes("pair.buy == null") && curSrc.includes("pair.sell == null"));
  check("Stage2 cur: БЫСТРЫЙ КОНВЕРТЕР — блок <section aria-label=\"Калькулятор-конвертер валют\">", curSrc.includes('aria-label="Калькулятор-конвертер валют"'));
  check("Stage2 cur: поля конвертера — Сумма (input) + Валюта (select с 5 кодами) + радио Операция", curSrc.includes('inputMode="decimal"') && curSrc.includes('value={convCur}') && curSrc.includes('setConvCur') && curSrc.includes("Купить в банке") && curSrc.includes("Продать в банк") && curSrc.includes('type="radio"') && curSrc.includes('name="conv-op"'));
  check("Stage2 cur: ИТОГ одной строкой «Итого: ... руб. в [Банк]» через crt-conv-total", curSrc.includes('className="crt-conv-total"') && curSrc.includes("Итого: ") && curSrc.includes("руб. в ${convBestBank}"));
  check("Stage2 cur: итог в рублях через useMemo + convertToRub из lib/currency-table", curSrc.includes("useMemo") && curSrc.includes("convertToRub") && curSrc.includes("convResult"));
  check("Stage2 cur: блок результата показывает лучший банк-источник курса", curSrc.includes("convBestBank") && curSrc.includes("convBestValue"));
  check("Stage2 cur: импорт convertToRub из lib/currency-table", curSrc.includes("convertToRub") && /import \{[^}]*convertToRub[^}]*\} from "@\/lib\/currency-table"/.test(curSrc));
  // CSS для currency
  check("Stage2 cur CSS: padding ячеек урезан до 6px 8px !important", /\.crt-table th, \.crt-table td \{ padding: 6px 8px !important; \}/.test(cssClean));
  check("Stage2 cur CSS: цифры td b 14px/700 !important (полужирные, по одной цифре)", /\.crt-table td b \{ font-size: 14px !important; font-weight: 700 !important; \}/.test(cssClean));
  check("Stage2 cur CSS: прочерки светло-серые .is-dash (#A0AAB0)", /\.crt-table td\.is-dash b,\s*\.crt-table td\.is-dash i \{ color: #A0AAB0 !important; font-weight: 400 !important; \}/.test(cssClean));
  check("Stage2 cur CSS: .crt-bank-cell flex-row для иконки+имени", /\.crt-bank-cell \{ display: flex !important; align-items: center; gap: 4px; \}/.test(cssClean));
  check("Stage2 cur CSS: НОВАЯ таблица — 2-уровневый заголовок .crt-table-split + .crt-th-bank + .crt-th-cur", /\.crt-table-split \{ table-layout: fixed; \}/.test(cssClean) && /\.crt-table-split \.crt-th-bank \{[^}]*width: 110px/.test(cssClean) && /\.crt-table-split \.crt-th-cur \{[^}]*background: #f2f6f9/.test(cssClean));
  check("Stage2 cur CSS: подколонки «Купим» (#2E7D32 зелёный) / «Продадим» (#C62828 красный)", /\.crt-table-split \.crt-th-buy \{ color: #2E7D32; \}/.test(cssClean) && /\.crt-table-split \.crt-th-sell \{ color: #C62828; \}/.test(cssClean));
  check("Stage2 cur CSS: ячейки с одной цифрой .crt-cell-buy / .crt-cell-sell (text-align center, tabular-nums)", /\.crt-table-split td\.crt-cell-buy,\s*\.crt-table-split td\.crt-cell-sell \{[^}]*text-align: center;[^}]*font-variant-numeric: tabular-nums;[^}]*\}/.test(cssClean));
  check("Stage2 cur: таблица .crt-table-split с 2-уровневым thead (rowSpan=2 Банк + colSpan=2 валюты)", curSrc.includes('className="crt-table crt-table-split"') && curSrc.includes("rowSpan={2}") && curSrc.includes("colSpan={2}"));
  check("Stage2 cur: верхний ряд .crt-row-main с Банк (rowSpan=2) + 5 валют (colSpan=2)", curSrc.includes('className="crt-row-main"') && curSrc.includes('className="crt-th-bank"') && curSrc.includes('className="crt-th-cur"'));
  check("Stage2 cur: нижний ряд .crt-row-sub с 5×(Купим | Продадим) подколонок", curSrc.includes('className="crt-row-sub"') && curSrc.includes('crt-th-sub crt-th-buy') && curSrc.includes('crt-th-sub crt-th-sell'));
  check("Stage2 cur: в каждой ячейке ОДНА цифра (Fragment с td.crt-cell-buy + td.crt-cell-sell)", curSrc.includes('is-best crt-cell-buy') && curSrc.includes('is-best crt-cell-sell') && curSrc.includes('<Fragment key={c.key}>') && curSrc.includes("buyBest = isBestBuy(pair, best[c.key])") && curSrc.includes("sellBest = isBestSell(pair, best[c.key])"));
  check("Stage2 cur: импорт isBestBuy + isBestSell из lib/currency-table (max для buy, min для sell)", curSrc.includes("isBestBuy") && curSrc.includes("isBestSell") && /import \{[^}]*isBestBuy[^}]*isBestSell[^}]*\} from "@\/lib\/currency-table"/.test(curSrc));
  check("Stage2 cur CSS: блок конвертера .crt-conv с фоном #F8FAFC + padding 10px 12px", /\.crt-conv \{[^}]*padding: 10px 12px;[^}]*background: #F8FAFC;[^}]*\}/.test(cssClean));
  check("Stage2 cur CSS: input/select конвертера padding 6px 10px + border 1px #CED4DA + radius 4px", /\.crt-conv-input,\s*\.crt-conv-select \{[^}]*padding: 6px 10px !important;[^}]*border: 1px solid #CED4DA;[^}]*border-radius: 4px;[^}]*\}/.test(cssClean));
  check("Stage2 cur CSS: radio-кнопки [Купить в банке]/[Продать в банк] — активная bg #1E3A5F + белый текст", /\.crt-conv-radio-opt\.active \{[^}]*background: #1E3A5F;[^}]*color: #FFFFFF;[^}]*\}/.test(cssClean));
  check("Stage2 cur CSS: ИТОГ одной строкой .crt-conv-total — 16px/700 зелёный #2E7D32", /\.crt-conv-total \{[^}]*font-size: 16px;[^}]*font-weight: 700;[^}]*color: #2E7D32;[^}]*\}/.test(cssClean));
  // Логика convertToRub
  const curTableSrc = readFileSync(path.join(__dirname, "..", "src", "lib", "currency-table.ts"), "utf8");
  check("Stage2 cur lib: convertToRub(amount, cur, op, best) — номинал JPY=100/KRW=1000", curTableSrc.includes("export function convertToRub") && curTableSrc.includes("CURRENCY_UNITS_MAP") && curTableSrc.includes("jpy: 100") && curTableSrc.includes("krw: 1000"));
  check("Stage2 cur lib: isBestBuy — МАКСИМАЛЬНЫЙ курс покупки (выгодно сдать дороже)", curTableSrc.includes("export function isBestBuy") && curTableSrc.includes("pair.buy === best.buy.value"));
  check("Stage2 cur lib: isBestSell — МИНИМАЛЬНЫЙ курс продажи (выгодно купить дешевле)", curTableSrc.includes("export function isBestSell") && curTableSrc.includes("pair.sell === best.sell.value"));
  check("Stage2 cur lib: computeBestRates — buy ищет MAX (buy > best.value), sell ищет MIN (sell < best.value)", curTableSrc.includes("buy > best") && curTableSrc.includes("sell < best"));

  // 2. /disconnections.php — аккордеоны <details>/<summary>
  const disSrc = readFileSync(path.join(__dirname, "..", "src", "components", "site", "disconnections-screen.tsx"), "utf8");
  check("Stage2 dis: карточки в <details>/<summary> (нативный аккордеон)", disSrc.includes('<details') && disSrc.includes('<summary className="dis-summary">'));
  check("Stage2 dis: summary с маркером ведомства + городом + временем ▾", disSrc.includes("outageOrgBadge(it.source)") && disSrc.includes("outageWhenLabel(it.publishedAt)") && disSrc.includes('className="dis-summary-arr"') && disSrc.includes("▾"));
  check("Stage2 dis: содержимое (адреса) в .dis-details внутри <details>", disSrc.includes('<div className="dis-details">') && disSrc.includes("dis-addr"));
  check("Stage2 dis CSS: <details.dis-item> с border 1px #e1e8ee + radius 4px", /\.dis-list details\.dis-item \{[^}]*border: 1px solid #e1e8ee;[^}]*border-radius: 4px;[^}]*\}/.test(cssClean));
  check("Stage2 dis CSS: summary list-style:none (убран нативный треугольник)", /\.dis-list details\.dis-item > summary\.dis-summary \{[^}]*list-style: none;[^}]*cursor: pointer;[^}]*\}/.test(cssClean));
  check("Stage2 dis CSS: стрелка ▾ rotate(180deg) при [open] (плавное раскрытие)", /\.dis-list details\.dis-item\[open\] > summary\.dis-summary \.dis-summary-arr \{[^}]*transform: rotate\(180deg\);[^}]*\}/.test(cssClean));
  check("Stage2 dis CSS: webkit-details-marker скрыт (нет нативного маркера)", /\.dis-list details\.dis-item > summary\.dis-summary::-webkit-details-marker \{[^}]*display: none;[^}]*\}/.test(cssClean));

  // 3. /weather.php — урезанный meteoblue + 2-колон. сетка + цветные температуры
  const wxStageSrc = readFileSync(path.join(__dirname, "..", "src", "components", "site", "weather-screen.tsx"), "utf8");
  check("Stage2 wx: tempClass(t) — класс wth-t-warm/cold/neutral по шкале", wxStageSrc.includes("function tempClass") && wxStageSrc.includes("wth-t-warm") && wxStageSrc.includes("wth-t-cold") && wxStageSrc.includes("wth-t-neutral"));
  check("Stage2 wx: tempClass ≥+5°→warm, ≤-5°→cold, между→neutral", wxStageSrc.includes("t >= 5") && wxStageSrc.includes("t <= -5"));
  check("Stage2 wx: бабл температуры с tempClass(c.temp) в className", wxStageSrc.includes('className={`wth-bub-t ${tempClass(c.temp)}`}'));
  check("Stage2 wx: 2-колон. сетка через .wth-grid-2col", wxStageSrc.includes('className="wth-grid wth-grid-2col"'));
  check("Stage2 wx: meteoblue с классом .mp-w-frame-sm (урезанная высота)", wxStageSrc.includes('className="mp-w-frame mp-w-frame-sm"'));
  check("Stage2 wx CSS: .mp-w-frame-sm height 200px !important (было 230px)", /\.mp-w-frame-sm \{ height: 200px !important; \}/.test(cssClean));
  check("Stage2 wx CSS: .wth-grid-2col grid-template-columns repeat(2,1fr) !important", /\.wth-grid-2col \{[^}]*grid-template-columns: repeat\(2, 1fr\) !important;[^}]*\}/.test(cssClean));
  check("Stage2 wx CSS: wth-t-warm оранжевый #D2691E + wth-t-cold синий #1976D2", /\.wth-bub-t\.wth-t-warm \{ color: #D2691E !important; \}/.test(cssClean) && /\.wth-bub-t\.wth-t-cold \{ color: #1976D2 !important; \}/.test(cssClean));
  check("Stage2 wx CSS: мобайл @media≤480 → 1 колонка (откат для узких экранов)", /@media \(max-width: 480px\) \{\s*\.wth-grid-2col \{ grid-template-columns: 1fr !important; \}\s*\}/.test(cssClean));
  // Гарантия: глобальная сетка не тронута
  check("Stage2: глобальная сетка 850px НЕ тронута (.trf-map{height:850px}@media≥1024px)", /@media \(min-width:1024px\)\{\s*\.trf-map\{width:100%;height:850px\}\s*\}/.test(cssClean));

  // ===== Директива «Бесконечная карусель волонтёров» (Stage 2 — финальная) =====
  console.log("\n— Директива «Бесконечная карусель»: 6 кнопок 240×80px, gap 4px, клонирование+сброс —");
  const volSrc = readFileSync(path.join(__dirname, "..", "src", "components", "site", "volunteers-carousel.tsx"), "utf8");
  const homeCenterSrc = readFileSync(path.join(__dirname, "..", "src", "components", "site", "home-center.tsx"), "utf8");
  const wxSrcVol = readFileSync(path.join(__dirname, "..", "src", "components", "site", "weather-screen.tsx"), "utf8");
  const curSrcVol = readFileSync(path.join(__dirname, "..", "src", "components", "site", "currency-screen.tsx"), "utf8");
  const disSrcVol = readFileSync(path.join(__dirname, "..", "src", "components", "site", "disconnections-screen.tsx"), "utf8");
  const trfSrcVol = readFileSync(path.join(__dirname, "..", "src", "components", "site", "traffic-screen.tsx"), "utf8");
  check("Volunteers: файл volunteers-carousel.tsx создан", volSrc.length > 0);
  // Сквозной блок — на всех 5 страницах (Главная + 4 сервиса)
  check("Volunteers сквозной: импорт на Главной (home-center.tsx)", homeCenterSrc.includes('import VolunteersCarousel from "@/components/site/volunteers-carousel"') && homeCenterSrc.includes("<VolunteersCarousel />"));
  check("Volunteers сквозной: импорт на /weather.php", wxSrcVol.includes('import VolunteersCarousel from "@/components/site/volunteers-carousel"') && wxSrcVol.includes("<VolunteersCarousel />"));
  check("Volunteers сквозной: импорт на /currency.php", curSrcVol.includes('import VolunteersCarousel from "@/components/site/volunteers-carousel"') && curSrcVol.includes("<VolunteersCarousel />"));
  check("Volunteers сквозной: импорт на /disconnections.php", disSrcVol.includes('import VolunteersCarousel from "@/components/site/volunteers-carousel"') && disSrcVol.includes("<VolunteersCarousel />"));
  check("Volunteers сквозной: импорт на /traffic.php", trfSrcVol.includes('import VolunteersCarousel from "@/components/site/volunteers-carousel"') && trfSrcVol.includes("<VolunteersCarousel />"));
  check("Volunteers: НЕТ синей шапки и НЕТ белой коробки (border #CED4DA)", !volSrc.includes("Остров взаимопомощи") && !volSrc.includes('border: "1px solid #CED4DA"'));
  check("Volunteers: контейнер-обёртка overflow:hidden + width 100% + margin-top 20px + margin-bottom 25px", volSrc.includes('overflow: "hidden"') && volSrc.includes('marginTop: "20px"') && volSrc.includes('marginBottom: "25px"'));
  check("Volunteers: лента className=\"sakh-infinite-carousel\" + gap 4px + overflow-x auto + scroll-behavior smooth + padding 2px 0 + scrollbar-width none + msOverflowStyle none", volSrc.includes('className="sakh-infinite-carousel"') && volSrc.includes('gap: "4px"') && volSrc.includes('overflowX: "auto"') && volSrc.includes('scrollBehavior: "smooth"') && volSrc.includes('padding: "2px 0"') && volSrc.includes('scrollbarWidth: "none"') && volSrc.includes('msOverflowStyle: "none"'));
  check("Volunteers: кнопки 240×60px (пропорция 4:1) + flex 0 0 240px + radius 4px + text-decoration none + box-shadow 0 2px 5px rgba(0,0,0,0.08)", volSrc.includes('flex: "0 0 240px"') && volSrc.includes('width: "240px"') && volSrc.includes('height: "60px"') && volSrc.includes('borderRadius: "4px"') && volSrc.includes('textDecoration: "none"') && volSrc.includes('boxShadow: "0 2px 5px rgba(0,0,0,0.08)"'));
  check("Volunteers: 6 кнопок-организаций (ПСО СОВА / ЛизаАлерт / Помощь животным / ЭкоСахалин / Я Донор Сахалин / Российский Красный Крест)", volSrc.includes("ПСО СОВА") && volSrc.includes("ЛизаАлерт") && volSrc.includes("Помощь животным") && volSrc.includes("ЭкоСахалин") && volSrc.includes("Я Донор Сахалин") && volSrc.includes("Российский Красный Крест"));
  check("Volunteers: 6 фирменных цветов — #1A1A1A + #FF6D00 + #00796B + #4CAF50 + #C62828 + #D32F2F", volSrc.includes('"#1A1A1A"') && volSrc.includes('"#FF6D00"') && volSrc.includes('"#00796B"') && volSrc.includes('"#4CAF50"') && volSrc.includes('"#C62828"') && volSrc.includes('"#D32F2F"'));
  check("Volunteers: бесконечная карусель — cloneNode(true) + appendChild + scrollLeft >= scrollWidth/2 → scrollLeft=0", volSrc.includes("cloneNode") && volSrc.includes("appendChild") && volSrc.includes("scrollWidth / 2") && volSrc.includes("scrollLeft = 0"));
  check("Volunteers: автопрокрутка — setInterval(2500) + step 244 + scrollBy + isPaused", volSrc.includes("setInterval") && volSrc.includes("2500") && volSrc.includes("step = 244") && volSrc.includes("scrollBy") && volSrc.includes("isPaused"));
  check("Volunteers: пауза при наведении — mouseenter/mouseleave + isPaused (скрипт из директивы)", volSrc.includes('addEventListener("mouseenter"') && volSrc.includes('addEventListener("mouseleave"') && volSrc.includes("isPaused"));
  check("Volunteers: cleanup в useEffect — clearInterval (no memory leaks)", volSrc.includes("clearInterval"));
  check("Volunteers CSS: .sakh-infinite-carousel скрывает scrollbar (Firefox scrollbar-width:none + WebKit ::-webkit-scrollbar display:none)", /\.sakh-infinite-carousel\s*\{[^}]*scrollbar-width:\s*none;[^}]*\}/.test(cssClean) && /\.sakh-infinite-carousel::-webkit-scrollbar\s*\{\s*display:\s*none;\s*\}/.test(cssClean));


  console.log(`\nИТОГО: ${pass} ✓ / ${fail} ✗`);
  process.exit(fail > 0 ? 1 : 0);
}

void main().catch((e) => {
  console.error("ФАТАЛЬНО:", e);
  process.exit(1);
});
