// Скриншоты ДО правки: верхняя карточка /weather.php и /disconnections.php
import { chromium } from "playwright";

const ROUTES = [
  ["/weather.php", "weather-card-after.png"],
  ["/disconnections.php", "disconn-card-after.png"],
];

const browser = await chromium.launch();
for (const [route, file] of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto("http://127.0.0.1:3000" + route, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  const card = page.locator('section.mp-panel').first();
  await card.screenshot({ path: "/home/z/my-project/download/" + file });
  console.log(`${route} → download/${file}`);
  await page.close();
}
await browser.close();
