#!/bin/bash
# ЗАДАЧА 2: эстетические недоработки (Шапка и Подвал).
# Шапка: логотип SakhMatrix — симметричные вертикальные отступы
#   padding-top/padding-bottom 6px/6px (медиа ≥768px, .header-logo),
#   встаёт по центру бирюзовой плашки; правый блок лозунга
#   (.sm-mh-side «Сахалинская матрица взаимопомощи») — #FFFFFF !important.
# Футер: background-color:#004A8F !important, текст #FFFFFF, ссылки #A9CBEF
#   (оба футера сайта: .mp-footer Главной/форума и .sk-footer сервисных
#   страниц — weather.php и др.).
# Регрессы: сетка Стадии 2/Задачи 1 (flex 1260/240/450/300), информеры
#   Задачи 13, белые карточки Задачи 14, бирюза шапки, мобайл-заморозка
#   (шапка ≤60px, паддингов у логотипа нет ≤767px), прокруток-X нет.
# $1 — метка прогона (RUN1/RUN2/...).
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

S=s2a
agent-browser --session $S close >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1

# ===== Задача 2: шапка (логотип по центру плашки + белый блок лозунга) =====
HEADER2='
(function(){
  var p=[];
  var a=document.querySelector("a.header-logo");
  if(!a) return "ОШИБКА: a.header-logo нет";
  var cs=getComputedStyle(a);
  p.push("логотип: padT="+cs.paddingTop+" padB="+cs.paddingBottom+" ("+(cs.paddingTop==="6px"&&cs.paddingBottom==="6px"?"симметрично 6/6 ДА":"НЕТ!")+")");
  var h1=a.querySelector("h1");
  var hr=h1?h1.getBoundingClientRect():null;
  var head=document.querySelector("header");
  var kcr=head?head.getBoundingClientRect():null;
  if(hr&&kcr){
    var top=Math.round(hr.top-kcr.top), bot=Math.round(kcr.bottom-hr.bottom);
    p.push("плашка h="+Math.round(kcr.height)+": над логотипом "+top+"px / под логотипом "+bot+"px (визуальный баланс)");
  }
  var side=document.querySelector(".sm-mh-side");
  var scs=side?getComputedStyle(side):null;
  p.push("блок лозунга: color="+(scs?scs.color:"—")+" ("+(scs&&scs.color==="rgb(255, 255, 255)"?"белый !important ДА":"НЕТ!")+")");
  var sub=side?side.querySelector("div"):null;
  var dsc=side?side.querySelector("p"):null;
  var s1=sub?getComputedStyle(sub).color:"", s2=dsc?getComputedStyle(dsc).color:"";
  p.push("подзаголовок/описание: "+s1+" / "+s2+" ("+(s1==="rgb(255, 255, 255)"&&s2==="rgb(255, 255, 255)"?"оба белые ДА":"НЕТ!")+")");
  var wt=[].slice.call(document.querySelectorAll(".sm-mh-main p, .sm-mh-side div, .sm-mh-side p")).map(function(e){return getComputedStyle(e).color;});
  p.push("белые тексты шапки (эталон З14): "+(wt.length>=3&&wt.every(function(c){return c==="rgb(255, 255, 255)";})?"ДА":"НЕТ!"));
  var nav=document.querySelector(".sm-mainnav");
  p.push("синие плашки меню не тронуты: "+(nav&&getComputedStyle(nav).backgroundColor==="rgb(30, 58, 95)"?"ДА":"НЕТ!"));
  return p.join(" | ");
})()
'

# ===== Задача 2: футер Главной (.mp-footer) — после прокрутки вниз =====
FOOTMP='
(function(){
  var p=[];
  var f=document.querySelector(".mp-footer");
  if(!f) return "ОШИБКА: .mp-footer нет";
  var cs=getComputedStyle(f);
  p.push("фон="+cs.backgroundColor+" ("+(cs.backgroundColor==="rgb(0, 74, 143)"?"#004A8F ДА":"НЕТ!")+")");
  p.push("текст="+cs.color+" ("+(cs.color==="rgb(255, 255, 255)"?"белый ДА":"НЕТ!")+")");
  var a=f.querySelector("a");
  var acs=a?getComputedStyle(a):null;
  p.push("ссылка="+(acs?acs.color:"—")+" ("+(acs&&acs.color==="rgb(169, 203, 239)"?"#A9CBEF ДА":"НЕТ!")+")");
  var disc=f.querySelector(".mp-footer-disc"), rgt=f.querySelector(".mp-footer-right");
  var d1=disc?getComputedStyle(disc).color:"", d2=rgt?getComputedStyle(rgt).color:"";
  p.push("дисклеймер/правый: "+d1+" / "+d2+" ("+(d1==="rgb(255, 255, 255)"&&d2==="rgb(255, 255, 255)"?"белые ДА":"НЕТ!")+")");
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  return p.join(" | ");
})()
'

# ===== Задача 2: футер сервисных страниц (.sk-footer, weather.php) =====
FOOTSK='
(function(){
  var p=[];
  var f=document.querySelector(".sk-footer");
  if(!f) return "ОШИБКА: .sk-footer нет";
  var cs=getComputedStyle(f);
  p.push("фон="+cs.backgroundColor+" ("+(cs.backgroundColor==="rgb(0, 74, 143)"?"#004A8F !important ДА":"НЕТ!")+")");
  p.push("текст="+cs.color+" ("+(cs.color==="rgb(255, 255, 255)"?"белый ДА":"НЕТ!")+")");
  var st=f.querySelector("span");
  p.push("строка (c) видна: "+(st&&st.getBoundingClientRect().height>0?"ДА":"НЕТ!"));
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  return p.join(" | ");
})()
'

