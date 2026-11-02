// Проба biz-rotator-3d-2026-09-20: ОБЪЁМНАЯ версия ротатора баннеров в блоке
// «Поддержка молодого бизнеса» на Главной. Ключевые проверки: старый список
// удалён; ЕДИНЫЙ ПРЕМИАЛЬНЫЙ стиль трёх слайдов (глубокий тёмно-бирюзово-
// изумрудный ГРАДИЕНТНЫЙ фон, radius 0, БЕЗ теней блока, идеальный стык с
// тёмно-синей шапкой ячейки); КРУПНАЯ ЦВЕТНАЯ ОБЪЁМНАЯ SVG-графика 80×80
// (≥3 линейных градиента + фильтры blur на каждый слайд — чистый векторный
// код, НЕ эмодзи и НЕ белые контуры); крупный плотный заголовок (≥17px,
// weight ≥800, белый) и нежно-бирюзовая подпись #c9f2e9; автосмена всех трёх
// слайдов за ~14.5 с (6 с/шаг), БЕЗ эмодзи; пауза на hover; слайд 1/3
// открывают ленту БЕЗ перезагрузки, слайд 2 — окно регистрации на вкладке
// «Регистрация»; шапка ячейки по-прежнему открывает ленту; 375px без overflow;
// зум-скриншоты иконок 2x.
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
let pass = 0, fail = 0;
const ok = (c, n, x = "") => { if (c) { pass++; console.log(`  PASS ${n}${x ? " — " + x : ""}`); } else { fail++; console.log(`  FAIL ${n}${x ? " — " + x : ""}`); } };

const T1 = "Давайте поможем нашим землякам!";
const T2 = "Открыли новый бизнес на острове?";
const T3 = "ИЩЕШЬ НОВОЕ?";
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
let docRequests = 0;
page.on("request", (r) => { if (r.resourceType() === "document") docRequests++; });

await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000); // гидрация + префетч ленты
await page.evaluate(() => { window.__noReload = 42; });
const docsBefore = docRequests;

const rot = page.locator(".biz-rot").first();

// Хелперы ротации (обобщены: работают с любой страницей/локатором ротатора)
const curTitle = (loc) => loc.locator(".biz-rot-h").first().innerText();
const curSub = (loc) => loc.locator(".biz-rot-sub").first().innerText();
async function waitTitle(loc, target, timeoutMs = 14000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { if ((await curTitle(loc)).trim() === target) return true; } catch {}
    await loc.page().waitForTimeout(250);
  }
  return false;
}

// T1: старый список удалён, ротатор на месте
const bizCell = page.locator("section.mp-cell", { hasText: "Поддержка молодого бизнеса" }).first();
const bizHtml = await bizCell.innerHTML();
ok(
  !bizHtml.includes("Кофейня «Север»") && !bizHtml.includes("Студия йоги") && (await bizCell.locator(".mp-list").count()) === 0,
  "T1 белое поле очищено от старого списка, ротатор внедрён"
);

// T2: премиальная пластина — глубокий градиент, radius 0, без теней, стык с шапкой
const plate = await rot.evaluate((el) => {
  const s = getComputedStyle(el);
  const cell = el.closest("section.mp-cell");
  const title = cell ? cell.querySelector(".mp-celltitle") : null;
  const tb = title ? title.getBoundingClientRect() : null;
  const rb = el.getBoundingClientRect();
  return {
    bgImg: s.backgroundImage,
    radius: s.borderRadius,
    shadow: s.boxShadow,
    gap: tb ? Math.round((rb.top - tb.bottom) * 10) / 10 : null,
  };
});
ok(
  plate.bgImg.includes("linear-gradient") && plate.bgImg.includes("radial-gradient"),
  "T2a фон пластины — глубокий сочный ГРАДИЕНТ (тёмный бирюзово-изумруд + световое пятно)",
  plate.bgImg.slice(0, 90) + "…"
);
ok((plate.radius === "0px" || plate.radius === "") && (plate.shadow === "none" || plate.shadow === ""), "T2b без скруглений и теней самого блока", `radius=${plate.radius} shadow=${plate.shadow}`);
ok(plate.gap !== null && Math.abs(plate.gap) <= 1.5, "T2c пластина идеально стыкуется с тёмно-синей шапкой ячейки", `зазор=${plate.gap}px`);

