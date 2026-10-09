/**
 * Метрики «воздуха» форума — до/после компактизации (ТЗ 2026-09-23).
 * Замеряет computed-стили ключевых блоков на /?topic=183 и списке тем /.
 * Запуск: node scripts/measure-forum-spacing-2026-09-23.mjs [before|after]
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const TAG = process.argv[2] || "before";

const MSG = `async ({}) => {
  const cs = (sel, props) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const s = getComputedStyle(el);
    const o = {};
    for (const p of props) o[p] = parseFloat(s[p]);
    const r = el.getBoundingClientRect();
    o.h = Math.round(r.height * 10) / 10;
    return o;
  };
  const list = (sel, props, n) => {
    const els = [...document.querySelectorAll(sel)].slice(0, n || 3);
    return els.map((el) => {
      const s = getComputedStyle(el);
      const o = {};
      for (const p of props) o[p] = parseFloat(s[p]);
      const r = el.getBoundingClientRect();
      o.h = Math.round(r.height * 10) / 10;
      return o;
    });
  };
  return {
    comment: list(".sakh-comment", ["paddingTop","paddingBottom","paddingLeft","paddingRight","marginBottom"], 4),
    msgHead: list(".sk-msg-head", ["paddingTop","paddingBottom","marginTop","minHeight"], 2),
    msgBody: list(".sk-msg-body", ["paddingTop","paddingBottom","marginBottom","fontSize","lineHeight"], 2),
    quote: list(".sk-quote", ["marginTop","marginBottom","paddingTop","paddingBottom","paddingLeft","paddingRight","lineHeight"], 2),
    btnReply: list(".sk-btn-reply", ["paddingTop","paddingBottom","paddingLeft","paddingRight","fontSize"], 2),
    btnThanks: list(".sk-btn-thanks", ["paddingTop","paddingBottom","fontSize"], 2),
    btnFlood: list(".sk-flood-btn", ["paddingTop","paddingBottom","fontSize"], 2),
    qr: cs(".sk-qr", ["marginTop","paddingTop"]),
    qrTextarea: cs(".sk-qr textarea", ["minHeight","paddingTop","paddingBottom","fontSize","lineHeight"]),
    btnClassic: list(".sk-qr .sk-btn-classic", ["marginTop","paddingTop","paddingBottom"], 1),
    pager: list(".sk-pager", ["marginTop","marginBottom","paddingTop","paddingBottom"], 2),
    crumbs: cs(".sk-crumbs", ["marginBottom","paddingTop","paddingBottom"]),
    // зазор между карточками (фактический): low bottom → next top
    cardGap: (() => {
      const cards = [...document.querySelectorAll(".sakh-comment")].slice(0, 4);
      const gaps = [];
      for (let i = 1; i < cards.length; i++) {
        const g = Math.round((cards[i].getBoundingClientRect().top - cards[i-1].getBoundingClientRect().bottom) * 10) / 10;
        gaps.push(g);
      }
      return gaps;
    })(),
    headToBodyGap: (() => {
      // от низа шапки до верха тела (цитаты или текста) внутри первого сообщения
      const m = document.querySelector(".sakh-comment .sk-msg");
      if (!m) return null;
      const head = m.querySelector(".sk-msg-head");
      const body = m.querySelector(".sk-msg-body");
      if (!head || !body) return null;
      return Math.round((body.getBoundingClientRect().top - head.getBoundingClientRect().bottom) * 10) / 10;
    })(),
    bodyToNumGap: (() => {
      const m = document.querySelector(".sakh-comment .sk-msg");
      if (!m) return null;
      const body = m.querySelector(".sk-msg-body");
      if (!body) return null;
      return Math.round((m.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom) * 10) / 10;
    })(),
  };
}`;

const LIST = `async ({}) => {
  const list = (sel, props, n) => {
    const els = [...document.querySelectorAll(sel)].slice(0, n || 3);
    return els.map((el) => {
      const s = getComputedStyle(el);
      const o = {};
      for (const p of props) o[p] = parseFloat(s[p]);
      const r = el.getBoundingClientRect();
      o.h = Math.round(r.height * 10) / 10;
      return o;
    });
  };
  return {
    rows: list(".sk-row", ["paddingTop","paddingBottom","lineHeight"], 5),
    listhead: list(".sk-listhead", ["paddingTop","paddingBottom"], 1),
    title: list(".sk-row .r-title", ["fontSize","lineHeight"], 2),
    sub: list(".sk-row .r-sub", ["marginTop","lineHeight"], 2),
    toolbar: list(".sk-toolbar", ["marginBottom","paddingTop","paddingBottom"], 1),
    pager: list(".sk-pager", ["marginTop","marginBottom","paddingTop","paddingBottom"], 2),
  };
}`;

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // Тема #183
  await page.goto(BASE + "/?topic=183", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  let topic;
  try {
    topic = await page.evaluate("(" + MSG + ")({})");
  } catch (e) {
    console.log("TOPIC EVAL ERROR:", e.message.split("\n")[0]);
  }

  // Список тем (рубрика «Где купить» — рендерит .sk-row)
  await page.goto(BASE + "/?rubric=120", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  let listData;
  try {
    listData = await page.evaluate("(" + LIST + ")({})");
  } catch (e) {
    console.log("LIST EVAL ERROR:", e.message.split("\n")[0]);
  }

  await browser.close();

  console.log(`===== МЕТРИКИ ФОРУМА (${TAG}) =====`);
  console.log("--- ТЕМА /?topic=183 ---");
  if (topic) for (const k of Object.keys(topic)) console.log(k.padEnd(14), JSON.stringify(topic[k]));
  console.log("--- СПИСОК ТЕМ / ---");
  if (listData) for (const k of Object.keys(listData)) console.log(k.padEnd(14), JSON.stringify(listData[k]));
};

run().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
