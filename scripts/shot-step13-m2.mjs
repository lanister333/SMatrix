import { chromium } from 'playwright';
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.screenshot({ path: 'tool-results/s13-mobile-top.png' });
await p.evaluate(() => window.scrollTo(0, 1200));
await p.waitForTimeout(300);
await p.screenshot({ path: 'tool-results/s13-mobile-mid.png' });
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight - 900));
await p.waitForTimeout(300);
await p.screenshot({ path: 'tool-results/s13-mobile-bottom.png' });
// topic view
await p.goto('http://localhost:3000/?topic=26', { waitUntil: 'networkidle' });
await p.screenshot({ path: 'tool-results/s13-mobile-topic-top.png' });
await p.evaluate(() => window.scrollTo(0, 1400));
await p.waitForTimeout(300);
await p.screenshot({ path: 'tool-results/s13-mobile-topic-msgs.png' });
await browser.close();
console.log('done');
