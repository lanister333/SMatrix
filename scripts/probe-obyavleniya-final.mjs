// Финал расследования /obyavleniya: десктоп + мобайл 375, скриншоты.
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const SHOTS = "/home/z/my-project/download";

const browser = await chromium.launch();

// Десктоп 1600
const d = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await d.goto(BASE + "/obyavleniya", { waitUntil: "networkidle", timeout: 60000 });
await d.waitForTimeout(1200);
const desk = await d.evaluate(() => ({
  clock: !!document.querySelector("#sakh-time"),
  right: !!document.querySelector('[data-ads-right="1"]'),
  about: !!document.querySelector('[data-ads-about="1"]'),
  rules: document.querySelectorAll('[data-ads-rules="1"] li').length,
  tabs: document.querySelectorAll('[data-flat-tabs="1"] [role="tab"]').length,
  board: !!document.querySelector('[data-flat-board="ads"]'),
}));
console.log("DESKTOP:", JSON.stringify(desk));
await d.screenshot({ path: SHOTS + "/sm-obyavleniya-fixed-desktop-2026-09-23.png", fullPage: true });
await d.close();

// Мобайл 375
const m = await browser.newPage({ viewport: { width: 375, height: 812 } });
await m.goto(BASE + "/obyavleniya", { waitUntil: "networkidle", timeout: 60000 });
await m.waitForTimeout(1200);
const mob = await m.evaluate(() => ({
  hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  clock: !!document.querySelector("#sakh-time"),
  right: !!document.querySelector('[data-ads-right="1"]'),
  board: !!document.querySelector('[data-flat-board="ads"]'),
}));
console.log("MOBILE 375:", JSON.stringify(mob));
await m.screenshot({ path: SHOTS + "/sm-obyavleniya-fixed-mobile-2026-09-23.png", fullPage: true });
await m.close();

await browser.close();
const okDesk = desk.clock && desk.right && desk.about && desk.rules >= 8 && desk.tabs === 3 && desk.board;
const okMob = mob.hScroll <= 0 && mob.clock && mob.right && mob.board;
console.log(okDesk && okMob ? "ИТОГ: ВСЕ ПРОВЕРКИ OK" : "ИТОГ: ЕСТЬ ПРОВАЛЫ");
if (!(okDesk && okMob)) process.exit(1);
