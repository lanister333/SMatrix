// Верификация «концы нитей на рамках» (директива от Скриншот-20260919-121252):
// 1) каждая нить прижата вплотную к рамкам уровня K+1: left == 25·K − 2 (±1.5);
// 2) собственная нить карточки (K = L−1) прилегает к ЕЁ рамке: right == frame left;
// 3) вертикали полной высоты, штырьки мостят родитель→ответ, верх соединён;
// 4) низ ветви (tail=false) — ровно на нижней рамке карточки.
import { chromium } from "playwright";

const browser = await chromium.launch();
let context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
let page = await context.newPage();

let fails = 0, checked = 0, pages = 0, pageCount = 0;
for (const t of Array.from({ length: 34 }, (_, i) => i + 1)) {
  let prevFirst = null;
  for (let p = 1; p <= 8; p++) {
    let res;
    try {
      await page.goto(`http://127.0.0.1:3000/?topic=${t}${p > 1 ? `&page=${p}` : ""}`, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(180);
    } catch {
      // пересоздаём контекст после падения вкладки и повторяем страницу один раз
      try {
        await context.close();
      } catch {}
      context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      page = await context.newPage();
      try {
        await page.goto(`http://127.0.0.1:3000/?topic=${t}${p > 1 ? `&page=${p}` : ""}`, { waitUntil: "networkidle", timeout: 15000 });
        await page.waitForTimeout(180);
      } catch { break; }
    }
    pageCount++;
    if (pageCount % 12 === 0) {
      const url = page.url();
      await context.close();
      context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      page = await context.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(180);
    }
    res = await page.evaluate(() => {
      const cont = document.querySelector(".sakh-comments-container");
      if (!cont) return null;
      const cr = cont.getBoundingClientRect();
      const cards = new Map();
      for (const c of cont.querySelectorAll(":scope > .sakh-comment")) {
        const r = c.getBoundingClientRect();
        cards.set(+c.dataset.msgnum, {
          left: r.left - cr.left, top: Math.round(r.top - cr.top), bottom: Math.round(r.bottom - cr.top), lvl: +c.dataset.level,
        });
      }
      const errs = [];
      const rails = [...cont.querySelectorAll(":scope > .sakh-comment > .sakh-comment-connector")]
        .filter((r) => r.dataset.hook !== "1")
        .map((r) => {
          const card = r.parentElement, rr = r.getBoundingClientRect();
          const cd = cards.get(+card.dataset.msgnum);
          return {
            num: +card.dataset.msgnum, lvl: cd.lvl, stub: r.dataset.stub === "1",
            left: +(rr.left - cr.left).toFixed(1), right: +(rr.right - cr.left).toFixed(1),
            top: Math.round(rr.top - cr.top), bottom: Math.round(rr.bottom - cr.top),
            cardLeft: cd.left, cardTop: cd.top, cardBottom: cd.bottom, hStyle: r.style.height,
          };
        });
      // 1) колонка: нить left == 25·K − 2 (K в [1, lvl−1]); штырёк left == 25·lvl − 2
      for (const s of rails) {
        if (s.stub) {
          if (Math.abs(s.left - (25 * s.lvl - 2)) > 1.5)
            errs.push({ rule: "stub-column-off", num: s.num, left: s.left, lvl: s.lvl });
          continue;
        }
        const rel = s.left + 2;
        const k = Math.round(rel / 25);
        if (k < 1 || k > s.lvl - 1 || Math.abs(rel - 25 * k) > 1.5)
          errs.push({ rule: "column-off-frame", num: s.num, left: s.left, lvl: s.lvl });
        s.k = k;
        // 2) собственная нить прилегает к своей рамке
        if (!s.stub && s.k === s.lvl - 1 && Math.abs(s.right - s.cardLeft) > 1.5)
          errs.push({ rule: "own-not-hugging", num: s.num, right: s.right, cardLeft: s.cardLeft });
      }
      // 3) вертикальные правила
      const byX = new Map();
      for (const s of rails) { const x = Math.round(s.left); if (!byX.has(x)) byX.set(x, []); byX.get(x).push(s); }
      for (const [, list] of byX) {
        list.sort((a, b) => a.top - b.top);
        for (let i = 0; i < list.length; i++) {
          const s = list[i];
          if (s.stub) {
            if (Math.abs(s.top - s.cardBottom) > 2 || s.bottom - s.top > 11)
              errs.push({ rule: "stub-geometry", num: s.num });
            continue;
          }
          const cardH = s.cardBottom - s.cardTop;
          const segH = s.bottom - s.top;
          const tail = s.hStyle.includes("10px");
          if (Math.abs(segH - (cardH + (tail ? 9 : 1))) > 3)
            errs.push({ rule: "not-full-height", num: s.num, segH, cardH });
          const conn = list.some((o) => o !== s && o.bottom >= s.top - 2 && o.bottom <= s.top + 4);
          const colStart = !list.some((o) => o !== s && o.bottom < s.top);
          if (!conn && !colStart) errs.push({ rule: "top-hang", num: s.num });
          if (!tail && Math.abs(s.bottom - s.cardBottom) > 2)
            errs.push({ rule: "branch-end-off-frame", num: s.num, segBottom: s.bottom, cardBottom: s.cardBottom });
        }
      }
      return { first: Math.min(...cards.keys()), n: cards.size, errs, vCount: rails.length };
    });
    if (!res || !res.n || res.n === Infinity) break;
    if (prevFirst !== null && res.first === prevFirst) break;
    prevFirst = res.first;
    pages++; checked += res.vCount;
    if (res.errs.length) {
      fails += res.errs.length;
      console.log(`ТЕМА ${t} стр.${p}: ОШИБОК x${res.errs.length}:`, JSON.stringify(res.errs.slice(0, 6)));
    }
  }
}
console.log(`=== Страниц: ${pages}, нитей: ${checked}, ошибок: ${fails}`);
await browser.close();
process.exit(fails ? 1 : 0);
