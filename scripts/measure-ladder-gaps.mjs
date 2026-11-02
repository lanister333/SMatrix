// Замер геометрии лесенки: правые края карточек/кнопок, вертикальные зазоры
import { chromium } from 'playwright';
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto('http://127.0.0.1:3000/?topic=1', { waitUntil: 'networkidle' });

const data = await p.evaluate(() => {
  const cont = document.querySelector('.sakh-comments-container');
  const contR = cont.getBoundingClientRect();
  const cards = [...cont.querySelectorAll(':scope > .sakh-comment')];
  const rows = [];
  let prevBottom = null;
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    const btn = c.querySelector('.sk-btn-reply');
    const btnR = btn ? btn.getBoundingClientRect() : null;
    const head = c.querySelector('.sk-msg-head');
    const headR = head ? head.getBoundingClientRect() : null;
    rows.push({
      num: c.dataset.msgnum,
      level: c.dataset.level,
      cardL: +(r.left - contR.left).toFixed(1),
      cardR: +(r.right - contR.left).toFixed(1),
      contW: +contR.width.toFixed(1),
      gapAbove: prevBottom === null ? null : +(r.top - prevBottom).toFixed(1),
      btnR: btnR ? +(btnR.right - contR.left).toFixed(1) : null,
      btnOverCard: btnR && btnR.right > r.right - 1 ? +(btnR.right - r.right).toFixed(1) : 0,
      btnOverHead: headR && btnR && btnR.right > headR.right - 1 ? +(btnR.right - headR.right).toFixed(1) : 0,
      headR: headR ? +(headR.right - contR.left).toFixed(1) : null,
    });
    prevBottom = r.bottom;
  }
  return { contW: +contR.width.toFixed(1), rows };
});

console.log(`Контейнер width=${data.contW}`);
console.log('num lvl | cardL  cardR | gapAbove | btnR  btnOverCard btnOverHead | headR');
for (const r of data.rows) {
  console.log(
    `#${String(r.num).padStart(3)} L${r.level} | ${String(r.cardL).padStart(6)} ${String(r.cardR).padStart(6)} | ${String(r.gapAbove).padStart(8)} | ${String(r.btnR).padStart(6)} ${String(r.btnOverCard).padStart(6)} ${String(r.btnOverHead).padStart(6)} | ${r.headR}`
  );
}
const overflows = data.rows.filter(r => r.cardR > data.contW + 0.5);
console.log(`\nКарточек с правым краем ПРАВЕЕ контейнера: ${overflows.length} из ${data.rows.length}`);
console.log(`Макс. вылезание вправо: ${Math.max(0, ...data.rows.map(r => r.cardR - data.contW)).toFixed(1)}px`);
console.log(`Кнопок, вылезающих за правый край СВОЕЙ карточки: ${data.rows.filter(r => r.btnOverCard > 0).length}`);
console.log(`Кнопок, вылезающих за правый край шапки: ${data.rows.filter(r => r.btnOverHead > 0).length}`);
const gaps = data.rows.map(r => r.gapAbove).filter(g => g !== null);
console.log(`Зазоры между карточками: min=${Math.min(...gaps)} max=${Math.max(...gaps)}`);
await browser.close();
