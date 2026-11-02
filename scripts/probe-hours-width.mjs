// Проба ТЗ 2026-09-21 «ячейки почасовки пошире, чтобы не было много воздуха
// между ними»: замер ширин ячеек и заполнения ряда .hourly-forecast.
// Запуск: node scripts/probe-hours-width.mjs [префикс-скриншотов]
import { chromium } from "playwright";

const PREFIX = process.argv[2] || "hours-wide";
const OUT = "/home/z/my-project/scripts/shots/";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.goto("http://127.0.0.1:3000/weather.php", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector(".hourly-forecast", { timeout: 45000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}${PREFIX}-desktop.png`, fullPage: false });

const probe = await page.evaluate(() => {
  const row = document.querySelector(".hourly-forecast");
  const cells = [...document.querySelectorAll(".hour-cell")];
  const rs = row.getBoundingClientRect();
  // правая граница контентной области ряда (с учётом padding)
  const rowStyle = getComputedStyle(row);
  const padR = parseFloat(rowStyle.paddingRight);
  const padL = parseFloat(rowStyle.paddingLeft);
  const contentRight = rs.right - padR;
  const contentLeft = rs.left + padL;
  const last = cells[cells.length - 1]?.getBoundingClientRect();
  const widths = cells.map((c) => Math.round(c.getBoundingClientRect().width));
  return {
    cellCount: cells.length,
    gap: rowStyle.gap,
    cellWidths: widths,
    cellMinBasis: getComputedStyle(cells[0]).flexBasis,
    cellMaxWidth: getComputedStyle(cells[0]).maxWidth,
    flex: getComputedStyle(cells[0]).flex,
    rowContentWidth: Math.round(rs.width - padL - padR),
    cellsSpanPx: last ? Math.round(last.right - contentLeft) : 0,
    unusedRightPx: last ? Math.round(contentRight - last.right) : -1,
    rowScrollable: row.scrollWidth > row.clientWidth,
  };
});
console.log("DESKTOP PROBE:", JSON.stringify(probe, null, 2));

// Мобайл 375: ряд по-прежнему скроллится фиксированными ячейками 88px,
// горскролла страницы нет
const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
await mob.goto("http://127.0.0.1:3000/weather.php", { waitUntil: "domcontentloaded", timeout: 60000 });
await mob.waitForSelector(".hourly-forecast", { timeout: 45000 });
await mob.waitForTimeout(1000);
await mob.screenshot({ path: `${OUT}${PREFIX}-mobile.png` });
const mobProbe = await mob.evaluate(() => {
  const cells = [...document.querySelectorAll(".hour-cell")];
  return {
    docW: document.documentElement.scrollWidth,
    vw: window.innerWidth,
    cellWidths: cells.map((c) => Math.round(c.getBoundingClientRect().width)),
    rowScrollable:
      document.querySelector(".hourly-forecast").scrollWidth >
      document.querySelector(".hourly-forecast").clientWidth,
  };
});
console.log("MOBILE PROBE:", JSON.stringify(mobProbe));
console.log(`shots → ${OUT}${PREFIX}-desktop.png, ${PREFIX}-mobile.png`);
await browser.close();
