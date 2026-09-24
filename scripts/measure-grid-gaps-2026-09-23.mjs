/** Замер боковых зазоров глобальной сетки (реставрация 2026-09-23). */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const PAGES = [["Главная","/"],["Форум","/?rubric=120"],["Тема","/?topic=183"],["Валюты","/currency.php"],["Погода","/weather.php"],["Помощь","/help"]];
const WIDTHS = [1920, 1366, 1024];
for (const w of WIDTHS) {
  console.log(`===== ${w}px =====`);
  for (const [name, url] of PAGES) {
    const pg = await browser.newPage({ viewport: { width: w, height: 900 } });
    await pg.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await pg.waitForTimeout(1200);
    const m = await pg.evaluate(() => {
      const r = (el) => (el ? el.getBoundingClientRect() : null);
      const L = r(document.querySelector(".main-grid-container > .left-column"));
      const C = r(document.querySelector(".main-grid-container > .center-column"));
      const R = r(document.querySelector(".main-grid-container > .right-column"));
      const K = r(document.querySelector(".main-grid-container"));
      return !K ? "нет каркаса" : `каркас ${Math.round(K.width)} gap=${getComputedStyle(document.querySelector(".main-grid-container")).gap} | L=${(C.left-L.right).toFixed(1)} R=${(R.left-C.right).toFixed(1)} | центр ${Math.round(C.width)} | скролл ${document.documentElement.scrollWidth}x${document.documentElement.clientWidth}`;
    });
    console.log(`${name.padEnd(10)} ${m}`);
    await pg.close();
  }
}
await browser.close();
