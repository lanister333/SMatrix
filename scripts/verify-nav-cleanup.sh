#!/bin/bash
# ДИРЕКТИВА «Чистка навигации и блок „Обсудить на форуме“» (nav-cleanup-2026-09-18):
#  1) меню «Ещё» (ПК-дропдаун И мобильная шторка) — строго 3 пункта:
#     Правила форума /rules.php, Обращение к администратору /feedback.php, О проекте /about.php;
#  2) левая колонка на ВСЕХ страницах: карточка .sakh-card «Обсудить на форуме»
#     (7 рубрик, кнопки веток #004A8F, прямоугольники 4px, не сливаются);
#  3) новые роуты /rules.php, /feedback.php, /about.php работают (трёхколоночный монолит);
#  4) контроль: лесенка форума не сломана, карта .trf-map цела; скриншоты; приёмка.
set -u
cd /home/z/my-project
PORT=3000

for p in $(ss -tlnp 2>/dev/null | rg ":$PORT" | rg -o 'pid=[0-9]+' | rg -o '[0-9]+'); do kill -9 "$p" 2>/dev/null; done
sleep 1
rm -rf .next
nohup bun run dev > /tmp/dev.log 2>&1 &
disown
ok=""
for i in $(seq 1 90); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://localhost:$PORT/" 2>/dev/null)
  [ "$code" = "200" ] && { ok=1; echo "сервер готов (${i}с)"; break; }
  sleep 1
done
[ -z "$ok" ] && { echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; tail -20 /tmp/dev.log; exit 1; }

echo "== ПК @1920, Главная: дропдаун «Ещё» — строго 3 пункта =="
agent-browser set viewport 1920 1080 >/dev/null
agent-browser open "http://localhost:$PORT/" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
sleep 2
# клик и замер — РАЗДЕЛЬНЫЕ eval (React перерендеривает асинхронно)
agent-browser eval "[...document.querySelectorAll('.sm-mainnav button')].find(b => b.getAttribute('aria-haspopup') === 'menu')?.click(); 'clicked'" >/dev/null 2>&1
sleep 1
agent-browser eval "
(() => {
  const menu = document.querySelector('[role=menu]');
  if (!menu) return JSON.stringify({err: 'дропдаун не открылся'});
  const items = [...menu.querySelectorAll('[role=menuitem]')].map(a => ({label: a.textContent.trim(), href: a.getAttribute('href'), tag: a.tagName}));
  return JSON.stringify({count: items.length, items});
})()" 2>/dev/null

echo "== ПК @1920, Главная: карточка «Обсудить на форуме» в левой колонке =="
agent-browser eval "
(() => {
  const card = document.querySelector('.left-column .sk-discuss-card');
  if (!card) return JSON.stringify({err: 'нет карточки'});
  const col = card.closest('.left-column');
  const rows = [...card.querySelectorAll('.sk-discuss-row')];
  const items = rows.map(r => {
    const name = r.querySelector('.sk-discuss-name');
    const btn = r.querySelector('.sk-discuss-btn');
    const cs = btn ? getComputedStyle(btn) : null;
    return {
      name: name ? name.textContent.trim() : null,
      page: name ? name.getAttribute('href') : null,
      action: btn ? btn.textContent.trim() : null,
      discuss: btn ? btn.getAttribute('href') : null,
      btnBg: cs ? cs.backgroundColor : null,
      btnColor: cs ? cs.color : null,
      btnRadius: cs ? cs.borderRadius : null,
      btnH: btn ? Math.round(btn.getBoundingClientRect().height) : null
    };
  });
  const rowRects = rows.map(r => r.getBoundingClientRect());
  let gaps = [];
  for (let i = 1; i < rowRects.length; i++) gaps.push(Math.round(rowRects[i].top - rowRects[i-1].bottom));
  return JSON.stringify({
    isLastBlock: col && col.lastElementChild === card,
    rows: rows.length,
    items, gaps,
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth
  });
})()" 2>/dev/null

echo "== ПК @1920, внутренняя страница /weather.php: карточка есть =="
agent-browser open "http://localhost:$PORT/weather.php" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
sleep 1
agent-browser eval "
(() => {
  const card = document.querySelector('.left-column .sk-discuss-card');
  const rows = card ? card.querySelectorAll('.sk-discuss-row').length : 0;
  const inner = card ? card.closest('.sk-col-left-inner') !== null : false;
  return JSON.stringify({card: !!card, rows, innerColumn: inner});
})()" 2>/dev/null

echo "== Роуты «Ещё»: /rules.php, /feedback.php, /about.php =="
for R in rules feedback about; do
  agent-browser open "http://localhost:$PORT/$R.php" >/dev/null 2>&1
  agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
  sleep 1
  echo "  $R.php: $(agent-browser eval "
