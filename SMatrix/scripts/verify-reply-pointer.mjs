// Приёмка «указатель ответа как на Сахкоме»: метка └ ответ + клик = плавная перемотка
import { chromium } from 'playwright';
const browser = await chromium.launch();
const BASE = 'http://127.0.0.1:3000';
let fails = 0;
const ok = (cond, name) => { console.log(`${cond ? '✓' : '✗ FAIL'} ${name}`); if (!cond) fails++; };

// ---------- A. API: parentNum консистентен ----------
const p1 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await p1.goto(`${BASE}/?topic=1`, { waitUntil: 'networkidle' });
const api = await p1.evaluate(async () => {
  const r = await fetch('/api/topics/1?page=1');
  const d = await r.json();
  const byId = new Map(d.messages.map((m) => [m.id, m]));
  const bad = d.messages.filter((m) => m.parentId && byId.has(m.parentId) && m.parentNum !== byId.get(m.parentId).num);
  const withParent = d.messages.filter((m) => m.parentAuthor);
  return { total: d.messages.length, withParent: withParent.length, badParentNum: bad.length };
});
ok(api.total > 0 && api.withParent > 0, `API: сообщений ${api.total}, с родителем ${api.withParent}`);
ok(api.badParentNum === 0, `API: parentNum совпадает с num родителя (ошибок: ${api.badParentNum})`);

// ---------- B. DOM: метки-ссылки └ ответ ----------
const labels = await p1.evaluate(() => {
  const out = [];
  document.querySelectorAll('.sakh-comments-container > .sakh-comment').forEach((card) => {
    const lab = card.querySelector('.sk-msg-parent');
    if (!lab) return;
    const st = getComputedStyle(lab);
    const nick = lab.querySelector('.sk-nick');
    out.push({
      num: card.dataset.msgnum,
      tag: lab.tagName,
      text: lab.textContent.trim().replace(/\s+/g, ' '),
      color: st.color,
      cursor: st.cursor,
      underline: st.textDecorationLine,
      title: lab.getAttribute('title') || '',
      nick: nick ? nick.textContent : '',
      nickColor: nick ? getComputedStyle(nick).color : '',
    });
  });
  return out;
});
ok(labels.length > 0, `Меток «ответ» на странице: ${labels.length}`);
ok(labels.every((l) => l.tag === 'A'), `Все метки — кликабельные <a> (${labels.filter(l=>l.tag==='A').length}/${labels.length})`);
ok(labels.every((l) => l.text.startsWith('└ ответ')), 'Все метки начинаются с «└ ответ»');
ok(labels.every((l) => l.color === 'rgb(10, 92, 170)'), 'Все метки синего цвета ссылки #0a5caa');
ok(labels.every((l) => l.cursor === 'pointer'), 'Все метки с курсором-рукой');
ok(labels.every((l) => l.underline === 'none'), 'Без подчёркивания в покое (hover — с ним)');
ok(labels.every((l) => /№\d+ от .+/.test(l.title)), 'В title — номер и автор сообщения-родителя');

// имя в метке = автор родительской карточки
const nameChecks = await p1.evaluate((labels) => {
  return labels.map((l) => {
    const m = l.title.match(/№(\d+)/);
    const parentCard = m && document.querySelector(`.sakh-comments-container [data-msgnum="${m[1]}"] .sk-msg-author, [data-msgnum="${m[1]}"] .sk-msg-author`);
    return { num: l.num, parentNum: m ? m[1] : null, labNick: l.nick, parentAuthor: parentCard ? parentCard.textContent.trim() : null };
  });
}, labels);
const nameBad = nameChecks.filter((c) => c.parentAuthor && c.labNick !== c.parentAuthor);
ok(nameBad.length === 0, `Имя в метке = ник автора родителя (несовпадений: ${nameBad.length})`);
console.log('   пример:', JSON.stringify(nameChecks.find((c) => c.parentNum) || nameChecks[0]));

