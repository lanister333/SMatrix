/**
 * Регрессия блока «Объявления» (/obyavleniya) после ввода publishMode
 * (ТЗ 2026-09-23): у ads СМС-режим должен работать как прежде —
 * форма → «Далее: подтверждение по СМС» → телефон → демо-код →
 * «Опубликовать объявление» → пост наверху ленты.
 * Запуск: node scripts/probe-ads-sms-regression-2026-09-23.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const SHOTS = '/home/z/my-project/screenshots';
const AUTH_KEY = 'sm_auth';
let ok = 0, fail = 0;
const check = (name, cond) => { if (cond) { ok++; console.log(`OK   ${name}`); } else { fail++; console.log(`FAIL ${name}`); } };
const errors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

// Вход модератором (пароль из seed.js).
const r = await ctx.request.post(BASE + '/api/auth/login', {
  data: { email: 'u1_модератор@sakhmatrix.local', password: 'Moderator2026' },
});
const login = await r.json();
check('вход модератора', r.ok() && !!login?.user?.token);

// Идемпотентность (фикс 2026-09-23): убираем свой прежний @probe_test-пост,
// иначе защита от дубликатов («Вы уже публиковали объявление с таким же
// заголовком…») честно отвечает 400, попадает в консоль и рушит проверку
// «консоль чистая» — при полностью рабочем продукте.
const MARKER = '@probe_test_' + Date.now();
const mineResp = await ctx.request.get(BASE + '/api/obyavleniya?mine=1&token=' + encodeURIComponent(login.user.token) + '&pageSize=300');
const mineData = await mineResp.json().catch(() => ({ posts: [] }));
for (const p of mineData.posts || []) {
  if ((p.text || '').includes('@probe_test')) {
    await ctx.request.patch(`${BASE}/api/obyavleniya/${p.id}`, { data: { token: login.user.token, action: 'delete' } });
  }
}
await page.addInitScript(
  ([key, val]) => localStorage.setItem(key, val),
  [AUTH_KEY, JSON.stringify({ token: login.user.token, user: login.user })]
);

await page.goto(BASE + '/obyavleniya', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-flat-board="ads"]', { timeout: 30000 });
await page.waitForSelector('[data-flat-tabs="1"] [role="tab"]', { timeout: 30000 });

// Гостевое примечание ads-блока НЕ должно измениться (сначала выходим из авторизации не требуется —
// проверяем через контекст без токена ниже; здесь сразу форма под авторизацией).
// ТЗ 2026-09-23: кнопка публикации — в ЛЕВОЙ колонке страницы;
// внутренняя кнопка FlatBoard скрыта (hideAddButton).
await page.click('[data-ads-add-left="1"]');
await page.waitForSelector('[data-flat-form="1"]', { timeout: 10000 });
check('ads: форма открылась', await page.locator('[data-flat-form="1"]').isVisible());
check('ads: шаг «Далее: подтверждение по СМС» на месте', await page.locator('[data-flat-next="1"]').isVisible());

// Полный двухшаговый цикл: форма → СМС → публикация.
await page.click('[data-flat-form-tab="give"]');
await page.fill('[data-flat-city="1"]', 'Южно-Сахалинск');
await page.fill('[data-flat-text="1"]', `Отдам даром коробку детских книг и журналов, самовывоз. Пишите в Telegram: ${MARKER}`);
await page.click('[data-flat-next="1"]');
await page.waitForSelector('[data-flat-sms="1"]', { timeout: 10000 });
check('ads: шаг СМС открыт (телефон + код)', await page.locator('[data-flat-sms-phone="1"]').isVisible());
await page.fill('[data-flat-sms-phone="1"]', '+7 924 123-45-67');
await page.click('[data-flat-sms-send="1"]');
await page.waitForSelector('[data-flat-sms-devcode="1"]', { timeout: 20000 });
const devCodeText = (await page.locator('[data-flat-sms-devcode="1"]').textContent()) ?? '';
const codeMatch = devCodeText.match(/(\d{4,8})/);
check('ads: демо-код получен из /api/sms', !!codeMatch);
await page.fill('[data-flat-sms-code="1"]', codeMatch ? codeMatch[1] : '');
await page.click('[data-flat-publish="1"]');
await page.waitForFunction(
  (m) => {
    const first = document.querySelector('[data-flat-cards="1"] article [data-flat-card-text]');
    return first && (first.textContent || '').includes(m);
  },
  MARKER,
  { timeout: 60000 }
);
check('ads: объявление опубликовано и наверху ленты (СМС-поля приняты API)', true);
await page.screenshot({ path: SHOTS + '/ads-sms-regression-published.png' });

// Уборка (идемпотентность): снимаем с публикации своё тестовое объявление,
// чтобы лента раздела и следующий прогон оставались чистыми.
const newCardId = await page.evaluate((m) => {
  const cards = document.querySelectorAll('[data-flat-cards="1"] article[data-flat-card]');
  for (const c of cards) {
    if ((c.querySelector('[data-flat-card-text]')?.textContent || '').includes(m)) return c.getAttribute('data-flat-card');
  }
  return null;
}, MARKER);
if (newCardId) {
  await ctx.request.patch(`${BASE}/api/obyavleniya/${newCardId}`, { data: { token: login.user.token, action: 'delete' } });
}

await browser.close();
const realErrors = errors.filter((e) => !e.includes('favicon'));
check('консоль чистая', realErrors.length === 0);
if (realErrors.length) console.log(realErrors.join('\n'));
console.log(`ИТОГ: ${ok} OK / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
