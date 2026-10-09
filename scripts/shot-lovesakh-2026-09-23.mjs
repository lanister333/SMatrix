import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const OUT = '/home/z/my-project/download';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await ctx.newPage();
await page.goto(BASE + '/znakomstva', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-ls-cards="1"] article', { timeout: 30000 });
await page.screenshot({ path: OUT + '/lovesakh-3col-desktop-2026-09-23.png' });
// мобильный вид
const mctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
const mpage = await mctx.newPage();
await mpage.goto(BASE + '/znakомства'.replace('омства','omstva'), { waitUntil: 'networkidle' });
await mpage.waitForSelector('[data-ls-cards="1"] article', { timeout: 30000 });
await mpage.screenshot({ path: OUT + '/lovesakh-3col-mobile-2026-09-23.png', fullPage: false });
console.log('shots done');
await browser.close();
