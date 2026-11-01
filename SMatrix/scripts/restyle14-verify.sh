#!/bin/bash
# ЗАДАЧА 14: рестайл эстетики и структуры ПК-версии.
# Шаг 1 (шапка: логотип приспущен, тексты белые), Шаг 2 (вертикальные
# линии-разделители удалены), Шаг 3 (подложка #F4F6F7 + белые карточки
# с тенью ТЗ), Шаг 4 (трёхколоночный монолит внутренних страниц:
# меню форумов + контент + HomeRight), Шаг 5 (футер #004B87).
# Десктоп 1280 + мобайл 400 (регресс: мобайл ≤480 заморожен). $1 — метка.
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

S=r14
agent-browser --session $S close >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1

# ===== Шаги 1/2/3/5: шапка, линии, подложка, карточки, футер =====
RESTYL='
(function(){
  var p=[];
  var mh=document.querySelector(".sm-mh-wrap");
  if(!mh) return "ОШИБКА: шапки нет";
  var mcs=getComputedStyle(mh);
  p.push("Шаг1.1 паддинги плашки: "+mcs.paddingTop+"/"+mcs.paddingBottom+" ("+(mcs.paddingTop===mcs.paddingBottom?"симметричны ДА":"НЕТ!")+")");
  var logo=document.querySelector(".sm-masthead-title");
  var la=logo?logo.parentElement:null;
  var lcs=la?getComputedStyle(la):null;
  if(window.innerWidth<=480){
    p.push("Шаг1.1 логотип mt: "+(lcs?lcs.marginTop:"—")+" ("+(lcs&&lcs.marginTop==="0px"?"мобайл заморожен ДА":"НЕТ!")+")");
  } else {
    p.push("Шаг1.1 логотип mt: "+(lcs?lcs.marginTop:"—")+" ("+(lcs&&lcs.marginTop==="6px"?"приспущен ДА":"НЕТ!")+")");
  }
  var slog=document.querySelector(".sm-mh-main p");
  var sub=document.querySelector(".sm-mh-side div");
  var desc=document.querySelector(".sm-mh-side p");
  var sc=slog?getComputedStyle(slog).color:"—", uc=sub?getComputedStyle(sub).color:"—", dc=desc?getComputedStyle(desc).color:"—";
  p.push("Шаг1.2 тексты шапки: слоган="+sc+" подзагол="+uc+" опис="+dc+" ("+(sc==="rgb(255, 255, 255)"&&uc==="rgb(255, 255, 255)"&&dc==="rgb(255, 255, 255)"?"белые ДА":"НЕТ!")+")");
  var cl=document.querySelector(".sk-col-left:not(.sk-col-left-inner)")||document.querySelector(".sk-col-left");
  if(cl){var cls=getComputedStyle(cl);
    if(cl.getBoundingClientRect().width===0||cls.display==="none"){
      p.push("Шаг2 sk-col-left: display="+cls.display+" (не видима — мобайл-режим ДА)");
    } else {
      p.push("Шаг2 sk-col-left: border-right "+cls.borderRightStyle+"/"+cls.borderRightWidth+" ("+(cls.borderRightStyle==="none"||cls.borderRightWidth==="0px"?"линия удалена ДА":"НЕТ!")+")");
    }
  }
  else p.push("Шаг2 sk-col-left: на странице нет (внутренняя ≤900 скрыта / колонки нет)");
  var sh=document.querySelector(".sk-shell");
  if(sh){var ss=getComputedStyle(sh);
    p.push("Шаг2 sk-shell: L/R="+ss.borderLeftStyle+"/"+ss.borderRightStyle+" ("+(ss.borderLeftStyle==="none"&&ss.borderRightStyle==="none"?"рамки удалены ДА":"НЕТ!")+") bg="+ss.backgroundColor+" ("+(ss.backgroundColor==="rgba(0, 0, 0, 0)"?"прозрачна ДА":"НЕТ!")+")");}
  var sk=document.querySelector(".sk");
  var ks=sk?getComputedStyle(sk).backgroundColor:"—";
  p.push("Шаг3.1 подложка .sk: "+ks+" ("+(ks==="rgb(244, 246, 247)"?"#F4F6F7 ДА":"НЕТ!")+")");
  var card=document.querySelector(".sakh-card");
  if(card){var cs=getComputedStyle(card);
    p.push("Шаг3.2 sakh-card: bg="+cs.backgroundColor+" тень="+(cs.backgroundColor==="rgb(255, 255, 255)"&&cs.boxShadow.indexOf("rgba(0, 0, 0, 0.05)")>=0&&cs.boxShadow.indexOf("rgba(0, 0, 0, 0.03)")>=0?"белый+тень ТЗ ДА":"НЕТ! "+cs.boxShadow.slice(0,50)));}
  var f=document.querySelector(".sk-footer");
  if(f){var fs=getComputedStyle(f);
    p.push("Шаг5 футер: bg="+fs.backgroundColor+" текст="+fs.color+" ("+(fs.backgroundColor==="rgb(0, 75, 135)"&&fs.color==="rgb(230, 237, 245)"?"#004B87+светлый ДА":"НЕТ!")+")");}
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  return p.join(" | ");
})()
'

