/**
 * Скриншоты низа Главной: карусель волонтёров ↔ футер (задача 2026-09-23).
 * Скролл в самый низ, снимаем стык «карусель + футер».
 * Запуск: node scripts/carousel-footer-shot-2026-09-23.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOTS = [
  { name: 'carousel-footer-1280-2026-09-23', width: 1280, height: 700 },
  { name: 'carousel-footer-375-2026-09-23', width: 375, height: 740 },
];

const browser = await chromium.launch();
for (const s of SHOTS) {
  const page = await browser.newPage({ viewport: { width: s.width, height: s.height } });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.mp-footer', { timeout: 15000 });
  // Скролл в самый низ — стык карусель/футер в кадре
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `/home/z/my-project/download/${s.name}.png` });
  console.log(`OK: ${s.name}.png`);
  await page.close();
}
await browser.close();
