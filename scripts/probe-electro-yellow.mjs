// Проба ТЗ 2026-09-21 «блок электроэнергия: между строками окрась в
// нежно-жёлтый»: фон .dis-list блока «⚡ Электроэнергия (Сахалинэнерго)»
// = #FFF8E1, соседние блоки не задеты. /disconnections.php.
// Запуск: node scripts/probe-electro-yellow.mjs [префикс-скриншотов]
import { chromium } from "playwright";

const PREFIX = process.argv[2] || "electro-y";
const OUT = "/home/z/my-project/scripts/shots/";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:3000/disconnections.php", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('section[aria-label*="Электроэнергия"] .dis-list', { timeout: 45000 });
await page.waitForTimeout(1200);

const d = await page.evaluate(() => {
  const grab = (aria) => {
    const sec = document.querySelector(`section[aria-label="${aria}"]`);
    if (!sec) return { found: false };
    const list = sec.querySelector(".dis-list");
    if (!list) return { found: true, list: "NO-LIST (пусто)" };
    return {
      found: true,
      listBg: getComputedStyle(list).backgroundColor,
      rows: list.querySelectorAll(".dis-item").length,
      secBg: getComputedStyle(sec.querySelector(".mp-paneltitle")).backgroundColor,
    };
  };
  return {
    electro: grab("⚡ Электроэнергия (Сахалинэнерго)"),
    hot: grab("🔥 Горячая вода (СКК)") || grab("Горячая вода (СКК)"),
    cold: grab("💧 Холодная вода (РВК-Сахалин)") || grab("Холодная вода (РВК-Сахалин)"),
    selectorWithEmoji: !!document.querySelector('section.mp-panel[aria-label="⚡ Электроэнергия (Сахалинэнерго)"] .dis-list'),
  };
});
console.log("ELECTRO YELLOW DESKTOP:", JSON.stringify(d, null, 2));
console.log("EMOJI SELECTOR MATCHES:", d.selectorWithEmoji);

// ВСЕ .dis-list на странице: жёлтый должен быть ТОЛЬКО у электроэнергии
const allLists = await page.evaluate(() =>
  [...document.querySelectorAll(".dis-list")].map((l) => ({
    sec: l.closest("section")?.getAttribute("aria-label") || "?",
    bg: getComputedStyle(l).backgroundColor,
    rows: l.querySelectorAll(".dis-item").length,
  }))
);
console.log("ALL DIS-LISTS:", JSON.stringify(allLists, null, 2));

// СИНТЕТИКА: в блоке сейчас 0 строк (в песочнице нет свежих сводок
// электроэнергии) — вставляем 3 демо-.dis-item, чтобы показать
// жёлтые зазоры между строками; в DOM страницы не сохраняется
await page.evaluate(() => {
  const list = document.querySelector('section[aria-label*="Электроэнергия"] .dis-list');
  if (!list || list.children.length) return;
  for (let i = 1; i <= 3; i++) {
    const det = document.createElement("details");
    det.className = "dis-item";
    det.innerHTML = `<summary class="dis-summary"><span class="dis-summary-text">⚡ Сахалинэнерго — демо-строка ${i} (плановое отключение)</span><span class="dis-summary-arr">▾</span></summary><div class="dis-details"><div class="dis-title">Демо-заголовок ${i}</div><ul class="dis-addr"><li>ул. Демо, ${i}0</li></ul></div>`;
    list.appendChild(det);
  }
});
const loc = page.locator('section[aria-label*="Электроэнергия"]').first();
await loc.screenshot({ path: `${OUT}${PREFIX}-desktop.png` });

// мобайл 375
const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
await mob.goto("http://127.0.0.1:3000/disconnections.php", { waitUntil: "domcontentloaded", timeout: 60000 });
await mob.waitForSelector('section[aria-label*="Электроэнергия"] .dis-list', { timeout: 45000 });
await mob.waitForTimeout(800);
const m = await mob.evaluate(() => {
  const list = document.querySelector('section[aria-label*="Электроэнергия"] .dis-list');
  return {
    docW: document.documentElement.scrollWidth,
    vw: window.innerWidth,
    listBg: list ? getComputedStyle(list).backgroundColor : "ABSENT",
  };
});
console.log("ELECTRO YELLOW MOBILE:", JSON.stringify(m));
await mob.evaluate(() => {
  const list = document.querySelector('section[aria-label*="Электроэнергия"] .dis-list');
  if (!list || list.children.length) return;
  for (let i = 1; i <= 3; i++) {
    const det = document.createElement("details");
    det.className = "dis-item";
    det.innerHTML = `<summary class="dis-summary"><span class="dis-summary-text">⚡ Сахалинэнерго — демо-строка ${i}</span><span class="dis-summary-arr">▾</span></summary><div class="dis-details"><ul class="dis-addr"><li>ул. Демо, ${i}0</li></ul></div>`;
    list.appendChild(det);
  }
});
await mob.locator('section[aria-label*="Электроэнергия"]').first().screenshot({ path: `${OUT}${PREFIX}-mobile.png` });
await browser.close();
