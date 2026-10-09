/** Проба 2026-09-21 (вечер): 1) волновой график приливов на /weather.php —
 *  SVG-кривая по ряду open-meteo marine, метки ▲/▼, линия «сейчас»,
 *  сетка дней, список под графиком; 2) обмен графиков в карточке «Погода» —
 *  почасовой прогноз ВЫШЕ дневного виджета meteoblue. Скриншоты в scripts/shots/. */
import { chromium } from "playwright";
import fs from "fs";

const BASE = "http://127.0.0.1:3000";
const OUT = "scripts/shots";
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  PASS ${name}${extra ? " — " + extra : ""}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? " — " + extra : ""}`); }
};

/* ---------- T1: API приливов — живой ряд для графика ---------- */
console.log("T1. API приливов (ряд + экстремумы)");
let tides = null;
{
  const r = await fetch(`${BASE}/api/weather/tides`);
  tides = await r.json().catch(() => null);
  ok("HTTP 200", r.status === 200, `status=${r.status}`);
  ok("source live", tides?.source === "live", `source=${tides?.source}`);
  ok("ряд >= 48 точек", (tides?.series?.length ?? 0) >= 48, `series=${tides?.series?.length}`);
  ok("все экстремумы окна >= 4", (tides?.all?.length ?? 0) >= 4, `all=${tides?.all?.length}`);
  const kinds = new Set((tides?.all ?? []).map((e) => e.kind));
  ok("есть и приливы, и отливы", kinds.has("high") && kinds.has("low"), [...kinds].join(","));
  const isos = (tides?.all ?? []).map((e) => e.iso).sort();
  ok("экстремумы чередуются без однотипных подряд",
    (tides?.all ?? []).every((e, i, a) => i === 0 || e.kind !== a[i - 1].kind));
}

/* ---------- браузер ---------- */
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
await page.addInitScript(() => { window.__noReload = true; });

await page.goto(`${BASE}/weather.php`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500); // фетчи данных + гидрация

/* ---------- T2: волновой график в карточке приливов ---------- */
console.log("T2. Волновой график приливов");
const tideCard = page.locator('section[aria-label^="Приливы и отливы"]');
ok("карточка на странице", (await tideCard.count()) === 1);
const svg = tideCard.locator("svg");
ok("SVG-график присутствует", (await svg.count()) === 1);
const svgInfo = await svg.first().evaluate((el) => ({
  paths: el.querySelectorAll("path").length,
  stroked: [...el.querySelectorAll("path")].some((p) => (p.getAttribute("stroke") || "") !== ""),
  area: [...el.querySelectorAll("path")].some((p) => (p.getAttribute("fill") || "") === "#3a9ca5"),
  wave: [...el.querySelectorAll("path")].some((p) => (p.getAttribute("stroke") || "") === "#2a6fa8"),
  marks: el.querySelectorAll("polygon").length,
  marksHigh: [...el.querySelectorAll("polygon")].filter((p) => p.getAttribute("fill") === "#2a6fa8").length,
  marksLow: [...el.querySelectorAll("polygon")].filter((p) => p.getAttribute("fill") === "#3a9ca5").length,
  nowLine: [...el.querySelectorAll("text")].some((t) => t.textContent === "сейчас"),
  dayLabels: [...el.querySelectorAll("text")].filter((t) => /^\d{2}\.\d{2}$/.test(t.textContent || "")).length,
  heightLabels: [...el.querySelectorAll("text")].filter((t) => /^-?\d,\d{2}$/.test(t.textContent || "")).length,
  cap: el.parentElement?.querySelector(".tide-cap")?.textContent || "",
}));
ok("кривая-волна нарисована (stroke #2a6fa8)", svgInfo.wave);
ok("залив под кривой (#3a9ca5)", svgInfo.area);
ok("метки приливов ▲", svgInfo.marksHigh >= 2, `high=${svgInfo.marksHigh}`);
ok("метки отливов ▼", svgInfo.marksLow >= 2, `low=${svgInfo.marksLow}`);
ok("линия «сейчас»", svgInfo.nowLine);
ok("подписи дней >= 3", svgInfo.dayLabels >= 3, `days=${svgInfo.dayLabels}`);
ok("подписи высот на шкале", svgInfo.heightLabels >= 3, `h=${svgInfo.heightLabels}`);
ok("подпись ряда честная", svgInfo.cap.includes("сутки назад и 3 дня вперёд"), `"${svgInfo.cap}"`);
const rows = await tideCard.locator(".tide-row").count();
ok("список под графиком >= 2 строки", rows >= 2, `rows=${rows}`);
await tideCard.screenshot({ path: `${OUT}/tides-chart-card.png` });

/* ---------- T3: обмен — почасовой выше дневного ---------- */
console.log("T3. Порядок графиков в карточке «Погода»");
const wxCard = page.locator('section[aria-label="Погода в Южно-Сахалинске"]');
ok("карточка погоды на странице", (await wxCard.count()) === 1);
const order = await page.evaluate(() => {
  const card = document.querySelector('section[aria-label="Погода в Южно-Сахалинске"]');
  if (!card) return null;
  const y = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return Math.round(r.top + window.scrollY);
  };
  return {
    hourly: y(card.querySelector(".wth-hours-l")),
    hourlyRow: y(card.querySelector(".hourly-forecast")),
    mb: y(card.querySelector(".mp-weather")),
    mbIframe: y(card.querySelector(".mp-weather iframe")),
    now: y(card.querySelector(".wth-now")),
  };
});
ok("блок «Почасовой прогноз» есть", order?.hourly !== null && order?.hourly !== undefined, `y=${order?.hourly}`);
ok("дневной виджет meteoblue есть", order?.mbIframe !== null && order?.mbIframe !== undefined, `y=${order?.mbIframe}`);
ok("почасовой ВЫШЕ дневного", order?.hourly !== null && order?.mb !== null && order.hourly < order.mb, `hourly=${order?.hourly} < meteoblue=${order?.mb}`);
ok("текущая температура осталась наверху карточки", order?.now !== null && order?.hourly !== null && order.now < order.hourly, `now=${order?.now} < hourly=${order?.hourly}`);
await wxCard.screenshot({ path: `${OUT}/weather-card-order.png` });

/* ---------- T4: мобильный 375px — без горскролла, график виден ---------- */
console.log("T4. Мобильный вид 375px");
const mp = await browser.newPage({ viewport: { width: 375, height: 720 } });
await mp.goto(`${BASE}/weather.php`, { waitUntil: "domcontentloaded" });
await mp.waitForTimeout(2200);
const m = await mp.evaluate(() => {
  const doc = document.documentElement;
  const svg = document.querySelector('section[aria-label^="Приливы и отливы"] svg');
  const r = svg?.getBoundingClientRect();
  return {
    overflow: Math.max(doc.scrollWidth - doc.clientWidth, 0),
    svgW: r ? Math.round(r.width) : 0,
    svgVisible: !!r && r.width > 200,
  };
});
ok("нет горизонтального скролла", m.overflow === 0, `overflow=${m.overflow}px`);
ok("график растянут на карточку", m.svgVisible, `svgW=${m.svgW}px`);
await mp.screenshot({ path: `${OUT}/weather-375-tides.png`, fullPage: true });

/* ---------- консоль ---------- */
console.log("T5. Консоль браузера");
ok("нет ошибок консоли", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | ") || "чисто");

await browser.close();
console.log(`\nИТОГО: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
