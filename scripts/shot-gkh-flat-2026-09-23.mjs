/**
 * Скриншоты ТЗ №2 2026-09-23 «ЖКХ и городские проблемы» (/gkh, Flat 2.0):
 *   1. gkh-flat-desktop — десктоп 1440, лента целиком (4 сид-карточки)
 *   2. gkh-flat-form    — вход сид-аккаунтом, открытая форма 3 шагов
 *   3. gkh-flat-mobile  — мобайл 375
 * Результат: /home/z/my-project/download/
 * Запуск: node scripts/shot-gkh-flat-2026-09-23.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const OUT = '/home/z/my-project/download';

const browser = await chromium.launch();

/* 1. Десктоп: лента */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/gkh', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-gkf-card]', { timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/gkh-flat-desktop-2026-09-23.png`, fullPage: true });
  await ctx.close();
  console.log('1/3 desktop done');
}

/* 2. Форма 3 шагов (авторизованный) */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  const r = await ctx.request.post(BASE + '/api/auth/login', {
    data: { email: 'u1_модератор@sakhmatrix.local', password: 'Moderator2026' },
  });
  const login = await r.json();
  await page.addInitScript(
    ([key, val]) => localStorage.setItem(key, val),
    ['sm_auth', JSON.stringify({ token: login.user.token, user: login.user })]
  );
  await page.goto(BASE + '/gkh', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-gkf-card]', { timeout: 30000 });
  await page.click('[data-gkf-add-center="1"]');
  await page.waitForSelector('[data-gkf-form="1"]', { timeout: 10000 });
  await page.fill('[data-gkf-text="1"]', 'С 20 сентября не работает домофон в третьем подъезде: кнопка замка не срабатывает, дверь открыта.');
  await page.fill('[data-gkf-place="1"]', 'Южно-Сахалинск, ул. Ленина, д. 100');
  await page.fill('[data-gkf-date="1"]', '2026-09-20');
  await page.fill('[data-gkf-actions="1"]', 'Заявка в УК от 21.09, номер 7712-Ж. Ответ до 25.09 не дан.');
  await page.waitForTimeout(400);
  await page.locator('[data-gkf-form="1"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/gkh-flat-form-2026-09-23.png`, fullPage: true });
  await ctx.close();
  console.log('2/3 form done');
}

/* 3. Мобайл 375 */
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/gkh', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-gkf-card]', { timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/gkh-flat-mobile-2026-09-23.png`, fullPage: true });
  await ctx.close();
  console.log('3/3 mobile done');
}

await browser.close();
console.log('ALL SHOTS DONE');