# ===== Шаг 4: трёхколоночный монолит внутренних страниц (ПК ≥901) =====
PAGE3COL='
(function(){
  var p=[];
  var lay=document.querySelector(".sk-layout-page");
  if(!lay) return "ОШИБКА: .sk-layout-page нет";
  var lcs=getComputedStyle(lay);
  var cols=lcs.gridTemplateColumns.split(" ").length;
  p.push("сетка: display="+lcs.display+" колонок="+cols+" ("+(lcs.display==="grid"&&cols===3?"3-колонки ДА":"НЕТ!")+")");
  var left=document.querySelector(".sk-col-left-inner");
  if(!left) return p.join(" | ")+" | ОШИБКА: левой колонки нет";
  var lvs=getComputedStyle(left);
  p.push("левая: display="+lvs.display+" w="+Math.round(left.getBoundingClientRect().width)+"px, блоки: Нав="+(left.textContent.indexOf("Навигация")>=0?"ДА":"НЕТ!")+" Руб="+(left.textContent.indexOf("Рубрики форума")>=0?"ДА":"НЕТ!")+" Служ="+(left.textContent.indexOf("Служебный")>=0?"ДА":"—"));
  var sc7=left.querySelectorAll("a[href^=\"/?scope=\"]").length;
  var ru=left.querySelectorAll("a[href^=\"/?rubric=\"]").length;
  p.push("левая ссылки: scope="+sc7+" (7 ДА="+(sc7===7)+") rubric="+ru);
  var main=document.querySelector(".sk-layout-page .sk-col-main");
  var right=document.querySelector(".sk-layout-page .mp-right");
  if(!main) return p.join(" | ")+" | ОШИБКА: .sk-col-main нет";
  p.push("центр: карточек="+main.querySelectorAll("section.sakh-card").length);
  if(!right) return p.join(" | ")+" | ОШИБКА: правой колонки (HomeRight) нет";
  var rvs=getComputedStyle(right);
  p.push("правая: display="+rvs.display+" w="+Math.round(right.getBoundingClientRect().width)+"px погода="+(right.querySelector("section[aria-label=\"Погода на Сахалине\"]")?"ДА":"НЕТ!")+" курсы="+(right.querySelector("section[aria-label=\"Курсы валют\"]")?"ДА":"НЕТ!"));
  var c=main.querySelector("section.sakh-card");
  var cw=c?Math.round(c.getBoundingClientRect().width):0;
  p.push("контент НЕ на всю ширину: "+cw+"px ("+(cw>=400&&cw<=window.innerWidth-600?"ДА":"НЕТ! viewport "+window.innerWidth)+")");
  return p.join(" | ");
})()
'

# ===== Шаг 4: мобайл ≤480 заморожен (колонки скрыты, поля 0) =====
MOB3COL='
(function(){
  var p=[];
  var left=document.querySelector(".sk-col-left-inner");
  p.push("левая колонка: "+(left?(getComputedStyle(left).display==="none"?"скрыта ДА":"ВИДИМА! НЕТ!"):"нет в DOM"));
  var right=document.querySelector(".sk-layout-page .mp-right");
  p.push("правая колонка: "+(right?(getComputedStyle(right).display==="none"?"скрыта ДА":"ВИДИМА! НЕТ!"):"нет в DOM"));
  var lay=document.querySelector(".sk-layout-page");
  if(lay){var ls=getComputedStyle(lay);
    p.push("поля сетки: "+ls.paddingLeft+"/"+ls.paddingRight+" ("+((ls.paddingLeft==="0px"&&ls.paddingRight==="0px")?"0 ДА":"НЕТ!")+")");}
  var back=document.querySelector("a.sm-stub-home");
  p.push("возврат на Главную: "+(back?"на месте ДА":"НЕТ!"));
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  return p.join(" | ");
})()
'

