// Контрольный скриншот низа Главной после ТРЕТЬЕГО снятия панелей
// «Быстрые подсказки…» (указ заказчика 2026-09-23, скриншот «это удали»).
// Скроллим в самый низ — видно, что после сетки разделов сразу баннер/подвал.
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const SHOTS = '/home/z/my-project/screenshots';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 620 } });
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
// ждем гидрацию сетки (клиентский рендер) — как в прошлых пробах
await page.waitForSelector('text=Последние темы форума', { timeout: 20000 });
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(800);
await page.screenshot({ path: SHOTS + '/hints-removed-bottom-2026-09-23.png' });
await browser.close();
console.log('OK скриншот низа Главной сохранён: ' + SHOTS + '/hints-removed-bottom-2026-09-23.png');
