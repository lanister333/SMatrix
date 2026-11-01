// Приёмочные скриншоты SVG-оверлея: зум 2x постов №1–№7 + вся страница.
import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto("http://127.0.0.1:3000/?topic=1", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(700);

const clip = await page.evaluate(() => {
  const cont = document.querySelector(".sakh-comments-container");
  cont.scrollIntoView({ block: "start" });
  const c1 = cont.querySelector('.sakh-comment[data-msgnum="1"]');
  const c7 = cont.querySelector('.sakh-comment[data-msgnum="7"]');
  const r1 = c1.getBoundingClientRect();
  const r7 = c7.getBoundingClientRect();
  return {
    x: Math.max(0, r1.left - 48 + window.scrollX),
    y: r1.top - 24 + window.scrollY,
    width: r1.width + 96,
    height: r7.bottom - r1.top + 48,
  };
});
await page.waitForTimeout(300);
await page.screenshot({ path: "/home/z/my-project/download/reply-svg-zoom-1-7.png", clip });
await page.locator(".sakh-comments-container").first().screenshot({ path: "/home/z/my-project/download/reply-svg-topic1-page1.png" });
console.log("saved: download/reply-svg-zoom-1-7.png, download/reply-svg-topic1-page1.png");
await browser.close();
