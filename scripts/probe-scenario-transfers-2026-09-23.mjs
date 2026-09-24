/**
 * ПРОБА ТЗ 2026-09-23 «Единый стиль 7 сценариев» (раунд
 * scenario-cards-unified): все 7 сценариев — компактные карточки, у каждой
 * рабочая кнопка «Обсуждается на форуме» с корректным URL + prefilled_text;
 * полная публикация Cybex скрыта из ленты /gde-kupit (стала карточкой 7).
 *
 *  А. Блок «ГДЕ КУПИТЬ» (/gde-kupit): карточки 1,2,3,7; чужих (4,5,6) нет.
 *  Б. Блок «ГДЕ ДЕШЕВЛЕ» (/gde-deshevle): карточки 4,5,6; чужих (1,2,3,7) нет.
 *  В. В каждой карточке: сценарий · вопрос · тестовый ввод (Ошибка) ·
 *     тема форума · URL + кнопка «Обсуждается на форуме» (href = точный URL).
 *  Г. href ввода и кнопки = ТОЧНЫЙ URL ТЗ ПОБАЙТНО (%20/%2C/%3A/!/без искажений).
 *  Д. Сценарий 7 (Cybex): поля Автор: Админ и Дата: 15 сентября, 05:53;
 *     тема АКТУАЛЬНАЯ (#176, вместо примера topic-cybex-777).
 *  Е. e2e-клик по кнопке каждой карточки → тема-приёмник (#177/#178/#176) →
 *     форма ответа предзаполнена 1-в-1 → prefilled_text вычищен из URL.
 *  Ж. Лента /gde-kupit: полной публикации Cybex НЕТ (строка скрыта,
 *     счётчик «Всего 1» исчез), главная не тронута, мобайл 375 без горскролла.
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
  { n: 1, page: "/gde-kupit", topicId: 177, slug: "topic-grm-123", title: "Ремкомплект ГРМ",
    question: "Где в Южно-Сахалинске купить оригинальный японский ремкомплект ГРМ на двигатель 1JZ-GE? На маркетплейсах ждать долго",
    input: "Есть мастер Вова на Железнодорожной, звони ему: 8-924-111-22-33",
    url: "/forum/topic/topic-grm-123?prefilled_text=Есть%20мастер%20Вова%20на%20Железнодорожной%2C%20звони%20ему%3A%208-924-111-22-33" },
  { n: 2, page: "/gde-kupit", topicId: 177, slug: "topic-shkola-789", title: "Школьная форма",
    question: "Где в городе прямо сейчас купить качественную школьную форму на мальчика (рост 140)? В крупных ТЦ всё раскупили перед сезоном",
    input: "В ТЦ Рояль на 3 этаже сидят хамы и мошенники, торгуют синтетикой!",
    url: "/forum/topic/topic-shkola-789?prefilled_text=В%20ТЦ%20Рояль%20на%203%20этаже%20сидят%20хамы%20и%20мошенники%2C%20торгуют%20синтетикой!" },
  { n: 3, page: "/gde-kupit", topicId: 177, slug: "topic-sima-555", title: "Блесны на симу",
    question: "Ищу специфические японские снасти и блесны на симу (розовые, 18г). В обычных рыболовных магазинах Южного всё выгребли",
    input: "Закажи у чувака на Авито, вот его сотовый 8-914-000-44-55",
    url: "/forum/topic/topic-sima-555?prefilled_text=Закажи%20у%20чувака%20на%20Авито%2C%20вот%20его%20сотовый%208-914-000-44-55" },
  { n: 4, page: "/gde-deshevle", topicId: 178, slug: "topic-tyres-456", title: "Зимняя резина",
    question: "Подскажите, где в Южно-Сахалинске сейчас самая дешевая зимняя резина Triangle R16? В крупных сетях ценник сильно задрали",
    input: "На Пуркаева в ТЦ не ходи, там барыги совсем с ума сошли, крутят цены!",
    url: "/forum/topic/topic-tyres-456?prefilled_text=На%20Пуркаева%20в%20ТЦ%20не%20ходи%2C%20там%20барыги%20совсем%20с%20ума%20сошли%2C%20крутят%20цены!" },
  { n: 5, page: "/gde-deshevle", topicId: 178, slug: "topic-salmon-888", title: "Свежая горбуша",
    question: "Где найти свежую горбушу по минимальной цене напрямую от рыбаков, без наценки перекупщиков?",
    input: "Все перекупщики уроды, задрали ценник на рыбу в два раза!",
    url: "/forum/topic/topic-salmon-888?prefilled_text=Все%20перекупщики%20уроды%2C%20задрали%20ценник%20на%20рыбу%20в%20два%20раза!" },
  { n: 6, page: "/gde-deshevle", topicId: 178, slug: "topic-timber-999", title: "Обрезная доска",
    question: "Где сейчас дешевле взять куб обрезной доски 50х150 с доставкой в Троицкое? Цены на базах Южного сильно разнятся",
    input: "На базах на Холмском шоссе устроили обдираловку, воры кругом!",
    url: "/forum/topic/topic-timber-999?prefilled_text=На%20базах%20на%20Холмском%20шоссе%20устроили%20обдираловку%2C%20воры%20кругом!" },
  { n: 7, page: "/gde-kupit", topicId: 176, slug: "176", title: "Детское автокресло Cybex Solution T i-Fix",
    question: "Нужно автокресло Cybex Solution T i-Fix, ростовая группа 2/3. Подскажите магазины или страницы товара на сайтах магазинов Сахалина. wb",
    input: "Нужно автокресло Cybex Solution T i-Fix, ростовая группа 2/3. Подскажите магазины или страницы товара на сайтах магазинов Сахалина. wb",
    url: "/forum/topic/176?prefilled_text=Нужно%20автокресло%20Cybex%20Solution%20T%20i-Fix%2C%20ростовая%20группа%202%2F3.%20Подскажите%20магазины%20или%20страницы%20товара%20на%20сайтах%20магазинов%20Сахалина.%20wb" },
];

const CYBEX_POST_ID = "cmu1lp8wv000yoyiik3tp3iv7";
const CYBEX_TITLE = "Где купить детское автокресло Cybex Solution T i-Fix?";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });

/* ---------- А/Б/В/Г/Д: разметка карточек ---------- */
const blockSpecs = [
  { page: "/gde-kupit", secAttr: "data-wtb-scenarios", secName: "«ГДЕ КУПИТЬ»", nums: [1, 2, 3, 7], alien: [4, 5, 6] },
  { page: "/gde-deshevle", secAttr: "data-cheap-scenarios", secName: "«ГДЕ ДЕШЕВЛЕ»", nums: [4, 5, 6], alien: [1, 2, 3, 7] },
];

