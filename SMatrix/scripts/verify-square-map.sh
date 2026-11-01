#!/bin/bash
# ДИРЕКТИВА «Квадратная карта на странице пробок (/traffic.php)»:
# карта пробок — идеальный квадрат на ПК: .trf-map width:100%; height:850px
# в @media (min-width:1024px) (центральная колонка ровно 850px).
# Проверяются: /traffic.php @1920 (высота iframe строго 850), @1280, @1100
# (зона перекрытия 901–1150/≥1024), мобайл 400 (заморозка ≤480: 250px цел),
# контроль лесенки форума (?topic=1 @1920), скриншоты, приёмка.
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

map_check() {
  local w="$1"
  agent-browser set viewport "$w" 1080 >/dev/null
  agent-browser open "http://localhost:$PORT/traffic.php" >/dev/null 2>&1
  agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
  agent-browser eval "
(() => {
  const m = document.querySelector('.trf-map');
  const w_ = document.querySelector('.trf-mapwrap');
  const c = document.querySelector('.center-column');
  if (!m) return JSON.stringify({err: 'нет .trf-map'});
  const r = m.getBoundingClientRect();
  const rw = w_ ? w_.getBoundingClientRect() : null;
  const rc = c ? c.getBoundingClientRect() : null;
  const cs = getComputedStyle(m);
  return JSON.stringify({
    viewport: '$w',
    iframe: {width: Math.round(r.width), height: Math.round(r.height), cssWidth: cs.width, cssHeight: cs.height},
    wrap: rw ? {width: Math.round(rw.width), height: Math.round(rw.height)} : null,
    centerColumn: rc ? Math.round(rc.width) : null,
    square850: Math.round(r.height) === 850
  });
})()" 2>/dev/null
}

echo "== Карта /traffic.php @1920 (ожидание: height 850, квадрат) =="
echo "  $(map_check 1920)"
echo "== @1280 (ПК) =="
echo "  $(map_check 1280)"
echo "== @1100 (зона перекрытия 901–1150 / ≥1024) =="
echo "  $(map_check 1100)"
echo "== Мобайл 400 (заморозка ≤480: height 250px цел) =="
agent-browser set viewport 400 900 >/dev/null
agent-browser open "http://localhost:$PORT/traffic.php" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser eval "
(() => {
  const m = document.querySelector('.trf-map');
  if (!m) return JSON.stringify({err: 'нет .trf-map'});
  const r = m.getBoundingClientRect();
  return JSON.stringify({iframe: {width: Math.round(r.width), height: Math.round(r.height)}, hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth});
})()" 2>/dev/null

echo "== Контроль лесенки форума /?topic=1 @1920 (не сломана) =="
agent-browser set viewport 1920 1080 >/dev/null
agent-browser open "http://localhost:$PORT/?topic=1" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser eval "
(() => {
  const ch = document.querySelectorAll('.sk-children');
  if (!ch.length) return JSON.stringify({err: 'нет .sk-children'});
  const pb = getComputedStyle(ch[0], '::before');
  const nestedMsg = ch[0].querySelector('.sk-msg');
  const pa = nestedMsg ? getComputedStyle(nestedMsg, '::after') : null;
  return JSON.stringify({containers: ch.length, line: {left: pb.left, top: pb.top, bottom: pb.bottom, width: pb.width, bg: pb.backgroundColor, opacity: pb.opacity}, stub: pa ? {left: pa.left, top: pa.top, width: pa.width, height: pa.height} : null});
})()" 2>/dev/null

echo "== Скриншоты =="
agent-browser set viewport 1920 1080 >/dev/null
agent-browser open "http://localhost:$PORT/traffic.php" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser eval "document.querySelector('.trf-mapwrap')?.scrollIntoView({block:'start'}); 'ok'" >/dev/null 2>&1
sleep 2
agent-browser screenshot /home/z/my-project/download/square-map-traffic-1920.png >/dev/null
echo "скриншот: download/square-map-traffic-1920.png"
agent-browser set viewport 400 900 >/dev/null
agent-browser open "http://localhost:$PORT/traffic.php" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
sleep 1
agent-browser screenshot /home/z/my-project/download/square-map-traffic-mobile-400.png >/dev/null
echo "скриншот: download/square-map-traffic-mobile-400.png"
echo "== Приёмка =="
bun scripts/test-informers.ts 2>&1 | grep -E "✗|ИТОГО"
echo "== ГОТОВО =="
