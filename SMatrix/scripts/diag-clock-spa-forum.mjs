// Диагностика: почему на /?view=forum блок часов отличается от Главной.
// Дампим style-атрибут, computed-стили и цепочку родителей.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto("http://127.0.0.1:3000/?view=forum", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("#sakh-time", { state: "visible", timeout: 30000 });
await page.waitForTimeout(500);

const info = await page.evaluate(() => {
  const panels = document.querySelectorAll('[aria-label="Сахалинское время"]');
  const panel = panels[0];
  if (!panel) return { panels: panels.length };
  const chain = [];
  let el = panel;
  for (let i = 0; i < 6 && el; i++) {
    chain.push({
      tag: el.tagName,
      cls: el.className && String(el.className).slice(0, 120),
      id: el.id || null,
    });
    el = el.parentElement;
  }
  return {
    panelsCount: panels.length,
    styleAttr: panel.getAttribute("style"),
    chain,
    timeElStyle: document.querySelector("#sakh-time")?.getAttribute("style")?.slice(0, 300),
    headerStyle: panel.children[0]?.getAttribute("style")?.slice(0, 300),
    reactRoot: !!panel.closest("[data-reactroot]"),
  };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
