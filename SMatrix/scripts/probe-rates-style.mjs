// Проба ТЗ 2026-09-21 «в блоке курсы валют сделай таблицу более яркой
// и красивой»: сверка computed-styles перекрашенной таблицы
// (.mp-rt-table.mp-rt-best в правой колонке главной) + скриншоты.
// Запуск: node scripts/probe-rates-style.mjs [префикс-скриншотов]
import { chromium } from "playwright";

const PREFIX = process.argv[2] || "rates";
const OUT = "/home/z/my-project/scripts/shots/";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector(".mp-rt-table", { timeout: 45000 });
await page.waitForTimeout(1000);
await page.locator('section[aria-label="Курсы валют"]').screenshot({ path: `${OUT}${PREFIX}-desktop.png` });

const d = await page.evaluate(() => {
  const t = document.querySelector(".mp-rt-table");
  const ts = getComputedStyle(t);
  const head = t.querySelector("thead th");
  const hs = getComputedStyle(head);
  const bc = t.querySelector("td.bestcell");
  const bcs = getComputedStyle(bc);
  const bEl = bc.querySelector("b");
  const iEl = bc.querySelector("i");
  const ic = t.querySelector(".cur-ic");
  const ics = getComputedStyle(ic);
  const evenTh = t.querySelector("tbody tr:nth-child(2) th");
  const es = evenTh ? getComputedStyle(evenTh) : null;
  const nameTh = t.querySelector("tbody tr th");
  return {
    tableRadius: ts.borderRadius,
    tableBorder: ts.border,
    headBg: hs.backgroundColor,
    headColor: hs.color,
    bestBg: bcs.backgroundColor,
    bestValueColor: bEl ? getComputedStyle(bEl).color : "ABSENT",
    bestBankColor: iEl ? getComputedStyle(iEl).color : "ABSENT",
    chipBg: ics.backgroundColor,
    chipColor: ics.color,
    chipRadius: ics.borderRadius,
    evenRowBg: es ? es.backgroundColor : "NO-EVEN",
    nameColor: nameTh ? getComputedStyle(nameTh).color : "ABSENT",
    rows: t.querySelectorAll("tbody tr").length,
  };
});
console.log("RATES DESKTOP:", JSON.stringify(d, null, 2));

// hover первой строки: колонка «Валюта» → #e8f4fb, зелёные ячейки → #d2eac0
const firstRow = page.locator(".mp-rt-table tbody tr").first();
await firstRow.hover();
await page.waitForTimeout(200);
const hov = await page.evaluate(() => {
  const tr = document.querySelector(".mp-rt-table tbody tr");
  return {
    thBg: getComputedStyle(tr.querySelector("th")).backgroundColor,
    tdBg: getComputedStyle(tr.querySelector("td.bestcell")).backgroundColor,
  };
});
console.log("RATES HOVER:", JSON.stringify(hov));

// мобайл 375px: шапка синяя, таблица в границах, без горскролла
const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
await mob.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
await mob.waitForSelector(".mp-rt-table", { timeout: 45000 });
await mob.waitForTimeout(800);
await mob.locator('section[aria-label="Курсы валют"]').screenshot({ path: `${OUT}${PREFIX}-mobile.png` });
const m = await mob.evaluate(() => {
  const sec = document.querySelector('section[aria-label="Курсы валют"]');
  const t = document.querySelector(".mp-rt-table");
  return {
    docW: document.documentElement.scrollWidth,
    vw: window.innerWidth,
    headBg: getComputedStyle(t.querySelector("thead th")).backgroundColor,
    secW: sec ? Math.round(sec.getBoundingClientRect().width) : 0,
    tableW: Math.round(t.getBoundingClientRect().width),
  };
});
console.log("RATES MOBILE:", JSON.stringify(m));
await browser.close();
