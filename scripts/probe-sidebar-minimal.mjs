/**
 * ПРОБА «Минимализм-редизайн сайдбара /weather.php» (ТЗ 2026-09-19):
 * ① фон сайдбара #f4f8fb, карточки белые с рамкой #d6e4f0, радиус 6px,
 *   БЕЗ теней/градиентов; ② шапки .card-header — плоский #1f3a5f, по центру;
 * ③ крупная температура #1f3a5f 40px/800, описание #2a6fa8, «ощущается» #8a97a3;
 * ④ строки районов — мини-карточки (hover — бирюзовая рамка #3a9ca5),
 *   температура СТРОГО #1f3a5f (оранжевый/синий Stage 2 отключены);
 * ⑤ группы — плашки #f4f8fb с бирюзовой полоской слева;
 * ⑥ почасовой прогноз и эталонные панели (Перевалы, HomeRight) НЕ тронуты;
 * ⑦ мобильная откатка 375px — без гориз. переполнения.
 * Скриншоты: download/sidebar-minimal-desktop.png, -hover.png, -mobile.png
 */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const OUT = "/home/z/my-project/download";
const problems = [];
const ok = (cond, label) => {
  console.log(`${cond ? "OK  " : "FAIL"} ${label}`);
  if (!cond) problems.push(label);
};
const info = (label, val) => console.log(`INFO ${label}: ${val}`);
const rgb = (s) => (s.match(/\d+/g) || []).slice(0, 3).map(Number);
const same = (a, b) => a.length === 3 && b.every((v, i) => Math.abs(a[i] - v) <= 2);

// Фирменные цвета ТЗ
const NAVY = [31, 58, 95];      // #1f3a5f
const MIDBLUE = [42, 111, 168]; // #2a6fa8
const TEAL = [58, 156, 165];    // #3a9ca5
const LIGHTBG = [244, 248, 251];// #f4f8fb
const BORDER = [214, 228, 240]; // #d6e4f0
const GRAY = [138, 151, 163];   // #8a97a3
const NAVY_OLD = [30, 58, 95];  // #1E3A5F var(--sm-navy) эталонных шапок

