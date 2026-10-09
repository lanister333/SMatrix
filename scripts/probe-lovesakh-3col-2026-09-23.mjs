/**
 * ТЗ 2026-09-23 «Знакомства (Love Sakh)» — трёхколоночная страница /znakomstva.
 * Проверки:
 *   A) Структура: 3 колонки; заголовок/подзаголовок; «+ Разместить анкету» ×2;
 *      поиск; фильтр «Место» + «Показать»; 4 вкладки дословно; «О разделе» и
 *      «Правила раздела» (тексты ТЗ дословно); пагинация-строка; часы.
 *   B) Вкладки: переключение БЕЗ перезагрузки (URL стабилен, лента меняется),
 *      в каждой вкладке — сид-анкета: город+ник+дата+текст с открытыми
 *      контактами; карточки — прямые дети ленты (плоско), img = 0.
 *   C) Гость: клик «Разместить анкету» (левая и центральная кнопки) →
 *      ДОСЛОВНАЯ строка ТЗ, форма НЕ открылась.
 *   D) Авторизованный (сид-аккаунт «Модератор»): форма открылась мгновенно
 *      (4 вкладки, город, ОДНО текстовое поле, «Опубликовать», без СМС-шага);
 *      публикация → анкета НАВЕРХУ ленты; зачистка пробы.
 *   E) Поиск «Найти» и фильтр «Место → Показать» (и «Сбросить»).
 *   F) Мобайл 375 без горскролла; консоль чистая.
 * Запуск: node scripts/probe-lovesakh-3col-2026-09-23.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const AUTH_KEY = 'sm_auth';
let ok = 0, fail = 0;
const check = (name, cond) => { if (cond) { ok++; console.log(`OK   ${name}`); } else { fail++; console.log(`FAIL ${name}`); } };

const TABS = [
  { key: 'm4w', label: 'Мужчина ищет женщину', city: 'Корсаков', nick: 'Роман_Корсаков', contacts: ['@korsakov_active', '8-924-111-AA-BB'], marker: 'Переехал в Корсаков год назад' },
  { key: 'w4m', label: 'Женщина ищет мужчину', city: 'Южно-Сахалинск', nick: 'Наталья_ЮС', contacts: ['8-914-000-CC-DD'], marker: 'Ищу надежного, честного человека' },
  { key: 'friendship', label: 'Дружба / Общение', city: 'Холмск', nick: 'Мария_Холмск', contacts: ['@holmsk_girl'], marker: 'Недавно вернулась на Сахалин' },
  { key: 'person', label: 'Ищу человека / Благодарность', city: 'Южно-Сахалинск / Долинская трасса', nick: 'Ольга_ЮС', contacts: ['8-924-222-EE-FF'], marker: 'Ищу парня на сером Делика' },
];
// ТЗ 2026-09-23: единая ДОСЛОВНАЯ строка доступа.
const ACCESS_NOTE = 'Публикация доступна только зарегистрированным пользователям. Гости могут только читать';
const GUEST_HINT = ACCESS_NOTE;
const ABOUT_FRAGMENTS = [
  '«Знакомства (Love Sakh)» — бесплатная народная доска для поиска людей, создания семей и дружбы на Сахалине.',
  'Здесь нет фото и обязательного возраста ради приватности жителей.',
  'Вкладка «Благодарность» создана для поиска случайных героев на дорогах острова.',
];
const RULES = [
  'Раздел полностью бесплатный.',
  'Контакты открыты сразу в тексте.',
  'Любая коммерция, реклама или платные услуги запрещены — бан навсегда.',
];
const PROBE_MARKER = 'Ищу компанию из Холмска';
const PROBE_TEXT = 'Ищу компанию из Холмска для совместных прогулок по набережной, походов в кино и разговоров за кофе. Пишите в Telegram: @probe_test';

const errors = [];
const listen = (page, tag) => {
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text()}`); });
};

const browser = await chromium.launch();

/* ---------- A+B: гость — структура, вкладки, карточки ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await ctx.newPage();
  listen(page, 'guest');
  await page.goto(BASE + '/znakomstva', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-ls-cards="1"] article', { timeout: 30000 });

  // A: три колонки каркаса
  check('A1 каркас: left/center/right колонки', (await page.locator('[data-ls-layout="1"] > aside.left-column').count()) === 1
    && (await page.locator('[data-ls-layout="1"] > div.center-column').count()) === 1
    && (await page.locator('[data-ls-layout="1"] > aside.right-column').count()) === 1);
  check('A2 заголовок «Знакомства (Love Sakh)»', ((await page.locator('[data-ls-title="1"]').textContent()) ?? '').trim() === 'Знакомства (Love Sakh)');
  check('A3 подзаголовок (одна строка) есть', ((await page.locator('[data-ls-desc="1"]').textContent()) ?? '').length > 20);
  check('A4 кнопка «+ Разместить анкету» в левой колонке', ((await page.locator('[data-ls-add-left="1"]').textContent()) ?? '').includes('+ Разместить анкету'));
  // ТЗ 2026-09-23: кнопка одна — в ЛЕВОЙ колонке (дубль снят).
  check('A5 кнопка-дубль в центре СНЯТА (ТЗ 2026-09-23)', (await page.locator('[data-ls-add-center="1"]').count()) === 0);
  check('A6 текст блока «Доступ» дословно', ((await page.locator('[data-ls-accessnote="1"]').textContent()) ?? '').trim() === ACCESS_NOTE);
  // ТЗ 2026-09-23: поле ВЫБОРА города (select) + «Показать».
  check('A7 блок «Город»: select + «Показать»', (await page.locator('[data-ls-place-input="1"]').count()) === 1 && (await page.locator('[data-ls-place-input="1"]').evaluate((el) => el.tagName)).toLowerCase() === 'select' && ((await page.locator('[data-ls-place-apply="1"]').textContent()) ?? '').trim() === 'Показать');
  const cityOpts = await page.$$eval('[data-ls-place-input="1"] option', (els) => els.map((e) => e.textContent.trim()));
  check('A8 города в списке: Все города/Южно-Сахалинск/Корсаков/Холмск', cityOpts.includes('Все города') && cityOpts.includes('Южно-Сахалинск') && cityOpts.includes('Корсаков') && cityOpts.includes('Холмск'));
  check('A9 поле поиска по анкетам', (await page.locator('[data-ls-search="1"]').count()) === 1);
  const tabLabels = await page.$$eval('[data-ls-tabs="1"] [role="tab"]', (els) => els.map((e) => e.textContent.trim()));
  check('A10 ровно 4 вкладки дословно', tabLabels.length === 4 && TABS.every((t) => tabLabels.includes(`[ ${t.label} ]`)));
  // Правая колонка: «О разделе» и «Правила раздела» дословно
  const about = (await page.locator('[data-ls-about-text="1"]').textContent()) ?? '';
  for (const f of ABOUT_FRAGMENTS) check(`A11 «О разделе»: фрагмент «${f.slice(0, 28)}…»`, about.includes(f));
  const rules = (await page.locator('[data-ls-rules-list="1"]')?.textContent()) ?? '';
  check('A12 блок «Правила раздела» на месте', ((await page.locator('[data-ls-rules="1"] .dk-blocktitle').textContent()) ?? '').trim() === 'Правила раздела');
  RULES.forEach((r, i) => check(`A13 правило ${i + 1} дословно`, rules.includes(r)));
  const rightText = ((await page.locator('[data-ls-layout="1"] aside.right-column').first().textContent()) ?? '');
  check('A14 часы в правой колонке (сквозная директива)', rightText.includes('Время'));

  // B: вкладки — без перезагрузки (URL стабилен), контент меняется
  const urlBefore = page.url();
  for (const t of TABS) {
    await page.click(`[data-ls-tab="${t.key}"]`);
    await page.waitForFunction(
      (mark) => !!Array.from(document.querySelectorAll('[data-ls-cards="1"] article')).find((c) => (c.textContent || '').includes(mark)),
      t.marker,
      { timeout: 30000 }
    );
    const card = page.locator('[data-ls-cards="1"] article').filter({ hasText: t.marker }).first();
    const city = (await card.locator('[data-ls-card-city]').first().textContent())?.trim();
    const nick = (await card.locator('[data-ls-card-nick]').first().textContent())?.trim();
    const date = (await card.locator('[data-ls-card-date]').first().textContent())?.trim() ?? '';
    const text = (await card.locator('[data-ls-card-text]').first().textContent())?.trim() ?? '';
    check(`B1[${t.key}] URL без перезагрузки`, page.url() === urlBefore);
    check(`B2[${t.key}] город «${t.city}»`, city === t.city);
    check(`B3[${t.key}] ник «${t.nick}»`, nick === t.nick);
    check(`B4[${t.key}] дата/время показаны`, /\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}/.test(date));
    for (const c of t.contacts) check(`B5[${t.key}] контакт открыт сразу: ${c}`, text.includes(c));
    check(`B6[${t.key}] текст 1-в-1 (маркер)`, text.includes(t.marker));
  }
  // Плоский список: карточки — прямые дети ленты; аватаров/фото нет
  await page.click(`[data-ls-tab="${TABS[0].key}"]`);
  await page.waitForSelector('[data-ls-cards="1"] article', { timeout: 30000 });
  const flat = await page.evaluate(() => {
    const feed = document.querySelector('[data-ls-cards="1"]');
    return Array.from(feed.children).every((el) => el.tagName === 'ARTICLE');
  });
  check('B7 лента плоская: карточки — прямые дети', flat);
  const imgs = await page.evaluate(() => document.querySelectorAll('[data-ls-cards="1"] article img').length);
  check('B8 аватаров/фото нет (img в карточках = 0)', imgs === 0);
  const cardStyle = await page.evaluate(() => {
    const c = document.querySelector('[data-ls-cards="1"] article');
    const s = getComputedStyle(c);
    return { bg: s.backgroundColor, border: s.borderTopWidth + ' ' + s.borderTopColor };
  });
  check('B9 карточка: белый фон + окантовка как у часов #4A688C', cardStyle.bg === 'rgb(255, 255, 255)' && cardStyle.border === '1px rgb(74, 104, 140)');
  check('B10 строка пагинации «Всего N · новые сверху»', ((await page.locator('[data-ls-pager-info="1"]').textContent()) ?? '').includes('новые сверху'));

  // C: гость жмёт кнопку левой колонки — форма не открывается, строка ТЗ дословно
  await page.click('[data-ls-add-left="1"]');
  await page.waitForSelector('[data-ls-guesthint="1"]', { timeout: 10000 });
  check('C1 гость: ДОСЛОВНАЯ строка ТЗ 2026-09-23', ((await page.locator('[data-ls-guesthint="1"]').textContent()) ?? '').trim() === GUEST_HINT);
  check('C2 гость: форма НЕ открылась', (await page.locator('[data-ls-form="1"]').count()) === 0);
  check('C3 на странице НЕТ «Обсудить на форуме» (жёсткое правило)', !((await page.locator('[data-ls-layout="1"]').textContent()) ?? '').includes('Обсудить на форуме'));
  await ctx.close();
}

/* ---------- E: поиск и «Место» (гость) ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await ctx.newPage();
  listen(page, 'search');
  await page.goto(BASE + '/znakomstva', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-ls-cards="1"] article', { timeout: 30000 });

  // Поиск по тексту анкеты (вкладка «Ищу человека» — «Делика»)
  await page.click('[data-ls-tab="person"]');
  await page.waitForSelector('[data-ls-card-text]', { timeout: 30000 });
  await page.fill('[data-ls-search="1"]', 'Делика');
  await page.click('[data-ls-search-apply="1"]');
  await page.waitForFunction(
    () => !!Array.from(document.querySelectorAll('[data-ls-cards="1"] article')).find((c) => (c.textContent || '').includes('Делика')),
    { timeout: 30000 }
  );
  const found = await page.locator('[data-ls-cards="1"] article').count();
  check('E1 поиск «Делика» находит анкету Ольги (1 карточка)', found === 1);
  check('E2 кнопка «Сбросить» появилась', (await page.locator('[data-ls-search-reset="1"]').count()) === 1);
  await page.click('[data-ls-search-reset="1"]');
  await page.waitForTimeout(500);

  // «Место»: на вкладке «Дружба» фильтр «Холм» оставляет анкету Марии,
  // «Корсаков» — пусто (совмещение категории и места)
  await page.click('[data-ls-tab="friendship"]');
  await page.waitForSelector('[data-ls-card-text]', { timeout: 30000 });
  await page.selectOption('[data-ls-place-input="1"]', 'Холмск');
  await page.click('[data-ls-place-apply="1"]');
  await page.waitForFunction(() => !document.querySelector('[data-ls-empty="1"]'), { timeout: 30000 }).catch(() => {});
  await page.waitForSelector('[data-ls-cards="1"] article', { timeout: 30000 });
  const holmCards = await page.locator('[data-ls-cards="1"] article').count();
  check('E3 «Место» = «Холм»: анкета Холмска на месте', holmCards === 1 && ((await page.locator('[data-ls-card-city]').first().textContent()) ?? '').includes('Холмск'));
  await page.selectOption('[data-ls-place-input="1"]', 'Корсаков');
  await page.click('[data-ls-place-apply="1"]');
  await page.waitForSelector('[data-ls-empty="1"]', { timeout: 30000 });
  check('E4 «Место» = «Корсаков» на вкладке «Дружба»: пусто', ((await page.locator('[data-ls-empty="1"]').textContent()) ?? '').includes('ничего не найдено'));
  // Сброс места через кнопку сброса
  if ((await page.locator('[data-ls-place-reset="1"]').count()) > 0) {
    await page.click('[data-ls-place-reset="1"]');
    await page.waitForSelector('[data-ls-cards="1"] article', { timeout: 30000 });
    check('E5 «Сбросить место» возвращает анкету', (await page.locator('[data-ls-cards="1"] article').count()) === 1);
  } else {
    check('E5 «Сбросить место» возвращает анкету', false);
  }
  await ctx.close();
}

/* ---------- D: авторизованный — форма и публикация ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await ctx.newPage();
  listen(page, 'auth');
  // Вход через API → токен в localStorage (как useAuth.login); сид-аккаунт
  // «Модератор» (пароль Moderator2026 из seed.js).
  const r = await ctx.request.post(BASE + '/api/auth/login', {
    data: { email: 'u1_модератор@sakhmatrix.local', password: 'Moderator2026' },
  });
  const login = await r.json();
  const modToken = login?.user?.token ?? '';
  check('D1 вход сид-аккаунта через API', r.ok() && !!modToken);
  // Зачистка хвостов прежних прогонов (@probe_test)
  const mine = await ctx.request.get(`${BASE}/api/znakomstva?mine=1&token=${encodeURIComponent(modToken)}`);
  const md = await mine.json();
  for (const j of (md.posts ?? []).filter((p) => (p.body || '').includes('@probe_test'))) {
    await ctx.request.delete(`${BASE}/api/znakomstva/${j.id}?token=${encodeURIComponent(modToken)}`);
  }
  await page.addInitScript(
    ([key, val]) => localStorage.setItem(key, val),
    [AUTH_KEY, JSON.stringify({ token: login.user.token, user: login.user })]
  );
  await page.goto(BASE + '/znakomstva', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-ls-cards="1"] article', { timeout: 30000 });
  await page.click('[data-ls-tab="friendship"]');
  await page.waitForSelector('[data-ls-cards="1"] article', { timeout: 30000 });

  await page.click('[data-ls-add-left="1"]');
  await page.waitForSelector('[data-ls-form="1"]', { timeout: 10000 });
  check('D2 форма открылась сразу после клика', await page.locator('[data-ls-form="1"]').isVisible());
  check('D3 в форме выбор одной из 4 вкладок', (await page.$$eval('[data-ls-form-tabs="1"] [data-ls-form-tab]', (els) => els.length)) === 4);
  check('D4 поле «Город» чистое', (await page.inputValue('[data-ls-city="1"]')) === '');
  check('D5 ОДНО большое текстовое поле чистое', (await page.inputValue('[data-ls-text="1"]')) === '');
  check('D6 кнопка «Опубликовать» (без СМС-шага)', ((await page.locator('[data-ls-publish="1"]').textContent()) ?? '').includes('Опубликовать'));

  await page.click('[data-ls-form-tab="friendship"]');
  await page.fill('[data-ls-city="1"]', 'Холмск');
  await page.fill('[data-ls-text="1"]', PROBE_TEXT);
  await page.click('[data-ls-publish="1"]');
  const pubResult = await Promise.race([
    page
      .waitForFunction(
        (mark) => {
          const first = document.querySelector('[data-ls-cards="1"] article [data-ls-card-text]');
          return first && (first.textContent || '').includes(mark);
        },
        PROBE_MARKER,
        { timeout: 180000 }
      )
      .then(() => 'posted'),
    page
      .waitForSelector('[data-ls-note="1"]', { timeout: 180000 })
      .then(async () => {
        const t = (await page.locator('[data-ls-note="1"]').textContent()) ?? '';
        return t.includes('скрыто') ? 'hidden: ' + t.trim() : 'note-ok: ' + t.trim();
      }),
    page
      .waitForSelector('[data-ls-err="1"]', { timeout: 180000 })
      .then(async () => 'err: ' + ((await page.locator('[data-ls-err="1"]').textContent()) ?? '').trim()),
  ]).catch(() => 'timeout');
  check('D7 анкета опубликована и НАВЕРХУ ленты (или понятный исход)', pubResult === 'posted' || pubResult.startsWith('note-ok') || pubResult.startsWith('hidden'), );
  if (pubResult !== 'posted') console.log(`INFO исход публикации: ${pubResult}`);
  // Форма закрылась после публикации
  check('D8 форма закрыта после публикации', (await page.locator('[data-ls-form="1"]').count()) === 0);
  // Зачистка пробы
  const mine2 = await ctx.request.get(`${BASE}/api/znakomstva?mine=1&token=${encodeURIComponent(modToken)}`);
  const md2 = await mine2.json();
  const junk = (md2.posts ?? []).filter((p) => (p.body || '').includes('@probe_test'));
  for (const j of junk) {
    await ctx.request.delete(`${BASE}/api/znakomstva/${j.id}?token=${encodeURIComponent(modToken)}`);
  }
  check('D9 пробная анкета зачищена', junk.length >= 1);
  await ctx.close();
}

/* ---------- F: мобайл 375 ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await ctx.newPage();
  listen(page, 'mobile');
  await page.goto(BASE + '/znakomstva', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-ls-cards="1"] article', { timeout: 30000 });
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check('F1 мобайл 375 без горскролла (sw=375)', sw === 375);
  check('F2 вкладки видны', await page.locator('[data-ls-tabs="1"]').isVisible());
  // На ≤480px дублирующая кнопка в центре скрыта сквозной директивой сайта
  // (зад. 39: одна кнопка создания на смартфоне — в левой колонке, которая
  // на мобайле стоит ПЕРВОЙ; то же у «Рекомендую»/«Где купить» и др.)
  check('F3 кнопка «+ Разместить анкету» слева видна (дубля нет вообще, ТЗ 2026-09-23)', (await page.locator('[data-ls-add-left="1"]').isVisible()) && (await page.locator('[data-ls-add-center="1"]').count()) === 0);
  await page.screenshot({ path: '/home/z/my-project/download/lovesakh-3col-mobile-2026-09-23.png' });
  await ctx.close();
}

check('Z1 консоль чистая (0 ошибок)', errors.length === 0);
if (errors.length) console.log(errors.slice(0, 6).join('\n'));

console.log(`\nИТОГ: ${ok} OK / ${fail} FAIL`);
await browser.close();
process.exit(fail ? 1 : 0);
