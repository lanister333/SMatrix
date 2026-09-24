#!/bin/bash
# ШАГ 4 ТЗ №1: умная фиксация сетки ПК (≥1024px) + flex-строки Форума.
# One-shot: kill :3000 → rm -rf .next (ловушка Turbopack) → рестарт → проверки → приёмка.
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

# HOME: computed-стили контейнера/колонок + факт горизонтального скролла
home_check() {
  local w="$1"
  agent-browser set viewport "$w" 900 >/dev/null
  agent-browser open "http://localhost:$PORT/" >/dev/null 2>&1
  agent-browser wait --load networkidle --timeout 15000 >/dev/null 2>&1
  agent-browser eval "
(() => {
  const c = document.querySelector('.main-grid-container');
  if (!c) return JSON.stringify({err: 'нет контейнера'});
  const cs = getComputedStyle(c);
  const left = document.querySelector('.main-grid-container .sk-col-left');
  const center = document.querySelector('.main-grid-container .center-column');
  const right = document.querySelector('.main-grid-container .mp-right');
  const de = document.documentElement;
  return JSON.stringify({
    display: cs.display, justify: cs.justifyContent, gap: cs.columnGap,
    maxWidth: cs.maxWidth, w: Math.round(c.getBoundingClientRect().width),
    left: left ? Math.round(left.getBoundingClientRect().width) : null,
    center: center ? Math.round(center.getBoundingClientRect().width) : null,
    right: right ? Math.round(right.getBoundingClientRect().width) : null,
    hscroll: de.scrollWidth > de.clientWidth
  });
})()" 2>/dev/null
}

# FORUM: computed-стили строк списка тем
forum_check() {
  local w="$1"
  agent-browser set viewport "$w" 900 >/dev/null
  agent-browser open "http://localhost:$PORT/?view=forum" >/dev/null 2>&1
  agent-browser wait --load networkidle --timeout 15000 >/dev/null 2>&1
  agent-browser eval "
(() => {
  const row = document.querySelector('.sk-row');
  if (!row) return JSON.stringify({err: 'нет строк (возможно, тем нет)'});
  const cs = getComputedStyle(row);
  const head = document.querySelector('.sk-listhead');
  const a = row.querySelector('.r-title a');
  const author = row.querySelector('.r-author');
  const last = row.querySelector('.r-last');
  return JSON.stringify({
    display: cs.display, justify: cs.justifyContent, align: cs.alignItems,
    headDisplay: head ? getComputedStyle(head).display : null,
    authorW: author ? Math.round(author.getBoundingClientRect().width) : null,
    lastW: last ? Math.round(last.getBoundingClientRect().width) : null,
    ellipsis: a ? getComputedStyle(a).textOverflow : null,
    nowrap: a ? getComputedStyle(a).whiteSpace : null
  });
})()" 2>/dev/null
}

echo "== Главная: контейнер (1920 / 1280 / 1050 / 1024) =="
echo "1920: $(home_check 1920)"
echo "1280: $(home_check 1280)"
echo "1050: $(home_check 1050)"
echo "1024: $(home_check 1024)"
echo "== Форум: строки (1280 / 1024 / 1000) =="
echo "1280: $(forum_check 1280)"
echo "1024: $(forum_check 1024)"
echo "1000: $(forum_check 1000)"
echo "== Мобайл 400: заморозка =="
agent-browser set viewport 400 800 >/dev/null
agent-browser open "http://localhost:$PORT/" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 15000 >/dev/null 2>&1
agent-browser eval "
(() => {
  const c = document.querySelector('.main-grid-container');
  const row = document.querySelector('.mp-trow');
  const de = document.documentElement;
  return JSON.stringify({
    containerDisplay: c ? getComputedStyle(c).display : null,
    trowDisplay: row ? getComputedStyle(row).display : null,
    hscroll: de.scrollWidth > de.clientWidth,
    body: getComputedStyle(document.body).backgroundColor
  });
})()" 2>/dev/null
echo "== Скриншоты =="
agent-browser set viewport 1920 1000 >/dev/null
agent-browser open "http://localhost:$PORT/" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 15000 >/dev/null 2>&1
agent-browser screenshot /home/z/my-project/scripts/step4-home-1920.png >/dev/null
agent-browser set viewport 1280 900 >/dev/null
agent-browser open "http://localhost:$PORT/?view=forum" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 15000 >/dev/null 2>&1
agent-browser screenshot /home/z/my-project/scripts/step4-forum-1280.png >/dev/null
echo "скриншоты: scripts/step4-home-1920.png, scripts/step4-forum-1280.png"
echo "== Приёмка =="
bun scripts/test-informers.ts 2>&1 | grep -E "✗|ИТОГО"
echo "== ГОТОВО =="
