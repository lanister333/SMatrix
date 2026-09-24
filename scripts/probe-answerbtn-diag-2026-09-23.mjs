/**
 * Диагноз 2026-09-23: жалоба заказчика — на «Где купить» и «Где дешевле»
 * под запросами видна ТОЛЬКО кнопка «Обсудить на форуме», кнопки
 * [📍 Ответить на запрос] нет. Проверяем живой рендер обеих страниц:
 * сколько карточек, сколько wb-answerbtn/cd-answerbtn, сколько форум-кнопок.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const pages = [
  { url: "/gde-kupit", itemSel: ".wb-item", answerSel: ".wb-answerbtn", forumSel: ".wb-btn-forum", name: "ГДЕ КУПИТЬ" },
  { url: "/gde-deshevle", itemSel: ".cd-item", answerSel: ".cd-answerbtn", forumSel: ".wb-btn-forum, .cd-btn-forum", name: "ГДЕ ДЕШЕВЛЕ" },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

let fail = 0;
for (const p of pages) {
  await page.goto(BASE + p.url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  const items = await page.locator(p.itemSel).count();
  const answers = await page.locator(p.answerSel).count();
  const forums = await page.locator(p.forumSel).count();
  // видимость первой форум-кнопки и первой кнопки ответа
  const ansVisible = answers > 0 ? await page.locator(p.answerSel).first().isVisible().catch(() => false) : false;
  const forumVisible = forums > 0 ? await page.locator(p.forumSel).first().isVisible().catch(() => false) : false;
  const ansText = answers > 0 ? (await page.locator(p.answerSel).first().innerText().catch(() => "?")).trim() : "—";
  console.log(`[${p.name}] ${p.url}`);
  console.log(`  карточек: ${items} | кнопок «Ответить»: ${answers} (видима: ${ansVisible}, текст: «${ansText}») | форум-кнопок: ${forums} (видима: ${forumVisible})`);
  if (answers !== items || items === 0) { console.log(`  !! FAIL: у каждой карточки должна быть кнопка «Ответить на запрос»`); fail++; }
  else console.log(`  OK: у каждой карточки две кнопки`);
}
if (errors.length) { console.log("КОНСОЛЬНЫЕ ОШИБКИ:"); errors.slice(0, 5).forEach((e) => console.log("  " + e.slice(0, 200))); fail++; }
console.log(fail === 0 ? "ИТОГ: ВСЕ OK" : `ИТОГ: ${fail} FAIL`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
