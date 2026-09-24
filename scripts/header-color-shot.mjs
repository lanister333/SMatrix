/**
 * Раунд 2026-09-22 «цветокоррекция шапки и логотипа» — скриншоты шапки:
 * десктоп 1280 (шапка + синяя навигация) и мобайл 375.
 * Проверки computed-стилей: градиент-стопы не читаются из computed
 * (background-image), поэтому сверяются итоговые цвета ЛОГОТИПА
 * (.sm-masthead-matrix → #0869c5) и неизменность общего синего ссылок
 * (.sk a → #0a5caa) — скоуп правки подтверждается автоматически.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:3000";
const SHOTS = "scripts/shots";
fs.mkdirSync(SHOTS, { recursive: true });

const ok = (name, cond, extra = "") =>
  console.log(`${cond ? "OK  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".sm-masthead-title", { timeout: 60000 });
  await page.waitForTimeout(1200);

  const matrixColor = await page.evaluate(() => {
    const el = document.querySelector(".sm-masthead-matrix");
    return el ? getComputedStyle(el).color : null;
  });
  ok("логотип «Matrix» = #0869c5 (rgb(8,105,197))",
    matrixColor === "rgb(8, 105, 197)", matrixColor || "нет элемента");

  const sakhColor = await page.evaluate(() => {
    const el = document.querySelector(".sm-masthead-sakh");
    return el ? getComputedStyle(el).color : null;
  });
  ok("логотип «Sakh» остался белым", sakhColor === "rgb(255, 255, 255)", sakhColor || "нет элемента");

  const linkColor = await page.evaluate(() => {
    // ВАЖНО: первый попавшийся .sk a может попадать под более специфичное
    // правило — берём .sk-rubric-name (рубрики левой колонки), который
    // красится ИМЕННО generic-правилом #0a5caa (globals.css).
    const a = document.querySelector(".sk-rubric-name");
    return a ? getComputedStyle(a).color : null;
  });
  ok("общий синий ссылок НЕ тронут: #0a5caa", linkColor === "rgb(10, 92, 170)", linkColor || "нет элемента");

  const bgImage = await page.evaluate(() => {
    const h = document.querySelector("header.sm-masthead");
    return h ? getComputedStyle(h).backgroundImage : null;
  });
  ok("градиент шапки с новыми стопами (#16c5b0/#0f9989/#0a7066)",
    !!bgImage && bgImage.includes("rgb(22, 197, 176)") && bgImage.includes("rgb(15, 153, 137)") && bgImage.includes("rgb(10, 112, 102)"),
    bgImage ? bgImage.slice(0, 220) : "нет шапки");

  await page.screenshot({ path: `${SHOTS}/header-colors-desktop.png`, clip: { x: 0, y: 0, width: 1280, height: 260 } });

  const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mob.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await mob.waitForSelector(".sm-masthead-title", { timeout: 60000 });
  await mob.waitForTimeout(1200);
  const sw = await mob.evaluate(() => document.documentElement.scrollWidth);
  ok("мобайл 375: без горскролла", sw <= 375, `sw=${sw}`);
  await mob.screenshot({ path: `${SHOTS}/header-colors-mobile.png`, clip: { x: 0, y: 0, width: 375, height: 300 } });
} finally {
  await browser.close();
}
console.log("SHOTS DONE");
