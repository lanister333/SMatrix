/**
 * Прицельные скриншоты ТЗ «Единый вид 7 сценариев»: карточка сценария 7
 * (Cybex) в wtb-панели + карточки cheap-панели.
 * Запуск: node scripts/e2e-unified-shots-2026-09-23.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch();

// wtb: скролл к карточке сценария 7
const p1 = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await p1.goto(BASE + '/gde-kupit', { waitUntil: 'networkidle' });
await p1.waitForSelector('[data-e2e-scenario="7"]', { timeout: 30000 });
await p1.locator('[data-e2e-scenario="7"]').scrollIntoViewIfNeeded();
await p1.evaluate(() => window.scrollBy(0, -80));
await p1.waitForTimeout(400);
await p1.screenshot({ path: '/home/z/my-project/download/e2e-unified-scn7-cybex-2026-09-23.png' });
console.log('OK: e2e-unified-scn7-cybex-2026-09-23.png');
await p1.close();

// cheap: панель целиком (верх карточки 4)
const p2 = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await p2.goto(BASE + '/gde-deshevle', { waitUntil: 'networkidle' });
await p2.waitForSelector('[data-e2e-scenario="4"]', { timeout: 30000 });
await p2.locator('[data-e2e-panel="cheap"]').scrollIntoViewIfNeeded();
await p2.waitForTimeout(400);
await p2.screenshot({ path: '/home/z/my-project/download/e2e-unified-cheap-top-2026-09-23.png' });
console.log('OK: e2e-unified-cheap-top-2026-09-23.png');
await p2.close();

await browser.close();
