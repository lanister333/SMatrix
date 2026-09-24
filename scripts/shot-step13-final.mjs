import { chromium } from 'playwright';
const browser = await chromium.launch();
// tiny phone
const t = await browser.newPage({ viewport: { width: 360, height: 780 } });
await t.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
const sw = await t.evaluate(() => document.documentElement.scrollWidth);
console.log('360px scrollWidth:', sw, sw <= 360 ? 'OK' : 'HSCROLL!');
await t.goto('http://localhost:3000/?topic=26', { waitUntil: 'networkidle' });
console.log('360px topic scrollWidth:', await t.evaluate(() => document.documentElement.scrollWidth));
await t.close();
// exact step10 texts still work in UI
const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
await p.goto('http://localhost:3000/?topic=26', { waitUntil: 'networkidle' });
// complaint flow
await p.click('.sk-msg .sk-flood-btn');
await p.waitForTimeout(400);
await p.click('.sk-kind-chip >> text=Другое');
await p.click('button:has-text("Отправить жалобу")');
await p.waitForTimeout(1200);
const toast = await p.evaluate(() => document.querySelector('.fixed.bottom-4')?.textContent || '');
console.log('complaint toast:', JSON.stringify(toast));
await p.close();
await browser.close();
