/**
 * Скриншоты 2026-09-23 — кнопка «Обсудить на форуме» на /znakomstva:
 *   1) десктоп 1440, вкладка «Ищу человека / Благодарность» — карточка
 *      Ольги с бирюзовой кнопкой справа (вся центральная колонка);
 *   2) мобайл 375 — та же вкладка;
 *   3) спец-ветка форума /?topic=179 (куда ведёт кнопка).
 * Запуск: node scripts/shot-lovesakh-forum-btn-2026-09-23.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const OUT = '/home/z/my-project/download';
const browser = await chromium.launch();

/* 1. Десктоп: вкладка person + кнопка */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/znakomstva', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-ls-cards="1"] article', { timeout: 30000 });
  await page.click('[data-ls-tab="person"]');
  await page.waitForSelector('[data-ls-card-forum]', { timeout: 15000 });
  await page.waitForTimeout(600);
  const head = await page.locator('[data-ls-head="1"]').boundingBox();
  const cardBox = await page.locator('[data-ls-card-forumrow]').first().boundingBox();
  const top = Math.max(0, (head?.y ?? 0) - 20);
  const bottom = Math.min(1100 * 3, (cardBox?.y ?? 400) + (cardBox?.height ?? 100) + 30);
  await page.screenshot({ path: `${OUT}/lovesakh-btn-person-2026-09-23.png`, clip: { x: 0, y: top, width: 1440, height: Math.min(bottom - top, 1400) } });
  await ctx.close();
}

/* 2. Мобайл 375 */
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/znakomstva', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-ls-cards="1"] article', { timeout: 30000 });
  await page.click('[data-ls-tab="person"]');
  await page.waitForSelector('[data-ls-card-forum]', { timeout: 15000 });
  await page.waitForTimeout(600);
  const cardBox = await page.locator('[data-ls-card-forumrow]').first().boundingBox();
  await page.screenshot({ path: `${OUT}/lovesakh-btn-mobile-2026-09-23.png`, clip: { x: 0, y: Math.max(0, (cardBox?.y ?? 300) - 160), width: 375, height: 700 } });
  await ctx.close();
}

/* 3. Спец-ветка форума */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/?topic=179', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=специальное место для продолжения историй', { timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/lovesakh-btn-topic179-2026-09-23.png`, clip: { x: 0, y: 0, width: 1440, height: 1100 } });
  await ctx.close();
}

await browser.close();
console.log('SCREENSHOTS DONE');
