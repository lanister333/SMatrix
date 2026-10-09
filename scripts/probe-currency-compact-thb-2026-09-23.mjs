/**
 * ПРОБА ТЗ 2026-09-23 «Доработка таблицы курсов» (4 пункта):
 *   1) колонка банка УЖЕ (136px), все 12 колонок курсов равные 80px;
 *   2) блок «Отделения и кассы банков» — все 15 банков таблицы;
 *   3) шапка без русских названий валют, коды увеличены до 15px;
 *   4) плашки «устарело» удалены (таблица + панель), старые значения
 *      показываются обычными числами.
 * Плюс регресс: 15 банков, THB, компактность, состояния, тултипы,
 * API, консоль, мобайл 375.
 * Запуск: node scripts/probe-currency-compact-thb-2026-09-23.mjs
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
let ok = 0, fail = 0;
const errors = [];
const O = (name, cond, detail) => {
  if (cond) { ok++; console.log("  OK", name, detail !== undefined ? "— " + detail : ""); }
  else { fail++; errors.push(name); console.log("  FAIL", name, detail !== undefined ? "— " + detail : ""); }
};

const EXPECT_BANKS = [
  "АТБ", "Солид Банк", "Сбербанк", "ВТБ", "Приморье", "Долинск",
  "Экспобанк", "Газпромбанк", "Совкомбанк", "Россельхозбанк",
  "Альфа-Банк", "МТС-Банк", "ДВ банк", "Банк «Итуруп»", "Т-Банк",
];

const browser = await chromium.launch();

/* Жидкие ожидания THB — сверяются с API (курсы агрегатора живут:
 * sell Приморье 28.4→28.3 за час), а не с хардкодом */
const fmt = (v) => v.toFixed(2).replace(".", ",");
let expPrimTHB = null, expSovTHB = null;

/* ---------- РАУНД 1: API ---------- */
{
  console.log("РАУНД 1: API /api/home/rates");
  const pg = await browser.newPage();
  const resp = await pg.request.get(BASE + "/api/home/rates");
  const d = await resp.json();
  O("15 банков в порядке ТЗ", JSON.stringify(d.banks.map((b) => b.bank)) === JSON.stringify(EXPECT_BANKS), d.banks.map((b) => b.bank).join(", "));
  O("THB колонка в ответе", d.banks.every((b) => b.thb !== undefined));
  const primThb = d.banks.find((b) => b.bank === "Приморье")?.thb;
  const sovThb = d.banks.find((b) => b.bank === "Совкомбанк")?.thb;
  O("THB Приморье — живые числа (ok, sell≥buy>0)",
    primThb?.status === "ok" && Number.isFinite(primThb?.buy) && Number.isFinite(primThb?.sell) && primThb.sell >= primThb.buy && primThb.buy > 0,
    JSON.stringify(primThb));
  O("THB Совкомбанк — живые числа (ok, sell≥buy>0)",
    sovThb?.status === "ok" && Number.isFinite(sovThb?.buy) && Number.isFinite(sovThb?.sell) && sovThb.sell >= sovThb.buy && sovThb.buy > 0,
    JSON.stringify(sovThb));
  if (primThb?.status === "ok") expPrimTHB = [fmt(primThb.buy), fmt(primThb.sell)];
  if (sovThb?.status === "ok") expSovTHB = [fmt(sovThb.buy), fmt(sovThb.sell)];
  const withData = d.banks.filter((b) => ["usd"].some((k) => b[k].buy !== null)).length;
  O("новые банки с USD-числами (6)", ["Экспобанк","Газпромбанк","Совкомбанк","Россельхозбанк","Альфа-Банк","МТС-Банк"].every((n) => d.banks.find((b) => b.bank === n)?.usd.buy !== null), `rows with usd: ${withData}`);
  const noData = ["ДВ банк","Банк «Итуруп»","Т-Банк"].map((n) => d.banks.find((b) => b.bank === n)?.usd.status);
  O("ДВ банк/Итуруп/Т-Банк — «—» (unpublished)", noData.every((s) => s === "unpublished"), noData.join(","));
  O("нет статусов error", d.banks.every((b) => Object.values(b).every((c) => typeof c !== "object" || c === null || c.status !== "error")));
  O("источник mainfin ok", d.sources.mainfin === "ok", JSON.stringify(d.sources));
  await pg.close();
}

