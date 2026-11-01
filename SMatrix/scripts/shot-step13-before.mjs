import { chromium } from 'playwright';
const browser = await chromium.launch();
// Desktop
const d = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await d.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await d.screenshot({ path: 'tool-results/s13-before-desktop.png', fullPage: false });
await d.goto('http://localhost:3000/?topic=26', { waitUntil: 'networkidle' });
await d.screenshot({ path: 'tool-results/s13-before-topic.png', fullPage: false });
// Mobile
const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
await m.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await m.screenshot({ path: 'tool-results/s13-before-mobile.png', fullPage: false });
await m.goto('http://localhost:3000/?topic=26', { waitUntil: 'networkidle' });
await m.screenshot({ path: 'tool-results/s13-before-mobile-topic.png', fullPage: false });
// horizontal scroll check
const hs = await m.evaluate(() => document.documentElement.scrollWidth + ' vs ' + window.innerWidth);
console.log('mobile scrollWidth vs innerWidth:', hs);
await browser.close();
