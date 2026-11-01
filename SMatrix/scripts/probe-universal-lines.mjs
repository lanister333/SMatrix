// Проба УНИВЕРСАЛЬНОСТИ механизма линий (ForumThread + useReplyLines):
//  1) оверлей есть на ЛЮБОЙ странице пагинации и в ЛЮБОЙ теме (5, 12, 18);
//  2) при переключении страницы линий перерисовываются (SPA-клик, без перезагрузки);
//  3) кросс-страничные ответы показывают пометку «(стр. 1)» в карточке;
//  4) негативная проверка: в теме 1 на стр. 2 кросс-страничных ответов нет —
//     пометок быть не должно;
//  5) контейнер несёт классы forum-thread posts-list (универсальный ForumThread).
import { chromium } from "playwright";

const browser = await chromium.launch();
const fails = [];
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) fails.push(msg);
};

for (const topicId of [5, 12, 18, 1]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`http://127.0.0.1:3000/?topic=${topicId}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector(".sakh-comment", { timeout: 15000 });
  await page.waitForTimeout(700);

  const p1 = await page.evaluate(() => ({
    threadClass: document.querySelector(".forum-thread")?.className ?? "",
    svg: !!document.querySelector(":scope .sakh-reply-lines") || !!document.querySelector("svg.sakh-reply-lines"),
    paths: document.querySelectorAll("svg.sakh-reply-lines path.rl-vis").length,
    cards: document.querySelectorAll(".sakh-comment").length,
  }));
  ok(p1.threadClass.includes("forum-thread") && p1.threadClass.includes("posts-list"), `тема ${topicId}: контейнер = ForumThread (${p1.threadClass})`);
  ok(p1.svg, `тема ${topicId} стр.1: SVG-оверлей на месте`);
  ok(p1.paths > 0, `тема ${topicId} стр.1: линии нарисованы (${p1.paths} шин, карточек ${p1.cards})`);
  const marksOnP1 = await page.evaluate(() => document.querySelectorAll(".sk-msg-parent-page").length);

  // SPA-переход на страницу 2 кликом по пейджеру
  const clicked = await page.evaluate(() => {
    const el = [...document.querySelectorAll(".sk-pager a.pg-num")].find((a) => a.textContent.trim() === "2");
    if (el) { el.click(); return true; }
    return false;
  });
  ok(clicked, `тема ${topicId}: кнопка «2» в пейджере найдена`);
  await page.waitForTimeout(900);

  const p2 = await page.evaluate(() => ({
    svg: !!document.querySelector("svg.sakh-reply-lines"),
    paths: document.querySelectorAll("svg.sakh-reply-lines path.rl-vis").length,
    cards: document.querySelectorAll(".sakh-comment").length,
    marks: [...document.querySelectorAll(".sk-msg-parent-page")].map((e) => e.textContent.trim()),
    nums: [...document.querySelectorAll(".sakh-comment")].slice(0, 2).map((c) => c.dataset.msgnum),
  }));
  ok(p2.svg, `тема ${topicId} стр.2: SVG-оверлей перерисовался (SPA, без перезагрузки)`);
  ok(p2.cards > 0 && p2.nums[0] === "36", `тема ${topicId} стр.2: открылась именно страница 2 (первая карточка №${p2.nums[0]})`);
  if (topicId === 1) {
    ok(p2.marks.length === 0, `тема ${topicId} стр.2: пометок «(стр. M)» нет — все родители на этой странице`);
  } else {
    ok(p2.marks.length >= 1 && p2.marks.every((m) => m === "(стр. 1)"),
      `тема ${topicId} стр.2: пометки «(стр. 1)» показаны (${p2.marks.join(", ")})`);
    ok(marksOnP1 === 0, `тема ${topicId} стр.1: пометок нет — родители рядом, линии рисуются`);
  }
  await page.close();
}

// Скриншот-артефакт: тема 5, стр. 2 — пометки «(стр. 1)» + линии своей страницы
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2 });
await page.goto("http://127.0.0.1:3000/?topic=5", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForSelector(".sakh-comment");
await page.waitForTimeout(600);
await page.evaluate(() => {
  const el = [...document.querySelectorAll(".sk-pager a.pg-num")].find((a) => a.textContent.trim() === "2");
  el?.click();
});
await page.waitForTimeout(1000);
const cont = await page.$(".sakh-comments-container");
if (cont) await cont.screenshot({ path: "download/universal-lines-topic5-page2.png" });
console.log("скриншот: download/universal-lines-topic5-page2.png");

await browser.close();
console.log(fails.length ? `ИТОГО: ${fails.length} провалов` : "ИТОГО: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ");
process.exit(fails.length ? 1 : 0);
