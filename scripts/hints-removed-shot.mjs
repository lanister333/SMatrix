// Проба после снятия панелей «Быстрые подсказки…» с Главной (указ заказчика 2026-09-22).
// Проверки: панелей нет; сетка разделов целая; мобайл 375 без горскролла.
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const SHOTS = '/home/z/my-project/screenshots';
let ok = 0, fail = 0;
const check = (name, cond) => { if (cond) { ok++; console.log(`OK   ${name}`); } else { fail++; console.log(`FAIL ${name}`); } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(BASE + '/', { waitUntil: 'networkidle' });

// 1. Панелей больше нет (ни в HTML, ни видимыми)
check('«Быстрые подсказки «Где купить»» удалена с Главной', (await page.locator('text=Быстрые подсказки «Где купить»').count()) === 0);
check('«Быстрые подсказки «Где дешевле»» удалена с Главной', (await page.locator('text=Быстрые подсказки «Где дешевле»').count()) === 0);
check('формы подсказок (textarea placeholder) нет', (await page.locator('textarea[placeholder*="Видел на Железнодорожной"]').count()) === 0);

// 2. Утверждённая сетка Главной не задета
check('сетка разделов «Где дешевле» (ссылки) на месте', await page.locator('a', { hasText: 'Продукты питания' }).first().isVisible());
check('сетка разделов «Где купить» (ссылки) на месте', await page.locator('a', { hasText: 'Автозапчасти' }).first().isVisible());
check('«Последние темы форума» на месте', await page.locator('text=Последние темы форума').first().isVisible());

// 3. Скриншоты низа страницы (место, где были панели)
await page.screenshot({ path: SHOTS + '/hints-removed-desktop-full.png', fullPage: true });
const hintPanels = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.mp-paneltitle'))
    .filter((t) => (t.textContent || '').includes('Быстрые подсказки')).length
);
check('среди заголовков панелей нет «Быстрых подсказок» (count=' + hintPanels + ')', hintPanels === 0);
const topicLinks = await page.evaluate(() =>
  Array.from(document.querySelectorAll('a')).filter((a) => (a.textContent || '').includes('Быстрые подсказки:')).length
);
console.log(`INFO перенесённых тем «Быстрые подсказки: …» в списке тем форума: ${topicLinks} (контент БД, на Главной это только ссылки «Последних тем»)`);

// 4. Мобайл 375 без горскролла
const m = await browser.newPage({ viewport: { width: 375, height: 800 } });
await m.goto(BASE + '/', { waitUntil: 'networkidle' });
const sw = await m.evaluate(() => document.documentElement.scrollWidth);
check('мобайл 375 без горскролла (sw=' + sw + ')', sw <= 375);
await m.screenshot({ path: SHOTS + '/hints-removed-mobile.png', fullPage: false });

await browser.close();
console.log(`ИТОГ: ${ok} OK / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