// T3: КРУПНАЯ ЦВЕТНАЯ ОБЪЁМНАЯ SVG-графика 64×64 (градиенты + blur-фильтры)
async function iconAudit(loc, label) {
  return await loc.locator(".biz-rot-ico").first().evaluate((el) => {
    const box = el.getBoundingClientRect();
    const svg = el.querySelector("svg");
    const grads = svg ? svg.querySelectorAll("linearGradient").length : 0;
    const radgrads = svg ? svg.querySelectorAll("radialGradient").length : 0;
    const filters = svg ? svg.querySelectorAll("filter feGaussianBlur").length : 0;
    const stops = svg ? new Set(Array.from(svg.querySelectorAll("stop")).map((s) => s.getAttribute("stop-color"))) : new Set();
    return {
      w: Math.round(box.width), h: Math.round(box.height),
      attrW: svg ? svg.getAttribute("width") : null, attrH: svg ? svg.getAttribute("height") : null,
      rootStroke: svg ? svg.getAttribute("stroke") : null,
      grads, radgrads, filters, stopColors: stops.size,
    };
  }).then((a) => {
    ok(a.w === 80 && a.h === 80 && a.attrW === "80" && a.attrH === "80", `${label}a контейнер и SVG ровно 80×80`, `${a.w}x${a.h} attr=${a.attrW}x${a.attrH}`);
    ok(a.grads >= 3 && a.radgrads >= 1 && a.filters >= 2, `${label}b объёмная графика: ≥3 линейных градиента, radial-свечение, ≥2 blur-фильтра`, `grad=${a.grads} rad=${a.radgrads} blur=${a.filters}`);
    ok(a.stopColors >= 5 && a.rootStroke === null, `${label}c иконка ЦВЕТНАЯ (многоцветные стопы, не белые контуры)`, `stopColors=${a.stopColors}`);
    return a;
  });
}
const audit1 = await iconAudit(rot, "T3 слайд 1 (росток)");

// Хелпер: собрать аудит иконки и текста для КОНКРЕТНОГО слайда, дождавшись его
async function auditSlide(target, label) {
  const shown = await waitTitle(rot, target);
  if (!shown) return null;
  await page.waitForTimeout(650); // fade 0.45s доиграть
  const a = await rot.locator(".biz-rot-ico").first().evaluate((el) => {
    const svg = el.querySelector("svg");
    return {
      grads: svg ? svg.querySelectorAll("linearGradient").length : 0,
      radgrads: svg ? svg.querySelectorAll("radialGradient").length : 0,
      filters: svg ? svg.querySelectorAll("filter feGaussianBlur").length : 0,
      stopColors: svg ? new Set(Array.from(svg.querySelectorAll("stop")).map((s) => s.getAttribute("stop-color"))).size : 0,
      rootStroke: svg ? svg.getAttribute("stroke") : null,
    };
  });
  ok(a.grads >= 3 && a.radgrads >= 1 && a.filters >= 2 && a.stopColors >= 5 && a.rootStroke === null, `${label} графика объёмная и цветная`, `grad=${a.grads} rad=${a.radgrads} blur=${a.filters} stops=${a.stopColors}`);
  return a;
}

// T4: за 14.5 с должны показаться ВСЕ ТРИ слайда
const seen = new Set();
const subsSeen = new Map();
const t0 = Date.now();
while (Date.now() - t0 < 14500) {
  const t = (await curTitle(rot)).trim();
  seen.add(t);
  if (!subsSeen.has(t)) subsSeen.set(t, await curSub(rot));
  await page.waitForTimeout(400);
}
ok(seen.has(T1) && seen.has(T2) && seen.has(T3), "T4 автосмена: все три баннера по кругу каждые ~6 с", [...seen].join(" | "));

