// Замер шапки внутри iframe meteoblue: кроп правоколоночного .mp-weather
// в масштабе 2 + координаты iframe на странице.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('section[aria-label="Погода на Сахалине"] .mp-weather', { timeout: 45000 });
await page.waitForTimeout(4000); // deferred iframe + рендер meteoblue
const box = await page.evaluate(() => {
  const el = document.querySelector('section[aria-label="Погода на Сахалине"] .mp-weather');
  const f = document.querySelector('section[aria-label="Погода на Сахалине"] .mp-w-frame');
  const cap = document.querySelector('section[aria-label="Погода на Сахалине"] .mp-w-cap');
  const r = el.getBoundingClientRect();
  const fr = f.getBoundingClientRect();
  const cs = cap ? getComputedStyle(cap) : null;
  const csb = cap ? getComputedStyle(cap.querySelector("b")) : null;
  const css = cap ? getComputedStyle(cap.querySelector("small")) : null;
  const cf = getComputedStyle(f);
  const ce = getComputedStyle(el);
  return {
    weather: { x: r.x, y: r.y, w: r.width, h: r.height },
    frame: { x: fr.x, y: fr.y, w: fr.width, h: fr.height },
    frameMarginTop: cf.marginTop,
    frameHeight: cf.height,
    weatherOverflow: ce.overflow,
    weatherHeight: ce.height,
    cap: cs
      ? {
          textAlign: cs.textAlign,
          align: cs.alignItems,
          bColor: csb.color,
          smallColor: css.color,
          h: Math.round(cap.getBoundingClientRect().height),
        }
      : "ABSENT",
    frameClass: f.className,
  };
});
console.log(JSON.stringify(box, null, 2));
const el = await page.$('section[aria-label="Погода на Сахалине"] .mp-weather');
await el.screenshot({ path: "/home/z/my-project/scripts/shots/mp-weather-zoom.png" });
await browser.close();
