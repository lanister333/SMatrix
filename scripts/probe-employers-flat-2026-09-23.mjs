/**
 * ТЗ 2026-09-23 «О работодателях» (/o-rabotodatelyah) — Flat 2.0,
 * Пункты 5/6/8/20 ТЗ №2. Проверки:
 *   A) Структура (гость, 1440): три колонки; заголовок/подзаголовок;
 *      левая — «+ Описать трудовой опыт» + ДОСЛОВНЫЙ текст доступа +
 *      «Поиск по организации» (плейсхолдер «Название компании или ИП»,
 *      кнопка «Найти») + фильтр по городам (Все города + Сахалин/Курилы);
 *      правая — часы, «О разделе» (дословно: без «чёрных списков»,
 *      площадка ≠ автор утверждений), «Правила публикации» В РАМКЕ
 *      (вводка «Жесткие ограничения и правила:» + 4 пункта дословно).
 *   B) Лента сид-карточек: 3 карточки; 📍 Компания (Город); 📅 Период
 *      работы; «Личный опыт:»; ТЗ-пример (Сахалин-Строй-Ресурс) с
 *      «Особое упоминание человека:» («Человек ≠ Организация»); у карточки
 *      без упоминания строки НЕТ; дисклеймер дословно в каждой; кнопка
 *      «💬 Обсудить на форуме» справа, href=/forum/category/karera-biznes--rabotodateli,
 *      относительный, 0 localhost.
 *   C) Гость кликает кнопку → ДОСЛОВНАЯ строка ТЗ, форма НЕ открыта.
 *   D) Кнопка «Обсудить на форуме» РЕАЛЬНО открывает страницу форума
 *      /forum/category/karera-biznes--rabotodateli (рубрика 78 «Карьера,
 *      бизнес ▸ Работодатели»).
 *   E) Авторизованный (сид-аккаунт «Модератор»): форма (Компания/ИП,
 *      Город, Период, Личный опыт, Особое упоминание — необязательное);
 *      пустая публикация → ошибки; лозунги («Там одни мошенники, всегда
 *      всех обманывают») → отклонено ИИ-фильтром, ДОСЛОВНОЕ сообщение,
 *      текст СОХРАНЁН; фактура → опубликовано, карточка сверху; зачистка.
 *   F) Поиск «Сахалин-Строй» → 1 карточка; город «Холмск» → 1 карточка;
 *      сброс возвращает все.
 *   G) Мобайл 375: без горскролла; левая кнопка видима; кнопка форума видима.
 *   Z) Консоль чистая (без учёта ожидаемых 400 негативных проверок).
 * Запуск: node scripts/probe-employers-flat-2026-09-23.mjs
 */
import { chromium } from 'playwright';
import { createRequire } from 'module';

const BASE = 'http://localhost:3000';
let ok = 0, fail = 0;
const check = (name, cond) => { if (cond) { ok++; console.log(`OK   ${name}`); } else { fail++; console.log(`FAIL ${name}`); } };

const RUBRIC_URL = '/forum/category/karera-biznes--rabotodateli';
const ACCESS_NOTE = 'Оставлять отзывы о работодателях могут только зарегистрированные пользователи. Гости сайта могут только читать ленту';
const GUEST_HINT = 'Оставлять отзывы о работодателях могут только зарегистрированные пользователи. Пожалуйста, войдите в свой аккаунт';
const DISCLAIMER = '* Публикация отражает личный опыт автора. SakhMatrix предоставляет площадку и скрывает личные контакты физлиц.';
const SLOGAN_TEXT = 'Там одни мошенники, всегда всех обманывают.';
const FACT_TEXT = 'С 1 по 15 сентября 2026 работал грузчиком на складе: расчёт при увольнении задержали на две недели, трудовую выдали в срок. @ep-probe';
const MENTION_TEXT = 'Отдельно благодарю бригадира Андрея — в свою смену он организовал пересчёт товара без задержек.';