// ---------- C. Клик = плавная перемотка к родителю ----------
await p1.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p1.waitForTimeout(200);
const clicked = await p1.evaluate(() => {
  const labs = [...document.querySelectorAll('.sakh-comments-container .sk-msg-parent')];
  const lab = labs[labs.length - 3] || labs[labs.length - 1]; // метка ближе к низу
  const m = (lab.getAttribute('title') || '').match(/№(\d+)/);
  lab.click();
  return { parentNum: m ? +m[1] : null, scrollYBefore: window.scrollY };
});
await p1.waitForTimeout(1300);
const afterClick = await p1.evaluate((parentNum) => {
  const el = document.querySelector(`[data-msgnum="${parentNum}"]`);
  const r = el ? el.getBoundingClientRect() : null;
  return {
    flashed: !!el && el.classList.contains('sk-msg-flash'),
    inViewport: !!r && r.top < window.innerHeight && r.bottom > 0,
    scrollY: window.scrollY,
  };
}, clicked.parentNum);
ok(clicked.parentNum !== null, `Кликнули метку (родитель №${clicked.parentNum}), scrollY до: ${Math.round(clicked.scrollYBefore)}`);
ok(afterClick.flashed, 'Родительская карточка подсвечена (.sk-msg-flash)');
ok(afterClick.inViewport, 'Родительская карточка в зоне видимости после плавной перемотки');

// ---------- D. Кросс-страничный переход (тема 5: #36 → #35 на стр. 1) ----------
// Deep-link страницы темы = &msg=N (curPage = ceil(N/35)); параметр page= не читается
const p2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await p2.goto(`${BASE}/?topic=5&msg=36`, { waitUntil: 'networkidle' });
await p2.waitForTimeout(900); // ждём первичный deep-link флеш #36
const preCross = await p2.evaluate(() => ({
  onPage2: !!document.querySelector('[data-msgnum="36"]'),
  msg35absent: !document.querySelector('[data-msgnum="35"]'),
}));
ok(preCross.onPage2 && preCross.msg35absent, 'Тема 5: deep-link &msg=36 открыл страницу 2 (#36 есть, #35 нет)');
const cross = await p2.evaluate(() => {
  const lab = document.querySelector('[data-msgnum="36"] .sk-msg-parent');
  if (!lab) return { found: false };
  lab.click();
  return { found: true, title: lab.getAttribute('title') };
});
await p2.waitForTimeout(2200);
const crossAfter = await p2.evaluate(() => {
  const el = document.querySelector('[data-msgnum="35"]');
  const r = el ? el.getBoundingClientRect() : null;
  return {
    flashed: !!el && el.classList.contains('sk-msg-flash'),
    inViewport: !!r && r.top < window.innerHeight && r.bottom > 0,
    msg35visible: !!el,
  };
});
ok(cross.found, 'Тема 5, стр. 2: метка на #36 найдена и кликнута');
ok(crossAfter.msg35visible, 'Страница переключилась на 1-ю: карточка #35 в DOM');
ok(crossAfter.flashed, 'Кросс-страница: #35 подсвечена');
ok(crossAfter.inViewport, 'Кросс-страница: #35 в зоне видимости');

// ---------- E. Скриншоты ----------
await p1.evaluate(() => window.scrollTo(0, 0));
await p1.waitForTimeout(300);
const box = await p1.evaluate(() => {
  const cards = [...document.querySelectorAll('.sakh-comments-container > .sakh-comment')];
  const a = cards.find((c) => c.dataset.msgnum === '16');
  a.scrollIntoView({ block: 'center' });
  return { y: a.getBoundingClientRect().top + window.scrollY };
});
await p1.evaluate((y) => window.scrollTo(0, y - 100), box.y);
await p1.waitForTimeout(400);
await p1.screenshot({ path: 'download/reply-pointer-topic1-crop.png', clip: { x: 0, y: 80, width: 920, height: 640 } });
await p2.screenshot({ path: 'download/reply-pointer-cross-page.png', clip: { x: 0, y: 0, width: 1280, height: 700 } });
console.log('Скриншоты сохранены: reply-pointer-topic1-crop.png, reply-pointer-cross-page.png');

await browser.close();
console.log(fails === 0 ? '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : `\nПРОВАЛОВ: ${fails}`);
process.exit(fails === 0 ? 0 : 1);