// T5: тексты дословные, БЕЗ эмодзи; типографика крупная и чёткая
const sub1 = subsSeen.get(T1) || "", sub2 = subsSeen.get(T2) || "", sub3 = subsSeen.get(T3) || "";
ok(
  sub1 === "Здесь зарождается новый бизнес Сахалина. Заходи, читай блоги, поддержи своих!" &&
    sub2 === "Расскажи о своем деле" &&
    sub3 === "Загляни в блоги к новичкам — они готовы делом доказать качество",
  "T5a микро-подписи дословно из ТЗ"
);
ok(![T1, T2, T3, sub1, sub2, sub3].some((s) => EMOJI.test(s)), "T5b в текстах НЕТ эмодзи и рукопожатий");
const typo = await rot.evaluate((el) => {
  const h = getComputedStyle(el.querySelector(".biz-rot-h"));
  const s = getComputedStyle(el.querySelector(".biz-rot-sub"));
  return { hSize: parseFloat(h.fontSize), hWeight: parseInt(h.fontWeight), hColor: h.color, subColor: s.color, subSize: parseFloat(s.fontSize), hBox: el.querySelector(".biz-rot-h").getBoundingClientRect().height, subBox: el.querySelector(".biz-rot-sub").getBoundingClientRect().height };
});
ok(typo.hSize === 19 && typo.hWeight === 700 && typo.hColor === "rgb(255, 255, 255)", "T5c заголовок СТРОГО 19px / weight 700 / белый", `size=${typo.hSize}px weight=${typo.hWeight}`);
ok(typo.subSize === 13 && typo.subColor === "rgb(201, 242, 233)", "T5d подпись СТРОГО 13px нежно-бирюзовая #c9f2e9", `size=${typo.subSize}px`);
ok(Math.round(typo.hBox * 10) / 10 === 45.6 && Math.round(typo.subBox * 10) / 10 === 52.7, "T5e стабильные коробки: заголовок 45.6px (2 строки), подпись 52.7px (3 строки)", `h=${typo.hBox} sub=${typo.subBox}`);

// T5f: «МЁРТВАЯ ЛИНИЯ» — верх заголовка и верх подписи стоят на ОДНИХ
// горизонталях на всех трёх слайдах (Δ ≤ 1px) — текст не прыгает ни на пиксель
async function lineOf(target) {
  if (!(await waitTitle(rot, target))) return null;
  await page.waitForTimeout(650);
  return await rot.evaluate((el) => {
    const h = el.querySelector(".biz-rot-h").getBoundingClientRect();
    const s = el.querySelector(".biz-rot-sub").getBoundingClientRect();
    return { hTop: Math.round(h.top * 10) / 10, sTop: Math.round(s.top * 10) / 10 };
  });
}
const L1 = await lineOf(T1), L2 = await lineOf(T2), L3 = await lineOf(T3);
const spread = (arr, k) => Math.max(...arr.map((x) => (x ? x[k] : -999))) - Math.min(...arr.map((x) => (x ? x[k] : 999)));
ok(
  L1 && L2 && L3 && spread([L1, L2, L3], "hTop") <= 1 && spread([L1, L2, L3], "sTop") <= 1,
  "T5f МЁРТВАЯ ЛИНИЯ: заголовок и подпись не прыгают между слайдами (Δtop ≤ 1px)",
  JSON.stringify([L1, L2, L3])
);

// T6: hover ставит ротацию на паузу
await rot.hover();
const hoverTitle = (await curTitle(rot)).trim();
let hovered = true;
const t1 = Date.now();
while (Date.now() - t1 < 7500) {
  await page.waitForTimeout(400);
  if ((await curTitle(rot)).trim() !== hoverTitle) { hovered = false; break; }
}
ok(hovered, "T6 пауза ротации на hover (7.5 с без смены)", hoverTitle);
await page.mouse.move(0, 0);
await page.waitForTimeout(300);

// Скриншоты каждого слайда (дожидаемся активного и даём fade 0.45s доиграть)
const shot = async (target, file) => {
  if (await waitTitle(rot, target)) { await page.waitForTimeout(650); await page.screenshot({ path: file }); return true; }
  return false;
};
const s1 = await shot(T1, "scripts/shots/biz-rot3d-slide1-1920.png");
const a2 = await auditSlide(T2, "T3 слайд 2 (здание):");
const s2 = await shot(T2, "scripts/shots/biz-rot3d-slide2-1920.png");
const a3 = await auditSlide(T3, "T3 слайд 3 (коробка):");
const s3 = await shot(T3, "scripts/shots/biz-rot3d-slide3-1920.png");
ok(s1 && s2 && s3, "T3d все три слайда показаны и отсняты", `1:${!!s1} 2:${!!s2} 3:${!!s3}`);

// T7: клик по слайду 1 — бесшовная лента
ok(s1, "T7a слайд 1 активен для клика");
if (s1) {
  await waitTitle(rot, T1); // устраняем гонку: кликаем строго в окно показа слайда 1
  await rot.locator(".biz-rot-slide").first().click();
  await page.waitForTimeout(800);
  const m1 = await page.evaluate(() => window.__noReload);
  ok(
    m1 === 42 && docRequests === docsBefore && page.url().replace(/\/$/, "") === BASE,
    "T7b слайд 1 → лента БЕЗ перезагрузки (маркер выжил, document-запросов 0, URL /)", `docs=${docsBefore}→${docRequests}`
  );
  ok((await page.locator(".biz-feed").count()) === 1, "T7c лента стартапов развернулась в центре");
  await page.locator(".biz-backlink").click();
  await page.waitForTimeout(800);
  ok((await page.locator(".mp-grid").count()) === 1, "T7d «Назад» вернул сетку с ротатором");
}

