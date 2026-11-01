/**
 * Проба ТЗ 2026-09-21 (доработка): баннер «Поддержка молодого бизнеса»
 * открывает /startup.php («Новый бизнес Сахалина»), в меню «Полезное»
 * (ПК-дропдаун и мобильная шторка) пункта «Новый бизнес» больше нет.
 *
 * Проверки:
 *  1) href шапки ячейки бизнеса = /startup.php; клик → URL /startup.php;
 *  2) клик слайда 1 ротатора («поможем нашим землякам») → /startup.php;
 *  3) ПК-дропдаун «Полезное»: 4 пункта, БЕЗ «Новый бизнес»;
 *  4) мобайл 375: шторка → «Полезное» без «Новый бизнес», docW === vw.
 * Скриншоты: scripts/shots/startup-banner-*.png
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:3000";
const SHOTS = "scripts/shots";
fs.mkdirSync(SHOTS, { recursive: true });

const ok = (name, cond, extra = "") =>
  console.log(`${cond ? "OK  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`);

const browser = await chromium.launch();
try {
  // ---------- ДЕСКТОП ----------
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector(".mp-grid", { timeout: 45000 });
  await page.waitForTimeout(1200);

  // 1) href шапки ячейки бизнеса + скриншот ячейки
  const cell = page.locator('section.mp-panel[aria-label="Поддержка молодого бизнеса"]');
  const href = await cell.locator("a.mp-celltitle").first().getAttribute("href");
  ok("1. href шапки ячейки = /startup.php", href === "/startup.php", `href=${href}`);
  await cell.screenshot({ path: `${SHOTS}/startup-banner-cell.png` });

  // клик по шапке ячейки
  await cell.locator("a.mp-celltitle").first().click();
  await page.waitForURL("**/startup.php", { timeout: 45000 });
  await page.waitForTimeout(1000);
  const title1 = await page.locator(".startup-panel-title").textContent().catch(() => "");
  ok("1a. клик по шапке → /startup.php", page.url().includes("/startup.php") && (title1 || "").includes("Новый бизнес Сахалина"), `url=${page.url()}, title=${title1}`);
  await page.screenshot({ path: `${SHOTS}/startup-page-from-banner.png`, fullPage: false });
  await page.goBack();
  await page.waitForSelector(".biz-rot", { timeout: 45000 });
  await page.waitForTimeout(1500);

  // 2) клик слайда 1 ротатора («Давайте поможем нашим землякам!»)
  await page.locator(".biz-rot").hover(); // пауза ротации
  await page.waitForSelector(".biz-rot-slide:has-text('поможем нашим землякам')", { timeout: 12000 });
  await page.locator(".biz-rot-slide:has-text('поможем нашим землякам')").click();
  await page.waitForURL("**/startup.php", { timeout: 45000 });
  await page.waitForTimeout(800);
  ok("2. клик слайда 1 баннера → /startup.php", page.url().includes("/startup.php"), `url=${page.url()}`);
  await page.goBack();
  await page.waitForSelector(".sm-mainnav", { timeout: 45000 });
  await page.waitForTimeout(1000);

  // 3) ПК-дропдаун «Полезное»
  await page.locator("button.sm-mainnav-link:has-text('Полезное')").click();
  const menu = page.locator("div[role='menu']");
  await menu.waitFor({ state: "visible", timeout: 10000 });
  const items = (await menu.locator("a[role='menuitem']").allTextContents()).map((s) => s.trim());
  ok("3. дропдаун «Полезное»: 4 пункта", items.length === 4, JSON.stringify(items));
  ok("3a. «Новый бизнес» УБРАН из дропдауна", !items.some((t) => t.includes("Новый бизнес")));
  ok("3b. сервисные пункты на месте", ["Погода", "Курс валют", "Отключения", "Пробки"].every((x) => items.some((t) => t.includes(x))));
  await page.screenshot({ path: `${SHOTS}/startup-useful-dropdown.png` });
  await page.keyboard.press("Escape");
  await page.close();

  // ---------- МОБАЙЛ 375 ----------
  const mp = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mp.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await mp.waitForSelector(".mp-grid", { timeout: 45000 });
  await mp.waitForTimeout(1000);
  const docW = await mp.evaluate(() => document.documentElement.scrollWidth);
  ok("4. мобайл 375: без горскролла", docW === 375, `docW=${docW}`);

  // href ячейки на мобиле
  const mHref = await mp.locator('section.mp-panel[aria-label="Поддержка молодого бизнеса"] a.mp-celltitle').first().getAttribute("href");
  ok("4a. мобайл: href ячейки = /startup.php", mHref === "/startup.php", `href=${mHref}`);

  // шторка: событие кнопки ☰ (sm-toggle-mobile-menu) → аккордеон «Полезное»
  await mp.evaluate(() => window.dispatchEvent(new Event("sm-toggle-mobile-menu")));
  await mp.waitForSelector("#sm-mdrawer", { timeout: 10000 });
  await mp.locator("#sm-mdrawer button:has-text('Полезное')").click();
  await mp.waitForTimeout(400);
  const mItems = (await mp.locator("#sm-mdrawer a.sm-mdrawer-sub").allTextContents()).map((s) => s.trim());
  ok("4b. мобайл: «Новый бизнес» УБРАН из шторки", !mItems.some((t) => t.includes("Новый бизнес")), JSON.stringify(mItems));
  ok("4c. мобайл: 4 сервисных пункта", mItems.length === 4);
  await mp.screenshot({ path: `${SHOTS}/startup-mobile-drawer.png` });
  await mp.close();
} finally {
  await browser.close();
}
console.log("PROBE DONE");
