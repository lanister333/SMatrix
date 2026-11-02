#!/bin/bash
# СТАДИЯ 2, ЗАДАЧА 1: фиксировано-адаптивная сетка ПК-версии.
# 1) .main-grid-container на Главной: flex, space-between, max-width:1260px,
#    margin:0 auto, gap:12px; левая 240px, правая 300px, центр flex:1
#    min-width:450px. Класс строго у Главной — форумный вид хранит прежнюю
#    grid-сетку 320/1fr/320.
# 2) Строки «Подслушано»/«Последние темы»: Flexbox (space-between, center),
#    тема flex:1 + ellipsis + padding-right:15px, автор 140px left,
#    дата 110px right.
# Мобайл 400 — регресс заморозки (контейнер блоковый, дата ≤640 скрыта,
# автор зажат 96px, прокруток-X нет). Десктоп 1280 + 1366 (16:9) + инфо 1024.
# $1 — метка прогона.
cd /home/z/my-project || exit 1
LBL=${1:-POSLE}
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
sleep 8

S=s2g
agent-browser --session $S close >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1

# ===== Задача 1: контейнер .main-grid-container (ПК) =====
HOMEGRID='
(function(){
  var p=[];
  var c=document.querySelector(".sk-layout.main-grid-container");
  if(!c) return "ОШИБКА: .main-grid-container нет на Главной";
  var cs=getComputedStyle(c);
  p.push("контейнер: display="+cs.display+" justify="+cs.justifyContent+" maxW="+cs.maxWidth+" gap="+cs.columnGap+" ("+(cs.display==="flex"&&cs.justifyContent==="space-between"&&cs.maxWidth==="1260px"&&cs.columnGap==="12px"?"ТЗ ДА":"НЕТ!")+")");
  var r=c.getBoundingClientRect();
  p.push("контейнер: w="+Math.round(r.width)+" ("+(r.width<=1260?"≤1260 ДА":"НЕТ!")+")");
  var left=c.querySelector(".sk-col-left");
  if(!left) return p.join(" | ")+" | ОШИБКА: левой колонки нет";
  var lcs=getComputedStyle(left), lw=Math.round(left.getBoundingClientRect().width);
  p.push("левая: basis="+lcs.flexBasis+" w="+lw+" ("+(lcs.flexBasis==="240px"&&lw===240?"240px ДА":"НЕТ!")+")");
  var main=c.querySelector(".sk-col-main");
  if(!main) return p.join(" | ")+" | ОШИБКА: центра нет";
  var mcs=getComputedStyle(main), mw=Math.round(main.getBoundingClientRect().width), exp=Math.round(r.width)-564;
  p.push("центр: grow="+mcs.flexGrow+" minW="+mcs.minWidth+" w="+mw+" (ож."+exp+") ("+(mcs.flexGrow==="1"&&mcs.minWidth==="450px"&&mw===exp&&mw>=450?"ТЗ ДА":"НЕТ!")+")");
  var right=c.querySelector(".mp-right");
  if(!right) return p.join(" | ")+" | ОШИБКА: правой колонки нет";
  var rcs=getComputedStyle(right), rw=Math.round(right.getBoundingClientRect().width);
  p.push("правая: basis="+rcs.flexBasis+" w="+rw+" ("+(rcs.flexBasis==="300px"&&rw===300?"300px ДА":"НЕТ!")+")");
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  return p.join(" | ");
})()
'

# ===== Задача 1: flex-строки таблиц Подслушано / Последние темы =====
ROWFLEX='
(function(){
  var p=[];
  var rows=document.querySelectorAll(".mp-trow");
  if(!rows.length) return "ОШИБКА: строк .mp-trow нет";
  var row=rows[0];
  var rcs=getComputedStyle(row);
  p.push("строка: display="+rcs.display+" justify="+rcs.justifyContent+" align="+rcs.alignItems+" ("+(rcs.display==="flex"&&rcs.justifyContent==="space-between"&&rcs.alignItems==="center"?"ТЗ ДА":"НЕТ!")+")");
  var t=row.querySelector(".mp-ttext");
  if(!t) return p.join(" | ")+" | ОШИБКА: .mp-ttext нет";
  var tcs=getComputedStyle(t);
  p.push("тема: grow="+tcs.flexGrow+" padR="+tcs.paddingRight+" ws="+tcs.whiteSpace+" ovX="+tcs.overflowX+" ell="+tcs.textOverflow+" ("+(tcs.flexGrow==="1"&&tcs.paddingRight==="15px"&&tcs.whiteSpace==="nowrap"&&tcs.overflowX==="hidden"&&tcs.textOverflow==="ellipsis"?"ТЗ ДА":"НЕТ!")+")");
  var cut=0; var tw=0;
  [].slice.call(document.querySelectorAll(".mp-ttext")).forEach(function(e){ tw++; if(e.scrollWidth>e.clientWidth) cut++; });
  p.push("троеточие занято на "+cut+" из "+tw+" тем ("+(cut>0?"длинные уходят в … ДА":"темы короткие — механизм по computed ДА")+")");
  var a=row.querySelector(".mp-tauthor");
  var acs=a?getComputedStyle(a):null, aw=a?Math.round(a.getBoundingClientRect().width):0;
  p.push("автор: basis="+(acs?acs.flexBasis:"—")+" w="+aw+" align="+(acs?acs.textAlign:"—")+" ("+(acs&&acs.flexBasis==="140px"&&aw===140&&acs.textAlign==="left"?"140px left ДА":"НЕТ!")+")");
  var d=row.querySelector(".mp-tdate");
  var dcs=d?getComputedStyle(d):null, ddw=d?Math.round(d.getBoundingClientRect().width):0;
  p.push("дата: basis="+(dcs?dcs.flexBasis:"—")+" w="+ddw+" align="+(dcs?dcs.textAlign:"—")+" ("+(dcs&&dcs.flexBasis==="110px"&&ddw===110&&dcs.textAlign==="right"?"110px right ДА":"НЕТ!")+")");
  var c2=document.querySelectorAll(".mp-overheard .mp-trow").length;
  var c3=document.querySelectorAll("section[aria-label=\"Последние темы форума\"] .mp-trow").length;
  p.push("строк: подслушано="+c2+" темы="+c3);
  return p.join(" | ");
})()
'

