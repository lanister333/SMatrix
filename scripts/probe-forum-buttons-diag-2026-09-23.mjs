/**
 * Диагностический проб «Обсудить на форуме» на всех страницах SakhMatrix.
 * Для каждой страницы: сбор кнопок/ссылок → клик каждой → итоговый URL →
 * признак «ничего не произошло» (URL не изменился) → ошибки консоли/сети.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3000";
const PAGES = [
  "/gde-kupit",
  "/gde-deshevle",
  "/podslyshano",
  "/rekomenduyu",
  "/o-rabotodatelyah",
  "/gkh",
  "/znakomstva",
];

const results = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + String(e).slice(0, 200)));

for (const p of PAGES) {
  consoleErrors.length = 0;
  await page.goto(BASE + p, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  // Собираем кандидатов: ссылки и кнопки с «Обсуд»/«Обсужда»/«Тема»
  const els = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("a, button").forEach((el) => {
      const t = (el.textContent || "").trim();
      if (/обсуд|форум|тема (закрыта|в архиве)/i.test(t) && t.length < 80) {
        out.push({ tag: el.tagName, text: t, href: el.getAttribute("href") });
      }
    });
    return out;
  });
  results.push({ page: p, found: els.length, buttons: els });
  // Кликаем каждый элемент (первый уникальный href)
  const seen = new Set();
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    const key = el.href || el.text;
    if (seen.has(key)) continue;
    seen.add(key);
    const before = page.url();
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    try {
      const handle = await page.evaluateHandle((idx) => {
        const list = [...document.querySelectorAll("a, button")].filter((e2) => {
          const t = (e2.textContent || "").trim();
          return /обсуд|форум|тема (закрыта|в архиве)/i.test(t) && t.length < 80;
        });
        // Соответствие по href/тексту
        return list.find((e2) => (e2.getAttribute("href") || e2.textContent.trim()) === (idx.href || idx.text));
      }, el);
      const node = handle.asElement();
      if (!node) { results.push({ page: p, click: key, result: "ELEMENT NOT FOUND" }); continue; }
      await node.click({ timeout: 5000 });
      await page.waitForTimeout(1200);
      const after = page.url();
      const changed = after !== before;
      const h1 = await page.evaluate(() => {
        const h = document.querySelector("h1, h2, h3");
        const body = document.body.innerText.slice(0, 400);
        return { h: h ? h.textContent.trim().slice(0, 80) : null, snippet: body.replace(/\s+/g, " ") };
      });
      results.push({
        page: p, click: (el.text || "").slice(0, 50), href: el.href,
        result: changed ? "NAVIGATED" : "NO CHANGE",
        afterUrl: after.replace(BASE, ""), h1: h1.h, snippet: h1.snippet.slice(0, 160),
      });
    } catch (e) {
      results.push({ page: p, click: key, result: "CLICK FAILED: " + String(e).slice(0, 100) });
    }
  }
  if (consoleErrors.length) results.push({ page: p, consoleErrors: [...consoleErrors] });
}
await browser.close();
for (const r of results) console.log(JSON.stringify(r, null, 1));