for (const bs of blockSpecs) {
  console.log(`\n=== БЛОК ${bs.secName} (${bs.page}) — разметка ===`);
  const r = await page.goto(BASE + bs.page, { waitUntil: "domcontentloaded", timeout: 45000 });
  ok(`P${bs.page} 200`, r.status() === 200, String(r.status()));

  const sec = page.locator(`[${bs.secAttr}="1"]`);
  ok(`${bs.secName}: секция тестовых сообщений присутствует`, (await sec.count()) === 1);
  const alienSec = await page.locator(`[${bs.page === "/gde-kupit" ? "data-cheap-scenarios" : "data-wtb-scenarios"}="1"]`).count();
  ok(`${bs.secName}: чужой секции сценариев нет`, alienSec === 0);

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

    /* Кнопка «Обсуждается на форуме» — функционал полной публикации в компактной карточке */
    const btn = page.locator(`[data-scenario-forum="${n}"]`);
    ok(`С${n} кнопка «Обсуждается на форуме» присутствует`, (await btn.count()) === 1);
    const btnCls = await btn.getAttribute("class").catch(() => "");
    ok(`С${n} кнопка в стиле публикаций (.wb-btn-forum.is-open)`, (btnCls || "").includes("wb-btn-forum") && (btnCls || "").includes("is-open"), btnCls);
    const btnLabel = (await btn.textContent().catch(() => "")).trim();
    ok(`С${n} надпись кнопки «Обсуждается на форуме»`, btnLabel === "Обсуждается на форуме", btnLabel);
    const btnHref = await btn.getAttribute("href").catch(() => null);
    ok(`С${n} кнопка ведёт на ТОЧНЫЙ URL ТЗ`, btnHref === ex.url, btnHref || "null");

    if (n === 7) {
      const a = await page.locator(`[data-scenario-author="7"]`).textContent().catch(() => "");
      ok(`С7 поле «Автор: Админ»`, (a || "").includes("Админ"), a);
      const d = await page.locator(`[data-scenario-date="7"]`).textContent().catch(() => "");
      ok(`С7 поле «Дата: 15 сентября, 05:53»`, (d || "").includes("15 сентября, 05:53"), d);
      ok(`С7 тема АКТУАЛЬНАЯ (#176, не пример topic-cybex-777)`, ex.url.startsWith("/forum/topic/176?"));
    }
  }

  for (const n of bs.alien) {
    const cnt = await page.locator(`[data-scenario="${n}"]`).count();
    ok(`${bs.secName}: сценарий ${n} ОТСУТСТВУЕТ (правильный блок)`, cnt === 0);
  }
}

