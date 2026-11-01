#!/bin/bash
# Браузерная приёмка восстановленных «Объявлений» и «Полезного» в ОДНОМ вызове:
# поднимает сервер, проверяет /obyavleniya и /poleznoe, редиректы ?view=ads/useful,
# меню, блоки входа на главной, мобильную ширину, снимает скриншоты, глушит сервер.
cd /home/z/my-project || exit 1
mkdir -p download/screens

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
sleep 2
setsid nohup bun run dev > /tmp/sakh-dev-accept2.log 2>&1 < /dev/null & disown

up=0
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then up=1; echo "сервер готов (попытка $i)"; break; fi
  sleep 1
done
[ "$up" != "1" ] && { echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; tail -10 /tmp/sakh-dev-accept2.log; exit 2; }

agent-browser close > /dev/null 2>&1
fail=0

for p in obyavleniya poleznoe; do
  echo ""
  echo "========== /$p =========="
  if ! agent-browser open "http://localhost:3000/$p" 2>&1; then fail=1; continue; fi
  agent-browser wait --load networkidle > /dev/null 2>&1
  echo "title: $(agent-browser get title)"
  echo "url: $(agent-browser get url)"
  agent-browser screenshot "download/screens/restore-$p.png" > /dev/null 2>&1 && echo "screenshot: ok"
  errs=$(agent-browser errors 2>/dev/null | tail -n +2)
  if [ -n "$errs" ]; then echo "PAGE ERRORS: $errs"; fail=1; else echo "page errors: 0"; fi
done

echo ""
echo "========== Содержимое /obyavleniya =========="
ads_snap=$(agent-browser open "http://localhost:3000/obyavleniya" > /dev/null 2>&1 && agent-browser wait --load networkidle > /dev/null 2>&1 && agent-browser snapshot -c 2>/dev/null)
for item in "Продам" "Куплю" "Отдам даром" "Услуги" "Работа" "Недвижимость" "Транспорт" "Разное" "Создать объявление" "Правила раздела"; do
  if echo "$ads_snap" | grep -q "$item"; then echo "«$item»: есть"; else echo "«$item»: НЕТ"; fail=1; fi
done

echo ""
echo "========== Содержимое /poleznoe =========="
pl_snap=$(agent-browser open "http://localhost:3000/poleznoe" > /dev/null 2>&1 && agent-browser wait --load networkidle > /dev/null 2>&1 && agent-browser snapshot -c 2>/dev/null)
for item in "Важные телефоны" "Паром Ванино — Холмск" "Автовокзал" "Аэропорт" "Потерянные документы" "112"; do
  if echo "$pl_snap" | grep -q "$item"; then echo "«$item»: есть"; else echo "«$item»: НЕТ"; fail=1; fi
done

echo ""
echo "========== Редиректы ?view=ads / ?view=useful =========="
agent-browser open "http://localhost:3000/?view=ads" > /dev/null 2>&1
agent-browser wait --load networkidle > /dev/null 2>&1
url1=$(agent-browser get url)
echo "?view=ads → $url1"
echo "$url1" | grep -q "/obyavleniya" || { echo "РЕДИРЕКТ НЕ РАБОТАЕТ"; fail=1; }
agent-browser open "http://localhost:3000/?view=useful" > /dev/null 2>&1
agent-browser wait --load networkidle > /dev/null 2>&1
url2=$(agent-browser get url)
echo "?view=useful → $url2"
echo "$url2" | grep -q "/poleznoe" || { echo "РЕДИРЕКТ НЕ РАБОТАЕТ"; fail=1; }

echo ""
echo "========== Главная: блоки входа =========="
main_snap=$(agent-browser open "http://localhost:3000/" > /dev/null 2>&1 && agent-browser wait --load networkidle > /dev/null 2>&1 && agent-browser snapshot -c 2>/dev/null)
for item in "Объявления" "Полезное" "Знакомства" "Где дешевле"; do
  if echo "$main_snap" | grep -q "$item"; then echo "блок «$item»: есть"; else echo "блок «$item»: НЕТ"; fail=1; fi
done

echo ""
echo "========== Мобильная 390px =========="
agent-browser set viewport 390 844 > /dev/null 2>&1
for p in obyavleniya poleznoe; do
  agent-browser open "http://localhost:3000/$p" > /dev/null 2>&1
  agent-browser wait --load networkidle > /dev/null 2>&1
  agent-browser screenshot "download/screens/restore-$p-mobile.png" > /dev/null 2>&1
  metrics=$(agent-browser eval "JSON.stringify({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})" 2>/dev/null)
  echo "/$p scrollWidth/clientWidth: $metrics"
  echo "$metrics" | grep -q 'sw\\":390' || { echo "ГОРИЗОНТАЛЬНЫЙ СКРОЛЛ на /$p!"; fail=1; }
done

agent-browser close > /dev/null 2>&1
ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
echo ""
[ "$fail" = "0" ] && echo "БРАУЗЕРНАЯ ПРИЁМКА: ВСЁ ОК" || echo "БРАУЗЕРНАЯ ПРИЁМКА: ЕСТЬ ПРОБЛЕМЫ"
exit $fail
