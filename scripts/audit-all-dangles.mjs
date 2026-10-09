// ПОЛНЫЙ аудит висящих линий: все темы (1..34), все страницы.
// Сегмент "висит сверху": его верх не соединён ни с чьим низом в той же колонке.
// Отдельно ловим СТЫКИ-РАЗРЫВЫ: конец сегмента выше верха следующего сегмента
// той же колонки больше чем на 4px (разрыв непрерывности).
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const TOPICS = Array.from({ length: 34 }, (_, i) => i + 1);
let totalHangs = 0;
const problems = [];

for (const t of TOPICS) {
  let prevFirst = null;
  for (let p = 1; p <= 10; p++) {
    const url = `http://127.0.0.1:3000/?topic=${t}${p > 1 ? `&page=${p}` : ""}`;
    let res;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(200);
    } catch { break; }
    res = await page.evaluate(() => {
      const cont = document.querySelector(".sakh-comments-container");
      if (!cont) return null;
      const cr = cont.getBoundingClientRect();
      const nums = [...cont.querySelectorAll(":scope > .sakh-comment")].map((c) => +c.dataset.msgnum);
      const segs = [...cont.querySelectorAll(":scope > .sakh-comment > .sakh-comment-connector")]
        .map((r) => {
          const card = r.parentElement, rr = r.getBoundingClientRect();
          return {
            num: +card.dataset.msgnum, lvl: +card.dataset.level, hook: r.dataset.hook === "1",
            stub: r.dataset.stub === "1", x: Math.round(rr.left - cr.left),
            top: Math.round(rr.top - cr.top), bottom: Math.round(rr.bottom - cr.top),
            hStyle: r.style.height,
          };
        });
      const verts = segs.filter((s) => !s.hook);
      const byX = new Map();
      for (const v of verts) { if (!byX.has(v.x)) byX.set(v.x, []); byX.get(v.x).push(v); }
      const hangs = [];
      for (const [x, list] of byX) {
        list.sort((a, b) => a.top - b.top);
        for (const s of list) {
          if (s.stub) continue;
          const conn = list.some((o) => o !== s && o.bottom >= s.top - 2 && o.bottom <= s.top + 4);
          if (!conn) hangs.push({ x, num: s.num, lvl: s.lvl, h: s.hStyle });
        }
      }
      return { first: nums[0], n: nums.length, hangs };
    });
    if (!res || res.n === 0) break;
    if (prevFirst !== null && res.first === prevFirst) break; // страница повторилась
    prevFirst = res.first;
    if (res.hangs.length) {
      problems.push({ topic: t, page: p, hangs: res.hangs });
      totalHangs += res.hangs.length;
      console.log(`ТЕМА ${t} стр.${p}: висящих x${res.hangs.length}:`, JSON.stringify(res.hangs));
    }
  }
}
console.log("=== ИТОГ: висящих сегментов:", totalHangs, "| проблемных страниц:", problems.length);
await browser.close();