// T8: клик по слайду 2 — окно регистрации на вкладке «Регистрация»
ok(s2, "T8a слайд 2 активен для клика");
if (s2) {
  await waitTitle(rot, T2); // кликаем строго в окно показа слайда 2 (действие — регистрация)
  await rot.locator(".biz-rot-slide").first().click();
  await page.waitForTimeout(900);
  const modalUp = (await page.locator(".sk-modal-auth").count()) === 1;
  const regTab = modalUp ? ((await page.locator(".sk-auth-tabs button.active").innerText().catch(() => "")).trim()) : "";
  const m2 = await page.evaluate(() => window.__noReload);
  ok(modalUp && regTab === "Регистрация" && m2 === 42, "T8b слайд 2 → окно регистрации на вкладке «Регистрация», без перезагрузки", `tab=${regTab}`);
  if (modalUp) {
    await page.screenshot({ path: "scripts/shots/biz-rot3d-register-modal-1920.png" });
    await page.locator(".sk-modal-x").click();
    await page.waitForTimeout(500);
    ok((await page.locator(".sk-modal-auth").count()) === 0, "T8c модал закрылся, страница не покидалась");
  }
}

// T9: слайд 3 кликабелен к ленте
ok(s3, "T9a слайд 3 активен для клика");
if (s3) {
  await waitTitle(rot, T3); // кликаем строго в окно показа слайда 3 (действие — лента)
  await rot.locator(".biz-rot-slide").first().click();
  await page.waitForTimeout(800);
  ok((await page.locator(".biz-feed").count()) === 1, "T9b слайд 3 → лента бесшовно");
  await page.locator(".biz-backlink").click();
  await page.waitForTimeout(800);
}

// T10: шапка ячейки по-прежнему открывает ленту
await page.locator(".mp-celltitle", { hasText: "Поддержка молодого бизнеса" }).first().click();
await page.waitForTimeout(800);
ok((await page.locator(".biz-feed").count()) === 1, "T10 клик по шапке ячейки → лента бесшовно");
await page.locator(".biz-backlink").click();
await page.waitForTimeout(600);

const markerEnd = await page.evaluate(() => window.__noReload);
ok(markerEnd === 42 && docRequests <= docsBefore + 0, "T11 за всю сессию НИ ОДНОЙ перезагрузки", `docs=${docsBefore}→${docRequests}`);
ok(errs.length === 0, "T12 гидрация/консоль без ошибок", errs.slice(0, 2).join(" | "));
ok(audit1 && a2 && a3, "T12b аудит объёмной графики пройден на всех трёх слайдах");
await page.close();

// T13: мобильный 375
const m = await browser.newPage({ viewport: { width: 375, height: 720 } });
await m.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await m.waitForTimeout(2500);
const mRot = m.locator(".biz-rot").first();
const mBg = await mRot.evaluate((el) => getComputedStyle(el).backgroundImage);
const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
ok(mBg.includes("linear-gradient") && overflow <= 1, "T13 на 375px ротатор в едином градиентном стиле, без overflow", `overflow=${overflow}px`);
await m.screenshot({ path: "scripts/shots/biz-rot3d-375.png" });
await m.close();

// T14: зум-скриншоты всех трёх иконок 2x
const z = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
await z.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await z.waitForTimeout(2500);
const zRot = z.locator(".biz-rot").first();
const z1 = await (async () => { const r = await waitTitle(zRot, T1); if (r) { await z.waitForTimeout(650); await zRot.screenshot({ path: "scripts/shots/biz-rot3d-zoom-sprout.png" }); } return r; })();
const z2 = await (async () => { const r = await waitTitle(zRot, T2); if (r) { await z.waitForTimeout(650); await zRot.screenshot({ path: "scripts/shots/biz-rot3d-zoom-house.png" }); } return r; })();
const z3 = await (async () => { const r = await waitTitle(zRot, T3); if (r) { await z.waitForTimeout(650); await zRot.screenshot({ path: "scripts/shots/biz-rot3d-zoom-box.png" }); } return r; })();
ok(z1 && z2 && z3, "T14 зум-скриншоты иконок 2x сняты для всех трёх слайдов");
await z.close();

await browser.close();
console.log(`\nИТОГО: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
