/* Скриншоты ТЗ «уменьшить боковые отступы»: десктоп 1920 — главная,
   форум, тема, валюты, погода; мобайл 375 — главная. Плюс сбор ошибок
   консоли на каждой странице. */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const b = await chromium.launch();
const SHOTS = [
  ["gridgaps-home-1920-2026-09-23.png", "/", 1920],
  ["gridgaps-forum-1920-2026-09-23.png", "/?rubric=120", 1920],
  ["gridgaps-topic183-1920-2026-09-23.png", "/?topic=183", 1920],
  ["gridgaps-currency-1920-2026-09-23.png", "/currency.php", 1920],
  ["gridgaps-weather-1920-2026-09-23.png", "/weather.php", 1920],
  ["gridgaps-home-375-2026-09-23.png", "/", 375],
];
for (const [file, url, w] of SHOTS) {
  const pg = await b.newPage({ viewport: { width: w, height: 940 } });
  const errs = [];
  pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 120)); });
  pg.on("pageerror", (e) => errs.push("PAGEERROR " + String(e).slice(0, 120)));
  await pg.goto(BASE + url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await pg.waitForTimeout(1800);
  await pg.screenshot({ path: "download/" + file, fullPage: false });
  console.log(`${file}: консоль ${errs.length === 0 ? "чистая" : "ОШИБКИ: " + errs.join(" || ")}`);
  await pg.close();
}
await b.close();
