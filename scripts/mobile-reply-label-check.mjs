import { chromium } from 'playwright';
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
await p.goto('http://127.0.0.1:3000/?topic=1', { waitUntil: 'networkidle' });
const m = await p.evaluate(() => {
  const labs = [...document.querySelectorAll('.sk-msg-parent')];
  const sw = document.documentElement.scrollWidth, iw = window.innerWidth;
  return {
    labels: labs.length,
    tag: labs[0]?.tagName,
    text: labs[0]?.textContent.trim().replace(/\s+/g, ' '),
    hscroll: sw > iw, sw, iw,
  };
});
console.log(JSON.stringify(m));
await browser.close();
