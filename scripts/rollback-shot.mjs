// Проба-скриншот после ОТКАТА раунда «FLAT 2.0» (команда заказчика «откати назад»).
// Проверка: прежние панели «Быстрые подсказки…» на месте (mp-panel с синей шапкой),
// нового FLAT-компонента нет, /forum/topic/* адаптера нет.
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const SHOTS = '/home/z/my-project/screenshots';
let ok = 0, fail = 0;
const check = (name, cond) => { if (cond) { ok++; console.log(`OK   ${name}`); } else { fail++; console.log(`FAIL ${name}`); } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(BASE + '/', { waitUntil: 'networkidle' });

// 1. Прежние панели на месте
check('панель «Где купить» (прежняя) видима', await page.locator('text=Быстрые подсказки «Где купить»').first().isVisible());
check('панель «Где дешевле» (прежняя) видима', await page.locator('text=Быстрые подсказки «Где дешевле»').first().isVisible());

// 2. Нового FLAT-компонента на Главной нет
check('FLAT-компонента нет (нет «Опубликовать этот текст на форуме»)', (await page.locator('text=Опубликовать этот текст на форуме').count()) === 0);

// 3. Адаптер /forum/topic/* снят
const resp = await page.request.get(BASE + '/forum/topic/topic-grm?prefilled_text=test');
check('/forum/topic/* больше не отвечает (не 200)', resp.status() !== 200);

// 4. Скриншот
await page.screenshot({ path: SHOTS + '/rollback-home-restored.png', fullPage: false });
console.log('shot: rollback-home-restored.png');

// 5. Мобайл 375 без горскролла
const m = await browser.newPage({ viewport: { width: 375, height: 800 } });
await m.goto(BASE + '/', { waitUntil: 'networkidle' });
const sw = await m.evaluate(() => document.documentElement.scrollWidth);
check('мобайл 375 без горскролла (sw=' + sw + ')', sw <= 375);

await browser.close();
console.log(`ИТОГ: ${ok} OK / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