# ===== Регресс: сетка Стадии 2/Задачи 1 + информеры З13 + карточки З14 =====
HOMEREGRESS='
(function(){
  var p=[];
  var c=document.querySelector(".sk-layout.main-grid-container");
  if(!c) return "ОШИБКА: .main-grid-container нет";
  var cs=getComputedStyle(c);
  p.push("сетка З2-1: "+(cs.display==="flex"&&cs.justifyContent==="space-between"&&cs.maxWidth==="1260px"&&cs.columnGap==="12px"?"flex/1260/gap12 ДА":"НЕТ!"));
  var left=c.querySelector(".sk-col-left"), main=c.querySelector(".sk-col-main"), right=c.querySelector(".mp-right");
  var lw=left?Math.round(left.getBoundingClientRect().width):0;
  var mw=main?Math.round(main.getBoundingClientRect().width):0;
  var rw=right?Math.round(right.getBoundingClientRect().width):0;
  p.push("колонки: "+lw+"/"+mw+"/"+rw+" ("+(lw===240&&rw===300&&mw>=450?"240/центр/300 ДА":"НЕТ!")+")");
  var t=document.querySelector(".mp-trow .mp-ttext");
  var tcs=t?getComputedStyle(t):null;
  p.push("строки З2-1: "+(tcs&&tcs.textOverflow==="ellipsis"&&tcs.flexGrow==="1"?"flex+ellipsis ДА":"НЕТ!"));
  var tr=[].slice.call(document.querySelectorAll(".mp-tr-live b"));
  p.push("информеры З13 живы: "+(tr.length?"ДА":"НЕТ!"));
  var card=document.querySelector(".sakh-card");
  if(card){var cs2=getComputedStyle(card);
    p.push("карточки З14: "+(cs2.backgroundColor==="rgb(255, 255, 255)"&&cs2.boxShadow.indexOf("rgba(0, 0, 0, 0.05)")>=0?"белый+тень ДА":"НЕТ!"));}
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!":"нет"));
  return p.join(" | ");
})()
'

# ===== Мобайл 400: заморозка (шапка ≤60px, у логотипа нет паддингов) =====
MOB2='
(function(){
  var p=[];
  var a=document.querySelector("a.header-logo");
  if(!a) return "ОШИБКА: a.header-logo нет";
  var cs=getComputedStyle(a);
  p.push("логотип: padT="+cs.paddingTop+" padB="+cs.paddingBottom+" ("+(cs.paddingTop==="0px"&&cs.paddingBottom==="0px"?"паддингов нет ДА":"НЕТ! (протекли)")+")");
  var head=document.querySelector("header");
  var hh=head?Math.round(head.getBoundingClientRect().height):0;
  p.push("шапка h="+hh+" ("+(hh<=60?"≤60px заморозка ДА":"НЕТ!")+")");
  var side=document.querySelector(".sm-mh-side");
  p.push("правый блок: "+(side&&getComputedStyle(side).display==="none"?"скрыт (эталон ≤480) ДА":"НЕТ!"));
  var f=document.querySelector(".mp-footer");
  var fcs=f?getComputedStyle(f):null;
  p.push("футер: "+(fcs?(fcs.backgroundColor==="rgb(0, 74, 143)"&&fcs.color==="rgb(255, 255, 255)"?"#004A8F+белый ДА":"НЕТ!"):"нет"));
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  return p.join(" | ");
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

shot_bottom () {
  agent-browser --session $S eval "window.scrollTo(0, document.body.scrollHeight)" >/dev/null 2>&1
  agent-browser --session $S wait 900 >/dev/null 2>&1
  agent-browser --session $S screenshot $OUT/$1 >/dev/null 2>&1 && echo "скрин: $OUT/$1"
}

echo "======== HTTP ========"
curl -s -o /dev/null -w "/ -> %{http_code}\n" --max-time 15 "http://localhost:3000/"

echo "======== ДЕСКТОП 1280: шапка (логотип по центру + белый блок лозунга) ========"
open_view "http://localhost:3000/" "1280 900"
agent-browser --session $S eval "$HEADER2" 2>/dev/null
agent-browser --session $S screenshot $OUT/t2-home-top-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/t2-home-top-1280-$LBL.png"

echo "======== ДЕСКТОП 1280: футер Главной (.mp-footer) ========"
shot_bottom "t2-home-foot-1280-$LBL.png"
agent-browser --session $S eval "$FOOTMP" 2>/dev/null
agent-browser --session $S eval "$HOMEREGRESS" 2>/dev/null

echo "======== ДЕСКТОП 1280: футер сервисной страницы (weather.php, .sk-footer) ========"
open_view "http://localhost:3000/weather.php" "1280 900"
shot_bottom "t2-weather-foot-1280-$LBL.png"
agent-browser --session $S eval "$FOOTSK" 2>/dev/null

echo "======== ДЕСКТОП 1366 (16:9): шапка ========"
open_view "http://localhost:3000/" "1366 768"
agent-browser --session $S eval "$HEADER2" 2>/dev/null

echo "======== МОБАЙЛ 400: заморозка шапки + футер ========"
open_view "http://localhost:3000/" "400 850"
agent-browser --session $S eval "$MOB2" 2>/dev/null
agent-browser --session $S screenshot $OUT/t2-home-top-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/t2-home-top-400-$LBL.png"
shot_bottom "t2-home-foot-400-$LBL.png"

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
echo "Приёмка Задачи 2 ($LBL) завершена; сервер продолжает работать."
