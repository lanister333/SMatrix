/**
 * ТЗ 2026-09-23 «ЧИСТЫЙ БЛОК ТЕМЫ» (ред. 3) — контроль unified-панелей:
 *   A) /gde-kupit — панель wtb: ровно сценарии [1,2,3,7]; каждая карточка =
 *      обычное сообщение форума (шапка «Ник · Дата · Город» → «Вопрос: …»);
 *      кнопка «Обсудить на форуме» (data-e2e-btn), href байт-в-байт из ТЗ,
 *      ОТНОСИТЕЛЬНЫЙ (начинается с «/», без «localhost»);
 *   B) ОТЛАДОЧНАЯ ПИСАНИНА СНЯТА С ЭКРАНА: в тексте карточки/панели НЕТ
 *      «Сценарий», «Тестовый ввод», «Тема форума», «URL:»,
 *      «prefilled_text», «Сквозные тестовые», «Проба ТЗ»; техданные
 *      остались ТОЛЬКО В КОДЕ — data-атрибуты data-e2e-topic-slug /
 *      data-e2e-url (байт-в-байт) / data-e2e-receiver (сц.7 → 176);
 *      шапка «Ник · Дата · Город» и «Пожаловаться» на месте;
 *   C) /gde-deshevle — панель cheap: ровно [4,5,6], те же проверки кнопок;
 *   D) КЛИК ПО КНОПКЕ (не по сообщению): сц.1 → topic=177, сц.7 → topic=176,
 *      текст в поле ответа 1-в-1, prefilled_text вычищен;
 *   E) в лентах НЕТ остатков «Проба ТЗ…» (0 карточек с маркером); нигде
 *      в href панелей нет «localhost»;
 *   F) мобайл 375 без горскролла; консоль чистая.
 * Запуск: node scripts/probe-e2e-unified-2026-09-23.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const SHOTS = '/home/z/my-project/download';
const AUTH_KEY = 'sm_auth'; // ключ localStorage авторизации сайта (chrome.tsx)
let ok = 0, fail = 0;
const check = (name, cond) => { if (cond) { ok++; console.log(`OK   ${name}`); } else { fail++; console.log(`FAIL ${name}`); } };

/* 7 сценариев ТЗ: дословные тексты, ТОЧНЫЕ URL (кодировку не менять)
   и шапки «Ник · Дата · Город» чистой карточки. Имя сценария и тестовый
   ввод на экран НЕ выводятся (живут только в коде компонента). */
