// Диагностика: почему иконка и название рубрики на разных строках?
import { chromium } from "playwright";
const BASE = "http://127.0.0.1:3000";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("li.sk-rubric-row .sk-rubric-name", { timeout: 30000 });

  const info = await page.evaluate(() => {
    const li = document.querySelector("li.sk-rubric-row");
    const header = li.querySelector(".sk-rubric-header");
    const ico = li.querySelector(".sk-navico");
    const name = li.querySelector(".sk-rubric-name");
    const cs = (el) => {
      const s = getComputedStyle(el);
      return { display: s.display, flexWrap: s.flexWrap, alignItems: s.alignItems, tag: el.tagName };
    };
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
    return {
      header: { ...cs(header), rect: r(header) },
      icon: { ...cs(ico), rect: r(ico), svgDisplay: getComputedStyle(ico).display },
      name: { ...cs(name), rect: r(name) },
      sameRow: Math.abs(ico.getBoundingClientRect().y - name.getBoundingClientRect().y) < 5,
      headerRules: (() => {
        // какие правила CSS матчат .sk-rubric-header
        const out = [];
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule.selectorText && rule.selectorText.includes("sk-rubric-header")) {
                out.push({ sel: rule.selectorText, css: rule.style.cssText, href: sheet.href || "inline" });
              }
            }
          } catch (e) { /* cross-origin */ }
        }
        return out;
      })(),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
