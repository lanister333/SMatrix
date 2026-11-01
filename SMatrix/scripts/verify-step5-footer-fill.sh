#!/bin/bash
# ШАГ №5 «Фирменная заливка подвала (Футер)»: фон строго #004B87
# (плотный фирменный тёмно-синий), шрифт внутри — белый.
# .sk-footer (внутренние страницы) + .mp-footer (Главная/форум/профиль).
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

# Футер страницы: computed-стили нижнего блока
footer_check() {
  local url="$1" w="$2"
  agent-browser set viewport "$w" 900 >/dev/null
  agent-browser open "http://localhost:$PORT$url" >/dev/null 2>&1
  agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
  agent-browser eval "
(() => {
  const f = document.querySelector('.sk-footer, .mp-footer');
  if (!f) return JSON.stringify({err: 'нет футера'});
  const cs = getComputedStyle(f);
  const a = f.querySelector('a');
  const de = document.documentElement;
  return JSON.stringify({
    cls: f.className.split(' ')[0],
    bg: cs.backgroundColor,
    color: cs.color,
    link: a ? getComputedStyle(a).color : null,
    padT: cs.paddingTop, padB: cs.paddingBottom,
    hscroll: de.scrollWidth > de.clientWidth
  });
})()" 2>/dev/null
}

echo "== ПК 1280: футер на всех типах страниц (ожидание bg rgb(0,75,135)=#004B87) =="
for u in "/" "/?view=forum" "/weather.php" "/currency.php" "/disconnections.php" "/traffic.php" "/help"; do
  echo "  $u: $(footer_check "$u" 1280)"
done
echo "== Мобайл 400: цвета единые, откатки сохранены =="
for u in "/" "/currency.php"; do
  echo "  $u: $(footer_check "$u" 400)"
done

echo "== Скриншот: низ /currency.php (ПК 1280) =="
agent-browser set viewport 1280 900 >/dev/null
agent-browser open "http://localhost:$PORT/currency.php" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser eval "window.scrollTo(0, document.body.scrollHeight); 'scrolled'" >/dev/null 2>&1
sleep 1
agent-browser screenshot /home/z/my-project/download/step5-footer-fill-1280.png >/dev/null
echo "скриншот: download/step5-footer-fill-1280.png"
echo "== Приёмка =="
bun scripts/test-informers.ts 2>&1 | grep -E "✗|ИТОГО"
echo "== ГОТОВО =="
