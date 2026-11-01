// Проба ТЗ 2026-09-21 «блоки калькулятор, отделения и кассы банков —
// синяя шапка как у блока курсы валют, названия в середину»: сверка
// computed-styles синих шапок-полос на /currency.php + скриншоты.
// Запуск: node scripts/probe-currency-headers.mjs [префикс-скриншотов]
import { chromium } from "playwright";

const PREFIX = process.argv[2] || "cur-head";
const OUT = "/home/z/my-project/scripts/shots/";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:3000/currency.php", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("text=Калькулятор-конвертер", { timeout: 45000 });
await page.waitForTimeout(1500); // async-курсы могли догрузиться — даем таблице устаканиться

const read = () => {
  const grab = (label) => {
    const els = [...document.querySelectorAll("div")].filter(
      (d) => d.childElementCount === 0 && d.textContent.trim() === label
    );
    if (!els.length) return { found: false };
    const el = els[els.length - 1]; // самый внутренний (сам титул)
    const s = getComputedStyle(el);
    const parent = el.parentElement;
    return {
      found: true,
      bg: s.backgroundColor,
      color: s.color,
      align: s.textAlign,
      weight: s.fontWeight,
      parentBg: getComputedStyle(parent).backgroundColor,
      parentBorder: getComputedStyle(parent).border,
      barMargin: s.margin,
    };
  };
  return {
    calc: grab("Калькулятор-конвертер"),
    branches: grab("Отделения и кассы банков"),
  };
};
const d = await page.evaluate(read);
console.log("HEADERS DESKTOP:", JSON.stringify(d, null, 2));

// скриншоты блоков (десктоп): контейнер = div[style*="E0F5F3"], содержащий титул
for (const [key, label] of [["calc", "Калькулятор-конвертер"], ["branches", "Отделения и кассы банков"]]) {
  const t = d[key];
  if (!t.found) continue;
  const loc = page.locator('div[style*="E0F5F3"]', { hasText: label }).last();
  await loc.screenshot({ path: `${OUT}${PREFIX}-${key}.png` });
}

// мобайл 375: шапки синие, горскролла нет
const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
await mob.goto("http://127.0.0.1:3000/currency.php", { waitUntil: "domcontentloaded", timeout: 60000 });
await mob.waitForSelector("text=Калькулятор-конвертер", { timeout: 45000 });
await mob.waitForTimeout(1000);
const m = await mob.evaluate(() => {
  const grab = (label) => {
    const els = [...document.querySelectorAll("div")].filter(
      (x) => x.childElementCount === 0 && x.textContent.trim() === label
    );
    if (!els.length) return { found: false };
    const s = getComputedStyle(els[els.length - 1]);
    return { found: true, bg: s.backgroundColor, align: s.textAlign, color: s.color };
  };
  return {
    docW: document.documentElement.scrollWidth,
    vw: window.innerWidth,
    calc: grab("Калькулятор-конвертер"),
    branches: grab("Отделения и кассы банков"),
  };
});
console.log("HEADERS MOBILE:", JSON.stringify(m));
await browser.close();
