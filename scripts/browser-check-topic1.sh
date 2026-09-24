#!/bin/bash
# Визуальная проверка многостраничной ветки (topic=1, 100 сообщений) на мобиле 400px
cd /home/z/my-project || exit 1
OUT=download/screens

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
sleep 2
setsid nohup bun run dev > /tmp/sakh-dev-forummsg2.log 2>&1 < /dev/null &
up=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then up=1; break; fi
  sleep 1
done
[ "$up" = "1" ] && echo "сервер готов" || { echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; exit 2; }

S=forummsg2
agent-browser --session $S close >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/?topic=1" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 2500 >/dev/null 2>&1
agent-browser --session $S set viewport 400 850 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1

echo "---- Тема 1 (100 сообщений) @ 400 ----"
agent-browser --session $S eval '
(function(){
  var msgs=[].slice.call(document.querySelectorAll(".sk-msg")).filter(function(m){return !m.className.includes("sk-msg-deleted");});
  var dw=document.documentElement;
  var p=["видимых сообщений: "+msgs.length];
  // цепочка: у первых 5 сообщений №, ник, Ответить — все на одной строке? зазор до текста?
  var bad=0, gaps=[];
  msgs.slice(0,8).forEach(function(m){
    var num=m.querySelector(".sk-msg-num"), auth=m.querySelector(".sk-msg-author"),
        btn=m.querySelector(".sk-btn-reply"), body=m.querySelector(".sk-msg-body");
    if(!body) return;
    var bR=body.getBoundingClientRect();
    var tops=[num,auth,btn].filter(Boolean).map(function(e){return e.getBoundingClientRect().top;});
    if(tops.length && Math.max.apply(null,tops)-Math.min.apply(null,tops)>3) bad++;
    var chainBottom=Math.max.apply(null,[num,auth,btn].filter(Boolean).map(function(e){return e.getBoundingClientRect().bottom;}));
    gaps.push((bR.top-chainBottom).toFixed(1));
  });
  p.push("цепочка одной строкой (из 8): сбоев="+bad);
  p.push("зазоры цепочка→текст: "+gaps.join(","));
  var parents=document.querySelectorAll(".sk-msg-parent").length;
  p.push("меток «↳ ответ» в DOM: "+parents);
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  return p.join(" | ");
})()
' 2>/dev/null

agent-browser --session $S screenshot $OUT/forummsg-topic1-400-top.png >/dev/null 2>&1
# прокрутка к середине ветки — снимок области с ответами и метками «↳ ответ»
agent-browser --session $S eval 'document.querySelectorAll(".sk-msg")[4]?.scrollIntoView({block:"center"}); "ok"' >/dev/null 2>&1
agent-browser --session $S wait 800 >/dev/null 2>&1
agent-browser --session $S screenshot $OUT/forummsg-topic1-400-mid.png >/dev/null 2>&1
echo "скрины: $OUT/forummsg-topic1-400-top.png, $OUT/forummsg-topic1-400-mid.png"

agent-browser --session $S close >/dev/null 2>&1
ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
echo "проверка завершена"
