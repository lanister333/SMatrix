import { chromium } from 'playwright';
const browser = await chromium.launch();

async function shot(vw, vh, url, path, fullPage=false) {
  const p = await browser.newPage({ viewport: { width: vw, height: vh } });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.screenshot({ path, fullPage });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  const iw = await p.evaluate(() => window.innerWidth);
  console.log(`${vw}x${vh} ${url.replace('http://localhost:3000','')} scrollWidth=${sw} innerWidth=${iw} ${sw<=iw?'NO-HSCROLL-OK':'!!! HSCROLL !!!'}`);
  await p.close();
}

await shot(1280, 900, 'http://localhost:3000/', 'tool-results/s13-desktop-home.png');
await shot(1280, 900, 'http://localhost:3000/?topic=26', 'tool-results/s13-desktop-topic.png');
await shot(1024, 800, 'http://localhost:3000/', 'tool-results/s13-1024-home.png');
await shot(390, 844, 'http://localhost:3000/', 'tool-results/s13-mobile-home.png', true);
await shot(390, 844, 'http://localhost:3000/?topic=26', 'tool-results/s13-mobile-topic.png', true);
await browser.close();
