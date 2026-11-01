/** Ревизия 2026-09-24: окантовка КАК У ЧАСОВ (#4A688C) на 6 разделах.
 *  Проверяет computed border-color блоков колонок и карточек лент. */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const CLOCK = "rgb(74, 104, 140)"; // #4A688C

const PAGES = [
  { url: "/help", name: "Нужна помощь", sels: [".hp-sideblock", ".help-item-card"] },
  { url: "/rekomenduyu", name: "Рекомендую", sels: [".rc-sideblock", ".matrix-review-card"] },
  { url: "/o-rabotodatelyah", name: "О работодателях", sels: [".ep-sideblock", ".ep-card"] },
  { url: "/gkh", name: "ЖКХ и городские проблемы", sels: [".gkh-sideblock", ".gkf-card"] },
  { url: "/znakomstva", name: "Знакомства", sels: [".dk-sideblock", ".dk-card"] },
  { url: "/obyavleniya", name: "Объявления", sels: [".dk-sideblock", ".ad-sidebox", ".ad_item"] },
];

const b = await chromium.launch();
const p = await b.newPage();
let bad = 0;
for (const pg of PAGES) {
  await p.goto(BASE + pg.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await p.waitForTimeout(1500);
  for (const sel of pg.sels) {
    const el = await p.$(sel);
    if (!el) { console.log(`  — ${pg.name}: ${sel} не найден (лента пуста — ок)`); continue; }
    const col = await el.evaluate((e) => getComputedStyle(e).borderTopColor);
    const okk = col === CLOCK;
    if (!okk) bad++;
    console.log(`  ${okk ? "OK " : "BAD"} ${pg.name} · ${sel} → ${col}`);
  }
}
await b.close();
console.log(bad === 0 ? "\nВСЁ В ОКАНТОВКЕ ЧАСОВ #4A688C" : `\nНЕ СОВПАЛО: ${bad}`);
process.exit(bad === 0 ? 0 : 1);