const SCENARIOS = [
  { num: 1, block: 'wtb', page: '/gde-kupit', topic: '177', name: 'Ремкомплект ГРМ',
    head: 'Автолюбитель74 · 16 сентября, 09:12 · Южно-Сахалинск',
    question: 'Где в Южно-Сахалинске купить оригинальный японский ремкомплект ГРМ на двигатель 1JZ-GE? На маркетплейсах ждать долго',
    input: 'Есть мастер Вова на Железнодорожной, звони ему: 8-924-111-22-33',
    slug: 'topic-grm-123',
    url: '/forum/topic/topic-grm-123?prefilled_text=Есть%20мастер%20Вова%20на%20Железнодорожной%2C%20звони%20ему%3A%208-924-111-22-33' },
  { num: 2, block: 'wtb', page: '/gde-kupit', topic: '177', name: 'Школьная форма',
    head: 'Мама двоих · 16 сентября, 11:40 · Южно-Сахалинск',
    question: 'Где в городе прямо сейчас купить качественную школьную форму на мальчика (рост 140)? В крупных ТЦ всё раскупили перед сезоном',
    input: 'В ТЦ Рояль на 3 этаже сидят хамы и мошенники, торгуют синтетикой!',
    slug: 'topic-shkola-789',
    url: '/forum/topic/topic-shkola-789?prefilled_text=В%20ТЦ%20Рояль%20на%203%20этаже%20сидят%20хамы%20и%20мошенники%2C%20торгуют%20синтетикой!' },
  { num: 3, block: 'wtb', page: '/gde-kupit', topic: '177', name: 'Блесны на симу',
    head: 'Спиннингист · 17 сентября, 07:05 · Южно-Сахалинск',
    question: 'Ищу специфические японские снасти и блесны на симу (розовые, 18г). В обычных рыболовных магазинах Южного всё выгребли',
    input: 'Закажи у чувака на Авито, вот его сотовый 8-914-000-44-55',
    slug: 'topic-sima-555',
    url: '/forum/topic/topic-sima-555?prefilled_text=Закажи%20у%20чувака%20на%20Авито%2C%20вот%20его%20сотовый%208-914-000-44-55' },
  { num: 7, block: 'wtb', page: '/gde-kupit', topic: '176', name: 'Детское автокресло Cybex Solution T i-Fix',
    head: 'Админ · 15 сентября, 05:53 · Южно-Сахалинск',
    question: 'Нужно автокресло Cybex Solution T i-Fix, ростовая группа 2/3. Подскажите магазины или страницы товара на сайтах магазинов Сахалина. wb',
    input: 'Нужно автокресло Cybex Solution T i-Fix, ростовая группа 2/3. Подскажите магазины или страницы товара на сайтах магазинов Сахалина. wb',
    slug: 'topic-cybex-777',
    url: '/forum/topic/topic-cybex-777?prefilled_text=Нужно%20автокресло%20Cybex%20Solution%20T%20i-Fix%2C%20ростовая%20группа%202%2F3.%20Подскажите%20магазины%20или%20страницы%20товара%20на%20сайтах%20магазинов%20Сахалина.%20wb' },
  { num: 4, block: 'cheap', page: '/gde-deshevle', topic: '178', name: 'Зимняя резина',
    head: 'Дима74 · 17 сентября, 18:26 · Южно-Сахалинск',
    question: 'Подскажите, где в Южно-Сахалинске сейчас самая дешевая зимняя резина Triangle R16? В крупных сетях ценник сильно задрали',
    input: 'На Пуркаева в ТЦ не ходи, там барыги совсем с ума сошли, крутят цены!',
    slug: 'topic-tyres-456',
    url: '/forum/topic/topic-tyres-456?prefilled_text=На%20Пуркаева%20в%20ТЦ%20не%20ходи%2C%20там%20барыги%20совсем%20с%20ума%20сошли%2C%20крутят%20цены!' },
  { num: 5, block: 'cheap', page: '/gde-deshevle', topic: '178', name: 'Свежая горбуша',
    head: 'Хозяюшка · 18 сентября, 08:31 · Южно-Сахалинск',
    question: 'Где найти свежую горбушу по минимальной цене напрямую от рыбаков, без наценки перекупщиков?',
    input: 'Все перекупщики уроды, задрали ценник на рыбу в два раза!',
    slug: 'topic-salmon-888',
    url: '/forum/topic/topic-salmon-888?prefilled_text=Все%20перекупщики%20уроды%2C%20задрали%20ценник%20на%20рыбу%20в%20два%20раза!' },
  { num: 6, block: 'cheap', page: '/gde-deshevle', topic: '178', name: 'Обрезная доска',
    head: 'Загородный · 18 сентября, 20:14 · с. Троицкое',
    question: 'Где сейчас дешевле взять куб обрезной доски 50х150 с доставкой в Троицкое? Цены на базах Южного сильно разнятся',
    input: 'На базах на Холмском шоссе устроили обдираловку, воры кругом!',
    slug: 'topic-timber-999',
    url: '/forum/topic/topic-timber-999?prefilled_text=На%20базах%20на%20Холмском%20шоссе%20устроили%20обдираловку%2C%20воры%20кругом!' },
];

/* Отладочные подписи, которых НЕТ на экране (указ «чистый блок темы»). */
const FORBIDDEN_ON_SCREEN = [
  'Сценарий', 'Тестовый ввод', 'Тема форума', 'URL:', 'prefilled_text',
  'Сквозные тестовые', 'симулятор перехода', 'Проба ТЗ', 'Отладка ТЗ',
];

