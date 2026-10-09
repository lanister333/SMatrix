// Проба ТЗ 2026-09-21 «нежно-жёлтый между строками — для всех блоков
// отключений»: электростанция/горячая/холодная вода (.dis-list) +
// «Телефоны экстренных служб» (.dis-phones, separate 6px). Пустая
// «Холодная вода» наполняется синтетикой — демонстрация, что при
// появлении новостей расцветка применяется автоматически. /disconnections.php
// Запуск: node scripts/probe-yellow-blocks.mjs [префикс-скриншотов]
import { chromium } from "playwright";

const PREFIX = process.argv[2] || "yellow-all";
const OUT = "/home/z/my-project/scripts/shots/";
const YELLOW = "rgb(255, 248, 225)";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:3000/disconnections.php", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('section[aria-label*="Электроэнергия"] .dis-list', { timeout: 45000 });
await page.waitForTimeout(1200);

// все .dis-list + таблица телефонов
const d = await page.evaluate((YELLOW) => {
  const lists = [...document.querySelectorAll(".dis-list")].map((l) => ({
    sec: l.closest("section")?.getAttribute("aria-label") || "?",
    bg: getComputedStyle(l).backgroundColor,
    rows: l.querySelectorAll(".dis-item").length,
  }));
  const t = document.querySelector('section[aria-label="Телефоны экстренных служб"] .dis-phones');
  const phones = t
    ? {
        bg: getComputedStyle(t).backgroundColor,
        collapse: getComputedStyle(t).borderCollapse,
        spacing: getComputedStyle(t).borderSpacing,
        tdBg: getComputedStyle(t.querySelector("td")).backgroundColor,
        rows: t.querySelectorAll("tr").length,
      }
    : { found: false };
  return { lists, phones, isYellow: YELLOW };
}, YELLOW);
console.log("BLOCKS DESKTOP:", JSON.stringify(d, null, 2));
const ok =
  d.lists.filter((l) => l.sec.includes("Электроэнергия") || l.sec.includes("Горячая") || l.sec.includes("Холодная")).every((l) => l.bg === d.isYellow) &&
  d.phones.bg === d.isYellow && d.phones.collapse === "separate";
console.log("ALL YELLOW OK:", ok);

// СИНТЕТИКА в пустую «Холодную воду»: как придут новости — зазоры жёлтые
const coldEmpty = d.lists.find((l) => l.sec.includes("Холодная") && l.rows === 0);
if (coldEmpty) {
  await page.evaluate(() => {
    const list = document.querySelector('section[aria-label*="Холодная"] .dis-list');
    if (!list) return;
    for (let i = 1; i <= 3; i++) {
      const det = document.createElement("details");
      det.className = "dis-item";
      det.innerHTML = `<summary class="dis-summary"><span class="dis-summary-text">💧 Водоканал — демо-новость ${i} (автоприменение расцветки)</span><span class="dis-summary-arr">▾</span></summary><div class="dis-details"><ul class="dis-addr"><li>ул. Демо, ${i}0</li></ul></div>`;
      list.appendChild(det);
    }
  });
  console.log("COLD SYNTHETIC: injected 3 demo rows");
}

// скриншоты блоков
for (const [name, sel] of [
  ["electro", 'section[aria-label*="Электроэнергия"]'],
  ["hot", 'section[aria-label*="Горячая"]'],
  ["cold", 'section[aria-label*="Холодная"]'],
  ["phones", 'section[aria-label="Телефоны экстренных служб"]'],
]) {
  await page.locator(sel).first().screenshot({ path: `${OUT}${PREFIX}-${name}.png` });
}

// мобайл 375
const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
await mob.goto("http://127.0.0.1:3000/disconnections.php", { waitUntil: "domcontentloaded", timeout: 60000 });
await mob.waitForSelector('section[aria-label*="Электроэнергия"] .dis-list', { timeout: 45000 });
await mob.waitForTimeout(800);
const m = await mob.evaluate(() => ({
  docW: document.documentElement.scrollWidth,
  vw: window.innerWidth,
  electroBg: getComputedStyle(document.querySelector('section[aria-label*="Электроэнергия"] .dis-list')).backgroundColor,
  phonesBg: getComputedStyle(document.querySelector('section[aria-label="Телефоны экстренных служб"] .dis-phones')).backgroundColor,
  phonesSpacing: getComputedStyle(document.querySelector('section[aria-label="Телефоны экстренных служб"] .dis-phones')).borderSpacing,
}));
console.log("MOBILE:", JSON.stringify(m));
await browser.close();
