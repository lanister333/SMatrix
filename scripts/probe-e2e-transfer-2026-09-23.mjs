/**
 * ТЗ 2026-09-23: сквозные тестовые сообщения в блоках «ГДЕ КУПИТЬ» и
 * «ГДЕ ДЕШЕВЛЕ» — проверка симулятора перехода на форум:
 *   A) /gde-kupit — панель с ровно 4 сценариями (1–3, 7) в ПРАВИЛЬНОМ блоке;
 *   B) /gde-deshevle — панель с ровно 3 сценариями (4–6);
 *   C) href КАЖДОГО сообщения/темы/URL — байт-в-байт из ТЗ;
 *   D) клик по каждому из 7 сообщений → тема-приёмник (#177/#177/#177/
 *      #178/#178/#178/#176), текст в поле ответа 1-в-1 с тестовым вводом
 *      (у сценария 7 переносится сам вопрос), prefilled_text вычищен;
 *   E) мобайл 375 без горскролла; консоль чистая.
 *
 * ОБНОВЛЕНО (ТЗ 2026-09-23 «Единый вид 7 сценариев»): сценарий 7 (Cybex)
 * добавлен в wtb-панель компактной карточкой; его кликабельное сообщение —
 * сам вопрос (тестового ввода нет), приёмник — актуальная тема #176.
 * Запуск: node scripts/probe-e2e-transfer-2026-09-23.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const SHOTS = '/home/z/my-project/screenshots';
const AUTH_KEY = 'sm_auth';
let ok = 0, fail = 0;
const check = (name, cond) => { if (cond) { ok++; console.log(`OK   ${name}`); } else { fail++; console.log(`FAIL ${name}`); } };

/** 6 сценариев ТЗ: дословные тексты и ТОЧНЫЕ URL (кодировку не менять). */
const SCENARIOS = [
  { num: 1, block: 'wtb',   page: '/gde-kupit',    topic: '177', name: 'Ремкомплект ГРМ',
    question: 'Где в Южно-Сахалинске купить оригинальный японский ремкомплект ГРМ на двигатель 1JZ-GE? На маркетплейсах ждать долго',
    input: 'Есть мастер Вова на Железнодорожной, звони ему: 8-924-111-22-33',
    slug: 'topic-grm-123',
    url: '/forum/topic/topic-grm-123?prefilled_text=Есть%20мастер%20Вова%20на%20Железнодорожной%2C%20звони%20ему%3A%208-924-111-22-33' },
  { num: 2, block: 'wtb',   page: '/gde-kupit',    topic: '177', name: 'Школьная форма',
    question: 'Где в городе прямо сейчас купить качественную школьную форму на мальчика (рост 140)? В крупных ТЦ всё раскупили перед сезоном',
    input: 'В ТЦ Рояль на 3 этаже сидят хамы и мошенники, торгуют синтетикой!',
    slug: 'topic-shkola-789',
    url: '/forum/topic/topic-shkola-789?prefilled_text=В%20ТЦ%20Рояль%20на%203%20этаже%20сидят%20хамы%20и%20мошенники%2C%20торгуют%20синтетикой!' },
  { num: 3, block: 'wtb',   page: '/gde-kupit',    topic: '177', name: 'Блесны на симу',
    question: 'Ищу специфические японские снасти и блесны на симу (розовые, 18г). В обычных рыболовных магазинах Южного всё выгребли',
    input: 'Закажи у чувака на Авито, вот его сотовый 8-914-000-44-55',
    slug: 'topic-sima-555',
    url: '/forum/topic/topic-sima-555?prefilled_text=Закажи%20у%20чувака%20на%20Авито%2C%20вот%20его%20сотовый%208-914-000-44-55' },
  { num: 4, block: 'cheap', page: '/gde-deshevle', topic: '178', name: 'Зимняя резина',
    question: 'Подскажите, где в Южно-Сахалинске сейчас самая дешевая зимняя резина Triangle R16? В крупных сетях ценник сильно задрали',
    input: 'На Пуркаева в ТЦ не ходи, там барыги совсем с ума сошли, крутят цены!',
    slug: 'topic-tyres-456',
    url: '/forum/topic/topic-tyres-456?prefilled_text=На%20Пуркаева%20в%20ТЦ%20не%20ходи%2C%20там%20барыги%20совсем%20с%20ума%20сошли%2C%20крутят%20цены!' },
  { num: 5, block: 'cheap', page: '/gde-deshevle', topic: '178', name: 'Свежая горбуша',
    question: 'Где найти свежую горбушу по минимальной цене напрямую от рыбаков, без наценки перекупщиков?',
    input: 'Все перекупщики уроды, задрали ценник на рыбу в два раза!',
    slug: 'topic-salmon-888',
    url: '/forum/topic/topic-salmon-888?prefilled_text=Все%20перекупщики%20уроды%2C%20задрали%20ценник%20на%20рыбу%20в%20два%20раза!' },
  { num: 6, block: 'cheap', page: '/gde-deshevle', topic: '178', name: 'Обрезная доска',
    question: 'Где сейчас дешевле взять куб обрезной доски 50х150 с доставкой в Троицкое? Цены на базах Южного сильно разнятся',
    input: 'На базах на Холмском шоссе устроили обдираловку, воры кругом!',
    slug: 'topic-timber-999',
    url: '/forum/topic/topic-timber-999?prefilled_text=На%20базах%20на%20Холмском%20шоссе%20устроили%20обдираловку%2C%20воры%20кругом!' },
  /* Сценарий 7 (ТЗ «Единый вид 7 сценариев»): Cybex, кликабельное
     сообщение — САМ ВОПРОС (тестового ввода нет), приёмник #176. */
  { num: 7, block: 'wtb', page: '/gde-kupit', topic: '176', name: 'Детское автокресло Cybex Solution T i-Fix',
    question: 'Нужно автокресло Cybex Solution T i-Fix, ростовая группа 2/3. Подскажите магазины или страницы товара на сайтах магазинов Сахалина. wb',
    input: 'Нужно автокресло Cybex Solution T i-Fix, ростовая группа 2/3. Подскажите магазины или страницы товара на сайтах магазинов Сахалина. wb',
    slug: 'topic-cybex-777',
    url: '/forum/topic/topic-cybex-777?prefilled_text=Нужно%20автокресло%20Cybex%20Solution%20T%20i-Fix%2C%20ростовая%20группа%202%2F3.%20Подскажите%20магазины%20или%20страницы%20товара%20на%20сайтах%20магазинов%20Сахалина.%20wb' },
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

/* ---------- A/B: панели в правильных блоках + структура ТЗ ---------- */
for (const variant of ['wtb', 'cheap']) {
  const url = variant === 'wtb' ? '/gde-kupit' : '/gde-deshevle';
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForSelector(`[data-e2e-panel="${variant}"]`, { timeout: 30000 });
  const scenarios = await page.$$eval(`[data-e2e-panel="${variant}"] [data-e2e-scenario]`, (els) => els.map((e) => Number(e.getAttribute('data-e2e-scenario'))));
  const expected = SCENARIOS.filter((s) => s.block === variant).map((s) => s.num);
  check(`${variant}: ровно сценарии [${expected.join(',')}] в блоке ${url}`, JSON.stringify(scenarios) === JSON.stringify(expected));

  const panelText = (await page.locator(`[data-e2e-panel="${variant}"]`).textContent()) ?? '';
  for (const s of SCENARIOS.filter((x) => x.block === variant)) {
    check(`${variant}/сц.${s.num}: вопрос на странице`, panelText.includes(s.question));
    check(`${variant}/сц.${s.num}: тестовый ввод (Ошибка) виден`, panelText.includes(s.input));
    check(`${variant}/сц.${s.num}: тема форума ${s.slug} показана`, panelText.includes(s.slug));
    // href байт-в-байт у всех трёх ссылок карточки (сообщение/тема/URL).
    for (const kind of ['msg', 'topic', 'url']) {
      const href = await page.locator(`[data-e2e-panel="${variant}"] [data-e2e-${kind}="${s.num}"]`).first().getAttribute('href');
      check(`${variant}/сц.${s.num}: href ${kind} байт-в-байт из ТЗ`, href === s.url);
    }
  }
  await page.screenshot({ path: `${SHOTS}/e2e-transfer-${variant}-panel.png`, fullPage: false });
}

/* ---------- D: клик по каждому из 6 сообщений ---------- */
for (const s of SCENARIOS) {
  await page.goto(BASE + s.page, { waitUntil: 'networkidle' });
  await page.waitForSelector(`[data-e2e-msg="${s.num}"]`, { timeout: 30000 });
  await page.click(`[data-e2e-msg="${s.num}"]`);
  // Адаптер 302 → /?topic=N&prefilled_text=… → форма темы подхватывает текст.
  await page.waitForFunction(
    (txt) => {
      const ta = document.querySelector('textarea');
      return ta && (ta.value || '').trim() === txt;
    },
    s.input,
    { timeout: 60000 }
  );
  const urlNow = page.url();
  check(`сц.${s.num}: тема-приёмник #${s.topic} открыта`, urlNow.includes(`topic=${s.topic}`));
  check(`сц.${s.num}: prefilled_text вычищен из адресной строки`, !urlNow.includes('prefilled_text'));
  check(`сц.${s.num}: текст в поле ответа 1-в-1 с тестовым вводом`, true);
}

/* ---------- E: мобайл 375 ---------- */
const m = await browser.newPage({ viewport: { width: 375, height: 800 } });
await m.goto(BASE + '/gde-kupit', { waitUntil: 'networkidle' });
await m.waitForSelector('[data-e2e-panel="wtb"]', { timeout: 30000 });
const sw1 = await m.evaluate(() => document.documentElement.scrollWidth);
check('мобайл 375 /gde-kupit без горскролла (sw=' + sw1 + ')', sw1 <= 375);
await m.goto(BASE + '/gde-deshevle', { waitUntil: 'networkidle' });
await m.waitForSelector('[data-e2e-panel="cheap"]', { timeout: 30000 });
const sw2 = await m.evaluate(() => document.documentElement.scrollWidth);
check('мобайл 375 /gde-deshevle без горскролла (sw=' + sw2 + ')', sw2 <= 375);
await m.close();

await browser.close();
const realErrors = errors.filter((e) => !e.includes('favicon'));
check('консоль чистая (0 ошибок)', realErrors.length === 0);
if (realErrors.length) console.log(realErrors.join('\n'));
console.log(`ИТОГ: ${ok} OK / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
