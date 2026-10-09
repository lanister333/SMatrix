// Приёмочный скриншот после чистого рестарта: полный вид темы 1 + мобильный 390px.
import { chromium } from "playwright";

const browser = await chromium.launch();

// Десктоп: полный вид
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:3000/?topic=1", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(600);
await page.screenshot({ path: "/home/z/my-project/download/rails-fullheight-acceptance.png", fullPage: true });
console.log("saved: rails-fullheight-acceptance.png");

// Кроп стыка #6 -> #7 (место бывшего обрубка)
const a = await page.locator('[data-msgnum="6"]').first().boundingBox();
const b = await page.locator('[data-msgnum="7"]').first().boundingBox();
const box = await page.locator(".sakh-comments-container").first().boundingBox();
await page.evaluate((y) => window.scrollTo(0, y), a.y - 50);
await page.waitForTimeout(250);
const sy = await page.evaluate(() => window.scrollY);
await page.screenshot({
  path: "/home/z/my-project/download/rails-acceptance-junction-6-7.png",
  clip: { x: box.x - 20, y: a.y - sy - 20, width: 500, height: b.y + b.height - a.y + 50 },
});
console.log("saved: rails-acceptance-junction-6-7.png");

// Мобильный 390px: нити скрыты, лесенка одна колонка
const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mp.goto("http://127.0.0.1:3000/?topic=1", { waitUntil: "networkidle", timeout: 30000 });
await mp.waitForTimeout(500);
const mob = await mp.evaluate(() => {
  const cards = [...document.querySelectorAll(".sakh-comment")].slice(0, 6).map((c) => {
    const r = c.getBoundingClientRect();
    return { num: c.dataset.msgnum, left: Math.round(r.left), right: Math.round(r.right) };
  });
  const rails = [...document.querySelectorAll(".sakh-comment-connector")].filter((r) => {
    const st = getComputedStyle(r);
    return st.display !== "none";
  }).length;
  return { cards, visibleRails: rails, hscroll: document.documentElement.scrollWidth > window.innerWidth };
});
console.log("mobile 390px:", JSON.stringify(mob));
await mp.screenshot({ path: "/home/z/my-project/download/rails-mobile-390-after.png" });
console.log("saved: rails-mobile-390-after.png");

await browser.close();
