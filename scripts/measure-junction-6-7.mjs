// Точный замер стыков: карточки 5-11, все вертикальные сегменты в их колонках.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:3000/?topic=1", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(500);

const data = await page.evaluate(() => {
  const cont = document.querySelector(".sakh-comments-container");
  const cr = cont.getBoundingClientRect();
  const cards = [...cont.querySelectorAll(":scope > .sakh-comment")].map((c) => {
    const r = c.getBoundingClientRect();
    return { num: +c.dataset.msgnum, lvl: +c.dataset.level, top: Math.round(r.top), bottom: Math.round(r.bottom) };
  });
  const segs = [...cont.querySelectorAll(":scope > .sakh-comment > .sakh-comment-connector")].map((r) => {
    const card = r.parentElement, rr = r.getBoundingClientRect();
    return {
      num: +card.dataset.msgnum, lvl: +card.dataset.level,
      hook: r.dataset.hook === "1", stub: r.dataset.stub === "1",
      x: +(rr.left - cr.left).toFixed(1),
      top: +(rr.top - cr.top).toFixed(1), bottom: +(rr.bottom - cr.top).toFixed(1),
      hStyle: r.style.height,
    };
  });
  return { cards: cards.filter((c) => c.num >= 1 && c.num <= 12), segs: segs.filter((s) => s.num >= 1 && s.num <= 12) };
});

console.log("CARDS:");
for (const c of data.cards) console.log(`  #${c.num} L${c.lvl} top=${c.top} bottom=${c.bottom}`);
console.log("SEGMENTS (vertical only):");
for (const s of data.segs.filter((s) => !s.hook)) console.log(`  #${s.num} L${s.lvl} x=${s.x} top=${s.top} bottom=${s.bottom} h=${s.hStyle}${s.stub ? " [STUB]" : ""}`);
console.log("HOOKS:");
for (const s of data.segs.filter((s) => s.hook)) console.log(`  #${s.num} L${s.lvl} x=${s.x} top=${s.top} w=13`);

// 4x кроп стыка #6 -> #7
const a = await page.locator('[data-msgnum="6"]').first().boundingBox();
const b = await page.locator('[data-msgnum="7"]').first().boundingBox();
const y = a.y - 40;
await page.evaluate((yy) => window.scrollTo(0, yy), y);
await page.waitForTimeout(250);
const box = await page.locator(".sakh-comments-container").first().boundingBox();
const sy = await page.evaluate(() => window.scrollY);
await page.screenshot({
  path: "/home/z/my-project/download/crop-junction-6-7-4x.png",
  clip: { x: box.x - 20, y: a.y - sy - 30, width: 500, height: b.y + b.height - a.y + 70 },
});
console.log("saved crop-junction-6-7-4x.png");
await browser.close();
