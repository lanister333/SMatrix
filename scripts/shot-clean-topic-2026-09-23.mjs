/** Скриншоты «чистого блока темы» (указ 2026-09-23): десктоп + мобайл,
 *  обе страницы. Запуск: node scripts/shot-clean-topic-2026-09-23.mjs */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/download";
const browser = await chromium.launch();
const errors = [];

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
for (const [variant, path, name] of [["wtb", "/gde-kupit", "gde-kupit"], ["cheap", "/gde-deshevle", "gde-deshevle"]]) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForSelector(`[data-e2e-panel="${variant}"]`, { timeout: 30000 });
  await page.locator(`[data-e2e-panel="${variant}"] [data-e2e-scenario]`).first().screenshot({
    path: `${OUT}/sm-clean-topic-${name}-card-2026-09-23.png`,
  });
  await page.screenshot({ path: `${OUT}/sm-clean-topic-${name}-page-2026-09-23.png` });
}
const m = await browser.newPage({ viewport: { width: 375, height: 800 } });
m.on("pageerror", (e) => errors.push(String(e)));
m.on("console", (mm) => { if (mm.type() === "error") errors.push(mm.text()); });
await m.goto(BASE + "/gde-kupit", { waitUntil: "networkidle" });
await m.waitForSelector('[data-e2e-panel="wtb"]', { timeout: 30000 });
await m.locator('[data-e2e-panel="wtb"] [data-e2e-scenario]').first().screenshot({
  path: `${OUT}/sm-clean-topic-gde-kupit-mobile-2026-09-23.png`,
});
await browser.close();
console.log("Ошибки консоли:", errors.length ? errors.join(" | ") : "нет");
