// Верификация после правки: 
// 1) нет вертикалей короче карточки (кроме 9px штырьков-стыков);
// 2) каждая вертикаль соединена сверху (с штырьком или хвостом предыдущей);
// 3) низ каждой вертикали: либо продолжение, либо собственная нижняя рамка.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

let fails = 0, checked = 0, pages = 0;
for (const t of [1, 5, 10, 12, 14, 18]) {
  let prevFirst = null;
  for (let p = 1; p <= 5; p++) {
    let res;
    try {
      await page.goto(`http://127.0.0.1:3000/?topic=${t}${p > 1 ? `&page=${p}` : ""}`, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(200);
    } catch { break; }
    res = await page.evaluate(() => {
      const cont = document.querySelector(".sakh-comments-container");
      if (!cont) return null;
      const cr = cont.getBoundingClientRect();
      const cards = new Map();
      for (const c of cont.querySelectorAll(":scope > .sakh-comment")) {
        const r = c.getBoundingClientRect();
        cards.set(+c.dataset.msgnum, { top: Math.round(r.top), bottom: Math.round(r.bottom) });
      }
      const verts = [...cont.querySelectorAll(":scope > .sakh-comment > .sakh-comment-connector")]
        .filter((r) => r.dataset.hook !== "1")
        .map((r) => {
          const card = r.parentElement, rr = r.getBoundingClientRect();
          const cb = cards.get(+card.dataset.msgnum);
          return {
            num: +card.dataset.msgnum, stub: r.dataset.stub === "1",
            x: Math.round(rr.left - cr.left),
            top: Math.round(rr.top), bottom: Math.round(rr.bottom),
            cardTop: cb.top, cardBottom: cb.bottom,
            hStyle: r.style.height,
          };
        });
      const byX = new Map();
      for (const v of verts) { if (!byX.has(v.x)) byX.set(v.x, []); byX.get(v.x).push(v); }
      const errs = [];
      for (const [x, list] of byX) {
        list.sort((a, b) => a.top - b.top);
        for (let i = 0; i < list.length; i++) {
          const s = list[i];
          // ПРАВИЛО 1: вертикаль = рост карточки (±2px) или 9px штырёк
          if (s.stub) {
            if (Math.abs(s.top - s.cardBottom) > 2 || Math.abs((s.bottom - s.top) - 9) > 2)
              errs.push({ rule: "stub-geometry", num: s.num, x, h: s.hStyle });
            continue;
          }
          const cardH = s.cardBottom - s.cardTop;
          const segH = s.bottom - s.top;
          const expectedTail = s.hStyle.includes("10px");
          if (Math.abs(segH - (cardH + (expectedTail ? 9 : 1))) > 3)
            errs.push({ rule: "not-full-height", num: s.num, x, segH, cardH, h: s.hStyle });
          // ПРАВИЛО 2: верх соединён (кроме первого сегмента колонки — он должен быть штырьком ниже карточки-цели)
          const conn = list.some((o) => o !== s && o.bottom >= s.top - 2 && o.bottom <= s.top + 4);
          const isColumnStart = !list.some((o) => o !== s && o.bottom < s.top);
          if (!conn && !isColumnStart) errs.push({ rule: "top-hang", num: s.num, x });
          // ПРАВИЛО 3: низ — либо в следующий сегмент, либо ровно у своей нижней рамки
          const next = list[i + 1];
          if (next && next.top > s.bottom + 4 && Math.abs(s.bottom - s.cardBottom) > 2)
            errs.push({ rule: "bottom-gap", num: s.num, x, gap: next.top - s.bottom });
          if (!next && Math.abs(s.bottom - s.cardBottom) > 3 && !expectedTail)
            errs.push({ rule: "bottom-not-at-border", num: s.num, x, segBottom: s.bottom, cardBottom: s.cardBottom });
        }
      }
      return { first: [...cards.keys()][0], n: cards.size, errs, vCount: verts.length };
    });
    if (!res || res.n === 0) break;
    if (prevFirst !== null && res.first === prevFirst) break;
    prevFirst = res.first;
    pages++; checked += res.vCount;
    if (res.errs.length) {
      fails += res.errs.length;
      console.log(`ТЕМА ${t} стр.${p}: ОШИБОК x${res.errs.length}:`, JSON.stringify(res.errs.slice(0, 8)));
    }
  }
}
console.log(`=== Проверено страниц: ${pages}, вертикалей: ${checked}, ошибок: ${fails}`);
await browser.close();
process.exit(fails ? 1 : 0);
