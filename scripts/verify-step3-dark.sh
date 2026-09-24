#!/bin/bash
# ШАГ 3 ТЗ №1 (указ: фон -10%, тени всем блокам, все страницы) — one-shot верификация.
set -u
cd /home/z/my-project
PORT=3000

for p in $(ss -tlnp 2>/dev/null | rg ":$PORT" | rg -o 'pid=[0-9]+' | rg -o '[0-9]+'); do kill -9 "$p" 2>/dev/null; done
sleep 1
nohup bun run dev > /tmp/dev.log 2>&1 &
disown
ok=""
for i in $(seq 1 75); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://localhost:$PORT/" 2>/dev/null)
  [ "$code" = "200" ] && { ok=1; echo "сервер готов (${i}с)"; break; }
  sleep 1
done
[ -z "$ok" ] && { echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; tail -20 /tmp/dev.log; exit 1; }

agent-browser set viewport 1280 900 >/dev/null

# Проверка одной страницы: body bg + computed box-shadow первых доступных селекторов
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

echo "== ПК 1280: фон + тени по страницам =="
check_page "/" ".sakh-card|.mp-panel|.mp-cell" "Главная"
check_page "/?topic=1" ".sk-msg" "Форум (тема)"
check_page "/weather.php" ".sakh-card" "Погода"
check_page "/currency.php" ".sakh-card" "Валюты"
check_page "/disconnections.php" ".sakh-card" "Отключения"
check_page "/traffic.php" ".sakh-card" "Пробки"
check_page "/podslyshano" ".oh-sideblock" "Подслушано"
check_page "/gkh" ".gkh-sideblock" "ЖКХ"
check_page "/help" ".hp-sideblock|.hp-card" "Помощь"
check_page "/obyavleniya" ".ad-sidebox" "Объявления"
check_page "/poleznoe" ".pl-sidebox" "Полезное"
check_page "/gde-kupit" ".wb-sideblock" "Где купить"
check_page "/gde-deshevle" ".cd-sideblock" "Где дешевле"
check_page "/rekomenduyu" ".rc-sideblock" "Рекомендую"
check_page "/o-rabotodatelyah" ".ep-sideblock" "Работодатели"

echo "== Профиль (sk-profilebox) =="
check_page "/?user=%D0%90%D0%B4%D0%BC%D0%B8%D0%BD" ".sk-profilebox|.sk-profilelist" "Профиль"

echo "== Мобайл 400: заморозка (новые тени обязаны отсутствовать) =="
agent-browser set viewport 400 800 >/dev/null
check_page "/" ".mp-panel|.sakh-card" "Главная-мобайл"
check_page "/podslyshano" ".oh-sideblock" "Подслушано-мобайл"

echo "== Скриншот ПК =="
agent-browser set viewport 1280 900 >/dev/null
agent-browser open "http://localhost:$PORT/" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 15000 >/dev/null 2>&1
agent-browser screenshot /home/z/my-project/scripts/step3-dark-1280.png >/dev/null
echo "скриншот: scripts/step3-dark-1280.png"
echo "== ГОТОВО =="
