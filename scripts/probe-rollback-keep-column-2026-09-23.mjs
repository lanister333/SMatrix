/**
 * ПРОБА ОТКАТА «откати назад, но оставь ширину центральной колонки» (2026-09-23).
 *
 * Откачено: плоский список «Сахком» (topic-view/forum-thread/ui/api/topics/
 * globals.css возвращены к 1b21798), из БД удалены 4 тестовых сообщения
 * (t183 #3-#5, t182 #3). ОСТАВЛЕНО: центральная колонка 1105px (каркас 1685).
 *
 * РАУНД 1 «колонка сохранена» @1920 на /, /gde-kupit, /?topic=183:
 *   .center-column = 1105px (850×1,3), бока 240/300, контейнер 1685px.
 *
 * РАУНД 2 «лесенка вернулась» (/page темы #183 «горбуша»):
 *   2.1 ровно 2 сообщения: #1 Админ (вопрос), #2 Гость (тестовый ввод);
 *   2.2 карточки .sakh-comment с data-level (лесенка), контейнер
 *       .forum-thread с position:relative, оверлей .sakh-reply-lines;
 *   2.3 НЕТ .sk-quote, .sk-msg-avatar, .sk-msg-main, .sk-msg-foot,
 *       .sk-btn-thanks — артефакты плоского списка удалены;
 *   2.4 старая шапка: .sk-msg-head внутри карточки, кнопка «Ответить»
 *       (.sk-btn-reply), время .sk-msg-time, № .sk-msg-num;
 *
 * РАУНД 3 регресс «нет localhost» + e2e:
 *   на /, /gde-kupit, /gde-deshevle, /?topic=183 ни одного href*localhost;
 *   адаптер /forum/topic/topic-salmon-888?prefilled_text=… → 302,
 *   Location ОТНОСИТЕЛЬНЫЙ /?topic=183&prefilled_text=… (кодировка ТЗ);
 *   e2e по карточке С5: клик → тема #183, #reply-form textarea предзаполнена 1-в-1.
 *
 * РАУНД 4 мобайл 375: / и /?topic=183 без горскролла; на ≤768px
 *   карточки в одну линию (лесенка скрыта старыми правилами).
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

const C5_TEXT = "Все перекупщики уроды, задрали ценник на рыбу в два раза!";
// href карточек — ТОЧНЫЙ URL ТЗ: кириллица ЛИТЕРАЛЬНАЯ, пробелы %20,
// запятая %2C, восклицательный знак литеральный (не encodeURIComponent!)
const C5_URL = "/forum/topic/topic-salmon-888?prefilled_text=Все%20перекупщики%20уроды%2C%20задрали%20ценник%20на%20рыбу%20в%20два%20раза!";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();

/* ---------- РАУНД 1: центральная колонка 1105px сохранена ---------- */
console.log("РАУНД 1: центральная колонка сохранена (@1920)");
for (const url of ["/", "/gde-kupit", "/?topic=183"]) {
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  const m = await page.evaluate(() => {
    const c = document.querySelector(".center-column");
    const l = document.querySelector(".left-column");
    const r = document.querySelector(".right-column");
    const k = document.querySelector(".main-grid-container");
    const rect = (el) => el ? Math.round(el.getBoundingClientRect().width) : null;
    return { c: rect(c), l: rect(l), r: rect(r), k: rect(k) };
  });
  ok(`${url} .center-column=1105`, m.c === 1105, `=${m.c}`);
  ok(`${url} .left-column=240`, m.l === 240, `=${m.l}`);
  ok(`${url} .right-column=300`, m.r === 300, `=${m.r}`);
  ok(`${url} каркас ≤1685`, m.k !== null && m.k <= 1685, `=${m.k}`);
}
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.screenshot({ path: `${SHOT}/rollback-column-home-1920-2026-09-23.png` });

