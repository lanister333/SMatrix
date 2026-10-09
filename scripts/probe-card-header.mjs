// Проба «Плашка = верх карточки» на /weather.php и /disconnections.php:
// 1) заголовок карточки — .mp-paneltitle, прижат к верху карточки (без
//    зазора и без собственной рамки-плашки .sm-stub-home);
// 2) шапка совпадает по computed-стилям с эталонной («Температура по
//    районам» / «Электроэнергия (Сахалинэнерго)»);
// 3) клик по району обновляет содержимое, структура «шапка+тело» цела;
// 4) инвентаризация всех карточек обеих страниц.
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const EPS = 1.5;
const failures = [];

async function cardInfo(page, ariaLabel) {
  return page.evaluate((label) => {
    const card = document.querySelector(`section[aria-label="${label}"]`);
    if (!card) return null;
    const cs = (el) => {
      const s = getComputedStyle(el);
      return {
        bg: s.backgroundColor, color: s.color, pad: s.padding,
        fs: s.fontSize, fw: s.fontWeight, ta: s.textAlign,
        bb: `${s.borderBottomWidth} ${s.borderBottomStyle} ${s.borderBottomColor}`,
        bt: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
        br: s.borderRadius,
      };
    };
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { t: +r.top.toFixed(1), l: +r.left.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), b: +r.bottom.toFixed(1) };
    };
    const title = card.querySelector(":scope > .mp-paneltitle");
    const body = title ? title.nextElementSibling : null;
    const stub = card.querySelector(".sm-stub-home");
    const scr = card.querySelector(":scope > :not(.mp-paneltitle)");
    return {
      found: !!card,
      hasTitle: !!title,
      titleText: title ? title.textContent.trim() : null,
      hasStub: !!stub,
      card: rect(card), title: title ? rect(title) : null,
      body: body ? rect(body) : null,
      cardBorder: getComputedStyle(card).borderTopWidth,
      cardRadius: getComputedStyle(card).borderRadius,
      titleStyle: title ? cs(title) : null,
      firstChildIsTitle: !!title && card.firstElementChild === title,
      secondChild: scr ? (scr.className || scr.tagName) : null,
    };
  }, ariaLabel);
}

