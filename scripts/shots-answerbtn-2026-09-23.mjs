/** Скриншоты 2026-09-23: панели сценариев с ДВУМЯ кнопками под каждым запросом. */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

for (const cfg of [
  { url: "/gde-kupit", name: "gde-kupit" },
  { url: "/gde-deshevle", name: "gde-deshevle" },
]) {
  await page.goto(BASE + cfg.url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  const panel = page.locator(`[data-e2e-panel="${cfg.name === "gde-kupit" ? "wtb" : "cheap"}"]`);
  await panel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await panel.screenshot({ path: `/home/z/my-project/download/sm-answerbtn-${cfg.name}-panel-2026-09-23.png` });
  await page.screenshot({ path: `/home/z/my-project/download/sm-answerbtn-${cfg.name}-page-2026-09-23.png`, fullPage: false });
  console.log(`OK ${cfg.name}: панель + страница`);
}
await browser.close();
console.log("Скриншоты сохранены в download/");
