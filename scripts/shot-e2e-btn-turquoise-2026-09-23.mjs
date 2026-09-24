/** Скриншоты 2026-09-23: кнопки «Обсудить на форуме» — справа, бирюзовые. */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE}/gde-kupit`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-e2e-panel="wtb"]', { timeout: 30000 });
  await page.locator('[data-e2e-panel="wtb"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator('[data-e2e-panel="wtb"]').screenshot({ path: "download/e2e-btn-turquoise-wtb-2026-09-23.png" });

  const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page2.goto(`${BASE}/gde-deshevle`, { waitUntil: "networkidle" });
  await page2.waitForSelector('[data-e2e-panel="cheap"]', { timeout: 30000 });
  await page2.locator('[data-e2e-panel="cheap"]').scrollIntoViewIfNeeded();
  await page2.waitForTimeout(400);
  await page2.locator('[data-e2e-panel="cheap"]').screenshot({ path: "download/e2e-btn-turquoise-cheap-2026-09-23.png" });

  const mp = await browser.newPage({ viewport: { width: 375, height: 780 } });
  await mp.goto(`${BASE}/gde-kupit`, { waitUntil: "networkidle" });
  await mp.waitForSelector('[data-e2e-panel="wtb"]', { timeout: 30000 });
  await mp.locator('[data-e2e-panel="wtb"] [data-e2e-scenario="1"]').scrollIntoViewIfNeeded();
  await mp.waitForTimeout(400);
  await mp.locator('[data-e2e-panel="wtb"]').screenshot({ path: "download/e2e-btn-turquoise-mobile-2026-09-23.png" });
  console.log("Скриншоты сохранены");
} finally { await browser.close(); }
