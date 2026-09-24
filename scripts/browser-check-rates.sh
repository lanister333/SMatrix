#!/bin/bash
# Контроль таблицы курсов после ужимки (десктоп + мобайл)
cd /home/z/my-project || exit 1
OUT=download/screens
mkdir -p $OUT

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
sleep 2
setsid nohup bun run dev > /tmp/sakh-dev-accept2.log 2>&1 < /dev/null &
up=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then up=1; break; fi
  sleep 1
done
[ "$up" = "1" ] && echo "сервер готов (попытка $i)" || { echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; exit 2; }

S=accept35
agent-browser --session $S close >/dev/null 2>&1
agent-browser --session $S set viewport 1280 900 >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 4000 >/dev/null 2>&1
agent-browser --session $S eval 'var el=document.querySelector(".mp-right"); if(el) el.scrollIntoView({block:"start"}); "ok"' >/dev/null 2>&1
agent-browser --session $S wait 2000 >/dev/null 2>&1
echo "== Десктоп: ячейки таблицы (обрезки быть не должно) =="
agent-browser --session $S eval '
var rows=document.querySelectorAll(".mp-rt-table tbody tr");
var out=[];
rows.forEach(function(r){ out.push(Array.from(r.cells).map(function(c){var ov=c.scrollWidth>c.clientWidth?"ОБРЕЗАНО(":""); return ov+c.textContent.trim()+(ov?")":"");}).join(" | ")); });
out.join("\n")||"таблицы нет"
' 2>/dev/null
agent-browser --session $S screenshot $OUT/stage2-rates-desktop.png >/dev/null 2>&1

agent-browser --session $S set viewport 400 800 >/dev/null 2>&1
agent-browser --session $S wait 2000 >/dev/null 2>&1
agent-browser --session $S eval 'var el=document.querySelector(".mp-right"); if(el) el.scrollIntoView({block:"start"}); "ok"' >/dev/null 2>&1
agent-browser --session $S wait 2000 >/dev/null 2>&1
echo "== Мобайл 400: ячейки и переполнение =="
agent-browser --session $S eval '
var sw=document.documentElement.scrollWidth, cw=document.documentElement.clientWidth;
var rows=document.querySelectorAll(".mp-rt-table tbody tr");
var out=[];
out.push("scrollWidth="+sw+"/"+cw+" без прокрутки: "+(sw<=cw));
rows.forEach(function(r){ out.push(Array.from(r.cells).map(function(c){var ov=c.scrollWidth>c.clientWidth?"ОБРЕЗАНО(":""; return ov+c.textContent.trim()+(ov?")":"");}).join(" | ")); });
out.join("\n")
' 2>/dev/null
agent-browser --session $S screenshot $OUT/stage2-rates-mobile.png >/dev/null 2>&1
agent-browser --session $S close >/dev/null 2>&1

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
echo done
