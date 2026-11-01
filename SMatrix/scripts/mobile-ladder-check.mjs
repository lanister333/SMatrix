import { chromium } from 'playwright';
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
await p.goto('http://127.0.0.1:3000/?topic=1', { waitUntil: 'networkidle' });
const m = await p.evaluate(() => {
  const cards = [...document.querySelectorAll('.sakh-comments-container > .sakh-comment')];
  const first = cards[0].getBoundingClientRect();
  const rails = [...document.querySelectorAll('.sakh-comment-connector')];
  const railVisible = rails.some(r => getComputedStyle(r).display !== 'none');
  const sw = document.documentElement.scrollWidth, iw = window.innerWidth;
  return {
    cards: cards.length,
    lefts: [...new Set(cards.map(c => +c.getBoundingClientRect().left.toFixed(1)))],
    rights: [...new Set(cards.map(c => +c.getBoundingClientRect().right.toFixed(1)))],
    railVisible, sw, iw, hscroll: sw > iw,
  };
});
console.log(JSON.stringify(m));
await p.screenshot({ path: 'download/ladder-mobile-390.png', fullPage: false });
await browser.close();