(() => {
  const t = document.querySelector('.tb-title');
  const center = document.querySelector('.center-column');
  const card = document.querySelector('.left-column .sk-discuss-card');
  const moreBtn = [...document.querySelectorAll('.sm-mainnav button')].find(b => b.getAttribute('aria-haspopup') === 'menu');
  return JSON.stringify({
    title: t ? t.textContent.trim() : null,
    centerText: center ? center.textContent.trim().slice(0, 60) : null,
    leftCard: !!card,
    leftRows: card ? card.querySelectorAll('.sk-discuss-row').length : 0,
    moreActive: moreBtn ? moreBtn.classList.contains('active') : null,
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth
  });
})()" 2>/dev/null)"
done

echo "== Мобайл 400, Главная: шторка-аккордеон «Ещё» — строго 3 пункта =="
agent-browser set viewport 400 900 >/dev/null
agent-browser open "http://localhost:$PORT/" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
sleep 2
agent-browser eval "document.querySelector('.sm-mh-burger')?.click(); 'burger'" >/dev/null 2>&1
sleep 1
agent-browser eval "document.getElementById('sm-mdrawer')?.querySelector('.sm-mdrawer-more')?.click(); 'accordion'" >/dev/null 2>&1
sleep 1
agent-browser eval "
(() => {
  const drawer = document.getElementById('sm-mdrawer');
  if (!drawer) return JSON.stringify({err: 'шторка не открылась'});
  const subs = [...drawer.querySelectorAll('.sm-mdrawer-sub')].map(a => ({label: a.textContent.trim(), href: a.getAttribute('href'), tag: a.tagName}));
  const mainLinks = [...drawer.querySelectorAll('.sm-mdrawer-link:not(.sm-mdrawer-more):not(.sm-mdrawer-sub)')].map(a => a.textContent.trim());
  return JSON.stringify({mainLinks, subs: {count: subs.length, items: subs}});
})()" 2>/dev/null

echo "== Мобайл 400: карточка «Обсудить на форуме» в шторке категорий форума =="
agent-browser eval "
(() => {
  const btn = document.querySelector('.sk-topbar button');
  if (!btn) return JSON.stringify({err: 'нет кнопки «Категории форума»'});
  btn.click();
  const col = document.querySelector('.sk-col-left.left-column');
  if (!col) return JSON.stringify({err: 'нет левой колонки'});
  const card = col.querySelector('.sk-discuss-card');
  const rows = card ? [...card.querySelectorAll('.sk-discuss-row')] : [];
  const last = rows.length ? rows[rows.length-1].getBoundingClientRect() : null;
  const colRect = col.getBoundingClientRect();
  return JSON.stringify({
    card: !!card,
    rows: rows.length,
    cardWithinDrawer: card ? (card.getBoundingClientRect().width > 200 && card.getBoundingClientRect().width <= colRect.width + 1) : false,
    lastRowVisible: last ? Math.round(last.bottom) : null,
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth
  });
})()" 2>/dev/null

echo "== Контроль лесенки /?topic=1 @1920 (4-е поколение рамок не сломано) =="
agent-browser set viewport 1920 1080 >/dev/null
agent-browser open "http://localhost:$PORT/?topic=1" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
sleep 2
agent-browser eval "
(() => {
  const msgs = document.querySelectorAll('.sakh-comment');
  if (!msgs.length) return JSON.stringify({err: 'нет лесенки'});
  const cs = getComputedStyle(msgs[0]);
  return JSON.stringify({comments: msgs.length, border: cs.borderColor.split(' ')[0] || cs.borderTopColor, borderW: cs.borderTopWidth, bg: cs.backgroundColor, marginBottom: cs.marginBottom, flat: document.querySelectorAll('.sakh-comments-container > .sakh-comment').length === msgs.length});
})()" 2>/dev/null

echo "== Скриншоты =="
agent-browser open "http://localhost:$PORT/" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
sleep 2
agent-browser eval "[...document.querySelectorAll('.sm-mainnav button')].find(b => b.getAttribute('aria-haspopup') === 'menu')?.click(); document.querySelector('.left-column .sk-discuss-card')?.scrollIntoView({block: 'start'}); 'ok'" >/dev/null 2>&1
sleep 1
agent-browser screenshot /home/z/my-project/download/nav-cleanup-more-and-card-1920.png >/dev/null
echo "скриншот: download/nav-cleanup-more-and-card-1920.png"
agent-browser open "http://localhost:$PORT/rules.php" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
sleep 1
agent-browser screenshot /home/z/my-project/download/nav-cleanup-rules-1920.png >/dev/null
echo "скриншот: download/nav-cleanup-rules-1920.png"
agent-browser set viewport 400 900 >/dev/null
agent-browser open "http://localhost:$PORT/" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
sleep 2
agent-browser eval "document.querySelector('.sm-mh-burger')?.click(); 'burger'" >/dev/null 2>&1
sleep 1
agent-browser eval "document.getElementById('sm-mdrawer')?.querySelector('.sm-mdrawer-more')?.click(); 'accordion'" >/dev/null 2>&1
sleep 1
agent-browser screenshot /home/z/my-project/download/nav-cleanup-drawer-mobile-400.png >/dev/null
echo "скриншот: download/nav-cleanup-drawer-mobile-400.png"

echo "== Приёмка =="
bun scripts/test-informers.ts 2>&1 | grep -E "✗|ИТОГО"
echo "== ГОТОВО =="
