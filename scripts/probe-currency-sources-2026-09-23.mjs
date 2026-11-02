/**
 * ПРОБА «Замена источника курсов» (2026-09-23):
 * панель «Курсы валют» главной + полная страница /currency.php.
 * Проверки ТЗ:
 *  — Сбер/Приморье перестали показывать прочерки (mainfin отдаёт);
 *  — АТБ, ВТБ — числа корректны; Солид/Долинск — кэш «устарело»;
 *  — состояния ячеек: число / «—»+тултип / «Ошибка»+тултип / серое «устарело»;
 *  — подвал: источники цепочки, НЕТ упоминаний kovalut;
 *  — консоль без ошибок; мобайл 375 без горскролла.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  OK ${name}${extra ? " — " + extra : ""}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? " — " + extra : ""}`); }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

/* ---------- РАУНД 1: панель «Курсы валют» на главной ---------- */
console.log("РАУНД 1: панель «Курсы валют» (главная, 1920)");
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForSelector('section[aria-label="Курсы валют"] .mp-rt-table', { timeout: 20000 });
await page.waitForTimeout(800);

const panel = page.locator('section[aria-label="Курсы валют"]');
const panelHtml = await panel.innerHTML();
ok("в панели нет упоминаний kovalut", !panelHtml.toLowerCase().includes("kovalut"));
ok("в панели нет упоминаний старых прямых сайтов", !panelHtml.includes("atb.su") && !panelHtml.includes("primbank") && !panelHtml.includes("dolinskbank"));

// строки USD/EUR/CNY — лучший курс числом (Сбер/Приморье оживи через mainfin)
const rows = await panel.locator("tbody tr").all();
ok("5 строк валют (USD/EUR/CNY/JPY/KRW)", rows.length === 5, `got ${rows.length}`);
for (let i = 0; i < rows.length; i++) {
  const tds = await rows[i].locator("td.bestcell").all();
  const buyTxt = (await tds[0].innerText()).trim().replace(/\s+/g, " ");
  const sellTxt = (await tds[1].innerText()).trim().replace(/\s+/g, " ");
  const label = await rows[i].locator("th").innerText();
  const code = label.split("\n")[0].trim();
  if (i <= 2) {
    ok(`${code}: лучший курс — число (не прочерк)`, /\d/.test(buyTxt) && /\d/.test(sellTxt), `${buyTxt} | ${sellTxt}`);
    ok(`${code}: банк-лидер указан`, !buyTxt.startsWith("—"), buyTxt);
  } else {
    // JPY: свежий Приморье 53.7/56; KRW: только кэш Солид → серое «устарело» либо «—»
    ok(`${code}: число или честное состояние`, /\d/.test(buyTxt) || buyTxt.includes("—"), `${buyTxt} | ${sellTxt}`);
  }
}

// JPY — Приморье mainfin (53,70/56,00)
const jpyRow = rows[3];
const jpyBuy = await jpyRow.locator("td.bestcell").first().innerText();
ok("JPY: свежий курс Приморья от mainfin (53,7…)", jpyBuy.includes("53,7") || jpyBuy.includes("53.7"), jpyBuy.replace(/\s+/g, " "));

// KRW — кэш Солид с пометкой «устарело»
const krwRow = rows[4];
const krwBuyHtml = await krwRow.locator("td.bestcell").first().innerHTML();
const krwStale = krwBuyHtml.includes("устарело") || krwBuyHtml.includes("—");
ok("KRW: кэш-«устарело» или «—» (свежих нет)", krwStale, krwBuyHtml.replace(/\s+/g, " ").slice(0, 90));

// подвал панели — источник цепочки
const upd = await panel.locator(".mp-w-upd").innerText();
ok("подвал: mainfin.ru в источниках", upd.includes("mainfin.ru"), upd.trim());
ok("подвал: нет kovalut", !upd.toLowerCase().includes("kovalut"));

// состояние stale — серый стиль из CSS-класса
const staleCell = await panel.locator("td.bestcell.is-stale").count();
ok("есть ячейка(-ы) состояния stale (класс is-stale)", staleCell >= 1, `count=${staleCell}`);

/* ---------- РАУНД 2: страница /currency.php ---------- */
console.log("РАУНД 2: таблица /currency.php (1920)");
await page.goto(BASE + "/currency.php", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".crt-back", { timeout: 20000 });
await page.waitForTimeout(1000);

const pageHtml = await page.content();
ok("страница не содержит kovalut", !pageHtml.toLowerCase().includes("kovalut"));
ok("страница не содержит старых прямых сайтов", !pageHtml.includes("atb.su") && !pageHtml.includes("primbank.ru") && !pageHtml.includes("dolinskbank"));

// строки банков в порядке ТЗ (только основная таблица .sk-col-main —
// без строк правой колонки-информера, которая рендерится на той же странице)
const bankRows = await page.locator(".sk-col-main table tbody tr").all();
const bankNames = [];
for (const r of bankRows) {
  const firstTd = r.locator("td").first();
  if ((await firstTd.count()) === 0) continue;
  const txt = (await firstTd.innerText()).trim();
  if (txt) bankNames.push(txt.replace(/\s+/g, " "));
}
ok("порядок банков ТЗ: АТБ→Солид→Сбербанк→ВТБ→Приморье→Долинск",
  JSON.stringify(bankNames) === JSON.stringify(["АТБ", "Солид Банк", "Сбербанк", "ВТБ", "Приморье", "Долинск"]),
  bankNames.join(" | "));

