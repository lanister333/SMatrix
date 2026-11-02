// АУДИТ «линии = кто кому ответил» (директива пользователя).
// Для каждой страницы темы 1 строим ОЖИДАЕМУЮ модель нитей/штырьков прямо
// из API (parentId, depth) по тем же правилам, что и компонент, и сверяем
// с DOM 1:1. Плюс КРЮЧКИ/УГЛЫ по эталону autokochka (tree-t/tree-l/tree-i):
// каждый ответ висит крючком на колонке своей ветки (K = L−1) на высоте
// шапки; последний ответ ветки — «└» (вертикаль кончается на крючке).
// Плюс глобальный инвариант честности: каждый конец каждого вертикального
// отрезка обязан лежать на рамке карточки ЛИБО на крючке (ничего не висит
// в воздухе), плюс слияние линий у многодетных родителей, плюс регресс
// геометрии лесенки и метки «└ ответ …».
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3000';
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  ✗ ' + msg); } };

// ---------- Ожидаемая модель (те же правила, что в topic-view.tsx) ----------
function buildExpected(apiMsgs) {
  const byId = new Map(apiMsgs.map((m) => [m.id, m]));
  const info = new Map(); // id -> {lvl, chain, rails:[{k,tail}], stub}
  for (const m of apiMsgs) {
    const chain = [];
    let p = m.parentId ? byId.get(m.parentId) : undefined;
    let reachedRoot = !m.parentId;
    while (p) {
      chain.unshift(p);
      const pp = p.parentId ? byId.get(p.parentId) : undefined;
      if (!pp) { reachedRoot = !p.parentId; break; }
      p = pp;
    }
    const lvl = reachedRoot
      ? Math.min(6, Math.max(1, chain.length + 1))
      : Math.min(6, Math.max(2, (m.depth ?? 0) + 1));
    info.set(m.id, { lvl, chain, rails: [], stub: false, m });
  }
  const ancAt = (chain, k, lvl) => {
    const i = k - lvl + chain.length;
    return i >= 0 && i < chain.length ? chain[i].id : null;
  };
  for (let i = 0; i < apiMsgs.length; i++) {
    const cur = info.get(apiMsgs[i].id);
    const next = i + 1 < apiMsgs.length ? info.get(apiMsgs[i + 1].id) : null;
    if (next && next.m.parentId === cur.m.id && next.lvl === cur.lvl + 1) cur.stub = true;
    if (cur.lvl < 2) continue;
    for (let k = Math.max(1, cur.lvl - cur.chain.length); k < cur.lvl; k++) {
      const a = ancAt(cur.chain, k, cur.lvl);
      if (!a) continue;
      const tail = next ? ancAt(next.chain, k, next.lvl) === a : false;
      cur.rails.push({ k, tail, own: k === cur.lvl - 1 });
    }
  }
  return { byId, info };
}

