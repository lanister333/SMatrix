/**
 * ПРОБА «Шапка без треугольника, надпись по центру».
 * Проверяет:
 *  1) /weather.php — шапка «Погода» (.mp-paneltitle.mp-paneltitle-plain):
 *     текст без «▼», computed text-align=center, шапка — первый элемент
 *     карточки (зазор от верха ≤2px), текст геометрически отцентрован
 *     (|левый зазор − правый зазор| ≤ 4px), computed bg/color/padding/font
 *     = эталонной шапке «Температура по районам»;
 *  2) эталон «Температура по районам» — НЕ задет: содержит «▼», без
 *     класса mp-paneltitle-plain, text-align не center;
 *  3) /disconnections.php — то же для «Отключения»; эталон
 *     «Электроэнергия (Сахалинэнерго)» — не задет;
 *  4) клик по чипу «Корсаков»: шапка остаётся без «▼», по центру,
 *     структура «шапка+тело» цела (шапка первый элемент, зазор ≤2px).
 * Скриншоты: download/title-plain-weather.png, download/title-plain-disconnections.png
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:3000";
const OUT = "/home/z/my-project/download";
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
const ok = (cond, label) => {
  console.log(`${cond ? "OK  " : "FAIL"} ${label}`);
  if (!cond) problems.push(label);
};
const close = (a, b, eps) => Math.abs(a - b) <= eps;

function textGeometry(header) {
  return header.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const node = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    const range = document.createRange();
    range.selectNodeContents(node ?? el);
    const t = range.getBoundingClientRect();
    return {
      headerText: (el.textContent || "").trim(),
      hasTri: (el.textContent || "").includes("▼"),
      plainClass: el.classList.contains("mp-paneltitle-plain"),
      textAlign: getComputedStyle(el).textAlign,
      leftGap: t.left - r.left,
      rightGap: r.right - t.right,
      topGapFromCard: 0, // заполнит вызывающий код
    };
  });
}

async function checkCard(page, sectionLabel, wantTitle) {
  const sec = page.locator(`section[aria-label="${sectionLabel}"]`);
  const header = sec.locator(".mp-paneltitle").first();
  const geo = await textGeometry(header);
  const flush = await header.evaluate((el) => {
    const card = el.closest("section");
    return Math.round(el.getBoundingClientRect().top - card.getBoundingClientRect().top);
  });
  ok(geo.headerText === wantTitle, `[${sectionLabel}] текст шапки = «${wantTitle}» (получено: «${geo.headerText}»)`);
  ok(!geo.hasTri, `[${sectionLabel}] в шапке НЕТ треугольника «▼»`);
  ok(geo.plainClass, `[${sectionLabel}] шапка имеет класс mp-paneltitle-plain`);
  ok(geo.textAlign === "center", `[${sectionLabel}] computed text-align=center (получено: ${geo.textAlign})`);
  ok(flush <= 2, `[${sectionLabel}] шапка прижата к верху карточки (зазор ${flush}px ≤ 2)`);
  ok(close(geo.leftGap, geo.rightGap, 4), `[${sectionLabel}] надпись по центру: левый зазор ${geo.leftGap.toFixed(1)}px vs правый ${geo.rightGap.toFixed(1)}px`);
  return geo;
}

async function checkEtalon(page, sectionLabel) {
  const sec = page.locator(`section[aria-label="${sectionLabel}"]`);
  const header = sec.locator(".mp-paneltitle").first();
  const geo = await textGeometry(header);
  ok(geo.hasTri, `[эталон ${sectionLabel}] треугольник «▼» на месте (дизайн не тронут)`);
  ok(!geo.plainClass, `[эталон ${sectionLabel}] БЕЗ класса mp-paneltitle-plain`);
  ok(geo.textAlign !== "center", `[эталон ${sectionLabel}] text-align не center (${geo.textAlign})`);
  return geo;
}

async function sameComputedAsEtalon(page, sectionLabel, etalonLabel) {
  const pick = (loc) => loc.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, color: cs.color, padding: cs.padding, font: cs.fontSize, weight: cs.fontWeight, bb: cs.borderBottomWidth + " " + cs.borderBottomColor };
  });
  const a = await pick(page.locator(`section[aria-label="${sectionLabel}"] .mp-paneltitle`).first());
  const b = await pick(page.locator(`section[aria-label="${etalonLabel}"] .mp-paneltitle`).first());
  const same = a.bg === b.bg && a.color === b.color && a.padding === b.padding && a.font === b.font && a.weight === b.weight && a.bb === b.bb;
  ok(same, `[${sectionLabel}] computed-стили шапки = эталону «${etalonLabel}» ${same ? "" : JSON.stringify({ a, b })}`);
}

const browser = await chromium.launch();
try {
  // ---------- /weather.php ----------
  const w = await browser.newPage();
  await w.goto(`${BASE}/weather.php`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await w.waitForTimeout(2500);
  await checkCard(w, "Погода в Южно-Сахалинске", "Погода");
  await checkEtalon(w, "Температура по районам Сахалина и Курил");
  await sameComputedAsEtalon(w, "Погода в Южно-Сахалинске", "Температура по районам Сахалина и Курил");
  await w.screenshot({ path: `${OUT}/title-plain-weather.png`, fullPage: false });

  // ---------- /disconnections.php ----------
  const d = await browser.newPage();
  await d.goto(`${BASE}/disconnections.php`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await d.waitForTimeout(2500);
  await checkCard(d, "Отключения и районный фильтр", "Отключения");
  await checkEtalon(d, "⚡ Электроэнергия (Сахалинэнерго)");
  await sameComputedAsEtalon(d, "Отключения и районный фильтр", "⚡ Электроэнергия (Сахалинэнерго)");
  await d.screenshot({ path: `${OUT}/title-plain-disconnections.png`, fullPage: false });

  // ---------- клик по району «Корсаков»: структура прежняя ----------
  const chip = d.locator('.dis-chip', { hasText: "Корсаков" }).first();
  await chip.click();
  await d.waitForTimeout(1200);
  await checkCard(d, "Отключения и районный фильтр", "Отключения");
  const stillEmpty = await d.locator(".dis-empty").count();
  console.log(`INFO после клика «Корсаков»: .dis-empty блоков = ${stillEmpty} (содержимое обновилось)`);
  await d.screenshot({ path: `${OUT}/title-plain-disconnections-korsakov.png`, fullPage: false });

  await w.close(); await d.close();
} finally {
  await browser.close();
}

console.log(problems.length === 0 ? "\n=== ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ ===" : `\n=== ПРОВАЛОВ: ${problems.length} ===`);
process.exit(problems.length === 0 ? 0 : 1);
