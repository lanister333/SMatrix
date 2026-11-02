#!/bin/bash
# ШАГ №4 «Трехколоночный монолит внутренних страниц» (/weather.php,
# /currency.php, /disconnections.php, /traffic.php):
# контейнер .sk-layout.sk-layout-page.main-grid-container — архитектура
# СТРОГО как у Главной (≥1024px: flex по центру до 1800px, зазор 20px,
# левая 240 / центр flex:1 max 1200 / правая 300).
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

# Внутренняя страница: computed-стили монолита + факт переполнений
page_check() {
  local url="$1" w="$2"
  agent-browser set viewport "$w" 900 >/dev/null
  agent-browser open "http://localhost:$PORT$url" >/dev/null 2>&1
  agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
  agent-browser eval "
(() => {
  const c = document.querySelector('.sk-layout.sk-layout-page.main-grid-container');
  if (!c) return JSON.stringify({err: 'нет монолит-контейнера'});
  const cs = getComputedStyle(c);
  const left = c.querySelector('.sk-col-left');
  const center = c.querySelector('.center-column');
  const right = c.querySelector('.mp-right');
  const de = document.documentElement;
  const cw = (el) => el ? Math.round(el.getBoundingClientRect().width) : null;
  return JSON.stringify({
    display: cs.display, justify: cs.justifyContent, gap: cs.columnGap,
    maxWidth: cs.maxWidth,
    left: cw(left), center: cw(center), right: cw(right),
    centerMinW: center ? getComputedStyle(center).minWidth : null,
    overflow: center ? (center.scrollWidth > center.clientWidth) : null,
    hscroll: de.scrollWidth > de.clientWidth
  });
})()" 2>/dev/null
}

# Мобайл: откатки монолита (левая скрыта, правая скрыта ≤480, контейнер блок)
mobile_check() {
  local url="$1"
  agent-browser set viewport 400 800 >/dev/null
  agent-browser open "http://localhost:$PORT$url" >/dev/null 2>&1
  agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
  agent-browser eval "
(() => {
  const c = document.querySelector('.sk-layout.sk-layout-page.main-grid-container');
  const li = document.querySelector('.sk-col-left-inner');
  const r = document.querySelector('.sk-layout-page .mp-right');
  const de = document.documentElement;
  return JSON.stringify({
    containerDisplay: c ? getComputedStyle(c).display : null,
    leftInner: li ? getComputedStyle(li).display : null,
    right: r ? getComputedStyle(r).display : null,
    hscroll: de.scrollWidth > de.clientWidth,
    body: getComputedStyle(document.body).backgroundColor
  });
})()" 2>/dev/null
}

PAGES=("/weather.php" "/currency.php" "/disconnections.php" "/traffic.php")

for p in "${PAGES[@]}"; do
  echo "== $p: монолит (1920 / 1280 / 1050 / 1024) =="
  echo "  1920: $(page_check "$p" 1920)"
  echo "  1280: $(page_check "$p" 1280)"
  echo "  1050: $(page_check "$p" 1050)"
  echo "  1024: $(page_check "$p" 1024)"
  echo "  мобайл 400: $(mobile_check "$p")"
done

echo "== Скриншоты =="
agent-browser set viewport 1280 1400 >/dev/null
agent-browser open "http://localhost:$PORT/currency.php" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser screenshot /home/z/my-project/download/step4-monolith-currency-1280.png >/dev/null
agent-browser set viewport 1920 1000 >/dev/null
agent-browser open "http://localhost:$PORT/weather.php" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser screenshot /home/z/my-project/download/step4-monolith-weather-1920.png >/dev/null
echo "скриншоты: download/step4-monolith-currency-1280.png, download/step4-monolith-weather-1920.png"
echo "== Приёмка =="
bun scripts/test-informers.ts 2>&1 | grep -E "✗|ИТОГО"
echo "== ГОТОВО =="