// ---------- Аудит одной страницы ----------
async function auditPage(browser, pageNum, url) {
  console.log(`\n=== Страница ${pageNum} (${url}) ===`);
  const api = await (await fetch(`${BASE}/api/topics/1?page=${pageNum}`)).json();
  const apiMsgs = api.messages;
  const { info } = buildExpected(apiMsgs);
  const apiByNum = new Map(apiMsgs.map((m) => [m.num, m]));

  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
  const dom = await p.evaluate(() => {
    const y0 = window.scrollY;
    const cont = document.querySelector('.sakh-comments-container');
    const contLeft = cont ? cont.getBoundingClientRect().left : 0; // ступени/колонки меряем в координатах контейнера
    const cards = [...document.querySelectorAll('.sakh-comments-container > .sakh-comment')].map((c) => {
      const r = c.getBoundingClientRect();
      return { num: +c.dataset.msgnum, level: +c.dataset.level, left: r.left - contLeft, right: r.right - contLeft, top: r.top + y0, bottom: r.bottom + y0, h: r.height };
    });
    const segs = [...document.querySelectorAll('.sakh-comments-container .sakh-comment-connector')].map((s) => {
      const r = s.getBoundingClientRect();
      const card = s.closest('.sakh-comment');
      const cs = getComputedStyle(s);
      return { num: +card.dataset.msgnum, stub: s.dataset.stub === '1', hook: s.dataset.hook === '1', left: r.left - contLeft, top: r.top + y0, bottom: r.bottom + y0, w: r.width, color: cs.backgroundColor, disp: cs.display };
    });
    return { cards, segs, hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
  await p.close();

  const cardByNum = new Map(dom.cards.map((c) => [c.num, c]));
  ok(dom.cards.length === apiMsgs.length, `карточек в DOM ${dom.cards.length} = API ${apiMsgs.length}`);
  ok(!dom.hscroll, 'нет горизонтального скролла');

  // --- регресс лесенки: ступени, правый край, зазоры ---
  const lefts = [...new Set(dom.cards.map((c) => Math.round(c.left)))].sort((a, b) => a - b);
  const rights = dom.cards.map((c) => Math.round(c.right));
  ok(Math.max(...rights) - Math.min(...rights) <= 2, `правые края на одной вертикали (${Math.min(...rights)}..${Math.max(...rights)})`);
  for (let i = 1; i < dom.cards.length; i++) {
    const gap = dom.cards[i].top - dom.cards[i - 1].bottom;
    ok(Math.abs(gap - 8) <= 1.2, `зазор между #${dom.cards[i - 1].num} и #${dom.cards[i].num} = ${gap.toFixed(1)} (ожидалось 8)`);
  }

  // --- 1:1 ожидаемая модель vs DOM ---
  for (const [id, exp] of info) {
    const m = exp.m;
    const card = cardByNum.get(m.num);
    ok(!!card, `карточка #${m.num} на месте`);
    if (!card) continue;
    ok(card.level === exp.lvl, `#${m.num} data-level=${card.level} (ожидался ${exp.lvl})`);
    ok(Math.abs(card.left - 25 * (exp.lvl - 1)) <= 1.5, `#${m.num} левая ступень ${card.left.toFixed(1)} (ожидалась ${25 * (exp.lvl - 1)})`);
    const mine = dom.segs.filter((s) => s.num === m.num);
    const railsDom = mine.filter((s) => !s.stub && !s.hook);
    const hooksDom = mine.filter((s) => s.hook);
    ok(railsDom.length === exp.rails.length, `#${m.num} нитей ${railsDom.length} (ожидалось ${exp.rails.length})`);
    for (const er of exp.rails) {
      const colExp = 25 * er.k - 12;
      const seg = railsDom.find((s) => Math.abs(s.left - colExp) <= 1.5);
      ok(!!seg, `#${m.num} нить K=${er.k} на колонке ${colExp} есть`);
      if (!seg) continue;
      ok(Math.abs(seg.top - card.top) <= 1.5, `#${m.num} нить K=${er.k} начинается на верхней рамке карточки`);
      if (er.own && !er.tail) {
        // УГОЛ «└»: последний ответ ветки — вертикаль кончается на крючке (y = +22 от верха)
        ok(Math.abs(seg.bottom - (card.top + 22)) <= 1.5, `#${m.num} нить K=${er.k} угол «└»: вертикаль кончается на крючке (${(seg.bottom - card.top).toFixed(1)} от верха, ждём 22)`);
      } else {
        const hExp = card.h + (er.tail ? 9 : 0);
        ok(Math.abs(seg.bottom - (card.bottom + (er.tail ? 9 : 0))) <= 1.5, `#${m.num} нить K=${er.k} хвост ${er.tail ? 'сквозь зазор (+9)' : 'до своей нижней рамки (+0)'}`);
        ok(Math.abs((seg.bottom - seg.top) - hExp) <= 2, `#${m.num} нить K=${er.k} длина ок`);
      }
      ok(seg.color === 'rgb(36, 151, 144)', `#${m.num} нить K=${er.k} цвет #249790`);
      ok(Math.abs(seg.w - 2) <= 0.5, `#${m.num} нить K=${er.k} ширина 2px`);
    }
    const expHooks = exp.rails.filter((r) => r.own);
    ok(hooksDom.length === expHooks.length, `#${m.num} крючков ${hooksDom.length} (ожидалось ${expHooks.length})`);
    for (const eh of expHooks) {
      const colExp = 25 * eh.k - 12;
      const hk = hooksDom.find((s) => Math.abs(s.left - colExp) <= 1.5);
      ok(!!hk, `#${m.num} крючок K=${eh.k} на колонке ${colExp} есть`);
      if (!hk) continue;
      ok(Math.abs(hk.top - (card.top + 22)) <= 1.5, `#${m.num} крючок K=${eh.k} на высоте шапки (y=${(hk.top - card.top).toFixed(1)} от верха, ждём 22)`);
      ok(Math.abs(hk.w - 13) <= 1 && Math.abs(hk.bottom - hk.top - 2) <= 1, `#${m.num} крючок K=${eh.k} размер 13x2`);
      ok(Math.abs((hk.left + hk.w) - (colExp + 14)) <= 2.5, `#${m.num} крючок K=${eh.k} дотягивается до рамки карточки`);
      ok(hk.color === 'rgb(36, 151, 144)', `#${m.num} крючок K=${eh.k} цвет #249790`);
    }
    const stubDom = mine.find((s) => s.stub);
    ok(!!stubDom === exp.stub, `#${m.num} штырёк ${exp.stub ? 'есть (реальный ребёнок ниже)' : 'отсутствует (ребёнка ниже нет)'}`);
    if (stubDom && exp.stub) {
      const child = cardByNum.get(apiByNum.get(m.num + 1)?.num ?? -1);
      ok(Math.abs(stubDom.top - (card.bottom - 1)) <= 1.5, `#${m.num} штырёк стартует от нижней рамки родителя`);
      ok(Math.abs(stubDom.bottom - card.bottom - 8) <= 1.5, `#${m.num} штырёк доходит до верхней рамки ответа`);
      ok(Math.abs(stubDom.left - (25 * exp.lvl - 12)) <= 1.5, `#${m.num} штырёк на колонке нити K=${exp.lvl}`);
    }
  }

  // --- инвариант «никаких висящих концов»: слить отрезки по колонкам ---
  const hooksAll = dom.segs.filter((s) => s.hook);
  const endOnHook = (col, y) => hooksAll.some((h) => Math.abs(h.left - col) <= 1.5 && y >= h.top - 1.5 && y <= h.bottom + 1.5);
  const byCol = new Map();
  for (const s of dom.segs) {
    if (s.hook) continue; // крючки горизонтальны — в вертикальную сводку не идут
    const col = Math.round(s.left);
    if (!byCol.has(col)) byCol.set(col, []);
    byCol.get(col).push(s);
  }
  const endOnFrame = (col, y) => dom.cards.some((c) => Math.abs(c.top - y) <= 1.5 || Math.abs(c.bottom - y) <= 1.5) || endOnHook(col, y);
  let totalIntervals = 0, floats = 0;
  for (const [col, list] of byCol) {
    list.sort((a, b) => a.top - b.top);
    let cur = { top: list[0].top, bottom: list[0].bottom };
    const flush = () => {
      totalIntervals++;
      if (!endOnFrame(col, cur.top)) { floats++; console.log(`  ✗ висящий ВЕРХ линии x=${col}: y=${cur.top.toFixed(1)}`); }
      if (!endOnFrame(col, cur.bottom)) { floats++; console.log(`  ✗ висящий НИЗ линии x=${col}: y=${cur.bottom.toFixed(1)}`); }
    };
    for (let i = 1; i < list.length; i++) {
      if (list[i].top <= cur.bottom + 1.5) cur.bottom = Math.max(cur.bottom, list[i].bottom);
      else { flush(); cur = { top: list[i].top, bottom: list[i].bottom }; }
    }
    flush();
  }
  ok(floats === 0, `все концы линий на рамках: интервалов ${totalIntervals}, висящих ${floats}`);

  // --- слияние линий у многодетных родителей ---
  const childrenOf = new Map();
  for (const m of apiMsgs) {
    if (!m.parentId) continue;
    const pn = apiMsgs.find((x) => x.id === m.parentId)?.num;
    if (pn == null) continue;
    if (!childrenOf.has(pn)) childrenOf.set(pn, []);
    childrenOf.get(pn).push(m.num);
  }
  let multi = 0;
  for (const [pn, kids] of childrenOf) {
    if (kids.length < 2) continue;
    const parent = cardByNum.get(pn);
    if (!parent) continue; // родитель на другой странице — линия к нему честно не рисуется
    multi++;
    const col = 25 * parent.level - 12;
    const list = (byCol.get(col) ?? []).sort((a, b) => a.top - b.top);
    // слить и найти интервал, содержащий низ родителя
    let iv = null;
    let cur = null;
    for (const s of list) {
      if (cur && s.top <= cur.bottom + 1.5) { cur.bottom = Math.max(cur.bottom, s.bottom); }
      else { cur = { top: s.top, bottom: s.bottom }; }
      if (cur.top <= parent.bottom - 1 + 1.5 && cur.bottom >= parent.bottom - 1 - 1.5) iv = cur;
    }
    const kidCards = kids.map((k) => cardByNum.get(k)).filter(Boolean);
    if (kidCards.length === 0) continue;
    const lastKidCard = kidCards[kidCards.length - 1];
    const lastHookY = lastKidCard.top + 22; // крючок последнего ответа
    const allHooksCovered = kidCards.every((kc) => {
      const hy = kc.top + 22;
      return !!iv && iv.top <= hy + 1.5 && iv.bottom >= hy - 1.5;
    });
    ok(!!iv && iv.bottom >= lastHookY - 1.5 && allHooksCovered,
      `родитель #${pn} (дети ${kids.join(', ')}): ОДНА непрерывная линия от его рамки до крючка последнего ответа, крючки всех ответов на стволе` +
      (!iv ? ' — интервал не найден!' : ` — линия ${iv.top.toFixed(0)}..${iv.bottom.toFixed(0)}, нужно до ${lastHookY.toFixed(0)}`));
  }
  console.log(`  многодетных родителей на странице: ${multi}`);
  return { checks, fails };
}

const browser = await chromium.launch();
await auditPage(browser, 1, '/?topic=1');
await auditPage(browser, 2, '/?topic=1&msg=36');
await auditPage(browser, 3, '/?topic=1&msg=71');
await browser.close();
console.log(`\nИТОГО: проверок ${checks}, провалов ${fails}`);
process.exit(fails ? 1 : 0);
