// Приёмка: тот же участок, что на Скриншот-20260919-121252 (карточки #1-#8, тема 1).
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.goto("http://127.0.0.1:3000/?topic=1", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(600);

const a = await page.locator('[data-msgnum="1"]').first().boundingBox();
const h = await page.locator('[data-msgnum="8"]').first().boundingBox();
const box = await page.locator(".sakh-comments-container").first().boundingBox();
await page.evaluate((y) => window.scrollTo(0, y), a.y - 60);
await page.waitForTimeout(250);
const sy = await page.evaluate(() => window.scrollY);
await page.screenshot({
  path: "/home/z/my-project/download/rails-hug-frames-acceptance.png",
  clip: { x: box.x - 12, y: a.y - sy - 10, width: 560, height: h.y + h.height - a.y + 30 },
});
console.log("saved: rails-hug-frames-acceptance.png");
await browser.close();
