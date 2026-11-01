/** Скриншоты новых форумных страниц (десктоп + мобайл). */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const shots = [
  ["/forum", "forum-index", 1440],
  ["/forum/category/nedvizhimost--zhkh-i-upravlyayuschie-kompanii", "forum-category-gkh", 1440],
  ["/forum/topic/177", "forum-topic-177", 1440],
  ["/gkh", "gkh-button", 1440],
  ["/help", "help-button", 1440],
  ["/rekomenduyu", "recommend-simulator", 1440],
  ["/forum", "forum-index-mobile", 375],
  ["/forum/topic/177?prefilled_text=Сквозной перенос текста на мобиле", "forum-topic-mobile", 375],
];
const browser = await chromium.launch();
for (const [path, name, w] of shots) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `/home/z/my-project/screenshots/sm-${name}-2026-09-23.png`, fullPage: false });
  console.log("shot:", name);
  await page.close();
}
await browser.close();