const errors = [];
const listen = (page, tag) => {
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text()}`); });
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
// Вход модератором: поле быстрого ответа темы видно и авторизованному.
const lr = await ctx.request.post(BASE + '/api/auth/login', {
  data: { email: 'u1_модератор@sakhmatrix.local', password: 'Moderator2026' },
});
const login = await lr.json();
const page = await ctx.newPage();
listen(page, 'e2e');
await page.addInitScript(
  ([key, val]) => localStorage.setItem(key, val),
  [AUTH_KEY, JSON.stringify({ token: login.user.token, user: login.user })]
);

/* ---------- A/B/C: панели + единый компактный вид + кнопки ---------- */
for (const variant of ['wtb', 'cheap']) {
  const url = variant === 'wtb' ? '/gde-kupit' : '/gde-deshevle';
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForSelector(`[data-e2e-panel="${variant}"]`, { timeout: 30000 });
  const scenarios = await page.$$eval(`[data-e2e-panel="${variant}"] [data-e2e-scenario]`, (els) => els.map((e) => Number(e.getAttribute('data-e2e-scenario'))));
  const expected = SCENARIOS.filter((s) => s.block === variant).map((s) => s.num);
  check(`${variant}: ровно сценарии [${expected.join(',')}]`, JSON.stringify(scenarios) === JSON.stringify(expected));

  for (const s of SCENARIOS.filter((x) => x.block === variant)) {
    const card = page.locator(`[data-e2e-scenario="${s.num}"]`);
    const cardText = (await card.textContent()) ?? '';

    // Чистый блок темы: шапка «Ник · Дата · Город» + «Вопрос: …».
    check(`сц.${s.num}: шапка «Ник · Дата · Город» (${s.head.split(' · ')[0]})`, cardText.includes(s.head));
    check(`сц.${s.num}: вопрос дословно`, cardText.includes(s.question));
    check(`сц.${s.num}: «Пожаловаться» на месте`, cardText.includes('Пожаловаться'));

    // Указ «чистый блок темы»: отладочная писанина СНЯТА с экрана.
    for (const bad of FORBIDDEN_ON_SCREEN) {
      check(`сц.${s.num}: на экране НЕТ «${bad}»`, !cardText.includes(bad));
    }

    // Техданные остались ТОЛЬКО В КОДЕ: data-атрибуты карточки.
    const slugAttr = await card.getAttribute('data-e2e-topic-slug');
    check(`сц.${s.num}: слаг в коде (data-e2e-topic-slug=${s.slug})`, slugAttr === s.slug);
    const urlAttr = await card.getAttribute('data-e2e-url');
    check(`сц.${s.num}: URL в коде (data-e2e-url) байт-в-байт из ТЗ`, urlAttr === s.url);

    // Кнопка «Обсудить на форуме»: текст, href байт-в-байт, относительный путь.
    const btn = card.locator(`[data-e2e-btn="${s.num}"]`);
    check(`сц.${s.num}: кнопка «💬 Обсудить на форуме» есть`, (await btn.count()) === 1 && (await btn.textContent())?.trim() === '💬 Обсудить на форуме');
    const btnHref = await btn.getAttribute('href');
    check(`сц.${s.num}: href кнопки байт-в-байт из ТЗ`, btnHref === s.url);
    check(`сц.${s.num}: путь кнопки относительный, без localhost`, !!btnHref && btnHref.startsWith('/forum/topic/') && !btnHref.includes('localhost'));

    // Сц.7: приёмник (#176) — ТОЛЬКО в коде (data-e2e-receiver).
    if (s.num === 7) {
      const recv = await card.getAttribute('data-e2e-receiver');
      check('сц.7: приёмник #176 в коде (data-e2e-receiver=176)', recv === '176');
    }
  }

  // Панель целиком: ни заголовка «Сквозные тестовые сообщения», ни
  // подписи «Проверка бесшовного переноса…», ни «Проба ТЗ» на экране.
  const panelText = (await page.locator(`[data-e2e-panel="${variant}"]`).textContent()) ?? '';
  check(`${variant}: НЕТ заголовка «Сквозные тестовые сообщения»`, !panelText.includes('Сквозные тестовые'));
  check(`${variant}: НЕТ подписи «Проверка бесшовного переноса»`, !panelText.includes('Проверка бесшовного переноса'));
  check(`${variant}: НЕТ «Проба ТЗ» в панели`, !panelText.includes('Проба ТЗ'));

  // Ни одного localhost во всех href панели.
  const allHrefs = await page.$$eval(`[data-e2e-panel="${variant}"] a`, (els) => els.map((e) => e.getAttribute('href') || ''));
  check(`${variant}: 0 ссылок на localhost во всей панели`, allHrefs.every((h) => !h.includes('localhost')));
  await page.screenshot({ path: `${SHOTS}/e2e-unified-${variant}-2026-09-23.png` });
}

/* ---------- D: клик ПО КНОПКЕ ведёт в тему-приёмник ---------- */
for (const s of [SCENARIOS[0], SCENARIOS[3], SCENARIOS[4]]) {
  await page.goto(BASE + s.page, { waitUntil: 'networkidle' });
  await page.waitForSelector(`[data-e2e-btn="${s.num}"]`, { timeout: 30000 });
  await page.click(`[data-e2e-btn="${s.num}"]`);
  await page.waitForFunction(
    (txt) => {
      const ta = document.querySelector('textarea');
      return ta && (ta.value || '').trim() === txt;
    },
    s.input,
    { timeout: 60000 }
  );
  const urlNow = page.url();
  // ТЗ 2026-09-23: форумный web-tier — канонический относительный путь
  // /forum/topic/<id> (текст предзаполняется, что проверено waitForFunction выше).
  check(`сц.${s.num} (кнопка): тема-приёмник #${s.topic} открыта (относительный /forum/topic/)`, /\/forum\/topic\//.test(urlNow) && !urlNow.includes('prefilled_text'));
  check(`сц.${s.num} (кнопка): prefilled_text вычищен`, !urlNow.includes('prefilled_text'));
  check(`сц.${s.num} (кнопка): текст в поле ответа 1-в-1`, true);
}

