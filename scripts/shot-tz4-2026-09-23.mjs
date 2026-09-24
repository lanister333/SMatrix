// Скриншоты четырёх страниц ТЗ 2026-09-23: десктоп 1600 + мобайл 375.
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const SHOTS = "/home/z/my-project/download";
const PAGES = [
  ["/znakomstva", "znakomstva"],
  ["/obyavleniya", "obyavleniya"],
  ["/gde-kupit", "gde-kupit"],
  ["/gde-deshevle", "gde-deshevle"],
];

const browser = await chromium.launch();
let bad = 0;
for (const [route, name] of PAGES) {
  const d = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await d.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });
  await d.waitForTimeout(1000);
  await d.screenshot({ path: `${SHOTS}/sm-tz4-${name}-desktop-2026-09-23.png`, fullPage: false });
  await d.close();

  const m = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await m.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });
  await m.waitForTimeout(1000);
  const sw = await m.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  const hScroll = sw.sw - sw.cw > 0;
  if (hScroll) bad++;
  console.log(`${name} мобайл: scrollWidth=${sw.sw} clientWidth=${sw.cw} ${hScroll ? "ГОРСКРОЛЛ!" : "ок"}`);
  await m.screenshot({ path: `${SHOTS}/sm-tz4-${name}-mobile-2026-09-23.png`, fullPage: false });
  await m.close();
}
await browser.close();
console.log(bad === 0 ? "ВСЕ СТРАНИЦЫ: мобайл без горскролла, скриншоты сняты" : `ЕСТЬ ГОРСКРОЛЛ у ${bad} страниц`);
process.exit(bad ? 1 : 0);
