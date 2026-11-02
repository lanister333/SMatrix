#!/bin/bash
# Указ «светлее на 5%»: фон #DCDDDE → #E8EAEB — one-shot верификация.
# ВАЖНО: ловушка Turbopack — правки globals.css не инвалидируют dev-кэш,
# поэтому обязателен rm -rf .next перед рестартом.
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

agent-browser set viewport 1280 900 >/dev/null

check_page() {
  local url="$1"; local selectors="$2"; local label="$3"
  agent-browser open "http://localhost:$PORT$url" >/dev/null 2>&1
  agent-browser wait --load networkidle --timeout 15000 >/dev/null 2>&1
  local res=$(agent-browser eval "
(() => {
  const out = { body: getComputedStyle(document.body).backgroundColor, blocks: {} };
  const sels = '$selectors'.split('|');
  for (const s of sels) {
    const el = document.querySelector(s);
    if (el) out.blocks[s] = getComputedStyle(el).boxShadow === 'none' ? 'НЕТ ТЕНИ' : 'тень ✓';
  }
  return JSON.stringify(out);
})()" 2>/dev/null)
  echo "$label: $res"
}

echo "== ПК 1280: новый фон rgb(232,234,235) + тени =="
check_page "/" ".sakh-card|.mp-panel|.mp-cell" "Главная"
check_page "/?topic=1" ".sk-msg" "Форум (тема)"
check_page "/weather.php" ".sakh-card" "Погода"
check_page "/currency.php" ".sakh-card" "Валюты"
check_page "/podslyshano" ".oh-sideblock" "Подслушано"
check_page "/gkh" ".gkh-sideblock" "ЖКХ"
check_page "/help" ".hp-sideblock" "Помощь"
check_page "/obyavleniya" ".ad-sidebox" "Объявления"
check_page "/rekomenduyu" ".rc-sideblock" "Рекомендую"

echo "== Профиль =="
check_page "/?user=%D0%90%D0%B4%D0%BC%D0%B8%D0%BD" ".sk-profilebox|.sk-profilelist" "Профиль"

echo "== Мобайл 400: заморозка (новые тени отсутствуют, фон общий) =="
agent-browser set viewport 400 800 >/dev/null
check_page "/" ".mp-panel|.sakh-card" "Главная-мобайл"

echo "== Скриншот ПК =="
agent-browser set viewport 1280 900 >/dev/null
agent-browser open "http://localhost:$PORT/" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 15000 >/dev/null 2>&1
agent-browser screenshot /home/z/my-project/scripts/step3-lighter-1280.png >/dev/null
echo "скриншот: scripts/step3-lighter-1280.png"

echo "== Приёмка test-informers =="
bun scripts/test-informers.ts 2>&1 | tail -2
echo "== ГОТОВО =="
