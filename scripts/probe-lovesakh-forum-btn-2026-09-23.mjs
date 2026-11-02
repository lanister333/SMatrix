/**
 * Указ заказчика 2026-09-23 «добавляй кнопку» (/znakomstva, Love Sakh):
 * под карточками вкладки «Ищу человека / Благодарность» — кнопка
 * «Обсудить на форуме» перехода в СПЕЦИАЛЬНУЮ ВЕТКУ форума (текст
 * «О разделе» обещает её под публикацией).
 * Проверки:
 *   A) Вкладка «person»: ровно 1 кнопка; текст «Обсудить на форуме»;
 *      href байт-в-байт /forum/topic/179 (относительный, БЕЗ localhost,
 *      БЕЗ prefilled_text — решение задокументировано в шапке TSX);
 *      фон rgb(13,148,136) (бирюзовый по указу 2026-09-23), НЕ старый
 *      синий; правый край в Δ≤14px от правого края карточки и правее
 *      центра; title; обёртка dk-card-foot.
 *   B) Другие вкладки (m4w/w4m/friendship): кнопок НЕТ; возврат на
 *      «person» — кнопка снова есть; URL стабилен (без перезагрузки).
 *   C) КЛИК по кнопке: роут-адаптер /forum/topic/179 → /?topic=179 —
 *      открыта спец-ветка «Истории благодарности: спасители и герои
 *      сахалинских дорог» с вводным сообщением «Админ».
 *   D) Мобайл 375: без горскролла, кнопка видима, бирюзовая, справа.
 *   Z) Консоль чистая.
 * Запуск: node scripts/probe-lovesakh-forum-btn-2026-09-23.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
let ok = 0, fail = 0;
const check = (name, cond) => { if (cond) { ok++; console.log(`OK   ${name}`); } else { fail++; console.log(`FAIL ${name}`); } };

const BTN_URL = '/forum/topic/179';
const TURQUOISE = 'rgb(13, 148, 136)';
const OLD_BLUE = 'rgb(10, 92, 170)';
const TOPIC_TITLE = 'Истории благодарности: спасители и герои сахалинских дорог';

const errors = [];
const listen = (page, tag) => {
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text()}`); });
};

const browser = await chromium.launch();

/* ---------- A+B: гость, 1440 — кнопка только во вкладке «person» ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await ctx.newPage();
  listen(page, 'guest');
  await page.goto(BASE + '/znakomstva', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-ls-cards="1"] article', { timeout: 30000 });

  // B (часть 1): в первой вкладке (m4w) кнопок нет
  check('B1 m4w: кнопок «Обсудить на форуме» = 0', (await page.locator('[data-ls-card-forum]').count()) === 0);
  check('B1b m4w: строк-обёрток dk-card-foot = 0', (await page.locator('[data-ls-card-forumrow]').count()) === 0);

  // Переключение на вкладку «Ищу человека / Благодарность» (клиентское состояние)
  const urlBefore = page.url();
  await page.click('[data-ls-tab="person"]');
  await page.waitForSelector('[data-ls-card-forum]', { timeout: 15000 });
  check('B2 переключение вкладок БЕЗ перезагрузки (URL стабилен)', page.url() === urlBefore);

  const btn = page.locator('[data-ls-card-forum]').first();
  const btnCount = await page.locator('[data-ls-card-forum]').count();
  check('A1 вкладка person: ровно 1 кнопка форума (1 person-анкета)', btnCount === 1);

  const text = ((await btn.textContent()) ?? '').trim();
  check('A2 текст кнопки «Обсудить на форуме»', text === 'Обсудить на форуме');

  const href = (await btn.getAttribute('href')) ?? '';
  check('A3 href байт-в-байт /forum/topic/179', href === BTN_URL);
  check('A4 href относительный (не http)', !href.startsWith('http'));
  check('A5 в href нет localhost', !href.includes('localhost'));
  check('A6 в href нет prefilled_text (ТЗ обещает только переход)', !href.includes('prefilled_text'));
  check('A7 title кнопки про ветку форума', ((await btn.getAttribute('title')) ?? '').includes('ветке форума'));

  const cls = (await btn.getAttribute('class')) ?? '';
  check('A8 класс .dk-btn-forum', cls.includes('dk-btn-forum'));

  const bg = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
  check('A9 фон кнопки БИРЮЗОВЫЙ rgb(13,148,136)', bg === TURQUOISE);
  check('A10 фон НЕ старый синий', bg !== OLD_BLUE);

  const rects = await page.evaluate(() => {
    const row = document.querySelector('[data-ls-card-forumrow]');
    const card = row?.closest('article');
    const btn = row?.querySelector('[data-ls-card-forum]');
    if (!row || !card || !btn) return null;
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    return { btn: r(btn), card: r(card) };
  });
  check('A11 кнопка видима (box есть)', !!rects && rects.btn.w > 0 && rects.btn.h > 0);
  check('A12 правый край кнопки в Δ≤14px от правого края карточки', !!rects && Math.abs((rects.card.x + rects.card.w) - (rects.btn.x + rects.btn.w)) <= 14);
  check('A13 кнопка правее центра карточки', !!rects && rects.btn.x > rects.card.x + rects.card.w / 2);

  const footCls = (await page.locator('[data-ls-card-forumrow]').first().getAttribute('class')) ?? '';
  check('A14 обёртка dk-card-foot (flex-end)', footCls.includes('dk-card-foot'));

  // B (часть 2): в остальных вкладках кнопок нет; возврат — кнопка снова есть
  for (const t of ['w4m', 'friendship']) {
    await page.click(`[data-ls-tab="${t}"]`);
    await page.waitForFunction(() => !document.querySelector('[data-ls-card-forum]'), { timeout: 15000 });
    check(`B3 ${t}: кнопок форума = 0`, (await page.locator('[data-ls-card-forum]').count()) === 0);
  }
  check('B4 URL по-прежнему стабилен после 3 переключений', page.url() === urlBefore);
  await page.click('[data-ls-tab="person"]');
  await page.waitForSelector('[data-ls-card-forum]', { timeout: 15000 });
  check('B5 возврат на person: кнопка снова есть (клиентское состояние)', (await page.locator('[data-ls-card-forum]').count()) === 1);

  // C: КЛИК по кнопке → спец-ветка форума
  await page.click('[data-ls-card-forum]');
  await page.waitForURL(/topic=179/, { timeout: 30000 });
  check('C1 клик: URL темы = /?topic=179', page.url().includes('topic=179'));
  // Ждём ИМЕННО вводное сообщение: заголовок темы мелькает и в боковом
  // списке «Закреплённые темы» до загрузки сообщений (гонка первого прогона).
  await page.waitForSelector('text=специальное место для продолжения историй', { timeout: 30000 });
  const bodyText = (await page.locator('body').textContent()) ?? '';
  check('C2 открыта спец-ветка: заголовок «Истории благодарности…»', bodyText.includes(TOPIC_TITLE));
  check('C3 вводное сообщение «Админ» видно', bodyText.includes('специальное место для продолжения историй'));
  await ctx.close();
}

/* ---------- D: мобайл 375 ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  listen(page, 'mobile');
  await page.goto(BASE + '/znakomstva', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-ls-cards="1"] article', { timeout: 30000 });
  await page.click('[data-ls-tab="person"]');
  await page.waitForSelector('[data-ls-card-forum]', { timeout: 15000 });

  const btn = page.locator('[data-ls-card-forum]').first();
  const bg = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
  check('D1 мобайл: кнопка видима (фон прочитан)', !!bg);
  check('D2 мобайл: кнопка бирюзовая', bg === TURQUOISE);
  const rects = await page.evaluate(() => {
    const row = document.querySelector('[data-ls-card-forumrow]');
    const card = row?.closest('article');
    const btnEl = row?.querySelector('[data-ls-card-forum]');
    if (!row || !card || !btnEl) return null;
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    return { btn: r(btnEl), card: r(card) };
  });
  check('D3 мобайл: кнопка видима и справа (Δ≤14px)', !!rects && rects.btn.w > 0 && Math.abs((rects.card.x + rects.card.w) - (rects.btn.x + rects.btn.w)) <= 14);
  const metrics = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  check('D4 мобайл: без горизонтального скролла (sw=iw=375)', metrics.sw === metrics.iw && metrics.iw === 375);
  await ctx.close();
}

await browser.close();

console.log('--- CONSOLE ERRORS ---');
check('Z1 консоль чистая (0 ошибок)', errors.length === 0);
if (errors.length) console.log(errors.join('\n'));

console.log(`\nИТОГ: ${ok} OK / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
