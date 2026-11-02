import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://localhost:3000/rekomenduyu", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector(".matrix-review-card[data-rc-id]", { timeout: 60000 });
await page.waitForTimeout(1200);

const card = page.locator(".matrix-review-card[data-rc-id]").first();
const dump = await card.evaluate((el) => {
  const cs = (sel, props) => {
    const n = el.querySelector(sel);
    if (!n) return { sel, MISSING: true };
    const s = getComputedStyle(n);
    const out = { sel };
    for (const p of props) out[p] = s[p];
    return out;
  };
  return [
    cs(".rc-headrow", ["fontSize", "color", "display"]),
    cs(".rc-headrow b", ["fontWeight", "color"]),
    cs(".rc-headrow b", ["className"]),
    cs(".rc-date", ["whiteSpace"]),
    cs(".rc-usefulbtn", ["fontSize", "color", "backgroundColor", "textDecorationLine"]),
    cs(".rc-report", ["color", "marginRight", "fontSize"]),
    cs(".rc-actrow", ["justifyContent", "columnGap"]),
  ];
});
console.log(JSON.stringify(dump, null, 2));
await browser.close();
