#!/bin/bash
# One-shot верификация nav-discuss-restyle-2026-09-18:
# kill :3000 → rm -rf .next → рестарт → agent-browser замеры + скриншоты.
# Всё в одном скрипте, т.к. фоновой сервер умирает между вызовами шелла.
set -u
cd /home/z/my-project
OUT=download
mkdir -p "$OUT"

echo "== 1. Kill :3000 и чистая сборка =="
lsof -ti:3000 | xargs -r kill -9 2>/dev/null
pkill -9 -f "next dev" 2>/dev/null; pkill -9 -f "next-server" 2>/dev/null
sleep 1
rm -rf .next

echo "== 2. Старт dev =="
nohup bun run dev > /tmp/sakh-dev.log 2>&1 &
disown
for i in $(seq 1 30); do rg -q "Ready" /tmp/sakh-dev.log && break; sleep 1; done
tail -1 /tmp/sakh-dev.log

echo "== 3. Прогрев Главной =="
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "http://localhost:3000/" 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 2
done
echo "warmup: $code"

echo "== 4. ПК 1920: замеры блока на Главной =="
agent-browser set viewport 1920 1080
agent-browser open "http://localhost:3000/"
agent-browser wait --load networkidle
sleep 3
agent-browser eval "$(cat scripts/eval-discuss.js)" > /tmp/discuss-pk.json
cat /tmp/discuss-pk.json | head -c 3000; echo

echo "== 5. ПК 1920: hover-подсветка строки =="
agent-browser find first ".sk-discuss-card .sk-rubric-name" hover
sleep 1
agent-browser eval "getComputedStyle(document.querySelector('.sk-discuss-card .sk-rubric-name')).color" > /tmp/discuss-hover.txt
cat /tmp/discuss-hover.txt
agent-browser eval "(() => { document.querySelector('.sk-discuss-card').scrollIntoView({block:'center'}); return 'scrolled'; })()" > /dev/null
sleep 1
agent-browser screenshot "$OUT/discuss-restyle-hover-1920.png"

echo "== 6. ПК 1920: общий скрин колонки (без hover) =="
agent-browser open "http://localhost:3000/"
agent-browser wait --load networkidle
sleep 2
agent-browser eval "(() => { document.querySelector('.sk-discuss-card').scrollIntoView({block:'center'}); return 'scrolled'; })()" > /dev/null
sleep 1
agent-browser screenshot "$OUT/discuss-restyle-1920.png"

echo "== 7. ПК 1280: крупный план двух блоков =="
agent-browser set viewport 1280 900
agent-browser reload
agent-browser wait --load networkidle
sleep 2
agent-browser eval "(() => { const c = document.querySelector('.sk-discuss-card'); const b = c.parentElement; const r = c.getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top - 120); return 'ok'; })()" > /dev/null
sleep 1
agent-browser screenshot "$OUT/discuss-restyle-1280-closeup.png"

echo "== 8. Внутренняя страница /weather.php =="
agent-browser open "http://localhost:3000/weather.php"
agent-browser wait --load networkidle
sleep 2
agent-browser eval "(() => { const c = document.querySelector('.sk-discuss-card'); if (!c) return JSON.stringify({exists:false}); const rows = c.querySelectorAll('.sk-navlist > li').length; c.scrollIntoView({block:'center'}); return JSON.stringify({exists:true, rows}); })()" > /tmp/discuss-weather.json
cat /tmp/discuss-weather.json
sleep 1
agent-browser screenshot "$OUT/discuss-restyle-weather-1920.png"

echo "== 9. Мобайл 400: карточка в потоке страницы =="
agent-browser set viewport 400 800
agent-browser open "http://localhost:3000/"
agent-browser wait --load networkidle
sleep 2
agent-browser eval "(() => { const c = document.querySelector('.sk-discuss-card'); if (!c) return JSON.stringify({exists:false, hscroll:null}); c.scrollIntoView({block:'center'}); return JSON.stringify({exists:true, rows: c.querySelectorAll('.sk-navlist > li').length, hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth, cardW: Math.round(c.getBoundingClientRect().width)}); })()" > /tmp/discuss-mobile.json
cat /tmp/discuss-mobile.json
sleep 1
agent-browser screenshot "$OUT/discuss-restyle-mobile-400.png"

echo "== 10. Остановка сервера =="
lsof -ti:3000 | xargs -r kill -9 2>/dev/null
pkill -9 -f "next dev" 2>/dev/null
echo "DONE"
