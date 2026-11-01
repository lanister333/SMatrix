import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/gde-deshevle`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("[data-cd-id]", { timeout: 30000 });
const info = await page.$$eval("[data-cd-id]", (cards) => {
  return cards.slice(0, 3).map((el) => {
    const row = el.querySelector(".cd-actrow");
    if (!row) return { row: false };
    const kids = [...row.children].map((c) => {
      const r = c.getBoundingClientRect();
      const cs = getComputedStyle(c);
      return { cls: c.className.slice(0, 40), text: (c.textContent || "").trim().slice(0, 22), top: Math.round(r.top), w: Math.round(r.width), flex: cs.flex, display: cs.display };
    });
    return { row: true, kids };
  });
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