/* ---------- РАУНД 2: лесенка вернулась ---------- */
console.log("РАУНД 2: лесенка вернулась (тема #183)");
await page.goto(BASE + "/?topic=183", { waitUntil: "networkidle" });
await page.waitForSelector(".sakh-comment", { timeout: 15000 });

const t = await page.evaluate(() => {
  const cards = [...document.querySelectorAll(".sakh-comment")];
  const q = (sel) => document.querySelectorAll(sel).length;
  const head = (card) => card.querySelector(".sk-msg-head");
  return {
    count: cards.length,
    levels: cards.map((c) => c.getAttribute("data-level")),
    nums: cards.map((c) => c.getAttribute("data-msgnum")),
    authors: cards.map((c) => c.querySelector(".sk-msg-author")?.textContent?.trim() ?? null),
    bodies: cards.map((c) => (c.querySelector(".sk-msg-body")?.textContent ?? "").trim().slice(0, 60)),
    hasHead: cards.map((c) => !!head(c)),
    // артефакты плоского списка «Сахком» — их быть НЕ должно
    quotes: q(".sk-quote"),
    avatars: q(".sk-msg-avatar"),
    msgMain: q(".sk-msg-main"),
    foot: q(".sk-msg-foot"),
    thanks: q(".sk-btn-thanks"),
    // старая механика лесенки — должна быть
    replyLines: q(".sakh-reply-lines"),
    thread: !!document.querySelector(".forum-thread"),
    replyBtns: q(".sk-btn-reply"),
    msgNums: q(".sk-msg-num"),
    times: q(".sk-msg-time"),
    parentMarks: q(".sk-msg-parent"),
  };
});

ok("2.1 в теме ровно 2 сообщения", t.count === 2, `=${t.count}`);
ok("2.1 № сообщений 1,2", JSON.stringify(t.nums) === '["1","2"]', JSON.stringify(t.nums));
ok("2.1 авторы Админ,Гость", JSON.stringify(t.authors) === '["Админ","Гость"]', JSON.stringify(t.authors));
ok("2.1 #1 = вопрос про горбушу", (t.bodies[0] ?? "").includes("горбушу"), JSON.stringify(t.bodies[0]));
ok("2.1 #2 = тестовый ввод С5", (t.bodies[1] ?? "").includes("перекупщики"), JSON.stringify(t.bodies[1]));
ok("2.2 data-level у карточек", t.levels.every((l) => l !== null), JSON.stringify(t.levels));
ok("2.2 оба уровня 1 (корневые)", JSON.stringify(t.levels) === '["1","1"]', JSON.stringify(t.levels));
ok("2.2 .forum-thread на месте", t.thread);
ok("2.2 старая шапка .sk-msg-head", t.hasHead.every(Boolean));
ok("2.3 цитат .sk-quote нет", t.quotes === 0, `=${t.quotes}`);
ok("2.3 аватаров .sk-msg-avatar нет", t.avatars === 0, `=${t.avatars}`);
ok("2.3 .sk-msg-main нет", t.msgMain === 0, `=${t.msgMain}`);
ok("2.3 .sk-msg-foot нет", t.foot === 0, `=${t.foot}`);
ok("2.3 «Спасибо» .sk-btn-thanks нет", t.thanks === 0, `=${t.thanks}`);
ok("2.4 «Ответить» на месте", t.replyBtns === 2, `=${t.replyBtns}`);
ok("2.4 № сообщений .sk-msg-num", t.msgNums === 2, `=${t.msgNums}`);
ok("2.4 время .sk-msg-time", t.times === 2, `=${t.times}`);
ok("2.4 SVG-оверлей линий в DOM", t.replyLines >= 1, `=${t.replyLines}`);

await page.screenshot({ path: `${SHOT}/rollback-forest-topic183-2026-09-23.png`, fullPage: true });

