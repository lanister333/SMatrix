/** Скриншоты 2026-09-23 (ред.2): пара кнопок «в одну линию, рядом, справа». */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  for (const [variant, path, file] of [
    ["wtb", "/gde-kupit", "download/sm-btnrow-gde-kupit-desktop-2026-09-23.png"],
    ["cheap", "/gde-deshevle", "download/sm-btnrow-gde-deshevle-desktop-2026-09-23.png"],
  ]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.waitForSelector(`[data-e2e-panel="${variant}"]`, { timeout: 30000 });
    await page.locator(`[data-e2e-panel="${variant}"]`).screenshot({ path: file });
    console.log("shot:", file);
  }
  const mp = await browser.newPage({ viewport: { width: 375, height: 720 } });
  await mp.goto(BASE + "/gde-kupit", { waitUntil: "networkidle" });
  await mp.waitForSelector('[data-e2e-panel="wtb"]', { timeout: 30000 });
  await mp.locator('[data-e2e-panel="wtb"]').screenshot({ path: "download/sm-btnrow-gde-kupit-mobile-2026-09-23.png" });
  console.log("shot: download/sm-btnrow-gde-kupit-mobile-2026-09-23.png");
} finally {
  await browser.close();
}
