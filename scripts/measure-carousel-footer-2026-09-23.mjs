/**
 * Замер карусели волонтёров ↔ футер (задача 2026-09-23 «отступ карусель-футер»).
 * Фиксирует ДО/ПОСЛЕ: computed margins, высоты карточек, фактический зазор.
 * Запуск: node scripts/measure-carousel-footer-2026-09-23.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const VIEWPORTS = [
  { name: 'desktop-1729', width: 1729, height: 1000 },
  { name: 'laptop-1280', width: 1280, height: 900 },
  { name: 'mobile-375', width: 375, height: 812 },
];

const browser = await chromium.launch();
let fails = 0;

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.mp-footer', { timeout: 15000 });

  const m = await page.evaluate(() => {
    const footer = document.querySelector('.mp-footer');
    // карусель = div-обёртка прямо перед footer.mp-footer
    const wrap = footer && footer.previousElementSibling;
    const card = wrap ? wrap.querySelector('a') : null;
    const r = (el) => (el ? el.getBoundingClientRect() : null);
    const cs = (el, props) => {
      if (!el) return {};
      const s = getComputedStyle(el);
      return Object.fromEntries(props.map((p) => [p, s[p]]));
    };
    const fw = r(wrap), ff = r(footer), fc = r(card);
    const gap = fw && ff ? Math.round(ff.top - fw.bottom) : null;
    return {
      wrapFound: !!wrap,
      wrapTag: wrap ? wrap.tagName : null,
      wrapMargins: cs(wrap, ['marginTop', 'marginBottom']),
      wrapPadding: cs(wrap, ['paddingTop', 'paddingBottom']),
      cardHeight: fc ? Math.round(fc.height) : null,
      cardPadding: cs(card, ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight']),
      cardFont: card ? getComputedStyle(card.querySelector('span')).fontSize : null,
      footerMargins: cs(footer, ['marginTop', 'marginBottom']),
      footerPadding: cs(footer, ['paddingTop', 'paddingBottom']),
      gapCarouselToFooter: gap,
      viewportScrollW: document.documentElement.scrollWidth,
      viewportInnerW: window.innerWidth,
    };
  });

  console.log(`\n=== ${vp.name} (${vp.width}px) ===`);
  console.log(JSON.stringify(m, null, 2));

  // Контроль горизонтального скролла на мобиле
  if (vp.width <= 480) {
    const swOk = m.viewportScrollW <= m.viewportInnerW;
    console.log(swOk ? 'OK: нет горизонтального скролла' : `FAIL: горскролл ${m.viewportScrollW}>${m.viewportInnerW}`);
    if (!swOk) fails++;
  }
  if (consoleErrors.length) {
    console.log(`CONSOLE ERRORS (${vp.name}):`, consoleErrors.slice(0, 3));
    fails++;
  }
  await page.close();
}

await browser.close();
console.log(`\nИтог: ${fails === 0 ? 'ВСЁ OK' : fails + ' FAIL'}`);
process.exit(fails === 0 ? 0 : 1);
