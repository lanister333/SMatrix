/**
 * Быстрая диагностика сетки: ширины колонок и горизонтальный скролл
 * на вьюпортах 1920 / 1360 / 1280 / 1024 (после ТЗ «центр +30%»).
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 900 } });

for (const w of [1920, 1685, 1440, 1360, 1280, 1024]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto(BASE + "/gde-kupit", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const c = document.querySelector(".center-column");
    const l = document.querySelector(".left-column");
    const r = document.querySelector(".right-column");
    const cont = document.querySelector(".main-grid-container");
    return {
      center: c ? c.offsetWidth : null,
      left: l ? l.offsetWidth : null,
      right: r ? r.offsetWidth : null,
      contW: cont ? cont.offsetWidth : null,
      contMax: cont ? getComputedStyle(cont).maxWidth : null,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    };
  });
  console.log(`w=${w}: center=${m.center} left=${m.left} right=${m.right} cont=${m.contW}(max ${m.contMax}) scrollW=${m.scrollW} clientW=${m.clientW} hScroll=${m.scrollW > m.clientW}`);
}
await browser.close();
