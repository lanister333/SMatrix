// Проверка нитей лесенки после смены зазора 6→8px + приёмочный скриншот
import { chromium } from 'playwright';
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto('http://127.0.0.1:3000/?topic=1', { waitUntil: 'networkidle' });

const rails = await p.evaluate(() => {
  const cont = document.querySelector('.sakh-comments-container');
  const contR = cont.getBoundingClientRect();
  const cards = [...cont.querySelectorAll(':scope > .sakh-comment')];
  const report = { cols: new Set(), widths: new Set(), colors: new Set(), badStart: 0, badTail: 0, total: 0 };
  cards.forEach((c, idx) => {
    const cr = c.getBoundingClientRect();
    const next = cards[idx + 1] ? cards[idx + 1].getBoundingClientRect() : null;
    const nextLvl = cards[idx + 1] ? +cards[idx + 1].dataset.level : 0;
    c.querySelectorAll(':scope > .sakh-comment-connector').forEach((rail, k) => {
      report.total++;
      const rr = rail.getBoundingClientRect();
      report.cols.add(+(rr.left - contR.left).toFixed(1));
      report.widths.add(+rr.width.toFixed(1));
      report.colors.add(getComputedStyle(rail).backgroundColor);
      const topDelta = +(rr.top - cr.top).toFixed(1); // 0 = ровно наружный край верхней рамки (top:-1px от padding-box)
      if (topDelta !== 0) report.badStart++;
      const bottomDelta = +(rr.bottom - cr.bottom).toFixed(1); // tail: +8 (сквозь зазор до рамки след.); конец: 0
      const level = +c.dataset.level;
      const K = k + 1; // нити рисуются в порядке K = 1..L-1
      const expectTail = nextLvl >= K + 1; // ветка продолжается ниже
      if (expectTail && Math.abs(bottomDelta - 8) > 0.5) report.badTail++;
      if (!expectTail && Math.abs(bottomDelta) > 0.5) report.badTail++;
    });
  });
  return {
    total: report.total, badStart: report.badStart, badTail: report.badTail,
    cols: [...report.cols].sort((a, b) => a - b),
    widths: [...report.widths],
    colors: [...report.colors],
  };
});
console.log(`Нитей: ${rails.total}`);
console.log(`Колонки (отн. контейнера): ${rails.cols.join(' / ')}`);
console.log(`Ширины: ${[...rails.widths].join(', ')} | Цвета: ${[...rails.colors].join(' | ')}`);
console.log(`Стартов не на верхней рамке: ${rails.badStart} | Хвостов с неверной длиной: ${rails.badTail}`);

await p.screenshot({ path: 'download/ladder-gaps-8px-buttons-inside.png', fullPage: true });
console.log('Скриншот: download/ladder-gaps-8px-buttons-inside.png');
await browser.close();
