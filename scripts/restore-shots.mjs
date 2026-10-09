// Скрипт восстановления 2026-09-23: контрольные скриншоты после восстановления
// состояния сессии 2026-09-22 (Flat 2.0 + панели примеров).
// ТЗ (частный случай): Главная — низ центральной колонки (FlatBoard Знакомства,
// Объявления, панели «Быстрые подсказки»), /obyavleniya, мобайл 375.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/scripts/shots";
const shots = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// 1) Главная, низ центральной колонки: FlatBoard блоки + панели подсказок
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const flatFirst = page.locator("[data-flat-board]").first();
if (await flatFirst.count()) await flatFirst.scrollIntoViewIfNeeded().catch(() => {});
await page.evaluate(() => window.scrollBy(0, -80));
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + "/restore-home-flat-hints.png", fullPage: false });
shots.push("restore-home-flat-hints.png");

// 2) /obyavleniya целиком (верх страницы)
await page.goto(BASE + "/obyavleniya", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + "/restore-obyavleniya.png" });
shots.push("restore-obyavleniya.png");

// 3) Мобайл 375: /znakomstva
const mctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
const mpage = await mctx.newPage();
await mpage.goto(BASE + "/znakomstva", { waitUntil: "networkidle" });
await mpage.waitForTimeout(1200);
await mpage.screenshot({ path: OUT + "/restore-znakomstva-mobile.png" });
shots.push("restore-znakomstva-mobile.png");

// Горскролл-контроль на 375
const hscroll = await mpage.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
);
console.log(hscroll ? "FAIL мобайл 375: горизонтальный скролл" : "OK мобайл 375: без горскролла");

await browser.close();
console.log("SHOTS:", shots.join(", "));
