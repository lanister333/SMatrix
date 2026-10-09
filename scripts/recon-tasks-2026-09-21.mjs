/** Разведка задач 5-7 от 2026-09-21: найти бирюзовые элементы («шапка»),
 *  синие линии под ними, кнопки рядом; скриншоты главной и форумного списка. */
import { chromium } from "playwright";
import fs from "fs";

const OUT = "scripts/shots";
fs.mkdirSync(OUT, { recursive: true });

function parseRgb(s) {
  const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
}
function rgbToHue({ r, g, b }) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  if (d === 0) return { h: 0, s: 0, l: max };
  const l = (max + min) / 2;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return { h: ((h * 60) + 360) % 360, s, l };
}
const isTeal = (rgb) => {
  if (!rgb || rgb.a < 0.4) return false;
  const { h, s, l } = rgbToHue(rgb);
  return h >= 140 && h <= 200 && s > 0.15 && l > 0.12 && l < 0.9;
};
const isBlue = (rgb) => {
  if (!rgb || rgb.a < 0.4) return false;
  const { h, s, l } = rgbToHue(rgb);
  return h >= 200 && h <= 250 && s > 0.2;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

for (const [name, url] of [["main", "http://127.0.0.1:3000/"], ["forum", "http://127.0.0.1:3000/?scope=new"]]) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const report = await page.evaluate(() => {
    const all = [...document.querySelectorAll("body *")];
    const teal = [];
    for (const el of all) {
      const cs = getComputedStyle(el);
      const bg = cs.backgroundColor;
      const m = bg.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
      if (!m) continue;
      const rgb = { r: +m[1], g: +m[2], b: +m[3], a: 1 };
      const { h, s, l } = (() => {
        const R = rgb.r / 255, G = rgb.g / 255, B = rgb.b / 255;
        const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
        if (!d) return { h: 0, s: 0, l: mx };
        const L = (mx + mn) / 2, S = d / (1 - Math.abs(2 * L - 1));
        let H = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
        return { h: (H * 60 + 360) % 360, s: S, l: L };
      })();
      if (h >= 140 && h <= 200 && s > 0.15 && l > 0.12 && l < 0.9) {
        const r = el.getBoundingClientRect();
        teal.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || "").toString().slice(0, 90),
          text: (el.textContent || "").trim().slice(0, 60),
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          bg,
          borderBottom: cs.borderBottomColor + " " + cs.borderBottomWidth,
        });
      }
    }
    return { tealCount: teal.length, teal: teal.slice(0, 25) };
  });
  console.log(`\n===== ${name} (${url}) =====`);
  console.log("TEAL elements:", report.tealCount);
  report.teal.forEach((t, i) => console.log(` [${i}] <${t.tag} class="${t.cls}"> bg=${t.bg} borderB=${t.borderBottom} rect=${JSON.stringify(t.rect)} text="${t.text}"`));

  // Скриншоты: полный вид + верхняя зона (шапки) крупно
  await page.screenshot({ path: `${OUT}/recon-${name}-full.png`, fullPage: false });
  await page.screenshot({ path: `${OUT}/recon-${name}-top.png`, clip: { x: 0, y: 0, width: 1920, height: 700 } });
}

await browser.close();
console.log("\nDONE");
