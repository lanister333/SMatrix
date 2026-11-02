// Скриншоты блока часов после фикса: Главная, /?view=forum, /obyavleniya
import { chromium } from "playwright";

const ROUTES = [
  ["/", "clock-identity-home.png"],
  ["/?view=forum", "clock-identity-forum-view.png"],
  ["/obyavleniya", "clock-identity-obyavleniya.png"],
];

const browser = await chromium.launch();
for (const [route, file] of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto("http://127.0.0.1:3000" + route, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#sakh-time", { state: "visible", timeout: 30000 });
  await page.waitForTimeout(600);
  const panel = page.locator('[aria-label="Сахалинское время"]');
  await panel.screenshot({ path: "/home/z/my-project/download/" + file });
  console.log(`${route.padEnd(16)} → download/${file}`);
  await page.close();
}
await browser.close();
