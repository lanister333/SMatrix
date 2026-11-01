import { chromium } from "playwright";
const BASE = "http://127.0.0.1:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE + "/rekomenduyu", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector(".rc-col-main .max-w-3xl", { timeout: 60000 });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const card = document.querySelector(".rc-col-main .max-w-3xl");
  if (!card) return "NO CARD";
  const cat = card.querySelector("span");
  const cs = (el, p) => getComputedStyle(el)[p];
  return {
    cardClasses: card.className.slice(0, 160),
    catClasses: cat?.className,
    catText: cat?.textContent?.trim().slice(0, 60),
    catFontSize: cs(cat, "fontSize"),
    catTextTransform: cs(cat, "textTransform"),
    catColor: cs(cat, "color"),
    catLetterSpacing: cs(cat, "letterSpacing"),
    badge: card.querySelector('span[class*="border-red"], span[class*="emerald"]')?.textContent?.trim(),
    sheetHasZinc: Array.from(document.styleSheets).some((s) => {
      try { return Array.from(s.cssRules).some((r) => r.cssText && r.cssText.includes("--color-zinc-400")); }
      catch { return false; }
    }),
    tailwindVar: getComputedStyle(document.documentElement).getPropertyValue("--color-zinc-400"),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