function checkStructure(name, info, refStyle) {
  const errs = [];
  if (!info) { failures.push(`${name}: карточка не найдена`); return errs; }
  if (!info.hasTitle) errs.push("нет .mp-paneltitle как прямого потомка");
  if (!info.firstChildIsTitle) errs.push(".mp-paneltitle НЕ первый элемент карточки");
  if (info.hasStub) errs.push("внутри осталась плашка .sm-stub-home");
  if (info.title && info.card) {
    const topGap = +(info.title.t - info.card.t - parseFloat(info.cardBorder)).toFixed(1);
    if (Math.abs(topGap) > EPS) errs.push(`зазор сверху шапки ${topGap}px (эталон 0)`);
    const sideL = +(info.title.l - info.card.l - parseFloat(info.cardBorder)).toFixed(1);
    if (Math.abs(sideL) > EPS) errs.push(`шапка не прилегает слева (${sideGap(sideL)}px)`);
    const widthDiff = +(info.card.w - 2 * parseFloat(info.cardBorder) - info.title.w).toFixed(1);
    if (Math.abs(widthDiff) > EPS) errs.push(`шапка не на всю ширину карточки (diff ${widthDiff}px)`);
  }
  if (info.titleStyle && refStyle) {
    for (const k of ["bg", "color", "pad", "fs", "fw", "bb"]) {
      if (String(info.titleStyle[k]) !== String(refStyle[k])) {
        errs.push(`стиль шапки ${k}: ${info.titleStyle[k]} ≠ эталон ${refStyle[k]}`);
      }
    }
  }
  return errs;
}
function sideGap(v) { return v; }

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  // ---------- /weather.php ----------
  await page.goto(BASE + "/weather.php", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1800);

  const refWeather = await page.evaluate(() => {
    const t = document.querySelector('section[aria-label="Температура по районам Сахалина и Курил"] > .mp-paneltitle');
    if (!t) return null;
    const s = getComputedStyle(t);
    return { bg: s.backgroundColor, color: s.color, pad: s.padding, fs: s.fontSize, fw: s.fontWeight, bb: `${s.borderBottomWidth} ${s.borderBottomStyle} ${s.borderBottomColor}` };
  });

  const wCard = await cardInfo(page, "Погода в Южно-Сахалинске");
  const wErrs = checkStructure("weather:Погода", wCard, refWeather);
  console.log(`weather.php «Погода»: title="${wCard?.titleText}" stub=${wCard?.hasStub} firstChild=${wCard?.firstChildIsTitle} secondChild=${wCard?.secondChild}`);
  if (wErrs.length) { wErrs.forEach((e) => console.log(`  FAIL ${e}`)); failures.push(...wErrs); }
  else console.log("  OK — шапка = верхняя часть карточки, стили = эталону «Температура по районам»");

  // Инвентаризация всех карточек страницы
  const wInv = await page.evaluate(() =>
    [...document.querySelectorAll(".center-column section.mp-panel")].map((c) => {
      const t = c.querySelector(":scope > .mp-paneltitle");
      return `${t ? t.textContent.trim().slice(0, 36) : "(без шапки)"} | firstChild=${c.firstElementChild === t} stub=${!!c.querySelector(".sm-stub-home")}`;
    })
  );
  console.log("  Карточки /weather.php:"); wInv.forEach((l) => console.log("   · " + l));

  // ---------- /disconnections.php ----------
  await page.goto(BASE + "/disconnections.php", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);

  const refDis = await page.evaluate(() => {
    const t = document.querySelector('section[aria-label="⚡ Электроэнергия (Сахалинэнерго)"] > .mp-paneltitle');
    if (!t) return null;
    const s = getComputedStyle(t);
    return { bg: s.backgroundColor, color: s.color, pad: s.padding, fs: s.fontSize, fw: s.fontWeight, bb: `${s.borderBottomWidth} ${s.borderBottomStyle} ${s.borderBottomColor}` };
  });

  const dCard = await cardInfo(page, "Отключения и районный фильтр");
  const dErrs = checkStructure("disconnections:Отключения", dCard, refDis);
  console.log(`disconnections.php «Отключения»: title="${dCard?.titleText}" stub=${dCard?.hasStub} firstChild=${dCard?.firstChildIsTitle} secondChild=${dCard?.secondChild}`);
  if (dErrs.length) { dErrs.forEach((e) => console.log(`  FAIL ${e}`)); failures.push(...dErrs); }
  else console.log("  OK — шапка = верхняя часть карточки, стили = эталону «Электроэнергия (Сахалинэнерго)»");

  // Клик по району «Корсаков»: структура цела, содержимое обновилось
  const chips = page.locator(".dis-chip");
  const chipsCount = await chips.count();
  const listBefore = await page.evaluate(() => document.querySelectorAll(".dis-list .dis-item").length);
  await page.locator('.dis-chip', { hasText: "Корсаков" }).click();
  await page.waitForTimeout(400);
  const afterClick = await page.evaluate(() => {
    const card = document.querySelector('section[aria-label="Отключения и районный фильтр"]');
    const title = card?.querySelector(":scope > .mp-paneltitle");
    const cr = card?.getBoundingClientRect(); const tr = title?.getBoundingClientRect();
    const border = card ? parseFloat(getComputedStyle(card).borderTopWidth) : 0;
    const emptyTexts = [...document.querySelectorAll(".dis-empty")].map((e) => e.textContent.trim());
    return {
      chipsRow: !!card?.querySelector(".dis-filters"),
      chipCount: card?.querySelectorAll(".dis-chip").length,
      activePressed: document.querySelector('.dis-chip[aria-pressed="true"]')?.textContent ?? null,
      listItems: document.querySelectorAll(".dis-list .dis-item").length,
      emptyTexts,
      topGap: tr && cr ? +(tr.top - cr.top - border).toFixed(1) : null,
      headerText: title?.textContent.trim() ?? null,
    };
  });
  console.log(`  Клик «Корсаков» (чипов: ${chipsCount}, было записей: ${listBefore} → стало: ${afterClick.listItems}, пустых-блоков: ${afterClick.emptyTexts.length}${afterClick.emptyTexts.length ? ` «${afterClick.emptyTexts[0]}»` : ""})`);
  const clickOk =
    afterClick.chipsRow &&
    afterClick.chipCount === chipsCount &&
    afterClick.activePressed === "Корсаков" &&
    afterClick.topGap !== null && Math.abs(afterClick.topGap) <= EPS &&
    (afterClick.listItems !== listBefore || afterClick.emptyTexts.length > 0);
  if (!clickOk) { failures.push("disconnections: клик по району сломал структуру или фильтр"); console.log("  FAIL — структура/фильтр после клика некорректны"); }
  else console.log("  OK — содержимое обновилось, структура «шапка + тело» прежняя (зазор шапки " + afterClick.topGap + "px)");
  // Возврат к «Все районы»
  await page.locator('.dis-chip', { hasText: "Все районы" }).click();
  await page.waitForTimeout(300);

  const dInv = await page.evaluate(() =>
    [...document.querySelectorAll(".center-column section.mp-panel")].map((c) => {
      const t = c.querySelector(":scope > .mp-paneltitle");
      return `${t ? t.textContent.trim().slice(0, 36) : "(без шапки)"} | firstChild=${c.firstElementChild === t} stub=${!!c.querySelector(".sm-stub-home")}`;
    })
  );
  console.log("  Карточки /disconnections.php:"); dInv.forEach((l) => console.log("   · " + l));

  await browser.close();
  console.log("\n================ ИТОГ ================");
  if (failures.length === 0) console.log("ПЛАШКИ «ПОГОДА» И «ОТКЛЮЧЕНИЯ» — ВЕРХНИЕ ЧАСТИ КАРТОЧЕК, СТРУКТУРА = ЭТАЛОНУ");
  else { console.log("ПРОВАЛЫ:\n - " + failures.join("\n - ")); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