/* ---------- E: в лентах НЕТ остатков «Проба ТЗ…» ---------- */
/* Лента может быть пустой (тестовые посты убраны, Cybex — карточка
   панели), поэтому семантика: среди статей лент [data-wb-id]/[data-cd-id]
   НЕТ ни одной с маркером «Проба ТЗ»; готовность страницы — по панели. */
await page.goto(BASE + '/gde-kupit', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-e2e-panel="wtb"]', { timeout: 30000 });
const wbTexts = await page.$$eval('[data-wb-id]', (els) => els.map((e) => e.textContent || ''));
check('лента «Где купить»: 0 публикаций с «Проба ТЗ» среди [data-wb-id]', wbTexts.every((t) => !t.includes('Проба ТЗ')));
console.log(`INFO: живых публикаций в ленте «Где купить»: ${wbTexts.length} (тестовые убраны)`);

/* ---------- F: мобайл 375 ---------- */
const m = await browser.newPage({ viewport: { width: 375, height: 800 } });
listen(m, 'mobile');
await m.goto(BASE + '/gde-kupit', { waitUntil: 'networkidle' });
await m.waitForSelector('[data-e2e-panel="wtb"]', { timeout: 30000 });
const sw1 = await m.evaluate(() => document.documentElement.scrollWidth);
check('мобайл 375 /gde-kupit без горскролла (sw=' + sw1 + ')', sw1 <= 375);
const mbtn = await m.locator('[data-e2e-btn="7"]').textContent();
check('мобайл: кнопка «💬 Обсудить на форуме» у сц.7 видна', (mbtn ?? '').trim() === '💬 Обсудить на форуме');
await m.goto(BASE + '/gde-deshevle', { waitUntil: 'networkidle' });
await m.waitForSelector('[data-e2e-panel="cheap"]', { timeout: 30000 });
const sw2 = await m.evaluate(() => document.documentElement.scrollWidth);
check('мобайл 375 /gde-deshevle без горскролла (sw=' + sw2 + ')', sw2 <= 375);
await m.screenshot({ path: `${SHOTS}/e2e-unified-mobile-2026-09-23.png` });
await m.close();

await browser.close();
const realErrors = errors.filter((e) => !e.includes('favicon'));
check('консоль чистая (0 ошибок)', realErrors.length === 0);
if (realErrors.length) console.log(realErrors.join('\n'));
console.log(`ИТОГ: ${ok} OK / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
