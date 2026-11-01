#!/bin/bash
# Шаг «Единый футер как на Главной»: на ВСЕХ страницах рендерится общий
# SiteFooter (.mp-footer — разметка футера Главной); высота/стиль 1-в-1.
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

# Высота футера Главной — эталон
agent-browser set viewport 1280 900 >/dev/null
agent-browser open "http://localhost:$PORT/" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
H0=$(agent-browser eval "(() => { const f = document.querySelector('footer'); return Math.round(f.getBoundingClientRect().height); })()" 2>/dev/null | tr -d '"')
echo "Эталон Главной: высота футера = $H0"

footer_check() {
  local url="$1" w="$2"
  agent-browser set viewport "$w" 900 >/dev/null
  agent-browser open "http://localhost:$PORT$url" >/dev/null 2>&1
  agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
  agent-browser eval "
(() => {
  const f = document.querySelector('footer');
  if (!f) return JSON.stringify({err: 'нет футера'});
  const cs = getComputedStyle(f);
  const de = document.documentElement;
  const h = Math.round(f.getBoundingClientRect().height);
  return JSON.stringify({
    cls: f.className,
    h, ref: $H0, same: h === $H0,
    bg: cs.backgroundColor, color: cs.color,
    links: f.querySelectorAll('.mp-footer-links a').length,
    padT: cs.paddingTop, padB: cs.paddingBottom,
    hscroll: de.scrollWidth > de.clientWidth
  });
})()" 2>/dev/null
}

echo "== ПК 1280: футер на всех страницах (cls=mp-footer, same=true, bg rgb(0,75,135)) =="
for u in "/" "/?view=forum" "/weather.php" "/currency.php" "/disconnections.php" "/traffic.php" "/help" "/gkh" "/podslyshano" "/obyavleniya" "/gde-deshevle" "/rekomenduyu" "/o-rabotodatelyah" "/gde-kupit" "/poleznoe" "/znakomstva"; do
  echo "  $u: $(footer_check "$u" 1280)"
done
echo "== Мобайл 400 =="
for u in "/" "/currency.php" "/help"; do
  echo "  $u: $(footer_check "$u" 400)"
done

echo "== Скриншот: низ /help (ПК 1280) =="
agent-browser set viewport 1280 900 >/dev/null
agent-browser open "http://localhost:$PORT/help" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser eval "window.scrollTo(0, document.body.scrollHeight); 'scrolled'" >/dev/null 2>&1
sleep 1
agent-browser screenshot /home/z/my-project/download/footer-uniform-help-1280.png >/dev/null
echo "скриншот: download/footer-uniform-help-1280.png"
echo "== Приёмка =="
bun scripts/test-informers.ts 2>&1 | grep -E "✗|ИТОГО"
echo "== ГОТОВО =="
