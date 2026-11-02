#!/bin/bash
# Повторная проверка «О работодателях» @400 (первый open в прошлом прогоне
# поймал известную ловушку молчаливого незагруза после рестарта сервера)
cd /home/z/my-project || exit 1
OUT=download/screens

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
sleep 2
setsid nohup bun run dev > /tmp/sakh-dev-ep400.log 2>&1 < /dev/null &
up=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then up=1; break; fi
  sleep 1
done
[ "$up" = "1" ] && echo "сервер готов" || { echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; exit 2; }

S=ep400
agent-browser --session $S close >/dev/null 2>&1
# прогревочный open главной ( SSR-компиляция ), затем целевая страница
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1

agent-browser --session $S open "http://localhost:3000/o-rabotodatelyah" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 2000 >/dev/null 2>&1
agent-browser --session $S set viewport 400 800 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1
echo "---- О работодателях @ 400 (повтор) ----"
agent-browser --session $S eval '
(function(){
  function st(sel){var e=document.querySelector(sel);if(!e)return "нет в DOM!";return getComputedStyle(e).display==="none"?"скрыта":"ВИДНА";}
  var bodyLen=document.body.children.length;
  var p=["body children="+bodyLen];
  p.push("верхняя (aside) .ep-addbtn: "+st(".ep-addbtn"));
  p.push("нижняя .ep-newbtn: "+st(".ep-newbtn"));
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!":"нет"));
  return p.join(" | ");
})()
' 2>/dev/null
agent-browser --session $S screenshot $OUT/dupbtn2-ep-400-retry.png >/dev/null 2>&1 && echo "скрин: $OUT/dupbtn2-ep-400-retry.png"
agent-browser --session $S close >/dev/null 2>&1

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
echo "проверка завершена"
