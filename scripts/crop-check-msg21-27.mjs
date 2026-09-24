import { chromium } from 'playwright';
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await p.goto('http://127.0.0.1:3000/?topic=1', { waitUntil: 'networkidle' });
const el = await p.evaluate(() => {
  const cards = [...document.querySelectorAll('.sakh-comments-container > .sakh-comment')];
  const a = cards.find(c => c.dataset.msgnum === '21');
  a.scrollIntoView({ block: 'center' });
  const r = a.getBoundingClientRect();
  return { y: r.top + window.scrollY, h: r.height };
});
await p.evaluate(y => window.scrollTo(0, y - 120), el.y);
await p.waitForTimeout(300);
await p.screenshot({ path: 'download/ladder-crop-21-27.png', clip: { x: 0, y: 100, width: 900, height: 620 } });
console.log('crop saved');
await browser.close();
