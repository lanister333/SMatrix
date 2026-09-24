// Проба ТЗ 2026-09-21: ячейки почасовки — ярко-голубые по времени суток
// (night/twilight/day/midday), синие полоски 3px под шапками центральных
// блоков. Запуск: node scripts/probe-tod-blue.mjs [префикс-скриншотов]
import { chromium } from "playwright";

const PREFIX = process.argv[2] || "tod-blue";
const OUT = "/home/z/my-project/scripts/shots/";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.goto("http://127.0.0.1:3000/weather.php", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}${PREFIX}-desktop.png`, fullPage: false });
await page.screenshot({ path: `${OUT}${PREFIX}-full.png`, fullPage: true });

const probe = await page.evaluate(() => {
  const bg = (el) => (el ? getComputedStyle(el).backgroundColor : "NONE");
  const col = (el) => (el ? getComputedStyle(el).color : "NONE");
  const bBottom = (el) => (el ? getComputedStyle(el).borderBottom : "NONE");
  const bLeft = (el) => (el ? getComputedStyle(el).borderLeft : "NONE");

  // список всех реальных ячеек (вечером видны только night/twilight)
  const cells = [...document.querySelectorAll(".hour-cell")].map((el) => ({
    time: el.querySelector(".hour-time")?.textContent ?? "?",
    cls: el.className.replace(/ selected| current/g, "").replace("hour-cell", "").trim() || "day",
    isCurrent: el.className.includes(" current"),
    bg: bg(el),
    timeColor: col(el.querySelector(".hour-time")),
  }));
  // синтетическая проверка дневных заливок (днём их часы уже прошли):
  // клон ячейки с классами day/midday — computed background из тех же правил
  const synthetic = (() => {
    const host = document.querySelector(".hourly-forecast");
    const src = document.querySelector(".hour-cell");
    const out = {};
    for (const cls of ["", "midday"]) {
      const c = src.cloneNode(true);
      c.className = "hour-cell" + (cls ? ` ${cls}` : "");
      c.classList.remove("current", "selected");
      host.appendChild(c);
      out[cls || "day"] = bg(c);
      c.remove();
    }
    return out;
  })();
  const headers = [...document.querySelectorAll(".center-column .mp-paneltitle")].map((h) => ({
    title: h.textContent.trim().slice(0, 28),
    borderBottom: bBottom(h),
  }));
  // рамки внутренних ячеек 4 центральных блоков (ТЗ «тонкая синяя полоса»)
  const bAll = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return "ABSENT";
    const s = getComputedStyle(el);
    return `${s.borderTopWidth} ${s.borderTopColor}`;
  };
  const cellBorders = {
    hero: bAll(".wth-now"),
    metric: bAll(".wth-metric"),
    hoursLabel: bAll(".wth-hours-l"),
    dailyBox: bAll(".wth-daily-box"),
    districtRow: bAll(".wth-bub"),
    tideChart: bAll(".tide-chart"),
    tideRow: bAll(".tide-row"),
    passCell: bAll(".wth-pass"),
  };
  // герой-карточка: размер температуры и высота (ТЗ «сделай поменьше»)
  const hero = document.querySelector(".wth-now");
  const heroT = document.querySelector(".wth-now-t");
  const heroInfo = hero && heroT ? {
    tempFont: getComputedStyle(heroT).fontSize,
    heroPadding: getComputedStyle(hero).padding,
    heroHeight: Math.round(hero.getBoundingClientRect().height),
  } : "ABSENT";
  return {
    cells,
    synthetic,
    heroInfo,
    currentCellBg: bg(document.querySelector(".hour-cell.current")),
    bodyBgs: [...document.querySelectorAll(".card-body")].map((b) => ({
      block: b.closest("section")?.getAttribute("aria-label")?.slice(0, 32) ?? "?",
      body: bg(b),
      section: bg(b.closest("section")),
    })),
    passesBlockBg: bg(document.querySelector('section[aria-label="Оперативная обстановка на перевалах"]')),
    headerStrips: headers,
    cellBorders,
    groupTitleStrip: bLeft(document.querySelector(".wth-gt")),
    mastheadBg: bg(document.querySelector(".sm-masthead")),
    cellCount: document.querySelectorAll(".hour-cell").length,
  };
});
console.log("DESKTOP PROBE:", JSON.stringify(probe, null, 2));

// Мобайл 375: горскролл
const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
await mob.goto("http://127.0.0.1:3000/weather.php", { waitUntil: "domcontentloaded", timeout: 60000 });
await mob.waitForTimeout(2000);
await mob.screenshot({ path: `${OUT}${PREFIX}-mobile.png` });
const mobProbe = await mob.evaluate(() => ({
  docW: document.documentElement.scrollWidth,
  vw: window.innerWidth,
  nightBg: getComputedStyle(document.querySelector(".hour-cell.night") || document.body).backgroundColor,
}));
console.log("MOBILE PROBE:", JSON.stringify(mobProbe));
console.log(`shots → ${OUT}${PREFIX}-desktop.png, ${PREFIX}-mobile.png`);
await browser.close();
