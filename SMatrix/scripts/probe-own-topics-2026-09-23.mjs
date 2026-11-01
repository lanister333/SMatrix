/**
 * ПРОБА ТЗ 2026-09-23 «каждый сценарий ведёт в СВОЮ тему» (раунд
 * scenario-own-topics): слаги карточек больше НЕ мапятся на темы-агрегаторы
 * #177/#178 («Быстрые подсказки…») — каждая из 7 карточек ведёт в ОТДЕЛЬНУЮ
 * тему (179-184 созданы посевом, 176 — актуальная тема Cybex с добавленным
 * сообщением №2); в каждой теме: заголовок = суть вопроса, сообщение №1 =
 * вопрос, сообщение №2 = тестовый ввод (Ошибка).
 *
 *  0. АДАПТЕР ×7 + fallback: 302; Location ОТНОСИТЕЛЬНЫЙ; цель
 *     /?topic=179..184|176&prefilled_text=…; кодировка ТЗ (%20 без «+»);
 *     симуляция прокси-заголовков превью не меняет относительность.
 *  А/Б. Разметка карточек (1,2,3,7 в «ГДЕ КУПИТЬ»; 4,5,6 в «ГДЕ ДЕШЕВЛЕ»).
 *  В/Г. Метка «Обсудить на форуме» ×7; старой метки нет; href побайтно.
 *  Д. С7: Автор/Дата; URL слагом topic-cybex-777 (ТЗ).
 *  Е. e2e ×7: клик кнопки → ИМЕННО своя тема (заголовок .t-title совпадает,
 *     это НЕ агрегатор, сообщение №1 = вопрос, №2 = ввод), крошки = нужная
 *     рубрика, форма предзаполнена, параметр вычищен.
 *  Ж. Лента/Главная/мобайл — без регресса.
 */

import { chromium } from "playwright";
import fs from "fs";

