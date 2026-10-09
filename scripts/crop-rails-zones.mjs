// Кроп 2x лесенки темы 1: три зоны со сложной структурой веток.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.goto("http://127.0.0.1:3000/?topic=1", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(600);

// Зона 1: сообщения 1-7 (длинная цепочка + возврат ветки к корню)
// Зона 2: сообщения 10-19 (боковые ветки 11→10, 15→14, 18→14)
// Зона 3: сообщения 34-41 (23→, ответы uglu/bor/gostb)
const zones = [
  { sel: '[data-msgnum="1"]', sel2: '[data-msgnum="7"]', out: "/home/z/my-project/download/crop-msgs-1-7.png" },
  { sel: '[data-msgnum="10"]', sel2: '[data-msgnum="19"]', out: "/home/z/my-project/download/crop-msgs-10-19.png" },
  { sel: '[data-msgnum="28"]', sel2: '[data-msgnum="33"]', out: "/home/z/my-project/download/crop-msgs-28-33.png" },
];

for (const z of zones) {
  const a = await page.locator(z.sel).first().boundingBox();
  const b = await page.locator(z.sel2).first().boundingBox();
  if (!a || !b) { console.log("skip zone", z.out, "— карточки не найдены"); continue; }
  const y = Math.min(a.y, b.y) - 30;
  const h = Math.max(a.y + a.height, b.y + b.height) - y + 30;
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(250);
  const box = await page.locator(".sakh-comments-container").first().boundingBox();
  await page.screenshot({
    path: z.out,
    clip: { x: box.x - 30, y: y - (await page.evaluate(() => window.scrollY)) + 0, width: 720, height: Math.min(h, 1600) },
  });
  console.log("saved:", z.out);
}
await browser.close();