/* ---------- РАУНД 3: регресс localhost + e2e ---------- */
console.log("РАУНД 3: регресс «нет localhost» + e2e С5");
for (const url of ["/", "/gde-kupit", "/gde-deshevle", "/?topic=183"]) {
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  const bad = await page.evaluate(() =>
    [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") ?? "")
      .filter((h) => h.includes("localhost"))
  );
  ok(`3.1 ${url} без localhost-href`, bad.length === 0, bad.length ? JSON.stringify(bad.slice(0, 3)) : "");
}

const resp = await page.request.get(BASE + C5_URL, { maxRedirects: 0 });
const loc = resp.headers()["location"] ?? "";
ok("3.2 адаптер 302", resp.status() === 302, `=${resp.status()}`);
ok("3.2 Location относительный", !loc.startsWith("http"), JSON.stringify(loc));
ok("3.2 Location → /?topic=183", loc.startsWith("/?topic=183&"), JSON.stringify(loc.slice(0, 40)));
ok("3.2 prefilled_text в Location", decodeURIComponent(loc).includes(C5_TEXT));

// e2e по карточке сценария 5 на /gde-deshevle (карточка — div; кликабельны
// внутренние ссылки: сообщение data-scenario-input и кнопка data-scenario-forum)
await page.goto(BASE + "/gde-deshevle", { waitUntil: "networkidle" });
const card = page.locator('[data-scenario="5"][data-topic-slug]');
ok("3.3 карточка С5 видима", await card.count() === 1, `count=${await card.count()}`);
const link = page.locator('[data-scenario="5"] a[data-scenario-input="5"]');
ok("3.3 кликабельное сообщение в карточке", await link.count() === 1, `count=${await link.count()}`);
const href = await link.getAttribute("href");
ok("3.3 href сообщения = URL ТЗ", href === C5_URL, JSON.stringify(href));
const btn = page.locator('[data-scenario="5"] a[data-scenario-forum="5"]');
ok("3.3 кнопка «Обсудить на форуме» href = URL ТЗ",
  (await btn.count()) === 1 && (await btn.getAttribute("href")) === C5_URL,
  JSON.stringify(await btn.getAttribute("href")));
await link.click();
await page.waitForSelector("#reply-form textarea", { timeout: 15000 });
const urlAfter = page.url();
ok("3.3 после клика /?topic=183", urlAfter.includes("topic=183"), urlAfter.slice(0, 60));
const ta = await page.inputValue("#reply-form textarea");
ok("3.3 textarea предзаполнена 1-в-1", ta === C5_TEXT, JSON.stringify(ta.slice(0, 50)));

/* ---------- РАУНД 4: мобайл 375 ---------- */
console.log("РАУНД 4: мобайл 375");
const mob = await browser.newContext({ viewport: { width: 375, height: 812 } });
const mp = await mob.newPage();
for (const url of ["/", "/?topic=183"]) {
  await mp.goto(BASE + url, { waitUntil: "networkidle" });
  const r = await mp.evaluate(() => ({
    scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    forestShift: [...document.querySelectorAll(".sakh-comment")].slice(0, 3)
      .map((c) => c.getBoundingClientRect().left),
  }));
  ok(`4.1 ${url} без горскролла`, r.scroll <= 0, `scrollX=${r.scroll}`);
  if (url === "/?topic=183") {
    ok("4.2 карточки в одну линию (левые края равны)",
      r.forestShift.every((x) => Math.abs(x - r.forestShift[0]) < 2),
      JSON.stringify(r.forestShift));
  }
}
await mp.goto(BASE + "/?topic=183", { waitUntil: "networkidle" });
await mp.waitForSelector(".sakh-comment", { timeout: 15000 });
await mp.screenshot({ path: `${SHOT}/rollback-forest-topic183-mobile-2026-09-23.png`, fullPage: true });

await browser.close();
console.log(`\n=== ИТОГ: pass=${pass} fail=${fail} ===`);
process.exit(fail ? 1 : 0);
