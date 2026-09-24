#!/bin/bash
# СТАДИЯ 2: браузерная приёмка информеров (Шаги 5-8).
# Сервер и браузер живут в пределах одного вызова (среда не сохраняет
# фоновые процессы между вызовами Bash).
cd /home/z/my-project || exit 1
OUT=download/screens
mkdir -p $OUT

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
sleep 2
setsid nohup bun run dev > /tmp/sakh-dev-accept.log 2>&1 < /dev/null &
up=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then up=1; break; fi
  sleep 1
done
[ "$up" = "1" ] && echo "сервер готов (попытка $i)" || { echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; tail -20 /tmp/sakh-dev-accept.log; exit 2; }

S=accept34
agent-browser --session $S close >/dev/null 2>&1
agent-browser --session $S set viewport 1280 900 >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 5000 >/dev/null 2>&1

echo "== ДЕСКТОП 1280 =="
agent-browser --session $S eval '
var r=document.querySelectorAll(".mp-right .mp-panel.sakh-card");
var out=[];
out.push("sakh-card панелей: "+r.length);
var wf=document.querySelector(".mp-w-frame");
out.push("виджет погоды: "+(wf? "есть ("+wf.src.slice(8,40)+"…)":"НЕТ"));
var rt=document.querySelector(".mp-rt-table");
out.push("таблица курсов: "+(rt? rt.rows.length+" строк (шапка+банки)":"НЕТ"));
out.push("курсы в таблице: "+(rt? (rt.rows[1]? Array.from(rt.rows[1].cells).map(function(c){return c.textContent.trim().slice(0,24)}).join(" | "):"-"):"-"));
var off=document.querySelector(".mp-off-list, .mp-offnote");
out.push("отключения: "+(off? off.className:"НЕТ"));
var tr=document.querySelector(".mp-tr-circle");
out.push("круг пробок: "+(tr? tr.textContent+" ("+tr.className.slice(12)+")":"НЕТ"));
var tm=document.querySelector(".mp-tr-map");
out.push("карта пробок: "+(tm? "есть (yandex l=trf)":"НЕТ"));
var ph=document.querySelector(".mp-phones");
out.push("телефоны (не тронуты): "+(ph? "есть":"НЕТ"));
out.join("\n")
' 2>/dev/null

echo "== Десктоп: базные стили не изменились (эталон СТАДИИ 1) =="
agent-browser --session $S eval '
var nav=document.querySelector(".sm-mainnav");
var mh=document.querySelector(".sm-mh-wrap");
var cs=getComputedStyle(nav||document.body);
var pt=document.querySelector(".mp-paneltitle");
var cspt=getComputedStyle(pt);
"nav display="+cs.display+" | paneltitle padding="+cspt.padding+" | шапка высота="+(mh?mh.getBoundingClientRect().height:"?")
' 2>/dev/null

echo "== Мобайл 400px =="
agent-browser --session $S set viewport 400 800 >/dev/null 2>&1
agent-browser --session $S wait 2500 >/dev/null 2>&1
agent-browser --session $S eval '
var sw=document.documentElement.scrollWidth, cw=document.documentElement.clientWidth;
var out=[];
out.push("scrollWidth="+sw+" clientWidth="+cw+" (горизонт-скролла нет: "+(sw<=cw)+")");
var tr=document.querySelector(".mp-tr-circle");
var cstr=tr?getComputedStyle(tr):null;
out.push("круг пробок: "+(tr? tr.textContent+" | "+cstr.width+"×"+cstr.height+" | фон "+cstr.backgroundColor:"-"));
var tt=document.querySelector(".mp-rt-table th");
out.push("шрифт шапки таблицы курсов: "+(tt?getComputedStyle(tt).fontSize:"-"));
var td=document.querySelector(".mp-rt-table td");
out.push("шрифт ячеек таблицы: "+(td?getComputedStyle(td).fontSize:"-")+" паддинг="+(td?getComputedStyle(td).padding:"-"));
var wf=document.querySelector(".mp-w-frame");
out.push("виджет погоды ширина: "+(wf?getComputedStyle(wf).width:"-"+" высота="+(wf?getComputedStyle(wf).height:"-")));
var oa=document.querySelector(".mp-off-addr li");
out.push("адреса отключений шрифт: "+(oa?getComputedStyle(oa).fontSize:"-"));
var tm2=document.querySelector(".mp-tr-map");
out.push("карта пробок высота: "+(tm2?getComputedStyle(tm2).height:"-"));
var burg=document.querySelector(".sm-mh-burger");
out.push("шторка-бургер: "+(burg?getComputedStyle(burg).display:"?"));
out.join("\n")
' 2>/dev/null

echo "== Скриншоты =="
agent-browser --session $S eval 'window.scrollTo(0,0)' >/dev/null 2>&1
agent-browser --session $S screenshot $OUT/stage2-home-mobile-top.png >/dev/null 2>&1
agent-browser --session $S eval 'var el=document.querySelector(".mp-right"); if(el) el.scrollIntoView({block:"start"}); "scrolled"' >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1
agent-browser --session $S screenshot $OUT/stage2-home-mobile-right.png >/dev/null 2>&1
agent-browser --session $S eval 'window.scrollTo(0,0)' >/dev/null 2>&1

agent-browser --session $S set viewport 1280 900 >/dev/null 2>&1
agent-browser --session $S wait 2500 >/dev/null 2>&1
agent-browser --session $S eval 'var el=document.querySelector(".mp-right"); if(el) el.scrollIntoView({block:"start"}); "scrolled"' >/dev/null 2>&1
agent-browser --session $S wait 2500 >/dev/null 2>&1
agent-browser --session $S screenshot $OUT/stage2-home-desktop-right.png >/dev/null 2>&1

echo "== Консоль =="
agent-browser --session $S errors 2>/dev/null | head -5
agent-browser --session $S console 2>/dev/null | grep -iE "error" | head -5 || echo "(ошибок в консоли нет)"
agent-browser --session $S close >/dev/null 2>&1

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
echo "приёмка завершена"