const errors = [];
const listen = (page, tag) => {
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text()}`); });
};

const browser = await chromium.launch();

/* ---------- A+B: гость, 1440 — структура и лента ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  listen(page, 'guest');
  await page.goto(BASE + '/o-rabotodatelyah', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-ep-card]', { timeout: 30000 });

  check('A1 каркас: left/center/right колонки', (await page.locator('.ep-layout .left-column').count()) === 1 && (await page.locator('.ep-layout .center-column').count()) === 1 && (await page.locator('.ep-layout .right-column').count()) === 1);
  check('A2 заголовок «О работодателях»', ((await page.textContent('[data-ep-title="1"]')) ?? '').trim() === 'О работодателях');
  check('A3 подзаголовок: сухая фиксация без «чёрных списков»', ((await page.textContent('[data-ep-desc="1"]')) ?? '').includes('без лозунгов и «чёрных списков»'));
  check('A4 левая кнопка «+ Описать трудовой опыт»', ((await page.textContent('[data-ep-add-left="1"]')) ?? '').trim() === '+ Описать трудовой опыт');
  check('A5 центральная кнопка-дубль', ((await page.textContent('[data-ep-add-center="1"]')) ?? '').trim() === '+ Описать трудовой опыт');
  check('A6 текст доступа ДОСЛОВНО (ТЗ)', ((await page.textContent('[data-ep-accessnote="1"]')) ?? '').trim() === ACCESS_NOTE);
  check('A7 «Поиск по организации» заголовок блока', ((await page.textContent('[data-ep-searchblock="1"] .ep-blocktitle')) ?? '').trim() === 'Поиск по организации');
  check('A8 плейсхолдер «Название компании или ИП»', ((await page.getAttribute('[data-ep-search-input="1"]', 'placeholder')) ?? '') === 'Название компании или ИП');
  check('A9 кнопка «Найти»', ((await page.textContent('[data-ep-search-apply="1"]')) ?? '').trim() === 'Найти');
  check('A10 фильтр по городам: подпись + «Все города»', ((await page.textContent('.ep-citylabel')) ?? '').trim() === 'Фильтр по городам' && ((await page.$eval('[data-ep-city-select="1"] option', (el) => el.textContent)) ?? '') === 'Все города');
  const cityOptions = await page.$$eval('[data-ep-city-select="1"] option', (els) => els.map((e) => e.textContent));
  check('A11 города ТЗ в списке (Южно-Сахалинск, Холмск, Корсаков)', cityOptions.includes('Южно-Сахалинск') && cityOptions.includes('Холмск') && cityOptions.includes('Корсаков') && cityOptions.includes('Южно-Курильск'));
  check('A12 правая: «О разделе»', ((await page.textContent('[data-ep-about="1"] .ep-blocktitle')) ?? '').trim() === 'О разделе');
  const about = ((await page.textContent('[data-ep-about-text="1"]')) ?? '').replace(/\s+/g, ' ');
  check('A13 «О разделе» дословно: инструмент фиксации опыта', about.includes('инструмент фиксации реального трудового опыта жителей Сахалина и Курил'));
  check('A14 «О разделе» дословно: не «чёрные списки», не автор утверждений', about.includes('не ведем «черных списков» компаний') && about.includes('не является автором пользовательских утверждений'));
  check('A15 правая: «Правила публикации»', ((await page.textContent('[data-ep-rules="1"] .ep-blocktitle')) ?? '').trim() === 'Правила публикации');
  const frameBorder = await page.$eval('[data-ep-rules-frame="1"]', (el) => getComputedStyle(el).borderTopWidth);
  check('A16 правила В РАМКЕ (border-top ≥1px)', parseFloat(frameBorder) >= 1);
  check('A17 вводка «Жесткие ограничения и правила:»', ((await page.textContent('[data-ep-rules-frame="1"] .ep-keyrule')) ?? '').trim() === 'Жесткие ограничения и правила:');
  check('A18 ровно 4 пункта правил', (await page.$$eval('[data-ep-rules-list="1"] li', (els) => els.length)) === 4);
  const rules = await page.$$eval('[data-ep-rules-list="1"] li', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  check('A19 п.1: конкретика + лозунги ТЗ дословно', rules[0].includes('даты, условия работы, должностные обязанности, факты выплат или задержек') && rules[0].includes('«там одни мошенники», «всегда всех обманывают»') && rules[0].includes('ИИ-фильтром'));
  check('A20 п.2: запрет личных данных физлиц, только ООО/ИП и рабочие имена', rules[1].includes('номера сотовых телефонов директоров, бухгалтеров или мастеров') && rules[1].includes('Только официальное название ООО / ИП и рабочие имена'));
  check('A21 п.3: «Человек не равен организации» + благодарность специалисту', rules[2].includes('Человек не равен организации') && rules[2].includes('поблагодарить конкретного специалиста или руководителя'));
  check('A22 п.4: рубрика «Карьера, бизнес ▸ Работодатели» по кнопке под отзывом', rules[3].includes('«Карьера, бизнес ▸ Работодатели»') && rules[3].includes('по кнопке под отзывом'));
  check('A23 часы справа сверху (сквозная директива)', await page.locator('.right-column .sakh-clock').first().isVisible());

  /* --- B: карточки --- */
  const cards = await page.$$eval('[data-ep-card]', (els) => els.map((el) => ({
    id: el.getAttribute('data-ep-card'),
    place: (el.querySelector('[data-ep-card-place]')?.textContent ?? '').trim(),
    period: (el.querySelector('[data-ep-card-period]')?.textContent ?? '').trim(),
    text: (el.querySelector('[data-ep-card-text]')?.textContent ?? '').trim(),
    mentionRow: el.querySelector('[data-ep-card-mention-row]') ? (el.querySelector('[data-ep-card-mention]')?.textContent ?? '').trim() : null,
    disclaimer: (el.querySelector('[data-ep-card-disclaimer]')?.textContent ?? '').trim(),
    btn: el.querySelector('[data-ep-card-forum]')?.getAttribute('href') ?? null,
    btnText: (el.querySelector('[data-ep-card-forum]')?.textContent ?? '').trim(),
    imgs: el.querySelectorAll('img').length,
  })));
  check('B1 ровно 3 сид-карточки', cards.length === 3);
  check('B2 все с 📍 Компания (Город)', cards.every((c) => /^📍 .+ \(.+\)$/.test(c.place)));
  check('B3 все с 📅 Период работы:', cards.every((c) => /^📅 Период работы: .+/.test(c.period)));
  const byEmp = (frag) => cards.find((c) => c.place.includes(frag));
  check('B4 ТЗ-пример: ООО «Сахалин-Строй-Ресурс» (Южно-Сахалинск)', (byEmp('Сахалин-Строй-Ресурс')?.place ?? '') === '📍 ООО «Сахалин-Строй-Ресурс» (Южно-Сахалинск)');
  check('B5 ТЗ-пример: период «май – август 2026 г.»', byEmp('Сахалин-Строй-Ресурс')?.period === '📅 Период работы: май – август 2026 г.');
  check('B6 ТЗ-пример: задержка расчёта в опыте', byEmp('Сахалин-Строй-Ресурс')?.text.includes('задержкой окончательного расчёта'));
  check('B7 ТЗ-пример: «Особое упоминание человека:» с Дмитрием Николаевичем (Человек ≠ Организация)', byEmp('Сахалин-Строй-Ресурс')?.mentionRow?.includes('Дмитрия Николаевича') === true);
  check('B8 карточка без упоминания НЕ рендерит строку', byEmp('Портовый пекарь')?.mentionRow === null);
  check('B9 дисклеймер ДОСЛОВНО в каждой карточке', cards.every((c) => c.disclaimer === DISCLAIMER));
  check('B10 кнопка форума в КАЖДОЙ карточке', cards.every((c) => !!c.btn));
  check('B11 текст кнопки «💬 Обсудить на форуме»', cards.every((c) => c.btnText === '💬 Обсудить на форуме'));
  check('B12 href байт-в-байт рубрики 78', cards.every((c) => c.btn === RUBRIC_URL));
  check('B13 href относительный, 0 localhost', cards.every((c) => !c.btn.startsWith('http') && !c.btn.includes('localhost')));
  check('B14 аватаров в карточках НЕТ', cards.every((c) => c.imgs === 0));
  const align = await page.evaluate(() => {
    const card = document.querySelector('[data-ep-card]');
    const btn = card.querySelector('[data-ep-card-forum]');
    const c = card.getBoundingClientRect(), b = btn.getBoundingClientRect();
    return { delta: Math.abs(c.right - b.right), rightOfCenter: b.left > c.left + c.width / 2 };
  });
  check('B15 кнопка прижата СПРАВА (Δ≤14px, правее центра)', align.delta <= 14 && align.rightOfCenter);
  const cardBg = await page.$eval('[data-ep-card]', (el) => getComputedStyle(el).backgroundColor);
  const cardBorder = await page.$eval('[data-ep-card]', (el) => getComputedStyle(el).borderColor);
  check('B16 карточка белая в окантовке как у часов #4A688C (директива 2026-09-24)', cardBg === 'rgb(255, 255, 255)' && cardBorder === 'rgb(74, 104, 140)');

  /* --- C: гость кликает «+ Описать трудовой опыт» --- */
  await page.click('[data-ep-add-left="1"]');
  await page.waitForTimeout(400);
  check('C1 гостю — ДОСЛОВНАЯ строка ТЗ', ((await page.textContent('[data-ep-guesthint="1"]')) ?? '').trim() === GUEST_HINT);
  check('C2 форма НЕ открыта', (await page.locator('[data-ep-form="1"]').count()) === 0);

  /* --- D: кнопка форума реально открывает рубрику форума --- */
  await page.click('[data-ep-card-forum]');
  await page.waitForURL('**' + RUBRIC_URL, { timeout: 20000 });
  // Рубрика разрешается клиентски из /api/bootstrap — ждём хлебные крошки.
  await page.waitForFunction(
    () => ((document.querySelector('[data-forum-crumbs]')?.textContent ?? '')).includes('Работодатели'),
    null,
    { timeout: 20000 }
  );
  const crumbText = ((await page.textContent('[data-forum-crumbs]')) ?? '').replace(/\s+/g, ' ');
  check('D1 кнопка ведёт на /forum/category/karera-biznes--rabotodateli', page.url().endsWith(RUBRIC_URL));
  check('D2 крошки: Форум → Карьера, бизнес → Работодатели', crumbText.includes('Форум') && crumbText.includes('Карьера, бизнес') && crumbText.includes('Работодатели'));
  await ctx.close();
}

/* ---------- E: поиск и город (отдельный гость) ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  listen(page, 'search');
  await page.goto(BASE + '/o-rabotodatelyah', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-ep-card]', { timeout: 30000 });
  await page.fill('[data-ep-search-input="1"]', 'Сахалин-Строй');
  await page.click('[data-ep-search-apply="1"]');
  await page.waitForFunction(() => document.querySelectorAll('[data-ep-card]').length === 1, null, { timeout: 15000 });
  check('E1 поиск «Сахалин-Строй» → 1 карточка', (await page.locator('[data-ep-card]').count()) === 1);
  check('E2 «Сбросить» появился', (await page.locator('[data-ep-search-reset="1"]').count()) === 1);
  await page.click('[data-ep-search-reset="1"]');
  await page.waitForFunction(() => document.querySelectorAll('[data-ep-card]').length === 3, null, { timeout: 15000 });
  check('E3 сброс поиска → снова 3 карточки', (await page.locator('[data-ep-card]').count()) === 3);
  await page.selectOption('[data-ep-city-select="1"]', 'Холмск');
  await page.waitForFunction(() => document.querySelectorAll('[data-ep-card]').length === 1, null, { timeout: 15000 });
  check('E4 фильтр города «Холмск» → 1 карточка (применяется сразу)', (await page.locator('[data-ep-card]').count()) === 1);
  check('E5 это Портовый пекарь', ((await page.textContent('[data-ep-card-place]')) ?? '').includes('Портовый пекарь'));
  await page.click('[data-ep-search-reset="1"]');
  await page.waitForFunction(() => document.querySelectorAll('[data-ep-card]').length === 3, null, { timeout: 15000 });
  check('E6 сброс города → снова 3 карточки', (await page.locator('[data-ep-card]').count()) === 3);
  await ctx.close();
}

/* ---------- F: авторизованный — форма, ИИ-фильтр, публикация ---------- */
let createdId = null;
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  listen(page, 'auth');
  const r = await ctx.request.post(BASE + '/api/auth/login', {
    data: { email: 'u1_модератор@sakhmatrix.local', password: 'Moderator2026' },
  });
  const login = await r.json();
  const token = login?.user?.token ?? '';
  check('F1 вход сид-аккаунта через API', r.ok() && !!token);
  await page.addInitScript(
    ([key, val]) => localStorage.setItem(key, val),
    ['sm_auth', JSON.stringify({ token: login.user.token, user: login.user })]
  );
  await page.goto(BASE + '/o-rabotodatelyah', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-ep-card]', { timeout: 30000 });

  await page.click('[data-ep-add-center="1"]');
  await page.waitForSelector('[data-ep-form="1"]', { timeout: 10000 });
  check('F2 форма открылась, гостевой подсказки нет', await page.locator('[data-ep-form="1"]').isVisible() && (await page.locator('[data-ep-guesthint="1"]').count()) === 0);
  check('F3 поле «Компания / ИП»', ((await page.textContent('[data-ep-field-employer="1"] .ep-steplabel')) ?? '').trim().startsWith('Компания / ИП'));
  check('F4 поля «Город» и «Период работы»', (await page.locator('[data-ep-city="1"]').count()) === 1 && ((await page.textContent('[data-ep-field-city="1"]')) ?? '').includes('Период работы'));
  check('F5 поле «Личный опыт» + подсказка без лозунгов', ((await page.textContent('[data-ep-field-experience="1"] .ep-steplabel')) ?? '').trim().startsWith('Личный опыт') && ((await page.textContent('[data-ep-field-experience="1"]')) ?? '').includes('без лозунгов'));
  check('F6 поле «Особое упоминание человека» — необязательное, «Человек ≠ Организация»', ((await page.textContent('[data-ep-field-mention="1"]')) ?? '').includes('необязательно') && ((await page.textContent('[data-ep-field-mention="1"]')) ?? '').includes('Человек ≠ Организация'));

  // Пустая публикация: поля обязательны
  await page.click('[data-ep-publish="1"]');
  await page.waitForSelector('[data-ep-err="1"]', { timeout: 5000 });
  check('F7 пустая публикация → ошибка компании', ((await page.textContent('[data-ep-err="1"]')) ?? '').includes('название компании или ИП'));
  await page.fill('[data-ep-employer="1"]', 'ИП Пробный');
  await page.click('[data-ep-publish="1"]');
  await page.waitForFunction(() => (document.querySelector('[data-ep-err="1"]')?.textContent ?? '').includes('город'), null, { timeout: 5000 });
  check('F8 без города → ошибка', ((await page.textContent('[data-ep-err="1"]')) ?? '').includes('город'));
  await page.selectOption('[data-ep-city="1"]', 'Южно-Сахалинск');
  await page.click('[data-ep-publish="1"]');
  await page.waitForFunction(() => (document.querySelector('[data-ep-err="1"]')?.textContent ?? '').includes('период работы'), null, { timeout: 5000 });
  check('F9 без периода → ошибка', ((await page.textContent('[data-ep-err="1"]')) ?? '').includes('период работы'));
  await page.fill('[data-ep-period="1"]', 'сентябрь 2026 г.');
  await page.click('[data-ep-publish="1"]');
  await page.waitForFunction(() => (document.querySelector('[data-ep-err="1"]')?.textContent ?? '').includes('личный опыт'), null, { timeout: 5000 });
  check('F10 без опыта → ошибка', ((await page.textContent('[data-ep-err="1"]')) ?? '').includes('личный опыт'));

  // ИИ-фильтр лозунгов: отклонение, дословное сообщение, текст СОХРАНЁН
  await page.fill('[data-ep-experience="1"]', SLOGAN_TEXT);
  await page.click('[data-ep-publish="1"]');
  await page.waitForSelector('[data-ep-rewrite="1"]', { timeout: 20000 });
  check('F11 лозунги → отклонено ИИ-фильтром (плашка)', await page.locator('[data-ep-rewrite="1"]').isVisible());
  const rewriteMsg = ((await page.textContent('[data-ep-rewrite="1"]')) ?? '').replace(/\s+/g, ' ');
  check('F12 сообщение содержит лозунги ТЗ дословно и «ИИ-фильтром»', rewriteMsg.includes('«там одни мошенники», «всегда всех обманывают»') && rewriteMsg.includes('ИИ-фильтром'));
  check('F13 текст в форме СОХРАНЁН (не стёрт)', ((await page.inputValue('[data-ep-experience="1"]')) ?? '') === SLOGAN_TEXT);
  check('F14 карточка НЕ создана (лента 3)', (await page.locator('[data-ep-card]').count()) === 3);

  // Фактура + упоминание человека → публикация проходит, карточка сверху
  await page.fill('[data-ep-experience="1"]', FACT_TEXT);
  await page.fill('[data-ep-mention="1"]', MENTION_TEXT);
  await page.click('[data-ep-publish="1"]');
  const resp = await page.waitForResponse((res) => res.url().includes('/api/employers') && res.request().method() === 'POST', { timeout: 90000 });
  const body = await resp.json().catch(() => ({}));
  check('F15 фактура → публикация прошла (ok:true)', resp.ok() && body.ok === true);
  createdId = body.id ?? null;
  if (body.ok && !body.hidden) {
    await page.waitForFunction(() => document.querySelectorAll('[data-ep-card]').length === 4, null, { timeout: 20000 });
    const topText = ((await page.textContent('[data-ep-cards="1"] [data-ep-card] [data-ep-card-text]')) ?? '').trim();
    check('F16 новая карточка НАВЕРХУ ленты', topText.includes('15 сентября 2026'));
    check('F17 упоминание человека в новой карточке', ((await page.textContent('[data-ep-cards="1"] [data-ep-card] [data-ep-card-mention]')) ?? '').includes('бригадира Андрея'));
    check('F18 форма закрылась, поля чистые', (await page.locator('[data-ep-form="1"]').count()) === 0);
  } else {
    // ИИ-модерация скрыла карточку (допустимый исход) — форма отработала
    check('F16 публикация создана (скрыта ИИ-модерацией раздела)', !!createdId);
    check('F17 форма закрылась после публикации', (await page.locator('[data-ep-form="1"]').count()) === 0);
  }
  await ctx.close();
}

/* ---------- G: мобайл 375 ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await ctx.newPage();
  listen(page, 'mobile');
  await page.goto(BASE + '/o-rabotodatelyah', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-ep-card]', { timeout: 30000 });
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check('G1 без горизонтального скролла (sw=375)', sw <= 375);
  check('G2 левая кнопка «+ Описать трудовой опыт» видима', await page.locator('[data-ep-add-left="1"]').isVisible());
  check('G3 кнопка форума видима', await page.locator('[data-ep-card-forum]').first().isVisible());
  check('G4 карточка места видима', await page.locator('[data-ep-card-place]').first().isVisible());
  check('G5 дисклеймер видим', await page.locator('[data-ep-card-disclaimer]').first().isVisible());
  await page.screenshot({ path: 'screenshots/sm-employers-flat-mobile-2026-09-23.png', fullPage: true });
  await ctx.close();
}

/* ---------- Z: консоль ---------- */
// Ожидаемые записи: намеренные негативные проверки F7–F11 (пустые поля,
// лозунги) дают HTTP 400 — браузер всегда пишет такие ресурсы в консоль.
const EXPECTED_CONSOLE = [
  'Failed to load resource: the server responded with a status of 400',
];
const realErrors = errors.filter(
  (e) => !EXPECTED_CONSOLE.some((frag) => e.includes(frag))
);
check('Z1 консоль чистая (без учёта ожидаемых 400 от F7–F11)', realErrors.length === 0);
if (realErrors.length) console.log(realErrors.slice(0, 10).join('\n'));

/* ---------- Зачистка публикации пробы ---------- */
if (createdId) {
  try {
    const require = createRequire(import.meta.url);
    const { PrismaClient } = require('@prisma/client');
    const db = new PrismaClient();
    await db.empPost.update({ where: { id: createdId }, data: { isDeleted: true, deletedAt: new Date() } });
    console.log(`CLEANUP: пробная публикация ${createdId} удалена (isDeleted)`);
    await db.$disconnect();
  } catch (e) {
    console.log(`CLEANUP WARN: ${e.message.slice(0, 120)}`);
  }
}

await browser.close();
console.log(`\nИТОГ: ${ok} OK / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
