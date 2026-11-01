// Проба после отката rails-hug-frames-no-float: крючки «├» должны вернуться,
// вертикали — на прежних колонках (левее рамок), штырьки на месте.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:3000/?topic=1", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(600);

const res = await page.evaluate(() => {
  const hooks = document.querySelectorAll('[data-hook="1"]').length;
  const stubs = document.querySelectorAll('[data-stub="1"]').length;
  const rails = [...document.querySelectorAll(".sakh-comment-connector")].filter(
    (el) => !el.dataset.hook && !el.dataset.stub
  );
  const sample = rails.slice(0, 6).map((el) => el.getAttribute("style"));
  const cards = document.querySelectorAll(".sakh-comment").length;
  return { cards, hooks, stubs, rails: rails.length, sample };
});
console.log(JSON.stringify(res, null, 2));
await browser.close();
