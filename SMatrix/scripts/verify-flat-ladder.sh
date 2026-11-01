#!/bin/bash
# ДИРЕКТИВА «Плоская лесенка форума»: ВСЕ сообщения — строго друг за
# другом в общем родителе .forum-comments-list, БЕЗ вложенности
# контейнеров; уровень ТОЛЬКО классом comment-level-1…6 (0/20/40/60/80/
# 100px); Г-образные линии-указатели ::before у ответов; корни (level-1)
# чисты; ≤768px — margin-left:6px !important, линии скрыты, текст не
# сжат. Проверяются: ?topic=1 @1920 (структура, уровни, линии, рамки),
# @1280, мобайл 400, скриншоты, приёмка.
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

flat_check() {
  local w="$1"
  agent-browser set viewport "$w" 1080 >/dev/null
  agent-browser open "http://localhost:$PORT/?topic=1" >/dev/null 2>&1
  agent-browser wait --load networkidle --timeout 30000 >/dev/null 2>&1
  sleep 2
  agent-browser eval "
(() => {
  const list = document.querySelector('.forum-comments-list');
  if (!list) return JSON.stringify({err: 'нет .forum-comments-list'});
  const items = [...list.children];
  const flat = items.every((el) => el.parentElement === list && el.classList.contains('comment-item'));
  const nested = list.querySelectorAll('.comment-item .comment-item').length;
  const lv = (n) => {
    const msg = document.querySelector('.sk-msg[data-msgnum=\"' + n + '\"]');
    if (!msg) return null;
    const w = msg.closest('.comment-item') || msg.closest('[class*=\"comment-level\"]');
    if (!w) return null;
    const mLvl = [...w.classList].find((c) => c.startsWith('comment-level-'));
    return {num: n, level: mLvl, marginLeft: getComputedStyle(w).marginLeft, before: getComputedStyle(w, '::before').content};
  };
  const byNum = (n) => document.querySelector('.sk-msg[data-msgnum=\"' + n + '\"]');
  const item14 = byNum('14') ? byNum('14').closest('.comment-item') : null;
  const line2 = item14 ? (() => { const next = item14.nextElementSibling; return next ? getComputedStyle(next, '::before') : null; })() : null;
  const inner = item14 ? item14.querySelector(':scope > .sk-msg') : null;
  return JSON.stringify({
    viewport: '$w',
    items: items.length,
    flatSiblings: flat,
    nestedContainers: nested,
    levels: ['14','15','16','17','18','21','22','23'].map(lv),
    lineSample: line2 ? {content: line2.content, top: line2.top, left: line2.left, width: line2.width, height: line2.height, borderLeft: line2.borderLeftWidth + ' ' + line2.borderLeftColor, borderBottom: line2.borderBottomWidth + ' ' + line2.borderBottomColor, opacity: line2.opacity} : null,
    frame: item14 ? {itemBorder: getComputedStyle(item14).borderTopWidth + ' ' + getComputedStyle(item14).borderTopColor, itemBg: getComputedStyle(item14).backgroundColor, innerSkMsgBorder: inner ? getComputedStyle(inner).borderTopWidth : null, innerSkMsgMargin: inner ? getComputedStyle(inner).marginBottom : null} : null
  });
})()" 2>/dev/null
}

echo "== Плоская лесенка /?topic=1 @1920 =="
echo "  $(flat_check 1920)"
echo "== @1280 (сжатый ПК) =="
echo "  $(flat_check 1280)"
echo "== Мобайл 400 (≤768px: 6px, линии скрыты, текст не сжат) =="
agent-browser set viewport 400 900 >/dev/null
agent-browser open "http://localhost:$PORT/?topic=1" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 30000 >/dev/null 2>&1
sleep 2
agent-browser eval "
(() => {
  const list = document.querySelector('.forum-comments-list');
  if (!list) return JSON.stringify({err: 'нет .forum-comments-list'});
  const deep = [...list.querySelectorAll('.comment-level-3, .comment-level-4')][0];
  const lvl1 = list.querySelector('.comment-level-1');
  if (!deep) return JSON.stringify({err: 'нет глубоких уровней на странице'});
  const cs = getComputedStyle(deep);
  const pb = getComputedStyle(deep, '::before');
  return JSON.stringify({
    deepLevel: [...deep.classList].find((c) => c.startsWith('comment-level-')),
    deepMarginLeft: cs.marginLeft,
    deepWidth: Math.round(deep.getBoundingClientRect().width),
    listWidth: Math.round(list.getBoundingClientRect().width),
    beforeDisplay: pb.display,
    lvl1Margin: lvl1 ? getComputedStyle(lvl1).marginLeft : null,
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth
  });
})()" 2>/dev/null

echo "== Скриншоты =="
agent-browser set viewport 1920 1080 >/dev/null
agent-browser open "http://localhost:$PORT/?topic=1" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 30000 >/dev/null 2>&1
agent-browser eval "const m = document.querySelector('.sk-msg[data-msgnum=\"14\"]'); m && m.scrollIntoView({block:'start'}); 'ok'" >/dev/null 2>&1
sleep 1
agent-browser screenshot /home/z/my-project/download/flat-ladder-1920.png >/dev/null
echo "скриншот: download/flat-ladder-1920.png"
agent-browser set viewport 400 900 >/dev/null
agent-browser open "http://localhost:$PORT/?topic=1" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 30000 >/dev/null 2>&1
agent-browser eval "const m = document.querySelector('.sk-msg[data-msgnum=\"14\"]'); m && m.scrollIntoView({block:'start'}); 'ok'" >/dev/null 2>&1
sleep 1
agent-browser screenshot /home/z/my-project/download/flat-ladder-mobile-400.png >/dev/null
echo "скриншот: download/flat-ladder-mobile-400.png"
echo "== Приёмка =="
bun scripts/test-informers.ts 2>&1 | grep -E "✗|ИТОГО"
echo "== ГОТОВО =="