/* ---------- РАУНД 2: /currency.php ---------- */
{
  const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const consoleErrors = [];
  pg.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  pg.on("pageerror", (e) => consoleErrors.push(String(e)));
  await pg.goto(BASE + "/currency.php", { waitUntil: "networkidle" });
  await pg.waitForTimeout(900);

  console.log("РАУНД 2: /currency.php — банки, THB, компактность");
  const T = await pg.evaluate(`(() => {
    const table = document.querySelector(".sk-col-main table");
    if (!table) return null;
    const headTexts = [...table.querySelectorAll("thead th")].map((th) => th.textContent.trim().replace(/\\s+/g, " "));
    const bodyRows = [...table.querySelectorAll("tbody tr")];
    const banks = bodyRows.map((tr) => tr.querySelector("td")?.textContent.trim());
    const rowsH = bodyRows.map((tr) => Math.round(tr.getBoundingClientRect().height * 10) / 10);
    // THB колонка: последняя пара ячеек каждой строки
    const thbCells = bodyRows.map((tr) => {
      const tds = [...tr.querySelectorAll("td")];
      const pair = tds.slice(-2);
      return pair.map((td) => td.textContent.trim().replace(/\\s+/g, " "));
    });
    const dashes = [...table.querySelectorAll("tbody td span")].filter((s) => s.textContent.trim() === "—");
    const dashTooltips = dashes.map((s) => s.getAttribute("title")).filter(Boolean);
    const staleTags = [...table.querySelectorAll(".cur-stale-tag")].length;
    const errs = [...table.querySelectorAll(".cur-err")].length;
    const thPad = getComputedStyle(table.querySelector("thead tr:first-child th")).paddingTop;
    // ЦИФРОВАЯ ячейка (вторая в строке): первая td — колонка банка без
    // инлайн-шрифта (наследование не показатель шрифта цифр)
    const tdPad = getComputedStyle(table.querySelector("tbody td:nth-child(2)")).paddingTop;
    const bodyFs = getComputedStyle(table.querySelector("tbody td:nth-child(2)")).fontSize;
    const convOptions = [...document.querySelectorAll("select option")].map((o) => o.textContent);
    // ТЗ «расширить по горизонтали»: все 13 колонок должны быть ВИДНЫ —
    // таблица не шире контейнера (иначе правые колонки обрезаны)
    const wrap = table.parentElement;
    const wideOk = table.scrollWidth <= wrap.clientWidth + 1 && wrap.scrollWidth <= wrap.clientWidth + 1;
    const lastThbVisible = (() => {
      const tds = [...table.querySelectorAll("tbody tr:nth-child(5) td")]; // строка Приморье
      const thbBuy = tds[tds.length - 2];
      const r = thbBuy.getBoundingClientRect();
      const w = wrap.getBoundingClientRect();
      return r.right <= w.right + 1;
    })();
    // ТЗ «ДВ банк»: ширины colgroup (заявленные и фактические) и
    // обрезка имён в колонке банка (fixed layout + nowrap не должен
    // прятать хвост самого длинного имени «Россельхозбанк»)
    const colsDeclared = [...table.querySelectorAll("colgroup col")].map((c) => c.style.width);
    const colsRendered = [...table.querySelectorAll("colgroup col")].map((c) => Math.round(parseFloat(getComputedStyle(c).width) * 10) / 10);
    const bankClip = bodyRows.map((tr) => {
      const td = tr.querySelector("td");
      return td ? td.scrollWidth - td.clientWidth : 0;
    });
    const staleRows = bodyRows.map((tr) => {
      const tds = [...tr.querySelectorAll("td")];
      // ВАЖНО: внутри шаблонной строки evaluate \\d → \\d (иначе /d/ — буква d)
      return tds.filter((td) => /\\d/.test(td.textContent)).length;
    });
    // Шапка: размер кода валюты (2-й th = USD) и отсутствие русских названий
    const codeFs = getComputedStyle(table.querySelectorAll("thead tr:first-child th")[1]).fontSize;
    const rusInHead = ["Доллар","Евро","Юань","Иена","Вона","Бат"].filter((n) => headTexts.some((h) => h.includes(n)));
    // Блок «Отделения и кассы банков»: 15 строк (синяя шапка → её родитель)
    const branchHdr = [...document.querySelectorAll(".sk-col-main div")].find((d) => d.textContent.trim() === "Отделения и кассы банков" && d.style.backgroundColor.includes("30, 58, 95"));
    const branchBox = branchHdr?.parentElement ?? null;
    const branchNames = branchBox ? [...branchBox.children].filter((ch) => ch.querySelector("b")).map((ch) => ch.querySelector("b").textContent.trim()) : [];
    return { headTexts, banks, rowsH, thbCells, dashTooltips, staleTags, errs, thPad, tdPad, bodyFs, convOptions, table, tableW: table.scrollWidth, wrapW: wrap.clientWidth, wideOk, lastThbVisible, colsDeclared, colsRendered, bankClip, staleRows, codeFs, rusInHead, branchNames };
  })()`);
  O("таблица на странице", !!T);
  if (T) {
    O("порядок банков = ТЗ (15 строк)", JSON.stringify(T.banks) === JSON.stringify(EXPECT_BANKS), T.banks.join(", "));
    O("шапка: THB колонка", T.headTexts.some((h) => h.startsWith("THB")), T.headTexts.filter((h) => /^(USD|EUR|CNY|JPY|KRW|THB)/.test(h)).join(" | "));
    O("THB Приморье в таблице = API (" + (expPrimTHB?.join("/") ?? "нет") + ")",
      expPrimTHB !== null && JSON.stringify(T.thbCells[4]) === JSON.stringify(expPrimTHB), JSON.stringify(T.thbCells[4]));
    O("THB Совкомбанк в таблице = API (" + (expSovTHB?.join("/") ?? "нет") + ")",
      expSovTHB !== null && JSON.stringify(T.thbCells[8]) === JSON.stringify(expSovTHB), JSON.stringify(T.thbCells[8]));
    O("THB остальных — «—»", [0,1,2,3,5,6,7,9,10,11,12,13,14].every((i) => T.thbCells[i][0] === "—"), "проверено 13 строк");
    O("тултип «Курс не опубликован» у прочерков", T.dashTooltips.includes("Курс не опубликован"), `dashes with title: ${T.dashTooltips.length}`);
    O("шапка без русских названий валют", T.rusInHead.length === 0, T.rusInHead.length ? "найдено: " + T.rusInHead.join(",") : "чисто");
    O("шапка: код валюты увеличен (15px)", T.codeFs === "15px", T.codeFs);
    O("плашек «устарело» НЕТ (удалены ТЗ)", T.staleTags === 0, `tags=${T.staleTags}`);
    O("устаревшие банки (Солид/Долинск) — числа, не «—»", T.staleRows[1] >= 6 && T.staleRows[5] >= 6, `Солид: ${T.staleRows[1]} чисел, Долинск: ${T.staleRows[5]}`);
    O("блок «Отделения»: 15 банков = таблица", JSON.stringify(T.branchNames) === JSON.stringify([...EXPECT_BANKS.slice(0, 4), "Банк Приморье", ...EXPECT_BANKS.slice(5)]), T.branchNames.join(", "));
    O("статусов «Ошибка» нет", T.errs === 0, `errs=${T.errs}`);
    O("шапка компактна (pt≤5px)", parseFloat(T.thPad) <= 5, `pt=${T.thPad}`);
    O("ячейки компактны (pt≤4px)", parseFloat(T.tdPad) <= 4, `pt=${T.tdPad}`);
    O("шрифт ячеек 13px", T.bodyFs === "13px", T.bodyFs);
    const avgH = T.rowsH.reduce((a, b) => a + b, 0) / T.rowsH.length;
    O("средняя высота строки ≤34px", avgH <= 34, `avg=${Math.round(avgH * 10) / 10}px rows=${JSON.stringify(T.rowsH)}`);
    O("конвертер: THB в списке", T.convOptions.some((o) => o.includes("THB")), T.convOptions.length + " опций");
    O("таблица умещается по ширине (KRW/THB видимы)", T.wideOk && T.lastThbVisible, `table=${T.tableW}px wrap=${T.wrapW}px thbVis=${T.lastThbVisible}`);
    // ТЗ «колонка банка уже, остальные равные»: банк 136 + 80×12 = 1096 ≤ 1105
    O("colgroup: банк 136 + все 12 колонок равные 80px",
      T.colsDeclared[0] === "136px" &&
      T.colsDeclared.slice(1).every((w) => w === "80px"),
      T.colsDeclared.join(","));
    // рендер: все 12 колонок курсов РАВНЫЕ (±1px), банк ~136.9
    const curW = T.colsRendered.slice(1);
    const wMin = Math.min(...curW), wMax = Math.max(...curW);
    O("рендер: 12 колонок курсов равные (79–82, разброс ≤1px)",
      curW.every((w) => w >= 79 && w <= 82) && wMax - wMin <= 1,
      `min=${wMin} max=${wMax}`);
    O("рендер: колонка банка сузилась (≤140px, было 160)",
      T.colsRendered[0] <= 140, `банк=${T.colsRendered[0]}px`);
    O("имена банков не обрезаны в колонке (вкл. «Россельхозбанк»)",
      T.bankClip.every((d) => d <= 1),
      `maxClip=${Math.max(...T.bankClip)}px`);
  }
  console.log("РАУНД 2б: консоль");
  O("консоль без ошибок", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | ") || "чисто");
  await pg.screenshot({ path: "download/currency-refine-page-2026-09-23.png", fullPage: false });
  await pg.close();
}

/* ---------- РАУНД 3: панель на главной ---------- */
{
  const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const consoleErrors = [];
  pg.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  pg.on("pageerror", (e) => consoleErrors.push(String(e)));
  await pg.goto(BASE + "/", { waitUntil: "networkidle" });
  await pg.waitForTimeout(900);
  console.log("РАУНД 3: панель «Курсы валют» на главной");
  const P = await pg.evaluate(`(() => {
    const panel = document.querySelector('section[aria-label="Курсы валют"]');
    if (!panel) return null;
    const rows = [...panel.querySelectorAll("tbody tr")];
    const curNames = rows.map((r) => r.querySelector("th")?.textContent.trim().replace(/\\s+/g, " "));
    const thb = rows.find((r) => r.querySelector("th")?.textContent.includes("Бат"));
    const thbCells = thb ? [...thb.querySelectorAll("td")].map((td) => td.textContent.trim().replace(/\\s+/g, " ")) : null;
    const rowH = rows.map((r) => Math.round(r.getBoundingClientRect().height * 10) / 10);
    const panelTags = panel.querySelectorAll(".cur-stale-tag").length;
    const panelStaleCls = panel.querySelectorAll("td.bestcell.is-stale").length;
    return { curNames, thbCells, rowH, panelTags, panelStaleCls };
  })()`);
  O("панель на странице", !!P);
  if (P) {
    O("6 валют в панели", P.curNames.length === 6, P.curNames.join(" | "));
    O("строка «Бат» с числами", P.thbCells !== null && /\d/.test(P.thbCells[0]) && /\d/.test(P.thbCells[1]), JSON.stringify(P.thbCells));
    O("ряды панели компактны (≤34px)", P.rowH.every((h) => h <= 34), JSON.stringify(P.rowH));
    O("панель: плашек «устарело» и серых is-stale НЕТ", P.panelTags === 0 && P.panelStaleCls === 0, `tags=${P.panelTags} stale=${P.panelStaleCls}`);
  }
  O("консоль без ошибок", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | ") || "чисто");
  await pg.close();
}

/* ---------- РАУНД 4: мобайл 375 ---------- */
{
  const pg = await browser.newPage({ viewport: { width: 375, height: 720 } });
  await pg.goto(BASE + "/currency.php", { waitUntil: "networkidle" });
  await pg.waitForTimeout(800);
  console.log("РАУНД 4: мобайл 375");
  const M = await pg.evaluate(`(() => ({
    scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    tableVisible: !!document.querySelector(".sk-col-main table"),
  }))()`);
  O("нет горизонтального скролла", M.scroll <= 0, `diff=${M.scroll}`);
  O("таблица видима", M.tableVisible);
  await pg.screenshot({ path: "download/currency-refine-mobile-2026-09-23.png" });
  await pg.close();
}

await browser.close();
console.log(`ИТОГО: ${ok} OK / ${fail} FAIL`);
if (fail) { console.log("Упавшие проверки:", errors.join("; ")); process.exit(1); }
