import { chromium } from 'playwright';
const browser = await chromium.launch();

const l = await browser.newPage({ viewport: { width: 1024, height: 800 } });
await l.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await l.screenshot({ path: 'tool-results/s13-1024-home.png' });
await l.close();

const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
m.on('pageerror', (e) => errors.push(String(e)));
m.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
await m.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

// 1) drawer open
await m.click('.sk-topbar button');
await m.waitForTimeout(400);
await m.screenshot({ path: 'tool-results/s13-mobile-menu.png' });
// 2) close via backdrop right edge
await m.mouse.click(365, 500);
await m.waitForTimeout(300);
console.log('menu closed after backdrop click:', await m.evaluate(() => !document.querySelector('.sk-menu-backdrop')));
// 3) open again, click Вход/регистрация inside drawer
await m.click('.sk-topbar button');
await m.waitForTimeout(300);
await m.getByText('Вход / регистрация').click();
await m.waitForTimeout(600);
await m.screenshot({ path: 'tool-results/s13-mobile-auth.png' });
// 4) complaint modal
await m.goto('http://localhost:3000/?topic=26', { waitUntil: 'networkidle' });
await m.click('.sk-flood-btn');
await m.waitForTimeout(600);
await m.screenshot({ path: 'tool-results/s13-mobile-complaint.png' });
console.log('mobile console errors:', errors.length ? errors : 'none');
await m.close();

const a = await browser.newPage({ viewport: { width: 390, height: 844 } });
await a.goto('http://localhost:3000/?view=admin', { waitUntil: 'networkidle' });
await a.screenshot({ path: 'tool-results/s13-mobile-admin.png' });
await a.close();
await browser.close();
console.log('done');
