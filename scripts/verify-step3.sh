#!/bin/bash
# ШАГ 3 ТЗ №1 — верификация computed-стилей (ПК 1280 + мобайл 400) одним заходом.
# Сервер стартует и гаснет внутри этой команды: между командами воркспейс
# реапает фоновые next-server (OOM при пике компиляции), поэтому проверка
# выполняется строго в одной сессии.
set -u
cd /home/z/my-project

PORT=3000
echo "== 1. Старт dev-сервера =="
# Убить случайные остатки
for p in $(ss -tlnp 2>/dev/null | rg ":$PORT" | rg -o 'pid=[0-9]+' | rg -o '[0-9]+'); do kill -9 "$p" 2>/dev/null; done
sleep 1
nohup bun run dev > /tmp/dev.log 2>&1 &
disown

echo "== 2. Ожидание готовности (макс 75с) =="
ok=""
for i in $(seq 1 75); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://localhost:$PORT/" 2>/dev/null)
  if [ "$code" = "200" ]; then ok=1; echo "готово на ${i}-й секунде (HTTP 200)"; break; fi
  sleep 1
done
[ -z "$ok" ] && { echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; tail -20 /tmp/dev.log; exit 1; }
sleep 2

echo "== 3. ПК 1280x900 — computed styles =="
agent-browser set viewport 1280 900
agent-browser open "http://localhost:$PORT/" >/dev/null
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser eval '
(() => {
  const cs = (el) => el ? getComputedStyle(el) : null;
  const sh = (el) => { const c = cs(el); return c ? c.boxShadow : "NO ELEMENT"; };
  const bg = (el) => { const c = cs(el); return c ? c.backgroundColor : "NO ELEMENT"; };
  return JSON.stringify({
    bodyBg: bg(document.body),
    skBg: bg(document.querySelector(".sk")),
    sakhCard: { bg: bg(document.querySelector(".sakh-card")), shadow: sh(document.querySelector(".sakh-card")).slice(0,90) },
    overheard: sh(document.querySelector("section[aria-label=\"Подслушано Сахалин\"]")).slice(0,90),
    lastTopics: sh(document.querySelector("section[aria-label=\"Последние темы форума\"]")).slice(0,90),
    gridCell: sh(document.querySelector(".mp-cell")).slice(0,90),
    phones: sh(document.querySelector("section[aria-label=\"Полезные телефоны и службы\"]")).slice(0,90)
  });
})()'

echo "== 4. Мобайл 400x800 — заморозка (тень .mp-panel обязана быть none) =="
agent-browser set viewport 400 800
agent-browser reload >/dev/null
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser eval '
(() => {
  const sh = (el) => el ? getComputedStyle(el).boxShadow : "NO ELEMENT";
  return JSON.stringify({
    bodyBg: getComputedStyle(document.body).backgroundColor,
    overheard: sh(document.querySelector("section[aria-label=\"Подслушано Сахалин\"]")).slice(0,90),
    gridCell: sh(document.querySelector(".mp-cell")).slice(0,90),
    sakhCardWeather: sh(document.querySelector("section[aria-label=\"Погода на Сахалине\"]")).slice(0,90),
    logoPadTop: getComputedStyle(document.querySelector(".header-logo") || document.body).paddingTop
  });
})()'

echo "== 5. Скриншоты для архива =="
agent-browser set viewport 1280 900
agent-browser reload >/dev/null
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser screenshot /home/z/my-project/scripts/step3-desktop-1280.png >/dev/null
echo "скриншот ПК сохранён: scripts/step3-desktop-1280.png"
echo "== ГОТОВО =="
