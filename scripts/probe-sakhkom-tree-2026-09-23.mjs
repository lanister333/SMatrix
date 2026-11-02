/**
 * ПРОБА ТЗ 2026-09-23 (2 задачи в одной):
 *
 * ЗАДАЧА 1 «левую колонку по ширине правой»:
 *   1.1 @1920 на /, /gde-kupit, /?topic=183: .left-column = 300px (= правой),
 *       .right-column = 300px, .center-column = 1105px, каркас ≤1745px;
 *   1.2 @1280: эластичное сжатие — центр ≥850, бока ≥150, без горскролла.
 *
 * ЗАДАЧА 2 «отображение ответов как на Сахкоме» (тема #183 «горбуша»,
 * контрольный состав #1..#6):
 *   2.1 состав: #1 Админ (вопрос), #2 Гость, #3 Админ, #4 Админ, #5 Админ,
 *       #6 Гость; порядок по num;
 *   2.2 уровни: data-level = [1,1,1,1,2,3] — ответы автору темы (#2-#4)
 *       ПЛОСКО (margin-left 0), #5 (ответ на #2) — отступ 25px, #6 — 50px;
 *   2.3 ЛИНИИ только у веток 2+ (п.3 ТЗ): svg g = 2 (для #5→#2 и #6→#5),
 *       шина в ЖЁЛОБЕ (bbox.left < 16, левее карточек) — карточки #2-#4
 *       полноразмерные линии НЕ перекрывают; линий к корню #1 НЕТ;
 *   2.4 карточка (п.2/3 ТЗ): аватаров НЕТ, ник текстом, ДАТА И ВРЕМЯ
 *       (dd.mm.yy hh:mm), № справа вверху, кнопки «Ответить» · «Спасибо» ·
 *       «Пожаловаться» · «В избранное»;
 *   2.5 цитаты (п.4 ТЗ): #2/#3/#4 = «Админ писал(а):» + текст #1;
 *       #5 = «Гость писал(а):» + текст #2; #6 = «Админ писал(а):» + текст #5;
 *       у #1 цитаты нет; серая рамка .sk-quote;
 *   2.6 «Спасибо» (п.3): клик → done + localStorage sk_thanks_<id>;
 *       повторный клик → снято;
 *   2.7 «Ответить» (п.5): цитата «Ник писал(а):» + строки «> …» в форму;
 *       при непустом поле (после e2e prefilled_text) — дописывается СНИЗУ,
 *       текст не стирается; «отменить ×» сбрасывает;
 *   2.8 e2e С5: адаптер 302 относительный /?topic=183&prefilled_text=…
 *       (кодировка ТЗ), форма предзаполнена 1-в-1, параметр вычищен;
 *   2.9 регресс «нет localhost» ×4 страницы;
 *   2.10 мобайл 375: без горскролла, карточки в одну линию (лесенка и
 *       линии скрыты), цитаты на месте.
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
const C5_URL = "/forum/topic/topic-salmon-888?prefilled_text=Все%20перекупщики%20уроды%2C%20задрали%20ценник%20на%20рыбу%20в%20два%20раза!";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();

/* ---------- РАУНД 1: левая колонка 300px (= правой) ---------- */
console.log("РАУНД 1: сетка 300/1105/300, каркас 1745 (@1920)");
for (const url of ["/", "/gde-kupit", "/?topic=183"]) {
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  const m = await page.evaluate(() => {
    const rect = (sel) => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().width) : null; };
    return { l: rect(".left-column"), c: rect(".center-column"), r: rect(".right-column"), k: rect(".main-grid-container") };
  });
  ok(`1.1 ${url} .left-column=300`, m.l === 300, `=${m.l}`);
  ok(`1.1 ${url} .right-column=300`, m.r === 300, `=${m.r}`);
  ok(`1.1 ${url} .center-column=1105`, m.c === 1105, `=${m.c}`);
  ok(`1.1 ${url} каркас ≤1745`, m.k !== null && m.k <= 1745, `=${m.k}`);
}
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.screenshot({ path: `${SHOT}/sakhkom2-home-1920-2026-09-23.png` });

