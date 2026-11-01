#!/bin/bash
# ЖЁСТКАЯ ДИРЕКТИВА «Фиксация сетки на 850 пикселей» (≥1024px):
# контейнер max-width:1430px (240+850+300+2×20), gap:20px;
# левая 240, правая 300, центральная СТРОГО 850px (flex:0 0 850px).
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

# Геометрия каркаса: контейнер + три колонки (computed)
grid_check() {
  local url="$1" w="$2"
  agent-browser set viewport "$w" 900 >/dev/null
  agent-browser open "http://localhost:$PORT$url" >/dev/null 2>&1
  agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
  agent-browser eval "
(() => {
  const c = document.querySelector('.main-grid-container');
  if (!c) return JSON.stringify({err: 'нет контейнера'});
  const cc = getComputedStyle(c);
  const L = c.querySelector('.sk-col-left');
  const C = c.querySelector('.center-column');
  const R = c.querySelector('.mp-right');
  const w = (el) => el ? Math.round(el.getBoundingClientRect().width) : null;
  const de = document.documentElement;
  return JSON.stringify({
    display: cc.display, justify: cc.justifyContent, gap: cc.gap,
    maxW: cc.maxWidth, contW: Math.round(c.getBoundingClientRect().width),
    L: w(L), C: w(C), R: w(R),
    hscroll: de.scrollWidth > de.clientWidth
  });
})()" 2>/dev/null
}

echo "== Главная: 1920 / 1440 / 1280 / 1024 (ожидание: центр СТРОГО 850, L 240, R 300, gap 20, maxW 1430) =="
for w in 1920 1440 1280 1024; do
  echo "  ${w}px: $(grid_check "/" "$w")"
done
echo "== Внутренняя /currency.php: те же ширины (монолит Шага №4 на новой сетке) =="
for w in 1920 1280; do
  echo "  ${w}px: $(grid_check "/currency.php" "$w")"
done
echo "== Мобайл 400: блоковая откатка ≤900px не сломана =="
for u in "/" "/currency.php"; do
  echo "  $u: $(grid_check "$u" 400)"
done

echo "== Скриншоты =="
agent-browser set viewport 1920 900 >/dev/null
agent-browser open "http://localhost:$PORT/" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser screenshot /home/z/my-project/download/grid850-main-1920.png >/dev/null
echo "скриншот: download/grid850-main-1920.png"
agent-browser set viewport 1280 900 >/dev/null
agent-browser open "http://localhost:$PORT/currency.php" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser screenshot /home/z/my-project/download/grid850-currency-1280.png >/dev/null
echo "скриншот: download/grid850-currency-1280.png"
echo "== Приёмка =="
bun scripts/test-informers.ts 2>&1 | grep -E "✗|ИТОГО"
echo "== ГОТОВО =="
