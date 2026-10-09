#!/bin/bash
# ШАГ «Единый синий футер»: padding:30px 0, фон #004A8F !important, текст #FFF, ссылки #A9CBEF.
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

foot_check() {
  local url="$1"; local sel="$2"; local label="$3"; local w="$4"
  agent-browser set viewport "$w" 900 >/dev/null
  agent-browser open "http://localhost:$PORT$url" >/dev/null 2>&1
  agent-browser wait --load networkidle --timeout 15000 >/dev/null 2>&1
  agent-browser eval "
(() => {
  const f = document.querySelector('$sel');
  if (!f) return JSON.stringify({err: 'нет футера'});
  const cs = getComputedStyle(f);
  const a = f.querySelector('a');
  const t = f.querySelector('span, div');
  return JSON.stringify({
    bg: cs.backgroundColor, color: cs.color, padding: cs.padding,
    link: a ? getComputedStyle(a).color : null,
    text: t ? getComputedStyle(t).color : null
  });
})()" 2>/dev/null
}

echo "== ПК 1280: футеры =="
foot_check "/" ".mp-footer" "Главная" 1280
foot_check "/?view=forum" ".mp-footer" "Форум" 1280
foot_check "/weather.php" ".sk-footer" "Погода" 1280
foot_check "/podslyshano" ".sk-footer" "Подслушано" 1280
foot_check "/gkh" ".sk-footer" "ЖКХ" 1280
foot_check "/help" ".sk-footer" "Помощь" 1280
foot_check "/obyavleniya" ".sk-footer" "Объявления" 1280
foot_check "/poleznoe" ".sk-footer" "Полезное" 1280
echo "== Мобайл 400: откатки ≤480 сохранены =="
foot_check "/" ".mp-footer" "Главная-мобайл" 400
foot_check "/weather.php" ".sk-footer" "Погода-мобайл" 400
echo "== Скриншот ПК =="
agent-browser set viewport 1280 900 >/dev/null
agent-browser open "http://localhost:3000/" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 15000 >/dev/null 2>&1
agent-browser eval "window.scrollTo(0, document.body.scrollHeight)" >/dev/null 2>&1
sleep 1
agent-browser screenshot /home/z/my-project/scripts/step5-footer-1280.png >/dev/null
echo "скриншот: scripts/step5-footer-1280.png"
echo "== Приёмка =="
bun scripts/test-informers.ts 2>&1 | grep -E "✗|ИТОГО"
echo "== ГОТОВО =="
