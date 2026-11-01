#!/bin/bash
# Task 45: переименование кнопок-меню («☰ Разделы портала» / «☰ Категории форума»)
# + плотные строки обеих шторок (pad 6/6, lh 1.2, разделители 1px #e2e8f0,
# плашки-заголовки 6px). Мобайл 400/320 + десктоп 1280 эталон.
cd /home/z/my-project || exit 1
OUT=download/screens
mkdir -p $OUT

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
sleep 2
setsid nohup bun run dev > /home/z/my-project/dev-server.log 2>&1 < /dev/null &
up=0
for i in $(seq 1 90); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then up=1; break; fi
  sleep 1
done
[ "$up" = "1" ] && echo "сервер готов (попытка $i)" || { echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; tail -20 dev-server.log; exit 2; }

S=tb45
agent-browser --session $S close >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1

PORTAL_BTN='
(function(){
  var p=[];
  var burg=document.querySelector(".sm-mh-burger");
  if(!burg) return "ОШИБКА: бургер не найден";
  p.push("текст бургера: «"+burg.textContent.trim()+"»");
  var mh=document.querySelector(".sm-mh-wrap");
  p.push("панель1: "+Math.round(mh.getBoundingClientRect().height)+"px");
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  burg.click();
  return p.join(" | ");
})()
'

PORTAL_DRAWER='
(function(){
  var d=document.querySelector(".sm-mdrawer");
  if(!d) return "ОШИБКА: шторка портала не открылась";
  var p=[];
  var l=d.querySelector(".sm-mdrawer-link");
  var cs=getComputedStyle(l), r=l.getBoundingClientRect();
  p.push("строка портала: h="+Math.round(r.height)+" pad="+cs.paddingTop+"/"+cs.paddingBottom+" lh="+cs.lineHeight+" разделитель="+cs.borderBottomWidth+" "+cs.borderBottomColor);
  p.push("строк-ссылок: "+d.querySelectorAll(".sm-mdrawer-link").length);
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!":"нет"));
  return p.join(" | ");
})()
'

FORUM_BTN='
(function(){
  var p=[];
  var tb=document.querySelector(".sk-topbar");
  if(!tb) return "ОШИБКА: топбар не найден";
  var btn=tb.querySelector("button");
  p.push("текст кнопки: «"+btn.textContent.trim()+"»");
  p.push("панель2: "+Math.round(tb.getBoundingClientRect().height)+"px");
  var t=document.querySelector(".sk-toolbar");
  if(t){var cs=getComputedStyle(t), k=t.querySelector(".sk-btn-classic");
    p.push("тулбар(зад.44): pad="+cs.paddingTop+"/"+cs.paddingRight+"/"+cs.paddingBottom+" кнопка="+Math.round(k.getBoundingClientRect().height)+"px");}
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!":"нет"));
  btn.click();
  return p.join(" | ");
})()
'

FORUM_DRAWER='
(function(){
  var col=document.querySelector(".sk-col-left.open");
  if(!col) return "ОШИБКА: шторка форума не открылась";
  var p=[];
  var li=document.querySelector(".sk-navlist li");
  var cs=getComputedStyle(li), r=li.getBoundingClientRect();
  p.push("строка форума: h="+Math.round(r.height)+" pad="+cs.paddingTop+"/"+cs.paddingBottom+" lh="+cs.lineHeight+" разделитель="+cs.borderBottomWidth+" "+cs.borderBottomColor);
  var bt=document.querySelector(".sk-blocktitle");
  var bcs=getComputedStyle(bt);
  p.push("плашка «Навигация»: h="+Math.round(bt.getBoundingClientRect().height)+" pad="+bcs.paddingTop+"/"+bcs.paddingLeft);
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!":"нет"));
  return p.join(" | ");
})()
'

DESK_CHECK='
(function(){
  var p=[];
  var tb=document.querySelector(".sk-topbar");
  p.push(".sk-topbar: "+(tb?(getComputedStyle(tb).display==="none"?"скрыта (штатно)":"ВИДНА!"):"нет в DOM"));
  var burg=document.querySelector(".sm-mh-burger");
  p.push("бургер: "+(burg?(getComputedStyle(burg).display==="none"?"скрыт (штатно)":"ВИДЕН!"):"нет в DOM"));
  var nav=document.querySelector(".sm-mainnav");
  p.push("синяя навигация ПК: "+(nav?(getComputedStyle(nav).display!=="none"?"ВИДНА":"скрыта"):"нет"));
  var t=document.querySelector(".sk-toolbar");
  if(t){var cs=getComputedStyle(t), k=t.querySelector(".sk-btn-classic");
    p.push("тулбар: h="+Math.round(t.getBoundingClientRect().height)+" pad="+cs.paddingTop+"/"+cs.paddingLeft+" кнопка="+Math.round(k.getBoundingClientRect().height)+"px");}
  return p.join(" | ");
})()
'

open_view () {
  agent-browser --session $S open "$1" >/dev/null 2>&1
  agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
  agent-browser --session $S wait 2500 >/dev/null 2>&1
  agent-browser --session $S set viewport $2 >/dev/null 2>&1
  agent-browser --session $S wait 1200 >/dev/null 2>&1
}

echo "======== МОБАЙЛ 400: портал ========"
open_view "http://localhost:3000/" "400 850"
agent-browser --session $S eval "$PORTAL_BTN" 2>/dev/null
agent-browser --session $S wait 900 >/dev/null 2>&1
agent-browser --session $S eval "$PORTAL_DRAWER" 2>/dev/null
agent-browser --session $S screenshot $OUT/task45-portal-drawer-400.png >/dev/null 2>&1 && echo "скрин: $OUT/task45-portal-drawer-400.png"

echo "======== МОБАЙЛ 400: форум ========"
open_view "http://localhost:3000/?view=forum" "400 850"
agent-browser --session $S eval "$FORUM_BTN" 2>/dev/null
agent-browser --session $S wait 900 >/dev/null 2>&1
agent-browser --session $S eval "$FORUM_DRAWER" 2>/dev/null
agent-browser --session $S screenshot $OUT/task45-forum-drawer-400.png >/dev/null 2>&1 && echo "скрин: $OUT/task45-forum-drawer-400.png"

echo "======== МОБАЙЛ 320: форум (стресс) ========"
open_view "http://localhost:3000/?view=forum" "320 700"
agent-browser --session $S eval "$FORUM_BTN" 2>/dev/null
agent-browser --session $S wait 900 >/dev/null 2>&1
agent-browser --session $S eval "$FORUM_DRAWER" 2>/dev/null
agent-browser --session $S screenshot $OUT/task45-forum-drawer-320.png >/dev/null 2>&1 && echo "скрин: $OUT/task45-forum-drawer-320.png"

echo "======== МОБАЙЛ 320: портал (стресс) ========"
open_view "http://localhost:3000/" "320 700"
agent-browser --session $S eval "$PORTAL_BTN" 2>/dev/null

echo "======== ДЕСКТОП 1280 (эталон) ========"
open_view "http://localhost:3000/?view=forum" "1280 900"
agent-browser --session $S eval "$DESK_CHECK" 2>/dev/null
agent-browser --session $S screenshot $OUT/task45-desktop-1280.png >/dev/null 2>&1 && echo "скрин: $OUT/task45-desktop-1280.png"

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
agent-browser --session $S close >/dev/null 2>&1
echo "приёмка Task 45 завершена; сервер оставлен работать"
