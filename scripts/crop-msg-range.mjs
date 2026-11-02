// Кроп зоны первых сообщений темы 1 (виден стык «родитель → первый ответ»
// и слияние линий нескольких ответов). Аргументы: from to outfile [topic=1]
// Пример: bun scripts/crop-msg-range.mjs 1 8 download/lines-before.png
import { chromium } from 'playwright';
const [from, to, out, topic = '1'] = process.argv.slice(2);
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await p.goto(`http://127.0.0.1:3000/?topic=${topic}`, { waitUntil: 'networkidle' });
const box = await p.evaluate(([f, t]) => {
  const cards = [...document.querySelectorAll('.sakh-comments-container > .sakh-comment')];
  const a = cards.find(c => c.dataset.msgnum === String(f));
  const b = cards.find(c => c.dataset.msgnum === String(t));
  if (!a || !b) return null;
  const y1 = a.getBoundingClientRect().top + window.scrollY;
  const y2 = b.getBoundingClientRect().bottom + window.scrollY;
  a.scrollIntoView({ block: 'start' });
  return { top: Math.max(0, y1 - 60), height: y2 - y1 + 60 };
}, [from, to]);
if (!box) { console.error('cards not found'); process.exit(1); }
await p.evaluate(t => window.scrollTo(0, t), Math.max(0, box.top - 100));
await p.waitForTimeout(250);
// клип в координатах страницы: после скролла пересчитываем
const clip = await p.evaluate(([f, t]) => {
  const cards = [...document.querySelectorAll('.sakh-comments-container > .sakh-comment')];
  const a = cards.find(c => c.dataset.msgnum === String(f));
  const b = cards.find(c => c.dataset.msgnum === String(t));
  const y1 = a.getBoundingClientRect().top;
  const y2 = b.getBoundingClientRect().bottom;
  return { x: 0, y: Math.max(0, y1 - 30), width: 900, height: Math.min(880, y2 - y1 + 60) };
}, [from, to]);
await p.screenshot({ path: out, clip });
console.log('saved', out, JSON.stringify(clip));
await browser.close();