const BASE = "http://localhost:3000";
const SHOT = "/home/z/my-project/download";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  OK   ${name}${extra ? " — " + extra : ""}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? " — " + extra : ""}`); }
};

const SCEN = [
  { n: 1, page: "/gde-kupit", topicId: 179, slug: "topic-grm-123", title: "Ремкомплект ГРМ",
    topicTitle: "Где купить оригинальный ремкомплект ГРМ на двигатель 1JZ-GE в Южно-Сахалинске?",
    question: "Где в Южно-Сахалинске купить оригинальный японский ремкомплект ГРМ на двигатель 1JZ-GE? На маркетплейсах ждать долго",
    input: "Есть мастер Вова на Железнодорожной, звони ему: 8-924-111-22-33",
    url: "/forum/topic/topic-grm-123?prefilled_text=Есть%20мастер%20Вова%20на%20Железнодорожной%2C%20звони%20ему%3A%208-924-111-22-33" },
  { n: 2, page: "/gde-kupit", topicId: 180, slug: "topic-shkola-789", title: "Школьная форма",
    topicTitle: "Где купить качественную школьную форму на мальчика (рост 140) в Южно-Сахалинске?",
    question: "Где в городе прямо сейчас купить качественную школьную форму на мальчика (рост 140)? В крупных ТЦ всё раскупили перед сезоном",
    input: "В ТЦ Рояль на 3 этаже сидят хамы и мошенники, торгуют синтетикой!",
    url: "/forum/topic/topic-shkola-789?prefilled_text=В%20ТЦ%20Рояль%20на%203%20этаже%20сидят%20хамы%20и%20мошенники%2C%20торгуют%20синтетикой!" },
  { n: 3, page: "/gde-kupit", topicId: 181, slug: "topic-sima-555", title: "Блесны на симу",
    topicTitle: "Где купить японские снасти и блесны на симу (розовые, 18г) в Южно-Сахалинске?",
    question: "Ищу специфические японские снасти и блесны на симу (розовые, 18г). В обычных рыболовных магазинах Южного всё выгребли",
    input: "Закажи у чувака на Авито, вот его сотовый 8-914-000-44-55",
    url: "/forum/topic/topic-sima-555?prefilled_text=Закажи%20у%20чувака%20на%20Авито%2C%20вот%20его%20сотовый%208-914-000-44-55" },
  { n: 4, page: "/gde-deshevle", topicId: 182, slug: "topic-tyres-456", title: "Зимняя резина",
    topicTitle: "Где купить зимнюю резину Triangle R16 в Южно-Сахалинске?",
    question: "Подскажите, где в Южно-Сахалинске сейчас самая дешевая зимняя резина Triangle R16? В крупных сетях ценник сильно задрали",
    input: "На Пуркаева в ТЦ не ходи, там барыги совсем с ума сошли, крутят цены!",
    url: "/forum/topic/topic-tyres-456?prefilled_text=На%20Пуркаева%20в%20ТЦ%20не%20ходи%2C%20там%20барыги%20совсем%20с%20ума%20сошли%2C%20крутят%20цены!" },
  { n: 5, page: "/gde-deshevle", topicId: 183, slug: "topic-salmon-888", title: "Свежая горбуша",
    topicTitle: "Где найти свежую горбушу по минимальной цене напрямую от рыбаков?",
    question: "Где найти свежую горбушу по минимальной цене напрямую от рыбаков, без наценки перекупщиков?",
    input: "Все перекупщики уроды, задрали ценник на рыбу в два раза!",
    url: "/forum/topic/topic-salmon-888?prefilled_text=Все%20перекупщики%20уроды%2C%20задрали%20ценник%20на%20рыбу%20в%20два%20раза!" },
  { n: 6, page: "/gde-deshevle", topicId: 184, slug: "topic-timber-999", title: "Обрезная доска",
    topicTitle: "Где дешевле взять куб обрезной доски 50х150 с доставкой в Троицкое?",
    question: "Где сейчас дешевле взять куб обрезной доски 50х150 с доставкой в Троицкое? Цены на базах Южного сильно разнятся",
    input: "На базах на Холмском шоссе устроили обдираловку, воры кругом!",
    url: "/forum/topic/topic-timber-999?prefilled_text=На%20базах%20на%20Холмском%20шоссе%20устроили%20обдираловку%2C%20воры%20кругом!" },
  { n: 7, page: "/gde-kupit", topicId: 176, slug: "topic-cybex-777", title: "Детское автокресло Cybex Solution T i-Fix",
    topicTitle: "Обсуждение: Где купить детское автокресло Cybex Solution T i-Fix?",
    question: "Нужно автокресло Cybex Solution T i-Fix, ростовая группа 2/3. Подскажите магазины или страницы товара на сайтах магазинов Сахалина. wb",
    input: "Нужно автокресло Cybex Solution T i-Fix, ростовая группа 2/3. Подскажите магазины или страницы товара на сайтах магазинов Сахалина. wb",
    url: "/forum/topic/topic-cybex-777?prefilled_text=Нужно%20автокресло%20Cybex%20Solution%20T%20i-Fix%2C%20ростовая%20группа%202%2F3.%20Подскажите%20магазины%20или%20страницы%20товара%20на%20сайтах%20магазинов%20Сахалина.%20wb" },
];

/** Ожидаемая рубрика темы в хлебных крошках (.sk-crumbs a): [родитель, подраздел]. */
const RUBRIC = {
  179: ["Товары и услуги", "Где купить"],
  180: ["Товары и услуги", "Где купить"],
  181: ["Товары и услуги", "Где купить"],
  182: ["Товары и услуги", "Цены"],
  183: ["Товары и услуги", "Цены"],
  184: ["Товары и услуги", "Цены"],
  176: ["Обсуждение сообщений из блоков", "Где купить"],
};

const CYBEX_POST_ID = "cmu1lp8wv000yoyiik3tp3iv7";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });

/* ---------- 0: АДАПТЕР — относительный Location, кодировка ТЗ ---------- */
console.log("\n=== АДАПТЕР /forum/topic/[topicId] — БЕЗ localhost (ФИКС) ===");
for (const ex of SCEN) {
  const resp = await page.request.get(BASE + ex.url, { maxRedirects: 0 }).catch((e) => null);
  ok(`С${ex.n} адаптер отвечает 302`, !!resp && resp.status() === 302, resp ? String(resp.status()) : "нет ответа");
  const loc = resp?.headers()?.location || "";
  ok(`С${ex.n} Location ОТНОСИТЕЛЬНЫЙ (не localhost)`, loc.startsWith("/") && !loc.includes("http://") && !loc.includes("https://"), loc.slice(0, 90));
  ok(`С${ex.n} цель = /?topic=${ex.topicId}&prefilled_text=…`, loc.startsWith(`/?topic=${ex.topicId}&prefilled_text=`));
  ok(`С${ex.n} кодировка ТЗ: пробелы %20, без «+»`, loc.includes("%20") && !loc.includes("+"));
  const q = loc.split("prefilled_text=")[1] || "";
  ok(`С${ex.n} декодированный prefilled_text = ввод 1-в-1`, decodeURIComponent(q) === ex.input);
}
const fb = await page.request.get(BASE + "/forum/topic/unknown-slug-xyz?prefilled_text=test", { maxRedirects: 0 });
ok("Fallback: неизвестный слаг → 302 на «/»", fb.status() === 302 && (fb.headers().location || "") === "/");
{
  /* Симуляция прокси превью: host/x-forwarded-* чужого домена НЕ дают абсолютный Location */
  const ex = SCEN[0];
  const px = await page.request.get(BASE + ex.url, {
    maxRedirects: 0,
    headers: { "x-forwarded-host": "preview-chat-27cf817b-c1ae-4967-9e43-a2f7d979adca.space-z.ai", "x-forwarded-proto": "https", host: "preview-chat-27cf817b-c1ae-4967-9e43-a2f7d979adca.space-z.ai" },
  });
  const ploc = px.headers().location || "";
  ok("Симуляция прокси превью: Location остаётся ОТНОСИТЕЛЬНЫМ", px.status() === 302 && ploc.startsWith("/?topic="), ploc.slice(0, 90));
}

/* ---------- А/Б/В/Г/Д: разметка карточек + переименованная метка ---------- */
const blockSpecs = [
  { page: "/gde-kupit", secAttr: "data-wtb-scenarios", secName: "«ГДЕ КУПИТЬ»", rubric: "Товары и услуги ▸ Где купить", nums: [1, 2, 3, 7], alien: [4, 5, 6] },
  { page: "/gde-deshevle", secAttr: "data-cheap-scenarios", secName: "«ГДЕ ДЕШЕВЛЕ»", rubric: "Товары и услуги ▸ Цены", nums: [4, 5, 6], alien: [1, 2, 3, 7] },
];

for (const bs of blockSpecs) {
  console.log(`\n=== БЛОК ${bs.secName} (${bs.page}) — разметка + новая метка ===`);
  const r = await page.goto(BASE + bs.page, { waitUntil: "domcontentloaded", timeout: 45000 });
  ok(`P${bs.page} 200`, r.status() === 200, String(r.status()));

  const sec = page.locator(`[${bs.secAttr}="1"]`);
  ok(`${bs.secName}: секция тестовых сообщений присутствует`, (await sec.count()) === 1);
  const alienSec = await page.locator(`[${bs.page === "/gde-kupit" ? "data-cheap-scenarios" : "data-wtb-scenarios"}="1"]`).count();
  ok(`${bs.secName}: чужой секции сценариев нет`, alienSec === 0);
  const secTxt = (await sec.textContent().catch(() => "")).replace(/\s+/g, " ");
  ok(`${bs.secName}: подзаголовок секции показывает рубрику «${bs.rubric}»`, secTxt.includes(`рубрика форума: «${bs.rubric}»`));

  for (const n of bs.nums) {
    const ex = SCEN.find((s) => s.n === n);
    const card = page.locator(`[data-scenario="${n}"][data-topic-slug="${ex.slug}"]`);
    ok(`С${n} (${ex.title}) присутствует`, (await card.count()) === 1);

    const q = await page.locator(`[data-scenario-question="${n}"]`).textContent().catch(() => "");
    ok(`С${n} вопрос дословно`, (q || "").includes(ex.question));

    const inp = page.locator(`[data-scenario-input="${n}"]`);
    ok(`С${n} тестовый ввод кликабелен (a href)`, (await inp.count()) === 1);
    const t = await inp.textContent().catch(() => "");
    ok(`С${n} ввод в тексте дословно`, (t || "").includes(ex.input));
    const href = await inp.getAttribute("href").catch(() => null);
    ok(`С${n} href ввода = ТОЧНЫЙ URL ТЗ (побайтно)`, href === ex.url, href || "null");
    const decoded = href ? decodeURIComponent(href.split("prefilled_text=")[1]) : null;
    ok(`С${n} prefilled_text без искажений`, decoded === ex.input);

    const topic = await page.locator(`[data-scenario-topic="${n}"]`).textContent().catch(() => "");
    ok(`С${n} тема форума показана (${ex.slug})`, (topic || "").includes(ex.slug));
    const urlTxt = await page.locator(`[data-scenario-url="${n}"]`).textContent().catch(() => "");
    ok(`С${n} URL показан дословно`, (urlTxt || "").trim() === ex.url);

    /* Кнопка «Обсудить на форуме» — НОВАЯ метка ТЗ */
    const btn = page.locator(`[data-scenario-forum="${n}"]`);
    ok(`С${n} кнопка обсуждения присутствует`, (await btn.count()) === 1);
    const btnCls = await btn.getAttribute("class").catch(() => "");
    ok(`С${n} кнопка в стиле публикаций (.wb-btn-forum.is-open)`, (btnCls || "").includes("wb-btn-forum") && (btnCls || "").includes("is-open"), btnCls);
    const btnLabel = (await btn.textContent().catch(() => "")).trim();
    ok(`С${n} НОВАЯ надпись кнопки «Обсудить на форуме»`, btnLabel === "Обсудить на форуме", btnLabel);
    const btnHref = await btn.getAttribute("href").catch(() => null);
    ok(`С${n} кнопка ведёт на ТОЧНЫЙ URL ТЗ`, btnHref === ex.url, btnHref || "null");

    if (n === 7) {
      const a = await page.locator(`[data-scenario-author="7"]`).textContent().catch(() => "");
      ok(`С7 поле «Автор: Админ»`, (a || "").includes("Админ"), a);
      const d = await page.locator(`[data-scenario-date="7"]`).textContent().catch(() => "");
      ok(`С7 поле «Дата: 15 сентября, 05:53»`, (d || "").includes("15 сентября, 05:53"), d);
      ok(`С7 URL слагом topic-cybex-777 (ТЗ), адаптер резолвит в актуальную #176`, ex.url.startsWith("/forum/topic/topic-cybex-777?"));
    }
  }

  for (const n of bs.alien) {
    const cnt = await page.locator(`[data-scenario="${n}"]`).count();
    ok(`${bs.secName}: сценарий ${n} ОТСУТСТВУЕТ (правильный блок)`, cnt === 0);
  }

  /* Г: СТАРАЯ метка на странице отсутствует — нигде (карточки + лента) */
  const bodyTxt = (await page.locator("body").textContent().catch(() => "")).replace(/\s+/g, " ");
  ok(`${bs.secName}: СТАРАЯ метка «Обсуждается на форуме» на странице ОТСУТСТВУЕТ`, !bodyTxt.includes("Обсуждается на форуме"));
  const oldBtns = await page.locator("a.wb-btn-forum", { hasText: "Обсуждается" }).count();
  ok(`${bs.secName}: кнопок со старой меткой 0`, oldBtns === 0);
  const newBtns = await page.locator("a.wb-btn-forum", { hasText: "Обсудить на форуме" }).count();
  ok(`${bs.secName}: кнопок «Обсудить на форуме» ровно ${bs.nums.length} (по одной в карточке)`, newBtns === bs.nums.length, String(newBtns));
}

