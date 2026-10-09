#!/bin/bash
# ШАГ №12 «Прямоугольные кнопки-фильтры /disconnections.php»:
# таблетки (radius 999px) убраны → radius 4px, padding 8px 16px,
# актив #004A8F + белый, неактив белый + рамка #CED4DA + тёмный текст,
# плавный ховер, ряд gap:8px без переноса (мобильный скролл сохранён).
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

# Чипы фильтра: computed-стили неактивной + активной (после клика) + геометрия ряда
chip_check() {
  local w="$1"
  agent-browser set viewport "$w" 900 >/dev/null
  agent-browser open "http://localhost:$PORT/disconnections.php" >/dev/null 2>&1
  agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
  agent-browser eval "
(() => {
  const chips = [...document.querySelectorAll('.dis-chip')];
  if (!chips.length) return JSON.stringify({err: 'нет чипов'});
  const row = document.querySelector('.dis-filters');
  const cs0 = getComputedStyle(chips[0]);
  const base = {
    count: chips.length,
    radius: cs0.borderRadius,
    padding: cs0.paddingTop + '/' + cs0.paddingRight,
    bg: cs0.backgroundColor,
    border: cs0.borderColor,
    color: cs0.color,
    transition: cs0.transitionDuration
  };
  chips[1].click();
  const cs1 = getComputedStyle(chips[1]);
  const active = { cls: chips[1].className, bg: cs1.backgroundColor, color: cs1.color, border: cs1.borderColor };
  chips[1].click();
  const rs = getComputedStyle(row);
  const de = document.documentElement;
  const rowGeom = {
    display: rs.display, wrap: rs.flexWrap, gap: rs.gap,
    scrollable: row.scrollWidth > row.clientWidth,
    hscroll: de.scrollWidth > de.clientWidth
  };
  return JSON.stringify({base, active, rowGeom});
})()" 2>/dev/null
}

echo "== ПК 1280: /disconnections.php (ожидание radius 4px, pad 8/16, актив rgb(0,74,143)=#004A8F) =="
chip_check 1280
echo "== ПК 1920: та же проверка =="
chip_check 1920
echo "== Мобайл 400: компактные откатки + горизонтальный скролл ряда, страница без hscroll =="
chip_check 400

echo "== Скриншоты =="
agent-browser set viewport 1280 900 >/dev/null
agent-browser open "http://localhost:$PORT/disconnections.php" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser screenshot /home/z/my-project/download/step12-dis-chips-1280.png >/dev/null
echo "скриншот: download/step12-dis-chips-1280.png"
agent-browser set viewport 400 800 >/dev/null
agent-browser screenshot /home/z/my-project/download/step12-dis-chips-mobile-400.png >/dev/null
echo "скриншот: download/step12-dis-chips-mobile-400.png"
echo "== Приёмка =="
bun scripts/test-informers.ts 2>&1 | grep -E "✗|ИТОГО"
echo "== ГОТОВО =="
