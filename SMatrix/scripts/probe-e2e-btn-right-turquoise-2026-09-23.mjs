/**
 * Проба 2026-09-23 (ред. 2): указ заказчика «кнопки расположить РЯДОМ,
 * в одну линию, в правой части карточки, как на форуме».
 *
 * Проверяет на /gde-kupit (сценарии 1,2,3,7) и /gde-deshevle (4,5,6):
 *   1) под КАЖДЫМ сценарием СТРОГО ДВЕ кнопки: [📍 Ответить на запрос]
 *      (data-e2e-answerbtn) и [💬 Обсудить на форуме] (data-e2e-btn);
 *   2) кнопки стоят РЯДОМ в ОДНОЙ строке: зазор между правым краем
 *      «Ответить» и левым краем «Обсудить» = gap 10px (допуск ≤14px),
 *      разница верхних кромок ≤4px;
 *   3) пара прижата К ПРАВОМУ краю карточки: правый край «Обсудить»
 *      ≈ правый край карточки (допуск = padding 12px + 2px);
 *   4) «Ответить на запрос» — СИНЯЯ #0a5caa (форумская, как
 *      .sk-btn-reply), «Обсудить на форуме» — БИРЮЗОВАЯ #0d9488
 *      (не старый синий);
 *   5) href относительный (/forum/topic/…), 0 localhost;
 *   6) мобайл 375: пара в одной строке, справа, без горскролла;
 *   7) консоль без ошибок.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
let ok = 0, fail = 0;
const errors = [];
function check(name, cond, extra = "") {
  if (cond) { ok++; console.log(`  OK   ${name}${extra ? " — " + extra : ""}`); }
  else { fail++; errors.push(name); console.log(`  FAIL ${name}${extra ? " — " + extra : ""}`); }
}
const TURQ = "rgb(13, 148, 136)";
const FORUM_BLUE = "rgb(10, 92, 170)";

async function auditPage(page, variant, expectedNums) {
  console.log(`\n=== Блок ${variant} (сценарии ${expectedNums.join(",")}) ===`);
  await page.goto(`${BASE}/${variant === "wtb" ? "gde-kupit" : "gde-deshevle"}`, { waitUntil: "networkidle" });
  await page.waitForSelector(`[data-e2e-panel="${variant}"]`, { timeout: 30000 });

  const nums = await page.$$eval(`[data-e2e-panel="${variant}"] [data-e2e-scenario]`,
    els => els.map(e => Number(e.getAttribute("data-e2e-scenario"))));
  check(`${variant}: ровно сценарии ${expectedNums.join(",")}`,
    JSON.stringify(nums) === JSON.stringify(expectedNums), `получено ${nums.join(",")}`);

  for (const n of expectedNums) {
    const card = await page.$(`[data-e2e-panel="${variant}"] [data-e2e-scenario="${n}"]`);
    if (!card) { check(`${variant} сц.${n}: карточка найдена`, false); continue; }

    const forum = await card.$(`[data-e2e-btn="${n}"]`);
    const ans = await card.$(`[data-e2e-answerbtn="${n}"]`);
    check(`${variant} сц.${n}: обе кнопки на месте`, !!forum && !!ans, `forum=${!!forum} ans=${!!ans}`);
    if (!forum || !ans) continue;

    // Метки кнопок
    const fLabel = ((await forum.textContent()) || "").trim();
    const aLabel = ((await ans.textContent()) || "").trim();
    check(`${variant} сц.${n}: метка «💬 Обсудить на форуме»`, fLabel === "💬 Обсудить на форуме", fLabel);
    check(`${variant} сц.${n}: метка «📍 Ответить»`, aLabel === "📍 Ответить", aLabel);

    // Цвета: форумская бирюзовая, «Ответить» — синяя форумская
    const fBg = await forum.evaluate(el => getComputedStyle(el).backgroundColor);
    const aBg = await ans.evaluate(el => getComputedStyle(el).backgroundColor);
    check(`${variant} сц.${n}: «Обсудить» бирюзовая #0d9488`, fBg === TURQ, fBg);
    check(`${variant} сц.${n}: «Ответить» синяя #0a5caa`, aBg === FORUM_BLUE, aBg);

    // Геометрия пары: рядом, в одной строке, у правого края
    const geo = await card.evaluate((el, num) => {
      const f = el.querySelector(`[data-e2e-btn="${num}"]`);
      const a = el.querySelector(`[data-e2e-answerbtn="${num}"]`);
      const fb = f.getBoundingClientRect(), ab = a.getBoundingClientRect();
      const cb = el.getBoundingClientRect();
      return {
        gap: fb.left - ab.right,          // зазор между кнопками
        dy: Math.abs(fb.top - ab.top),    // одна строка?
        fRightDelta: cb.right - fb.right, // прижатие пары к правому краю
        fLeft: fb.left, cardMid: cb.left + cb.width / 2, cardLeft: cb.left,
      };
    }, n);
    check(`${variant} сц.${n}: кнопки РЯДОМ (gap 0…14px)`,
      geo.gap >= 0 && geo.gap <= 14, `gap=${geo.gap.toFixed(1)}px`);
    check(`${variant} сц.${n}: кнопки в ОДНОЙ строке (dy≤4px)`,
      geo.dy <= 4, `dy=${geo.dy.toFixed(1)}px`);
    check(`${variant} сц.${n}: пара у ПРАВОГО края (Δ≤14px)`,
      geo.fRightDelta <= 14, `Δ=${geo.fRightDelta.toFixed(1)}px`);
    check(`${variant} сц.${n}: «Обсудить» правее центра карточки`,
      geo.fLeft > geo.cardMid, `left=${(geo.fLeft - geo.cardLeft).toFixed(0)}px из ${((geo.cardMid - geo.cardLeft) * 2).toFixed(0)}px`);

    const href = await forum.getAttribute("href");
    check(`${variant} сц.${n}: href относительный /forum/topic/`, !!href && href.startsWith("/forum/topic/"), (href || "").slice(0, 60));
    check(`${variant} сц.${n}: prefilled_text в href`, !!href && href.includes("prefilled_text="));
  }
  // 0 localhost на всей странице
  const locals = await page.$$eval("a", as => as.filter(a => (a.getAttribute("href") || "").includes("localhost")).length);
  check(`${variant}: 0 ссылок localhost`, locals === 0, `${locals}`);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", e => consoleErrors.push(String(e)));

  await auditPage(page, "wtb", [1, 2, 3, 7]);
  await auditPage(page, "cheap", [4, 5, 6]);

  // Мобайл 375
  console.log("\n=== Мобайл 375 ===");
  const mp = await browser.newPage({ viewport: { width: 375, height: 720 } });
  await mp.goto(`${BASE}/gde-kupit`, { waitUntil: "networkidle" });
  await mp.waitForSelector('[data-e2e-panel="wtb"]', { timeout: 30000 });
  const sw = await mp.evaluate(() => document.documentElement.scrollWidth);
  check("мобайл 375: без горизонтального скролла", sw <= 375, `scrollWidth=${sw}`);
  const mpair = await mp.$eval('[data-e2e-panel="wtb"] [data-e2e-scenario="1"]', el => {
    const f = el.querySelector('[data-e2e-btn="1"]').getBoundingClientRect();
    const a = el.querySelector('[data-e2e-answerbtn="1"]').getBoundingClientRect();
    const cb = el.getBoundingClientRect();
    return { gap: f.left - a.right, dy: Math.abs(f.top - a.top), fRightDelta: cb.right - f.right, aBg: getComputedStyle(el.querySelector('[data-e2e-answerbtn="1"]')).backgroundColor };
  });
  check("мобайл 375: пара кнопок РЯДОМ в одной строке",
    mpair.gap >= 0 && mpair.gap <= 14 && mpair.dy <= 4, `gap=${mpair.gap.toFixed(1)} dy=${mpair.dy.toFixed(1)}`);
  check("мобайл 375: пара у правого края", mpair.fRightDelta <= 14, `Δ=${mpair.fRightDelta.toFixed(1)}px`);
  check("мобайл 375: «Ответить» синяя", mpair.aBg === FORUM_BLUE, mpair.aBg);

  check("консоль без ошибок", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}
console.log(`\nИТОГ: ${ok} OK / ${fail} FAIL`);
if (fail > 0) { console.log("FAILS: " + errors.join(" ; ")); process.exit(1); }