/* ---------- Е: e2e-клик по кнопке каждой карточки + РУБРИКА в крошках ---------- */
for (const ex of SCEN) {
  console.log(`\n=== E2E сценарий ${ex.n} (${ex.title}) — кнопка «Обсудить на форуме» → рубрика ===`);
  await page.goto(BASE + ex.page, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator(`[data-scenario-forum="${ex.n}"]`).waitFor({ state: "visible", timeout: 30000 });
  await Promise.all([
    page.waitForURL(`**/?topic=${ex.topicId}**`, { timeout: 30000 }),
    page.locator(`[data-scenario-forum="${ex.n}"]`).click(),
  ]);
  await page.locator("#reply-form textarea").waitFor({ state: "visible", timeout: 45000 });
  ok(`С${ex.n} кнопка привела в тему-приёмник #${ex.topicId}`, page.url().includes(`topic=${ex.topicId}`), page.url());

  /* Рубрика темы в хлебных крошках: [Форум, родитель, подраздел] */
  const crumbs = await page.locator(".sk-crumbs a").allTextContents().catch(() => []);
  const [parent, sub] = RUBRIC[ex.topicId];
  ok(`С${ex.n} крошка-родитель «${parent}»`, (crumbs[1] || "").trim() === parent, JSON.stringify(crumbs));
  ok(`С${ex.n} крошка-подраздел «${sub}»`, (crumbs[2] || "").trim() === sub, JSON.stringify(crumbs));

  /* Открылась ИМЕННО своя тема: заголовок, не агрегатор, сообщения №1/№2 */
  const tTitle = (await page.locator(".t-title").textContent().catch(() => "")).trim();
  ok(`С${ex.n} заголовок темы = «${ex.topicTitle}»`, tTitle === ex.topicTitle, tTitle);
  ok(`С${ex.n} это НЕ тема-агрегатор «Быстрые подсказки»`, !tTitle.includes("Быстрые подсказки"), tTitle);
  const m1 = (await page.locator('.sk-msg[data-msgnum="1"] .sk-msg-body').textContent().catch(() => "")).trim();
  ok(`С${ex.n} сообщение №1 = исходный вопрос`, m1.includes(ex.question), m1.slice(0, 70));
  const m2 = (await page.locator('.sk-msg[data-msgnum="2"] .sk-msg-body').textContent().catch(() => "")).trim();
  ok(`С${ex.n} сообщение №2 = тестовый ввод (Ошибка)`, m2.includes(ex.input), m2.slice(0, 70));

  ok(`С${ex.n} форма ответа предзаполнена 1-в-1`,
    (await page.locator("#reply-form textarea").inputValue()) === ex.input);
  ok(`С${ex.n} prefilled_text вычищен из адресной строки`, !page.url().includes("prefilled_text"), page.url());
  ok(`С${ex.n} финальный URL на том же origin (без чужих хостов)`, page.url().startsWith(BASE + "/"), page.url());
  if (ex.n === 7) {
    await page.locator("#reply-form").scrollIntoViewIfNeeded();
    await page.screenshot({ path: SHOT + "/scenario7-forum-cybex-owntopics-2026-09-23.png" });
    ok("Скриншот темы #176 с предзаполнением снят", fs.existsSync(SHOT + "/scenario7-forum-cybex-owntopics-2026-09-23.png"));
  }
}

/* ---------- Ж: лента /gde-kupit — полная публикация Cybex скрыта ---------- */
console.log("\n=== ЛЕНТА /gde-kupit — Cybex стал карточкой, из ленты скрыт ===");
await page.goto(BASE + "/gde-kupit", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(800);
ok("Лента: полной строки публикации Cybex НЕТ", (await page.locator(`article.wb-item[data-wb-id="${CYBEX_POST_ID}"]`).count()) === 0);
ok("Лента: полных строк вообще нет (единственный пост стал карточкой)", (await page.locator("article.wb-item").count()) === 0);
ok("Лента: счётчик «Всего 1» исчез", (await page.locator(".wb-pager", { hasText: "Всего 1" }).count()) === 0);
ok("Секция сценариев: карточка С7 на месте", (await page.locator('[data-scenario="7"]').count()) === 1);

/* ---------- Главная не тронута ---------- */
console.log("\n=== ГЛАВНАЯ — не тронута ===");
await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
ok("Главная: секций сценариев нет", (await page.locator("[data-wtb-scenarios], [data-cheap-scenarios]").count()) === 0);
ok("Главная: панель «Быстрые подсказки Где купить» не смонтирована", (await page.locator("[data-wtb-hints]").count()) === 0);
ok("Главная: сетка разделов цела («Знакомства»)", (await page.locator("body").textContent()).includes("Знакомства"));

/* ---------- Скриншоты блоков ---------- */
fs.mkdirSync(SHOT, { recursive: true });
await page.setViewportSize({ width: 1360, height: 900 });
await page.goto(BASE + "/gde-kupit", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.locator("[data-wtb-scenarios]").scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: SHOT + "/scenarios-wtb-owntopics-2026-09-23.png" });
ok("Скриншот блока «ГДЕ КУПИТЬ» (4 карточки) снят", fs.existsSync(SHOT + "/scenarios-wtb-owntopics-2026-09-23.png"));

await page.goto(BASE + "/gde-deshevle", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.locator("[data-cheap-scenarios]").scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: SHOT + "/scenarios-cheap-owntopics-2026-09-23.png" });
ok("Скриншот блока «ГДЕ ДЕШЕВЛЕ» снят", fs.existsSync(SHOT + "/scenarios-cheap-owntopics-2026-09-23.png"));

/* ---------- Мобильный 375 ---------- */
await page.setViewportSize({ width: 375, height: 720 });
await page.goto(BASE + "/gde-kupit", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(600);
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
ok("Мобильный 375px: без горизонтального скролла", sw <= 375, "scrollWidth=" + sw);
await page.locator("[data-wtb-scenarios]").scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: SHOT + "/scenarios-mobile-owntopics-2026-09-23.png" });
ok("Мобильный скриншот снят", fs.existsSync(SHOT + "/scenarios-mobile-owntopics-2026-09-23.png"));

await browser.close();
console.log(`\nИТОГ: ${pass} OK / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