// Сбербанк: USD/EUR/CNY — числа (не прочерки) — ТЗ п.7
const sberRow = bankRows[bankNames.indexOf("Сбербанк")];
const sberCells = await sberRow.locator("td").all();
const sberNums = (await sberCells[1].innerText()).trim();
ok("Сбербанк: USD покупка — число", /\d/.test(sberNums), sberNums);
const sberSell = (await sberCells[2].innerText()).trim();
ok("Сбербанк: USD продажа — число", /\d/.test(sberSell), sberSell);
const sberEur = (await sberCells[3].innerText()).trim();
ok("Сбербанк: EUR покупка — число", /\d/.test(sberEur), sberEur);

// Приморье: USD — число + JPY число (свежие)
const primRow = bankRows[bankNames.indexOf("Приморье")];
const primCells = await primRow.locator("td").all();
ok("Приморье: USD — число", /\d/.test((await primCells[1].innerText()).trim()));
ok("Приморье: JPY — число (mainfin)", /\d/.test((await primCells[7].innerText()).trim()), (await primCells[7].innerText()).trim());

// АТБ и ВТБ — числа
const atbRow = bankRows[bankNames.indexOf("АТБ")];
const atbCells = await atbRow.locator("td").all();
ok("АТБ: USD — число", /\d/.test((await atbCells[1].innerText()).trim()));
const vtbRow = bankRows[bankNames.indexOf("ВТБ")];
const vtbCells = await vtbRow.locator("td").all();
ok("ВТБ: USD — число", /\d/.test((await vtbCells[1].innerText()).trim()));

// Солид/Долинск — кэш «устарело» (серым с бейджем)
const solidRow = bankRows[bankNames.indexOf("Солид Банк")];
const solidHtml = await solidRow.innerHTML();
ok("Солид Банк: кэш-«устарело» с бейджем", solidHtml.includes("устарело"));
const dolRow = bankRows[bankNames.indexOf("Долинск")];
const dolHtml = await dolRow.innerHTML();
ok("Долинск: кэш-«устарело» с бейджем", dolHtml.includes("устарело"));

// тултипы ТЗ: «Курс не опубликован» — где «—» без кэша (KRW АТБ/ВТБ/Долинск)
const unpublishedTitles = await page.locator('[title="Курс не опубликован"]').count();
ok("тултип «Курс не опубликован» присутствует", unpublishedTitles >= 1, `count=${unpublishedTitles}`);

// тултипы «устарело»: title начинается с «Данные устарели»
const staleTitles = await page.locator('td[title^="Данные устарели"]').count();
ok("тултип «Данные устарели…» у кэш-ячеек", staleTitles >= 1, `count=${staleTitles}`);

// подвал таблицы: источники
const upd2 = await page.locator(".mp-w-upd").first().innerText();
ok("подвал таблицы: mainfin.ru", upd2.includes("mainfin.ru"), upd2.trim());

/* ---------- РАУНД 3: API-состояния ---------- */
console.log("РАУНД 3: API /api/home/rates");
const api = await page.evaluate(async () => {
  const r = await fetch("/api/home/rates");
  return r.json();
});
ok("API: source=multi", api.source === "multi", api.source);
ok("API: sources.mainfin=ok", api.sources?.mainfin === "ok", JSON.stringify(api.sources));
const statuses = api.banks.flatMap((b) => ["usd", "eur", "cny", "jpy", "krw"].map((k) => b[k].status));
ok("API: нет статусов error (цепочка жива)", !statuses.includes("error"), `ok=${statuses.filter((s) => s === "ok").length} stale=${statuses.filter((s) => s === "stale").length}`);
const sber2 = api.banks.find((b) => b.bank === "Сбербанк");
ok("API: Сбербанк usd=ok c mainfin", sber2.usd.status === "ok" && sber2.usd.src === "mainfin");
const solid2 = api.banks.find((b) => b.bank === "Солид Банк");
ok("API: Солид Банк usd=stale (кэш)", solid2.usd.status === "stale");
const atb2 = api.banks.find((b) => b.bank === "АТБ");
ok("API: АТБ krw=unpublished («—»)", atb2.krw.status === "unpublished", atb2.krw.status);

/* ---------- РАУНД 4: консоль + мобайл 375 ---------- */
console.log("РАУНД 4: консоль и мобайл 375");
ok("консоль: нет ошибок", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | ").slice(0, 200));

const mpage = await browser.newPage({ viewport: { width: 375, height: 812 } });
await mpage.goto(BASE + "/currency.php", { waitUntil: "domcontentloaded" });
await mpage.waitForTimeout(1200);
const mScroll = await mpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok("мобайл 375: нет горизонтального скролла", mScroll <= 1, `diff=${mScroll}`);
const mtable = await mpage.locator(".mp-rt-table, table").first().isVisible().catch(() => false);
ok("мобайл 375: таблица курсов видима", mtable);
await mpage.close();

/* ---------- Скриншоты ---------- */
await page.setViewportSize({ width: 1920, height: 1080 });
await page.goto(BASE + "/", { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(500);
const panelEl = await page.locator('section[aria-label="Курсы валют"]').first();
await panelEl.screenshot({ path: "/home/z/my-project/download/currency-new-sources-panel-2026-09-23.png" });
await page.goto(BASE + "/currency.php", { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: "/home/z/my-project/download/currency-new-sources-page-2026-09-23.png", fullPage: false });

await browser.close();
console.log(`\nИТОГО: ${pass} OK / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
