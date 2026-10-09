#!/bin/bash
# Браузерная приёмка трёх восстановленных разделов в ОДНОМ вызове:
# поднимает сервер, проверяет /gde-deshevle, /rekomenduyu, /o-rabotodatelyah,
# меню «Ещё», снимает скриншоты, глушит сервер.
cd /home/z/my-project || exit 1
mkdir -p download/screens

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
sleep 2
setsid nohup bun run dev > /tmp/sakh-dev-accept.log 2>&1 < /dev/null & disown

up=0
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then up=1; echo "сервер готов (попытка $i)"; break; fi
  sleep 1
done
[ "$up" != "1" ] && { echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; tail -10 /tmp/sakh-dev-accept.log; exit 2; }

agent-browser close > /dev/null 2>&1
fail=0

for p in gde-deshevle rekomenduyu o-rabotodatelyah; do
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
echo "========== Главная + меню «Ещё» =========="
agent-browser open "http://localhost:3000/" > /dev/null 2>&1
agent-browser wait --load networkidle > /dev/null 2>&1
# Клик по «Ещё» в навигации
more=$(agent-browser snapshot -i 2>/dev/null | grep -i "Ещё" | head -2)
echo "навигация Ещё: $(echo "$more" | head -1)"
ref=$(echo "$more" | grep -oE "ref=e[0-9]+" | head -1 | cut -d= -f2 | sed 's/^/@/')
if [ -n "$ref" ]; then
  agent-browser click "$ref" > /dev/null 2>&1
  sleep 1
  menu=$(agent-browser snapshot -c 2>/dev/null)
  for item in "Где дешевле" "Рекомендую" "О работодателях"; do
    if echo "$menu" | grep -q "$item"; then echo "пункт «$item»: есть"; else echo "пункт «$item»: НЕТ"; fail=1; fi
  done
else
  echo "кнопка «Ещё» не найдена"; fail=1
fi

# Мобильная ширина одной из страниц
echo ""
echo "========== Мобильная 390px /o-rabotodatelyah =========="
agent-browser set viewport 390 844 > /dev/null 2>&1
agent-browser open "http://localhost:3000/o-rabotodatelyah" > /dev/null 2>&1
agent-browser wait --load networkidle > /dev/null 2>&1
agent-browser screenshot download/screens/restore-employers-mobile.png > /dev/null 2>&1
metrics=$(agent-browser eval "JSON.stringify({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})" 2>/dev/null)
echo "scrollWidth/clientWidth: $metrics"
echo "$metrics" | grep -q 'sw\\":390' || { echo "ГОРИЗОНТАЛЬНЫЙ СКРОЛЛ!"; fail=1; }

agent-browser close > /dev/null 2>&1
ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
echo ""
[ "$fail" = "0" ] && echo "БРАУЗЕРНАЯ ПРИЁМКА: ВСЁ ОК" || echo "БРАУЗЕРНАЯ ПРИЁМКА: ЕСТЬ ПРОБЛЕМЫ"
exit $fail
