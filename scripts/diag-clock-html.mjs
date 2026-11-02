// Диагностика 2: полный innerHTML блока часов на /?view=forum + версии CSS-чанков
import { chromium } from "playwright";

const browser = await chromium.launch();

for (const route of ["/", "/?view=forum"]) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto("http://127.0.0.1:3000" + route, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#sakh-time", { state: "visible", timeout: 30000 });
  await page.waitForTimeout(400);
  const html = await page.evaluate(() => {
    const p = document.querySelector('[aria-label="Сахалинское время"]');
    return p ? p.outerHTML.slice(0, 1200) : "NOT FOUND";
  });
  console.log(`===== ${route} =====`);
  console.log(html);
  console.log();
  await page.close();
}
await browser.close();