# ===== Регресс: форумный вид хранит прежнюю grid-сетку =====
FORUMREG='
(function(){
  var p=[];
  var c=document.querySelector(".sk-layout");
  if(!c) return "ОШИБКА: .sk-layout нет";
  var hasNew=c.classList.contains("main-grid-container");
  var cs=getComputedStyle(c);
  var cols=cs.gridTemplateColumns.split(" ").length;
  p.push("форум: main-grid-container="+(hasNew?"ЕСТЬ! (не должен)":"нет ДА")+" display="+cs.display+" треков="+cols+" ("+(cs.display==="grid"&&cols===3&&!hasNew?"прежняя grid ДА":"НЕТ!")+")");
  var left=c.querySelector(".sk-col-left");
  var lw=left?Math.round(left.getBoundingClientRect().width):0;
  p.push("форум левая: w="+lw+" ("+(lw===320?"320px эталон ДА":"НЕТ!")+")");
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  return p.join(" | ");
})()
'

# ===== Регресс главной (эталоны Задач 13/14) =====
HOMEREGRESS='
(function(){
  var p=[];
  var bc=document.querySelectorAll("section.sakh-card[aria-label=\"Курсы валют\"] .bestcell").length;
  p.push("панель курсов: bestcell="+bc+" ("+(bc===10?"не тронута ДА":"НЕТ!")+")");
  var st=[].slice.call(document.querySelectorAll(".sm-mh-main p, .sm-mh-side div, .sm-mh-side p")).map(function(e){return getComputedStyle(e).color;});
  p.push("шапка: белые тексты="+(st.length>=3&&st.every(function(c){return c==="rgb(255, 255, 255)";})?"ДА":"НЕТ!"));
  var tr=[].slice.call(document.querySelectorAll(".mp-tr-live b"));
  p.push("информеры Задачи 13 живы: пробки-строка="+(tr.length?"ДА":"НЕТ!"));
  var card=document.querySelector(".sakh-card");
  if(card){var cs2=getComputedStyle(card);
    p.push("карточки (З14): "+(cs2.backgroundColor==="rgb(255, 255, 255)"&&cs2.boxShadow.indexOf("rgba(0, 0, 0, 0.05)")>=0?"белый+тень ДА":"НЕТ!"));}
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!":"нет"));
  return p.join(" | ");
})()
'

# ===== Мобайл 400: регресс заморозки =====
MOBHOME='
(function(){
  var p=[];
  var c=document.querySelector(".sk-layout.main-grid-container");
  if(!c) return "ОШИБКА: контейнера нет";
  var cs=getComputedStyle(c);
  p.push("контейнер: display="+cs.display+" ("+(cs.display==="block"?"мобайл блоковый ДА":"НЕТ! (flex протёк)")+")");
  var cw=Math.round(c.getBoundingClientRect().width), vw=document.documentElement.clientWidth;
  p.push("контейнер: w="+cw+" при вьюпорте "+vw+" ("+(cw<=vw?"не шире вьюпорта ДА":"РАЗДУТ! НЕТ")+")");
  var main=c.querySelector(".sk-col-main");
  var mcs=main?getComputedStyle(main):null;
  p.push("центр: minW="+(mcs?mcs.minWidth:"—")+" w="+(main?Math.round(main.getBoundingClientRect().width):"—")+" ("+(mcs&&mcs.minWidth==="0px"?"450px снят ДА":"НЕТ!")+")");
  var a=document.querySelector(".mp-trow .mp-tauthor");
  var acs=a?getComputedStyle(a):null;
  p.push("автор: basis="+(acs?acs.flexBasis:"—")+" maxW="+(acs?acs.maxWidth:"—")+" w="+(a?Math.round(a.getBoundingClientRect().width):"—")+" ("+(acs&&acs.maxWidth==="96px"?"≤640 clamp 96px ДА":"НЕТ!")+")");
  var d=document.querySelector(".mp-trow .mp-tdate");
  p.push("дата: "+(d?(getComputedStyle(d).display==="none"?"скрыта ДА (≤640 эталон)":"ВИДИМА! НЕТ!"):"нет в DOM"));
  var over=0;
  [].slice.call(document.querySelectorAll(".mp-trow")).forEach(function(r){ if(r.scrollWidth>r.clientWidth+1) over++; });
  p.push("строк с вылетом содержимого: "+over+" ("+(over===0?"чисто ДА":"НЕТ!")+")");
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  return p.join(" | ");
})()
'

