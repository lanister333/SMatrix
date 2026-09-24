// Снятие пробы ДО/ПОСЛЕ: шапка сайта (Masthead) + карточка «Погода» (почасовка)
// Запуск: node scripts/shot-header-hours.mjs [префикс-файла]
import { chromium } from "playwright";

const PREFIX = process.argv[2] || "hdr-before";
const OUT = "/home/z/my-project/scripts/shots/";

const browser = await chromium.launch();

// Десктоп: страница целиком (шапка + погодная карточка в одном кадре)
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.goto("http://127.0.0.1:3000/weather.php", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}${PREFIX}-desktop.png` });

// Замеры: фон шапки, фон первой ячейки почасовки, список классов ячеек
const probe = await page.evaluate(() => {
  const mh = document.querySelector(".sm-masthead");
  const cells = [...document.querySelectorAll(".hour-cell")];
  const bg = (el) => (el ? getComputedStyle(el).backgroundColor : "none");
  return {
    mastheadBg: mh ? bg(mh) : "NO_HEADER",
    cellCount: cells.length,
    firstCellBg: bg(cells[0]),
    firstCellClass: cells[0]?.className ?? "",
    currentCellBg: bg(document.querySelector(".hour-cell.current")),
  };
});
console.log("DESKTOP PROBE:", JSON.stringify(probe, null, 2));

// Мобайл 375: горскролл + та же шапка
const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
await mob.goto("http://127.0.0.1:3000/weather.php", { waitUntil: "domcontentloaded", timeout: 60000 });
await mob.waitForTimeout(2000);
await mob.screenshot({ path: `${OUT}${PREFIX}-mobile.png` });
const mobProbe = await mob.evaluate(() => ({
  mastheadBg: getComputedStyle(document.querySelector(".sm-masthead")).backgroundColor,
  docW: document.documentElement.scrollWidth,
  vw: window.innerWidth,
}));
console.log("MOBILE PROBE:", JSON.stringify(mobProbe));
console.log(`shots → ${OUT}${PREFIX}-desktop.png, ${PREFIX}-mobile.png`);

await page.close();
await mob.close();
await browser.close();
