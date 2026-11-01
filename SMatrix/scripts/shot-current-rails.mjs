// Скриншот текущего состояния лесенки (тема 1) до правки висящих линий.
import { chromium } from "playwright";

const url = process.env.SHOT_URL || "http://127.0.0.1:3000/?topic=1";
const out = process.env.SHOT_OUT || "/home/z/my-project/download/rails-before-fix.png";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(600);

// Скроллим к блоку комментариев
const box = await page.locator(".sakh-comments-container").first().boundingBox();
if (box) await page.evaluate((y) => window.scrollTo(0, y), box.y - 40);
await page.waitForTimeout(300);

await page.screenshot({ path: out, fullPage: true });
console.log("saved:", out);
await browser.close();
