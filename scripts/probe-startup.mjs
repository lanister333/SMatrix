// Проба ТЗ 2026-09-21: новая страница /startup.php «Новый бизнес
// Сахалина» — 3 карточки по присланной разметке, navy-панель,
// пункты навигации, кнопки, мобайл 375 без горскролла.
// Запуск: node scripts/probe-startup.mjs [префикс-скриншотов]
import { chromium } from "playwright";

const PREFIX = process.argv[2] || "startup";
const OUT = "/home/z/my-project/scripts/shots/";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:3000/startup.php", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector(".startup-card", { timeout: 45000 });
await page.waitForTimeout(1200);

const d = await page.evaluate(() => {
  const panel = document.querySelector(".startup-header-panel");
  const cards = [...document.querySelectorAll(".startup-card")];
  return {
    panelBg: panel ? getComputedStyle(panel).backgroundColor : "ABSENT",
    panelTitle: document.querySelector(".startup-panel-title")?.textContent?.trim() ?? "ABSENT",
    backBtn: document.querySelector(".btn-back-to-main")?.textContent?.trim() ?? "ABSENT",
    cards: cards.map((c) => ({
      id: c.getAttribute("data-company-id"),
      badge: c.querySelector(".startup-badge")?.textContent?.trim() ?? "ABSENT",
      name: c.querySelector(".startup-name")?.textContent?.trim() ?? "ABSENT",
      blogBtn: !!c.querySelector(".btn-open-blog"),
      waBtn: c.querySelector(".btn-startup-whatsapp")?.getAttribute("href") ?? "ABSENT",
      human: c.querySelector(".human-name")?.textContent?.trim() ?? "ABSENT",
    })),
    navLink: !!document.querySelector('a[href="/startup.php"]'),
    containerW: Math.round(document.querySelector(".sakh-matrix-startup-container")?.getBoundingClientRect().width ?? 0),
  };
});
console.log("STARTUP DESKTOP:", JSON.stringify(d, null, 2));

// пункт «Новый бизнес» появляется в дропдауне «Полезное» ПОСЛЕ клика
await page.locator("nav.sm-mainnav button", { hasText: "Полезное" }).first().click();
await page.waitForTimeout(300);
const navLink = await page.evaluate(() => {
  const a = document.querySelector('a[href="/startup.php"]');
  return { present: !!a, label: a?.textContent?.trim() ?? "ABSENT" };
});
console.log("NAV USEFUL LINK:", JSON.stringify(navLink));

// тост-заглушка «Читать блог новичка»
await page.locator(".btn-open-blog").first().click();
await page.waitForTimeout(300);
const toast = await page.evaluate(() => document.body.innerText.includes("Блог компании скоро откроется"));
console.log("BLOG TOAST OK:", toast);

await page.screenshot({ path: `${OUT}${PREFIX}-desktop.png`, fullPage: false });
await page.locator(".sakh-matrix-startup-container").screenshot({ path: `${OUT}${PREFIX}-block.png` });

// мобайл 375
const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
await mob.goto("http://127.0.0.1:3000/startup.php", { waitUntil: "domcontentloaded", timeout: 60000 });
await mob.waitForSelector(".startup-card", { timeout: 45000 });
await mob.waitForTimeout(800);
const m = await mob.evaluate(() => {
  const card = document.querySelector(".startup-card-main");
  return {
    docW: document.documentElement.scrollWidth,
    vw: window.innerWidth,
    cardW: Math.round(card?.getBoundingClientRect().width ?? 0),
    actionsBelow: (() => {
      const info = document.querySelector(".startup-info")?.getBoundingClientRect();
      const act = document.querySelector(".startup-actions")?.getBoundingClientRect();
      if (!info || !act) return false;
      return act.top >= info.bottom - 2; // кнопки переехали ПОД описание
    })(),
  };
});
console.log("STARTUP MOBILE:", JSON.stringify(m));
await mob.screenshot({ path: `${OUT}${PREFIX}-mobile.png`, fullPage: false });
await browser.close();