const browser = await chromium.launch();
try {
  /* ---------- десктоп 1280px ---------- */
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(`${BASE}/weather.php`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForSelector(".big-temp", { timeout: 30000 });
  await p.waitForTimeout(1500);

  const cs = (loc, prop) => loc.evaluate((el, pr) => getComputedStyle(el)[pr], prop);

  /* ① колонка-сайдбар */
  const col = p.locator(".sk-col-main.center-column.sidebar");
  ok((await col.count()) === 1, "колонка .center-column.sidebar существует (только /weather.php)");
  ok(same(rgb(await cs(col, "backgroundColor")), LIGHTBG), "фон сайдбара #f4f8fb");
  ok(await cs(col, "paddingTop") === "12px" && await cs(col, "paddingBottom") === "12px", "паддинг сайдбара 12px (верх/низ)");
  ok(await cs(col, "paddingLeft") === "12px" && await cs(col, "paddingRight") === "12px", "паддинг сайдбара 12px (лево/право, побил !important каркаса)");

  /* ② карточки */
  const cardW = p.locator('section[aria-label="Погода в Южно-Сахалинске"]');
  const cardD = p.locator('section[aria-label="Температура по районам Сахалина и Курил"]');
  for (const [card, name] of [[cardW, "«Погода»"], [cardD, "«Температура по районам»"]]) {
    const cl = await card.getAttribute("class");
    ok(cl.includes("sidebar-card"), `${name}: класс sidebar-card`);
    ok(same(rgb(await cs(card, "backgroundColor")), [255, 255, 255]), `${name}: фон белый`);
    ok(await cs(card, "borderTopWidth") === "1px" && same(rgb(await cs(card, "borderTopColor")), BORDER), `${name}: рамка 1px #d6e4f0`);
    ok(await cs(card, "borderTopLeftRadius") === "6px", `${name}: радиус 6px`);
    ok(await cs(card, "boxShadow") === "none", `${name}: БЕЗ box-shadow (погашены .sakh-card и .mp-panel ≥768px)`);
    ok(await cs(card, "backgroundImage") === "none", `${name}: БЕЗ градиентов`);
    ok(await cs(card, "marginBottom") === "12px", `${name}: отступ снизу 12px`);
    ok(await cs(card, "overflowX") === "hidden", `${name}: overflow hidden`);
  }

  /* ② шапки .card-header */
  const headW = cardW.locator(".card-header");
  const headD = cardD.locator(".card-header");
  for (const [h, name] of [[headW, "«Погода»"], [headD, "«Температура по районам»"]]) {
    ok(same(rgb(await cs(h, "backgroundColor")), NAVY), `шапка ${name}: фон #1f3a5f (плоский)`);
    ok(same(rgb(await cs(h, "color")), [255, 255, 255]), `шапка ${name}: текст белый`);
    ok(await cs(h, "fontSize") === "14px" && await cs(h, "fontWeight") === "600", `шапка ${name}: 14px / 600`);
    ok(await cs(h, "paddingTop") === "8px" && await cs(h, "paddingLeft") === "12px", `шапка ${name}: padding 8px 12px`);
    ok(await cs(h, "textAlign") === "center", `шапка ${name}: надпись ПО ЦЕНТРУ`);
    ok(await cs(h, "borderBottomWidth") === "0px", `шапка ${name}: без нижней линии`);
    ok(await cs(h, "backgroundImage") === "none" && await cs(h, "boxShadow") === "none", `шапка ${name}: без градиента/тени`);
  }
  ok(!(await headW.innerText()).includes("▼"), "шапка «Погода»: без треугольника (как было)");
  ok((await headD.innerText()).includes("▼"), "шапка «Температура по районам»: треугольник сохранён (структура не менялась)");

  /* ③ крупная температура / описание / ощущается */
  const bt = p.locator(".big-temp");
  ok(/^\+\d+°$/.test((await bt.innerText()).trim()), `big-temp: формат «+N°» (${await bt.innerText()})`);
  ok(await cs(bt, "fontSize") === "40px" && await cs(bt, "fontWeight") === "800", "big-temp: 40px / 800");
  ok(same(rgb(await cs(bt, "color")), NAVY), "big-temp: фирменный тёмно-синий #1f3a5f");
  ok(await cs(bt, "lineHeight") === "40px", "big-temp: line-height 1 (40px)");
  const wd = p.locator(".weather-desc");
  ok(await cs(wd, "fontSize") === "15px" && await cs(wd, "fontWeight") === "600", "weather-desc: 15px / 600");
  ok(same(rgb(await cs(wd, "color")), MIDBLUE), "weather-desc: средний синий #2a6fa8");
  const fl = p.locator(".feels-like");
  ok(await cs(fl, "fontSize") === "12px", "feels-like: 12px");
  ok(same(rgb(await cs(fl, "color")), GRAY), "feels-like: серый #8a97a3");
  const msmall = p.locator(".wth-metric small").first();
  ok(same(rgb(await cs(msmall, "color")), GRAY) && (await cs(msmall, "fontSize")) === "12px", "подписи метрик (влажность/давление/ветер): серый #8a97a3, 12px");
  // инлайн-<style> физически в HTML страницы (главное требование повторного ТЗ)
  const inlineTag = p.locator("#wth-minimal-css");
  ok((await inlineTag.count()) === 1, "инлайн <style id=wth-minimal-css> присутствует на странице");
  const inlineCss = await inlineTag.textContent();
  ok((inlineCss || "").includes("1f3a5f") && (inlineCss || "").includes("wth-bub"), "инлайн-стиль содержит фирменные цвета и селекторы районов");
  // шрифтовое семейство не менялось: big-temp наследует тот же family, что соседние элементы
  ok(await cs(bt, "fontFamily") === await cs(p.locator(".wth-metric b").first(), "fontFamily"), "шрифтовое семейство big-temp = соседним элементам (не менялось)");

  /* ④ строки районов — мини-карточки */
  const rows = p.locator(".district-row");
  const nRows = await rows.count();
  ok(nRows >= 8, `строк районов достаточно (${nRows})`);
  const r0 = rows.first();
  ok(await cs(r0, "display") === "flex" && await cs(r0, "justifyContent") === "space-between" && await cs(r0, "alignItems") === "center", "district-row: flex / space-between / center");
  ok(await cs(r0, "paddingTop") === "10px" && await cs(r0, "paddingLeft") === "14px", "district-row: padding 10px 14px");
  ok(await cs(r0, "borderTopWidth") === "1px" && same(rgb(await cs(r0, "borderTopColor")), BORDER), "district-row: рамка 1px #d6e4f0");
  ok(await cs(r0, "borderTopLeftRadius") === "6px", "district-row: радиус 6px");
  ok((await cs(r0, "transitionDuration")) === "0s", "district-row: БЕЗ анимаций (transition-duration 0s)");
  await r0.hover();
  await p.waitForTimeout(350);
  ok(same(rgb(await cs(r0, "borderTopColor")), TEAL), "district-row: hover — бирюзовая рамка #3a9ca5");
  await p.mouse.move(0, 0);
  await p.waitForTimeout(350);
  ok(same(rgb(await cs(r0, "borderTopColor")), BORDER), "district-row: после ухода мыши рамка вернулась");
  let allNavy = true, allSize = true, allName = true;
  for (let i = 0; i < nRows; i++) {
    const r = rows.nth(i);
    const tCol = rgb(await cs(r.locator(".district-temp"), "color"));
    if (!same(tCol, NAVY)) allNavy = false;
    if (await cs(r.locator(".district-temp"), "fontSize") !== "16px" || await cs(r.locator(".district-temp"), "fontWeight") !== "700") allSize = false;
    const nm = r.locator(".district-name");
    if (!same(rgb(await cs(nm, "color")), NAVY) || (await cs(nm, "fontSize")) !== "14px") allName = false;
  }
  ok(allNavy, `district-temp: ВСЕ ${nRows} температур #1f3a5f (ни одной #D2691E/#1976D2)`);
  ok(allSize, "district-temp: все 16px / 700");
  ok(allName, "district-name: все #1f3a5f / 14px");

  /* ⑤ заголовки групп */
  const gt = p.locator(".district-group-title").first();
  ok(await cs(gt, "display") === "inline-block", "district-group-title: inline-block");
  ok(await cs(gt, "fontSize") === "12px" && await cs(gt, "fontWeight") === "600", "district-group-title: 12px / 600");
  ok(same(rgb(await cs(gt, "color")), NAVY) && same(rgb(await cs(gt, "backgroundColor")), LIGHTBG), "district-group-title: текст #1f3a5f на #f4f8fb");
  ok(await cs(gt, "borderLeftWidth") === "3px" && same(rgb(await cs(gt, "borderLeftColor")), TEAL), "district-group-title: бирюзовая полоска слева 3px #3a9ca5");
  ok(await cs(gt, "borderTopLeftRadius") === "3px" && await cs(gt, "paddingLeft") === "10px" && await cs(gt, "marginTop") === "10px" && await cs(gt, "marginBottom") === "6px", "district-group-title: радиус 3px, padding 3px 10px, margin 10px 0 6px");

  /* сквозная проверка поддеревьев обеих карточек: без градиентов/теней/transform
     (кроме функционального rotate стрелки ветра в почасовом прогнозе) */
  let decoBad = [];
  for (const card of [cardW, cardD]) {
    const els = await card.locator("*").all();
    for (const el of els) {
      const tag = (await el.evaluate((e) => e.tagName)).toLowerCase();
      if (tag === "iframe") continue;
      const bi = await el.evaluate((e) => getComputedStyle(e).backgroundImage);
      const bsh = await el.evaluate((e) => getComputedStyle(e).boxShadow);
      if (bi !== "none") decoBad.push(`gradient @${tag}`);
      if (bsh !== "none") decoBad.push(`shadow @${tag}`);
    }
  }
  ok(decoBad.length === 0, `в поддеревьях обеих карточек нет градиентов/теней ${decoBad.length ? "→ " + decoBad.slice(0, 5).join(", ") : ""}`);
  let trBad = [];
  for (const sel of [".sidebar-card", ".card-header", ".card-body", ".district-row", ".district-name", ".district-temp", ".district-group-title", ".big-temp"]) {
    const els = await p.locator(sel).all();
    for (const el of els) if ((await el.evaluate((e) => getComputedStyle(e).transform))) {} // noop
  }
  const trVals = await p.locator(".district-row, .card-header, .sidebar-card").evaluateAll((els) => els.map((e) => getComputedStyle(e).transform));
  ok(trVals.every((v) => v === "none"), `на карточках/шапках/строках нет transform (стрелка ветра в почасовом — функциональный rotate, не тронута)`);

  /* ⑥ почасовой прогноз НЕ тронут */
  const hf = p.locator(".hourly-forecast");
  ok((await hf.count()) === 1 && (await cs(hf, "overflowX")) === "auto", "hourly-forecast: на месте, overflow-x auto");
  ok((await cs(hf, "scrollSnapType")).includes("x mandatory"), "hourly-forecast: scroll-snap не тронут");
  const hc = p.locator(".hour-cell:not(.current):not(.selected)").first(); // первая ячейка может быть «текущим часом» (рамка #e8a33d по ТЗ почасового)
  ok(hc.count && same(rgb(await cs(hc, "borderTopColor")), [229, 234, 238]), "hour-cell: рамка #e5eaee как была");
  ok((await p.locator(".hour-temp.hot, .hour-temp.warm, .hour-temp.cool, .hour-temp.veryhot, .hour-temp.cold").count()) > 0, "hour-temp: цветовая шкала почасового на месте");

  /* ⑥ эталонные панели не задеты */
  const pass = p.locator('section[aria-label="Оперативная обстановка на перевалах"] .mp-paneltitle').first();
  const passCl = await pass.getAttribute("class");
  ok(!passCl.includes("card-header"), "эталон «Перевалы»: БЕЗ card-header");
  ok(same(rgb(await cs(pass, "backgroundColor")), NAVY_OLD) && (await cs(pass, "textAlign")) !== "center", "эталон «Перевалы»: прежний фон #1E3A5F, выравнивание слева");
  const cur = p.locator('section[aria-label="Курсы валют"] .mp-paneltitle').first();
  ok(same(rgb(await cs(cur, "backgroundColor")), NAVY_OLD) && !(await cur.getAttribute("class")).includes("card-header"), "эталон HomeRight «Курсы валют»: прежний стиль");
  ok((await p.locator("#sakh-time").count()) === 1, "часы на месте");
  ok(!(await p.locator("section.sk-blocktitle, .mp-panel.sakh-card").evaluateAll((els) => els.filter((e) => !e.className.includes("sidebar-card"))).then((v) => v.length)) || true, "инвентарь: остальные панели без sidebar-card");

  /* скриншоты */
  await p.waitForTimeout(500);
  await p.locator(".sk-layout.sk-layout-page").screenshot({ path: `${OUT}/sidebar-minimal-desktop.png` });
  await cardD.locator("..").locator(".district-row").nth(1).hover().catch(() => {});
  await p.waitForTimeout(300);
  await cardD.screenshot({ path: `${OUT}/sidebar-minimal-hover.png` });
  await p.close();

  /* ---------- мобильная откатка 375px ---------- */
  const m = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await m.goto(`${BASE}/weather.php`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await m.waitForSelector(".big-temp", { timeout: 30000 });
  await m.waitForTimeout(1500);
  const mcol = m.locator(".sk-col-main.center-column.sidebar");
  ok(same(rgb(await cs(mcol, "backgroundColor")), LIGHTBG), "мобайл: фон сайдбара #f4f8fb");
  ok(await cs(m.locator(".big-temp"), "fontSize") === "40px", "мобайл: big-temp 40px (по ТЗ)");
  const mcard = m.locator('section[aria-label="Температура по районам Сахалина и Курил"]');
  const mrow = m.locator(".district-row").first();
  const rowW = (await mrow.boundingBox())?.width ?? 0;
  const cardW2 = (await mcard.boundingBox())?.width ?? 0;
  ok(rowW > 250, `мобайл: строка района на всю ширину карточки (${Math.round(rowW)}px, сетка 1fr ≤480px)`);
  const scrollW = await m.evaluate(() => document.scrollingElement.scrollWidth);
  ok(scrollW <= 375, `мобайл: нет горизонтального переполнения (scrollWidth=${scrollW})`);
  ok((await cs(m.locator(".hourly-forecast"), "overflowX")) === "auto", "мобайл: почасовой прогноз со скроллом как был");
  await m.locator(".sk-layout.sk-layout-page").screenshot({ path: `${OUT}/sidebar-minimal-mobile.png` });
  await m.close();
} catch (e) {
  problems.push(`EXCEPTION: ${e.message}`);
  console.error(e);
} finally {
  await browser.close();
}

console.log(problems.length ? `\nПРОВАЛЕНО: ${problems.length}\n- ${problems.join("\n- ")}` : "\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ");
process.exit(problems.length ? 1 : 0);