/* ---------- Е: e2e-клик по кнопке каждой карточки ---------- */
for (const ex of SCEN) {
  console.log(`\n=== E2E сценарий ${ex.n} (${ex.title}) — кнопка «Обсуждается на форуме» ===`);
  await page.goto(BASE + ex.page, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator(`[data-scenario-forum="${ex.n}"]`).waitFor({ state: "visible", timeout: 30000 });
  await Promise.all([
    page.waitForURL(`**/?topic=${ex.topicId}**`, { timeout: 30000 }),
    page.locator(`[data-scenario-forum="${ex.n}"]`).click(),
  ]);
  await page.locator("#reply-form textarea").waitFor({ state: "visible", timeout: 45000 });
  ok(`С${ex.n} кнопка привела в тему-приёмник #${ex.topicId}`, page.url().includes(`topic=${ex.topicId}`), page.url());
  ok(`С${ex.n} форма ответа предзаполнена 1-в-1`,
    (await page.locator("#reply-form textarea").inputValue()) === ex.input);
  ok(`С${ex.n} prefilled_text вычищен из адресной строки`, !page.url().includes("prefilled_text"), page.url());
  if (ex.n === 7) {
    await page.locator("#reply-form").scrollIntoViewIfNeeded();
    await page.screenshot({ path: SHOT + "/scenario7-forum-cybex-2026-09-23.png" });
    ok("Скриншот темы #176 с предзаполнением снят", fs.existsSync(SHOT + "/scenario7-forum-cybex-2026-09-23.png"));
  }
}

/* ---------- Ж: лента /gde-kupit — полная публикация Cybex скрыта ---------- */
console.log("\n=== ЛЕНТА /gde-kupit — Cybex стал карточкой, из ленты скрыт ===");
await page.goto(BASE + "/gde-kupit", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(800);
ok("Лента: полной строки публикации Cybex НЕТ", (await page.locator(`article.wb-item[data-wb-id="${CYBEX_POST_ID}"]`).count()) === 0);
ok("Лента: полных строк вообще нет (единственный пост стал карточкой)", (await page.locator("article.wb-item").count()) === 0);
ok("Лента: заголовков полных публикаций нет (единственный пост стал карточкой)", (await page.locator(".wb-item-title").count()) === 0);
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
await page.screenshot({ path: SHOT + "/scenarios-wtb-unified-2026-09-23.png" });
ok("Скриншот блока «ГДЕ КУПИТЬ» (4 карточки) снят", fs.existsSync(SHOT + "/scenarios-wtb-unified-2026-09-23.png"));

await page.goto(BASE + "/gde-deshevle", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.locator("[data-cheap-scenarios]").scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: SHOT + "/scenarios-cheap-unified-2026-09-23.png" });
ok("Скриншот блока «ГДЕ ДЕШЕВЛЕ» снят", fs.existsSync(SHOT + "/scenarios-cheap-unified-2026-09-23.png"));

/* ---------- Мобильный 375 ---------- */
await page.setViewportSize({ width: 375, height: 720 });
await page.goto(BASE + "/gde-kupit", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(600);
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
ok("Мобильный 375px: без горизонтального скролла", sw <= 375, "scrollWidth=" + sw);
await page.locator("[data-wtb-scenarios]").scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: SHOT + "/scenarios-mobile-unified-2026-09-23.png" });
ok("Мобильный скриншот снят", fs.existsSync(SHOT + "/scenarios-mobile-unified-2026-09-23.png"));

await browser.close();
console.log(`\nИТОГ: ${pass} OK / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
