// Проба ТЗ 2026-09-21 «шапку сайта окрась в цвет как у блока поддержка
// молодого бизнеса»: сверка градиента .sm-masthead с .biz-rot на главной.
// Запуск: node scripts/probe-masthead.mjs [префикс-скриншотов]
import { chromium } from "playwright";

const PREFIX = process.argv[2] || "masthead";
const OUT = "/home/z/my-project/scripts/shots/";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:3000/weather.php", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector(".sm-masthead", { timeout: 45000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}${PREFIX}-weather.png`, fullPage: false });

const mh = await page.evaluate(() => {
  const s = getComputedStyle(document.querySelector(".sm-masthead"));
  return { bgImage: s.backgroundImage, bgColor: s.backgroundColor };
});
console.log("MASTHEAD:", JSON.stringify(mh, null, 2));

// главная: плашка блока «Поддержка молодого бизнеса»
const home = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await home.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
await home.waitForSelector(".biz-rot", { timeout: 45000 });
await home.waitForTimeout(1200);
const biz = await home.evaluate(() => {
  const cell = document.querySelector('section[aria-label="Поддержка молодого бизнеса"]');
  const rot = cell?.querySelector(".biz-rot");
  return {
    cellFound: !!cell,
    rotBgImage: rot ? getComputedStyle(rot).backgroundImage : "ABSENT",
  };
});
console.log("BIZ CELL:", JSON.stringify(biz, null, 2));
const same =
  biz.rotBgImage !== "ABSENT" &&
  biz.rotBgImage.split("radial-gradient")[0] === "" &&
  mh.bgImage.includes("150deg") &&
  biz.rotBgImage.includes("150deg") &&
  mh.bgImage.replace(/\s/g, "") === biz.rotBgImage.replace(/\s/g, "");
console.log("GRADIENT MATCH:", same);
await home.screenshot({ path: `${OUT}${PREFIX}-home.png`, fullPage: false });

// мобайл
const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
await mob.goto("http://127.0.0.1:3000/weather.php", { waitUntil: "domcontentloaded", timeout: 60000 });
await mob.waitForSelector(".sm-masthead", { timeout: 45000 });
await mob.waitForTimeout(800);
await mob.screenshot({ path: `${OUT}${PREFIX}-mobile.png` });
const mobProbe = await mob.evaluate(() => ({
  docW: document.documentElement.scrollWidth,
  vw: window.innerWidth,
  mhImage: getComputedStyle(document.querySelector(".sm-masthead")).backgroundImage.slice(0, 60),
}));
console.log("MOBILE:", JSON.stringify(mobProbe));
await browser.close();
