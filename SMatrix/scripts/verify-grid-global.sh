#!/bin/bash
# ГЛОБАЛЬНАЯ СЕТКА ВСЕГО САЙТА (жёсткая директива, ≥1024px):
# единый каркас .main-grid-container (.left-column 240 / .center-column 850 !important
# / .right-column 300), max-width:1430px, gap:20px — на ВСЕХ страницах без исключений.
# Проверяются: Главная, Форум, Объявления, Помощь, ЖКХ, Подслушано, Полезное,
# Знакомства, Где дешевле, Где купить, Рекомендую, Работодатели, 4 страницы сервисов.
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

# Геометрия глобального каркаса на странице
grid_check() {
  local url="$1" w="$2"
  agent-browser set viewport "$w" 900 >/dev/null
  agent-browser open "http://localhost:$PORT$url" >/dev/null 2>&1
  agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
  agent-browser eval "
(() => {
  const c = document.querySelector('.main-grid-container');
  if (!c) return JSON.stringify({err: 'нет каркаса'});
  const cc = getComputedStyle(c);
  const L = c.querySelector('.left-column');
  const C = c.querySelector('.center-column');
  const R = c.querySelector('.right-column');
  const w = (el) => el ? Math.round(el.getBoundingClientRect().width) : null;
  const de = document.documentElement;
  return JSON.stringify({
    disp: cc.display, gap: cc.gap, maxW: cc.maxWidth,
    contW: Math.round(c.getBoundingClientRect().width),
    L: w(L), C: w(C), R: w(R),
    hscroll: de.scrollWidth > de.clientWidth
  });
})()" 2>/dev/null
}

echo "== ВСЕ страницы @1920 (ожидание: flex, gap 20px, maxW 1430, L 240, C 850, R 300) =="
for u in "/" "/?view=forum" "/obyavleniya" "/help" "/gkh" "/podslyshano" "/poleznoe" "/znakomstva" "/gde-deshevle" "/gde-kupit" "/rekomenduyu" "/o-rabotodatelyah" "/currency.php" "/disconnections.php" "/weather.php" "/traffic.php"; do
  echo "  $u: $(grid_check "$u" 1920)"
done
echo "== Форум и Объявления @1280 (жёсткий стандарт держится) =="
for u in "/?view=forum" "/obyavleniya" "/currency.php"; do
  echo "  $u: $(grid_check "$u" 1280)"
done
echo "== Мобайл 400: блоковая откатка ≤900px цела (выборка) =="
for u in "/" "/?view=forum" "/obyavleniya" "/currency.php"; do
  echo "  $u: $(grid_check "$u" 400)"
done

echo "== Скриншоты =="
agent-browser set viewport 1920 900 >/dev/null
agent-browser open "http://localhost:$PORT/?view=forum" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser screenshot /home/z/my-project/download/grid-global-forum-1920.png >/dev/null
echo "скриншот: download/grid-global-forum-1920.png"
agent-browser set viewport 1920 900 >/dev/null
agent-browser open "http://localhost:$PORT/obyavleniya" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser screenshot /home/z/my-project/download/grid-global-obyavleniya-1920.png >/dev/null
echo "скриншот: download/grid-global-obyavleniya-1920.png"
echo "== Приёмка =="
bun scripts/test-informers.ts 2>&1 | grep -E "✗|ИТОГО"
echo "== ГОТОВО =="