# ===== Регресс главной (ПК эталон) =====
HOMEREGRESS='
(function(){
  var p=[];
  var left=document.querySelector(".sk-col-left:not(.sk-col-left-inner)");
  p.push("главная левая колонка: "+(left?"есть ДА":"НЕТ!"));
  var bc=document.querySelectorAll("section.sakh-card[aria-label=\"Курсы валют\"] .bestcell").length;
  p.push("панель курсов: bestcell="+bc+" ("+(bc===10?"не тронута ДА":"НЕТ!")+")");
  var st=[].slice.call(document.querySelectorAll(".sm-mh-main p, .sm-mh-side div, .sm-mh-side p")).map(function(e){return getComputedStyle(e).color;});
  p.push("шапка: текстов="+st.length+" все белые="+(st.length>=3&&st.every(function(c){return c==="rgb(255, 255, 255)";})?"ДА":"НЕТ!"));
  var tr=[].slice.call(document.querySelectorAll(".mp-tr-live b"));
  p.push("информеры Задачи 13 живы: пробки-строка="+(tr.length?"ДА":"НЕТ!"));
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!":"нет"));
  return p.join(" | ");
})()
'

DESK_TB='
(function(){
  var t=document.querySelector(".sk-toolbar");
  if(!t) return "форум: тулбара нет (вид не форумный)";
  var cs=getComputedStyle(t), k=t.querySelector(".sk-btn-classic"), inp=t.querySelector("input[type=text]");
  return "тулбар ПК эталон: h="+Math.round(t.getBoundingClientRect().height)+" | «Найти»: "+(k?Math.round(k.getBoundingClientRect().width)+"x"+Math.round(k.getBoundingClientRect().height):"—")+" | input: "+(inp?inp.offsetWidth+"x"+inp.offsetHeight:"—");
})()
'

open_view () {
  agent-browser --session $S open "$1" >/dev/null 2>&1
  agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
  agent-browser --session $S wait 2500 >/dev/null 2>&1
  agent-browser --session $S set viewport $2 >/dev/null 2>&1
  agent-browser --session $S wait 1200 >/dev/null 2>&1
}

echo "======== HTTP ========"
for u in weather.php currency.php disconnections.php traffic.php; do
  curl -s -o /dev/null -w "/$u -> %{http_code}\n" --max-time 15 "http://localhost:3000/$u"
done

echo "======== ДЕСКТОП 1280: главная (Шаги 1/2/3/5 + регресс) ========"
open_view "http://localhost:3000/" "1280 900"
agent-browser --session $S eval "$RESTYL" 2>/dev/null
agent-browser --session $S eval "$HOMEREGRESS" 2>/dev/null
agent-browser --session $S screenshot $OUT/r14-home-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/r14-home-1280-$LBL.png"

for PG in traffic weather currency disconnections; do
  echo "======== ДЕСКТОП 1280: /$PG.php (Шаг 4: 3 колонки) ========"
  open_view "http://localhost:3000/$PG.php" "1280 900"
  agent-browser --session $S eval "$PAGE3COL" 2>/dev/null
  agent-browser --session $S eval "$RESTYL" 2>/dev/null
  agent-browser --session $S screenshot $OUT/r14-$PG-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/r14-$PG-1280-$LBL.png"
done

echo "======== ДЕСКТОП 1280: форум (эталон тулбара) ========"
open_view "http://localhost:3000/?view=forum" "1280 900"
agent-browser --session $S eval "$DESK_TB" 2>/dev/null
agent-browser --session $S eval "$RESTYL" 2>/dev/null

echo "======== МОБАЙЛ 400: /traffic.php (регресс: ≤480 заморожен) ========"
open_view "http://localhost:3000/traffic.php" "400 850"
agent-browser --session $S eval "$MOB3COL" 2>/dev/null
agent-browser --session $S eval "$RESTYL" 2>/dev/null
agent-browser --session $S screenshot $OUT/r14-traffic-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/r14-traffic-400-$LBL.png"

for PG in weather currency disconnections; do
  echo "======== МОБАЙЛ 400: /$PG.php (регресс) ========"
  open_view "http://localhost:3000/$PG.php" "400 850"
  agent-browser --session $S eval "$MOB3COL" 2>/dev/null
  agent-browser --session $S screenshot $OUT/r14-$PG-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/r14-$PG-400-$LBL.png"
done

echo "======== МОБАЙЛ 400: главная (регресс) ========"
open_view "http://localhost:3000/" "400 850"
agent-browser --session $S eval "$HOMEREGRESS" 2>/dev/null

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
echo "Приёмка Задачи 14 ($LBL) завершена; сервер продолжает работать."