/* @1280 эластичность */
{
  const p2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pg = await p2.newPage();
  await pg.goto(BASE + "/?topic=183", { waitUntil: "networkidle" });
  const m = await pg.evaluate(() => {
    const rect = (sel) => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().width) : null; };
    return {
      l: rect(".left-column"), c: rect(".center-column"), r: rect(".right-column"),
      scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  ok("1.2 @1280 центр ≥850", (m.c ?? 0) >= 850, `=${m.c}`);
  ok("1.2 @1280 бока ≥150", (m.l ?? 0) >= 150 && (m.r ?? 0) >= 150, `=${m.l}/${m.r}`);
  ok("1.2 @1280 без горскролла", m.scroll <= 0, `scrollX=${m.scroll}`);
  await p2.close();
}

/* ---------- РАУНД 2: Сахком-дерево в теме #183 ---------- */
console.log("РАУНД 2: дерево ответов как на Сахкоме (тема #183)");
await page.goto(BASE + "/?topic=183", { waitUntil: "networkidle" });
await page.waitForSelector(".sakh-comment", { timeout: 15000 });
await page.waitForTimeout(400); // rAF-пересчёт линий после монтирования

const t = await page.evaluate(() => {
  const cards = [...document.querySelectorAll(".sakh-comment")];
  const q = (sel, root = document) => root.querySelectorAll(sel).length;
  const headOf = (card) => card.querySelector(".sk-msg-head");
  const timeRe = /^\d{2}\.\d{2}\.\d{2},? \d{2}:\d{2}$/;
  return {
    count: cards.length,
    nums: cards.map((c) => c.getAttribute("data-msgnum")),
    levels: cards.map((c) => c.getAttribute("data-level")),
    authors: cards.map((c) => c.querySelector(".sk-msg-author")?.textContent?.trim() ?? null),
    times: cards.map((c) => c.querySelector(".sk-msg-time")?.textContent?.trim() ?? ""),
    timesOk: cards.map((c) => timeRe.test((c.querySelector(".sk-msg-time")?.textContent ?? "").trim())),
    lefts: cards.map((c) => Math.round(c.getBoundingClientRect().left)),
    numRight: cards.map((c) => {
      const n = c.querySelector(".sk-msg-num");
      const cr = c.getBoundingClientRect();
      return n ? Math.round(n.getBoundingClientRect().right) : 0;
    }),
    cardRights: cards.map((c) => Math.round(c.getBoundingClientRect().right)),
    avatars: q(".sk-msg-avatar"),
    parentMarks: q(".sk-msg-parent"),
    connectors: q(".sakh-comment-connector"),
    replyBtns: q(".sk-btn-reply"),
    thanksBtns: q(".sk-btn-thanks"),
    complainBtns: q("button.sk-flood-btn:not(.sk-fav-btn)"),
    favBtns: q(".sk-fav-btn"),
    quotes: q(".sk-quote"),
    quoteHeads: cards.map((c) => c.querySelector(".sk-quote-head")?.textContent?.trim() ?? null),
    quoteBodies: cards.map((c) => (c.querySelector(".sk-quote-body")?.textContent ?? "").trim().slice(0, 160)),
    bodies: cards.map((c) => (c.querySelector(".sk-msg-body")?.textContent ?? "").trim().slice(0, 60)),
    svg: (() => { const s = document.querySelector(".sakh-reply-lines"); return s ? Math.round(s.getBoundingClientRect().left) : null; })(),
    contLeft: Math.round(document.querySelector(".sakh-comments-container")?.getBoundingClientRect().left ?? 0),
    lineGroups: q(".sakh-reply-lines g"),
    lineLefts: [...document.querySelectorAll(".sakh-reply-lines g .rl-vis")].map((p) => Math.round(p.getBoundingClientRect().left)),
  };
});

ok("2.1 в теме 6 сообщений", t.count === 6, `=${t.count}`);
ok("2.1 номера 1..6", JSON.stringify(t.nums) === '["1","2","3","4","5","6"]', JSON.stringify(t.nums));
ok("2.1 авторы А/Г/А/А/А/Г", JSON.stringify(t.authors) === '["Админ","Гость","Админ","Админ","Админ","Гость"]', JSON.stringify(t.authors));
ok("2.2 уровни [1,1,1,1,2,3]", JSON.stringify(t.levels) === '["1","1","1","1","2","3"]', JSON.stringify(t.levels));
ok("2.2 ответы автору темы плоско (левые края #1-#4 равны)",
  t.lefts[0] === t.lefts[1] && t.lefts[1] === t.lefts[2] && t.lefts[2] === t.lefts[3],
  JSON.stringify(t.lefts));
ok("2.2 #5 с отступом 25px", t.lefts[4] - t.lefts[0] === 25, `+${t.lefts[4] - t.lefts[0]}`);
ok("2.2 #6 с отступом 50px", t.lefts[5] - t.lefts[0] === 50, `+${t.lefts[5] - t.lefts[0]}`);
ok("2.4 аватаров нет (только ник)", t.avatars === 0, `=${t.avatars}`);
ok("2.4 метки «└ ответ» удалены", t.parentMarks === 0, `=${t.parentMarks}`);
ok("2.4 нитей-коннекторов нет", t.connectors === 0, `=${t.connectors}`);
ok("2.4 дата И время в шапке (dd.mm.yy hh:mm)", t.timesOk.every(Boolean), JSON.stringify(t.times));
ok("2.4 № справа вверху (правый край шапки)",
  t.nums === null || t.numRight.every((nr, i) => nr >= t.cardRights[i] - 45 && nr <= t.cardRights[i]),
  `num ${JSON.stringify(t.numRight)} vs card ${JSON.stringify(t.cardRights)}`);
ok("2.4 «Ответить» ×6", t.replyBtns === 6, `=${t.replyBtns}`);
ok("2.4 «Спасибо» ×6", t.thanksBtns === 6, `=${t.thanksBtns}`);
ok("2.4 «Пожаловаться» ×6", t.complainBtns === 6, `=${t.complainBtns}`);
ok("2.4 «В избранное» ×6", t.favBtns === 6, `=${t.favBtns}`);
ok("2.5 цитат 5 (у #1 нет)", t.quotes === 5, `=${t.quotes}`);
ok("2.5 шапки цитат А/А/А/Г/А",
  JSON.stringify(t.quoteHeads) === JSON.stringify([null, "Админ писал(а):", "Админ писал(а):", "Админ писал(а):", "Гость писал(а):", "Админ писал(а):"]),
  JSON.stringify(t.quoteHeads));
ok("2.5 цитаты #2-#4 = текст #1 (горбуша)", t.quoteBodies[1].includes("горбушу") && t.quoteBodies[2].includes("горбушу") && t.quoteBodies[3].includes("горбушу"));
ok("2.5 цитата #5 = текст #2 (перекупщики)", t.quoteBodies[4].includes("перекупщики"), JSON.stringify(t.quoteBodies[4]));
ok("2.5 цитата #6 = текст #5 (Мореходка)", t.quoteBodies[5].includes("Мореходке"), JSON.stringify(t.quoteBodies[5]));
ok("2.3 линий ровно 2 (ветки 2+), к корню линий НЕТ", t.lineGroups === 2, `=${t.lineGroups}`);
{
  // Шины в координатах КОНТЕЙНЕРА: первая (верхняя, #5→#2) — в ЖЁЛОБЕ 0…16;
  // обе — левее карточек уровня 2 (отступ 25px от края контента = 41px от края контейнера)
  const rel = t.lineLefts.map((x) => x - (t.contLeft || 0));
  ok("2.3 шина #5→#2 в жёлобе контейнера (rel<16)", rel.length > 0 && rel[0] >= 0 && rel[0] < 16, `rel=${JSON.stringify(rel)}`);
  ok("2.3 обе шины левее карточек уровня 2 (rel<41)", rel.every((x) => x >= 0 && x < 41), `rel=${JSON.stringify(rel)}`);
}

await page.screenshot({ path: `${SHOT}/sakhkom2-tree-topic183-2026-09-23.png`, fullPage: true });

/* ---------- РАУНД 3: Спасибо / Ответить (логин Админом) ---------- */
console.log("РАУНД 3: «Спасибо» и «Ответить» (Админ)");
const login = await page.request.post(BASE + "/api/auth/login", { data: { email: "admin@sakhmatrix.ru", password: "admin" } });
ok("3.0 логин Админ", login.ok(), `=${login.status()}`);
const lu = await login.json();
await ctx.addInitScript(([auth]) => { localStorage.setItem("sm_auth", auth); }, [JSON.stringify({ token: lu.user.token, user: lu.user })]);
await page.goto(BASE + "/?topic=183", { waitUntil: "networkidle" });
await page.waitForSelector(".sakh-comment", { timeout: 15000 });

const ids = await page.evaluate(() => {
  const card = (n) => document.querySelector(`.sakh-comment[data-msgnum="${n}"]`);
  return { c3: card(3)?.getAttribute("data-id"), c5: card(5)?.getAttribute("data-id") };
});
const thanksBtn3 = page.locator('.sakh-comment[data-msgnum="3"] .sk-btn-thanks');
await thanksBtn3.click();
ok("3.1 Спасибо → done", (await thanksBtn3.getAttribute("class")).includes("done"));
const ls1 = await page.evaluate(([id]) => localStorage.getItem(`sk_thanks_${id}`), [ids.c3]);
ok("3.1 localStorage sk_thanks=1", ls1 === "1", `=${ls1}`);
await thanksBtn3.click();
ok("3.1 повторный клик → снято", !(await thanksBtn3.getAttribute("class")).includes("done"));
const ls2 = await page.evaluate(([id]) => localStorage.getItem(`sk_thanks_${id}`), [ids.c3]);
ok("3.1 localStorage очищен", ls2 === null, `=${ls2}`);

// Ответить на #5 — пустое поле → цитата целиком
await page.locator('.sakh-comment[data-msgnum="5"] .sk-btn-reply').click();
await page.waitForTimeout(300);
let ta = await page.inputValue("#reply-form textarea");
ok("3.2 Ответить на #5 → цитата в форме", ta.startsWith("Админ писал(а):\n> По делу") , JSON.stringify(ta.slice(0, 50)));
ok("3.2 цитата построчно «> …»", ta.split("\n").slice(1).every((l) => l.startsWith("> ") || l === "") , "");
// повторный клик — без дубля
await page.locator('.sakh-comment[data-msgnum="5"] .sk-btn-reply').click();
const ta2 = await page.inputValue("#reply-form textarea");
ok("3.2 повторный клик не дублирует цитату", ta2 === ta, "");
// отменить ×
await page.locator("#reply-form .sk-qr-target button").click();
ok("3.2 «отменить ×» сбрасывает адресата", (await page.locator("#reply-form .sk-qr-target").count()) === 0);

// Ответить на #6 при непустом поле (сначала prefilled) — дописывание СНИЗУ
await page.goto(BASE + C5_URL, { waitUntil: "networkidle" });
await page.waitForSelector("#reply-form textarea", { timeout: 15000 });
const pre = await page.inputValue("#reply-form textarea");
ok("3.3 e2e С5: prefilled_text 1-в-1", pre === C5_TEXT, JSON.stringify(pre.slice(0, 40)));
ok("3.3 URL очищен от prefilled_text", !page.url().includes("prefilled_text"), page.url().slice(0, 60));
await page.locator('.sakh-comment[data-msgnum="6"] .sk-btn-reply').click();
await page.waitForTimeout(300);
const ta3 = await page.inputValue("#reply-form textarea");
ok("3.3 непустое поле не стёрто (дописывание ниже)", ta3.startsWith(C5_TEXT), JSON.stringify(ta3.slice(0, 60)));
ok("3.3 цитата #6 добавлена ниже ввода (Гость писал(а))", ta3.includes("Гость писал(а):") && ta3.split("\n").some((l) => l.startsWith("> Подтверждаю")), "");

/* ---------- РАУНД 4: регресс «нет localhost» + адаптер ---------- */
console.log("РАУНД 4: регресс «нет localhost»");
for (const url of ["/", "/gde-kupit", "/gde-deshevle", "/?topic=183"]) {
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  const bad = await page.evaluate(() =>
    [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") ?? "").filter((h) => h.includes("localhost"))
  );
  ok(`4.1 ${url} без localhost-href`, bad.length === 0, bad.length ? JSON.stringify(bad.slice(0, 2)) : "");
}
const resp = await page.request.get(BASE + C5_URL, { maxRedirects: 0 });
const loc = resp.headers()["location"] ?? "";
ok("4.2 адаптер 302", resp.status() === 302, `=${resp.status()}`);
ok("4.2 Location относительный /?topic=183", !loc.startsWith("http") && loc.startsWith("/?topic=183&"), JSON.stringify(loc.slice(0, 30)));

/* ---------- РАУНД 5: мобайл 375 ---------- */
console.log("РАУНД 5: мобайл 375");
const mob = await browser.newContext({ viewport: { width: 375, height: 812 } });
const mp = await mob.newPage();
await mp.goto(BASE + "/?topic=183", { waitUntil: "networkidle" });
await mp.waitForSelector(".sakh-comment", { timeout: 15000 });
const mr = await mp.evaluate(() => ({
  scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  lefts: [...document.querySelectorAll(".sakh-comment")].map((c) => Math.round(c.getBoundingClientRect().left)),
  quotes: document.querySelectorAll(".sk-quote").length,
  avatars: document.querySelectorAll(".sk-msg-avatar").length,
  linesHidden: (() => { const s = document.querySelector(".sakh-reply-lines"); return s ? getComputedStyle(s).display === "none" : true; })(),
}));
ok("5.1 без горскролла", mr.scroll <= 0, `scrollX=${mr.scroll}`);
ok("5.2 карточки в одну линию (лесенка скрыта)", mr.lefts.every((x) => Math.abs(x - mr.lefts[0]) < 2), JSON.stringify(mr.lefts));
ok("5.2 линии скрыты (display:none)", mr.linesHidden, "");
ok("5.3 цитаты на месте (5)", mr.quotes === 5, `=${mr.quotes}`);
ok("5.3 аватаров нет", mr.avatars === 0, `=${mr.avatars}`);
await mp.screenshot({ path: `${SHOT}/sakhkom2-tree-topic183-mobile-2026-09-23.png`, fullPage: true });

await browser.close();
console.log(`\n=== ИТОГ: pass=${pass} fail=${fail} ===`);
process.exit(fail ? 1 : 0);