# ===== Суженный ПК 1024: контейнер не раздувается (width:100%), центр по ТЗ =====
INFOWIDE='
(function(){
  var c=document.querySelector(".sk-layout.main-grid-container");
  if(!c) return "1024: контейнера нет";
  var main=c.querySelector(".sk-col-main");
  var right=c.querySelector(".mp-right");
  var cw=Math.round(c.getBoundingClientRect().width), vw=document.documentElement.clientWidth;
  var mw=main?Math.round(main.getBoundingClientRect().width):0;
  var re=right?Math.round(right.getBoundingClientRect().right):0;
  return "1024: контейнер w="+cw+" при вьюпорте "+vw+" ("+(cw<=vw?"не раздут ДА":"РАЗДУТ! НЕТ")+") | центр w="+mw+" ("+(mw>=450?"min 450 ТЗ ДА":"НЕТ!")+") | правая правый край="+re+" ("+(re<=vw?"видна ДА":"ОБРЕЗАНА на "+(re-vw)+"px (математика ТЗ 240+450+300+24+20=1024)")+")";
})()
'

open_view () {
  agent-browser --session $S open "$1" >/dev/null 2>&1
  agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
  agent-browser --session $S wait 2500 >/dev/null 2>&1
  local W=$(echo $2 | awk '{print $1}')
  local ok=0
  for try in 1 2 3; do
    agent-browser --session $S set viewport $2 >/dev/null 2>&1
    agent-browser --session $S wait 2500 >/dev/null 2>&1
    local got=$(agent-browser --session $S eval "window.innerWidth" 2>/dev/null | tr -d '"')
    if [ "$got" = "$W" ]; then ok=1; break; fi
    echo "  ! вьюпорт не применился (попытка $try: innerWidth=$got, ждали $W) — повтор"
  done
  [ "$ok" = "1" ] || echo "  !! ВНИМАНИЕ: вьюпорт $W не подтвердился, замеры могут быть по $got"
}

echo "======== HTTP ========"
curl -s -o /dev/null -w "/ -> %{http_code}\n" --max-time 15 "http://localhost:3000/"

echo "======== ДЕСКТОП 1280: главная (Задача 1: сетка + строки) ========"
open_view "http://localhost:3000/" "1280 900"
agent-browser --session $S eval "$HOMEGRID" 2>/dev/null
agent-browser --session $S eval "$ROWFLEX" 2>/dev/null
agent-browser --session $S eval "$HOMEREGRESS" 2>/dev/null
agent-browser --session $S screenshot $OUT/s2g-home-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/s2g-home-1280-$LBL.png"

echo "======== ДЕСКТОП 1366 (16:9): главная ========"
open_view "http://localhost:3000/" "1366 768"
agent-browser --session $S eval "$HOMEGRID" 2>/dev/null

echo "======== ИНФО 1024 (суженный ПК) ========"
open_view "http://localhost:3000/" "1024 768"
agent-browser --session $S eval "$INFOWIDE" 2>/dev/null

echo "======== ДЕСКТОП 1280: форум (регресс прежней grid-сетки) ========"
open_view "http://localhost:3000/?view=forum" "1280 900"
agent-browser --session $S eval "$FORUMREG" 2>/dev/null
agent-browser --session $S screenshot $OUT/s2g-forum-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/s2g-forum-1280-$LBL.png"

echo "======== МОБАЙЛ 400: главная (регресс заморозки) ========"
open_view "http://localhost:3000/" "400 850"
agent-browser --session $S eval "$MOBHOME" 2>/dev/null
agent-browser --session $S eval "$HOMEREGRESS" 2>/dev/null
agent-browser --session $S screenshot $OUT/s2g-home-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/s2g-home-400-$LBL.png"

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
echo "Приёмка Стадии 2 / Задачи 1 ($LBL) завершена; сервер продолжает работать."
