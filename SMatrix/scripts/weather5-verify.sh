#!/bin/bash
# Шаг 5: виджет погоды (метео) — таблица по дням удалена, виджет виден
# на всех ширинах (резина 100% в .sakh-card), заголовок-плашка — ссылка
# на /weather.php (страница-заглушка). Мобайл 400/320 + десктоп 1280 эталон.
# Параметр: $1 — метка скриншотов (например, POSLE-1 / POSLE-2).
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

S=w5
agent-browser --session $S close >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1

CHECK_MOBILE='
(function(){
  var p=[];
  var card=document.querySelector("section.sakh-card");
  if(!card) return "ОШИБКА: карточка .sakh-card не найдена";
  var title=card.querySelector(".mp-paneltitle");
  var link=title?title.querySelector("a"):null;
  if(!link) return "ОШИБКА: заголовок «Погода на Сахалине» не является ссылкой";
  var lcs=getComputedStyle(link);
  p.push("ссылка: href="+link.getAttribute("href")+" цвет="+lcs.color+" подч.="+lcs.textDecorationLine+" шрифт="+lcs.fontSize+"/"+lcs.fontWeight);
  p.push("таблица .mp-wv-list: "+(document.querySelector(".mp-wv-list")?"ОСТАЛАСЬ!":"удалена"));
  var frame=card.querySelector(".mp-w-frame");
  if(!frame) return p.join(" | ")+" | ОШИБКА: .mp-w-frame нет";
  var fcs=getComputedStyle(frame);
  var w=card.querySelector(".mp-weather");
  p.push("виджет: display="+fcs.display+" h="+Math.round(frame.getBoundingClientRect().height)+" iframe="+frame.clientWidth+" контейнер="+w.offsetWidth+" карточка(внутр)="+card.clientWidth);
  p.push("резина 100%: "+(w.offsetWidth===card.clientWidth?"ДА":"НЕТ!"));
  p.push("карточка за рамкой: "+(card.getBoundingClientRect().right>window.innerWidth+1?("ДА!"+Math.round(card.getBoundingClientRect().right)):"нет"));
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  return p.join(" | ");
})()
'

WPHP='
(function(){
  var p=[];
  var tb=document.querySelector(".sk-topbar .tb-title");
  p.push("топбар: "+(tb?tb.textContent.trim():"НЕТ"));
  var pan=document.querySelector(".mp-panel .mp-paneltitle");
  p.push("синяя плашка: "+(pan?pan.textContent.replace(/\s+/g," ").trim():"НЕТ"));
  var body=document.body.innerText;
  p.push("текст заглушки: "+(body.indexOf("будет развёрнут здесь позже")>-1?"есть":"НЕТ!"));
  var home=document.querySelector(".mp-loading a");
  p.push("ссылка на главную: "+(home?home.getAttribute("href"):"НЕТ"));
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!":"нет"));
  return p.join(" | ");
})()
'

DESKTOP_HOME='
(function(){
  var p=[];
  var card=document.querySelector("section.sakh-card");
  if(!card) return "ОШИБКА: карточки нет";
  var link=card.querySelector(".mp-paneltitle a");
  var lcs=link?getComputedStyle(link):null;
  p.push("ПК-плашка: ссылка="+(link?link.getAttribute("href"):"НЕТ")+" цвет="+(lcs?lcs.color:"—")+" подч.="+(lcs?lcs.textDecorationLine:"—")+" шрифт="+(lcs?lcs.fontSize:"—"));
  var frame=card.querySelector(".mp-w-frame");
  var fcs=frame?getComputedStyle(frame):null;
  p.push("виджет ПК: display="+(fcs?fcs.display:"—")+" iframe="+(frame?frame.clientWidth:"—")+" карточка(внутр)="+(card.clientWidth));
  p.push("таблица: "+(document.querySelector(".mp-wv-list")?"ОСТАЛАСЬ!":"удалена"));
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!":"нет"));
  return p.join(" | ");
})()
'

DESK_TB='
(function(){
  var p=[];
  var t=document.querySelector(".sk-toolbar");
  if(!t) return "ОШИБКА: тулбара нет";
  var cs=getComputedStyle(t), k=t.querySelector(".sk-btn-classic"), inp=t.querySelector("input[type=text]");
  p.push("тулбар ПК эталон: h="+Math.round(t.getBoundingClientRect().height)+" pad="+cs.paddingTop+"/"+cs.paddingLeft);
  if(k) p.push("«Найти»: "+Math.round(k.getBoundingClientRect().width)+"x"+Math.round(k.getBoundingClientRect().height)+" pad="+getComputedStyle(k).paddingTop+" "+getComputedStyle(k).paddingLeft+" fs="+getComputedStyle(k).fontSize);
  if(inp) p.push("input ПК: "+inp.offsetWidth+"x"+inp.offsetHeight+" fs="+getComputedStyle(inp).fontSize);
  return p.join(" | ");
})()
'

open_view () {
  agent-browser --session $S open "$1" >/dev/null 2>&1
  agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
  agent-browser --session $S wait 3500 >/dev/null 2>&1
  agent-browser --session $S set viewport $2 >/dev/null 2>&1
  agent-browser --session $S wait 1200 >/dev/null 2>&1
}

echo "======== МОБАЙЛ 400: главная (погода) ========"
open_view "http://localhost:3000/" "400 850"
agent-browser --session $S eval "$CHECK_MOBILE" 2>/dev/null
agent-browser --session $S screenshot $OUT/weather5-home-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/weather5-home-400-$LBL.png"

echo "======== МОБАЙЛ 320: главная (стресс) ========"
open_view "http://localhost:3000/" "320 700"
agent-browser --session $S eval "$CHECK_MOBILE" 2>/dev/null
agent-browser --session $S screenshot $OUT/weather5-home-320-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/weather5-home-320-$LBL.png"

echo "======== МОБАЙЛ 400: /weather.php (заглушка) ========"
phpcode=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 http://localhost:3000/weather.php)
echo "HTTP /weather.php: $phpcode"
open_view "http://localhost:3000/weather.php" "400 850"
agent-browser --session $S eval "$WPHP" 2>/dev/null
agent-browser --session $S screenshot $OUT/weather5-wphp-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/weather5-wphp-400-$LBL.png"

echo "======== ДЕСКТОП 1280: главная (эталон) ========"
open_view "http://localhost:3000/" "1280 900"
agent-browser --session $S eval "$DESKTOP_HOME" 2>/dev/null
agent-browser --session $S screenshot $OUT/weather5-home-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/weather5-home-1280-$LBL.png"

echo "======== ДЕСКТОП 1280: форум (эталон тулбара) ========"
open_view "http://localhost:3000/?view=forum" "1280 900"
agent-browser --session $S eval "$DESK_TB" 2>/dev/null

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
echo "Приёмка Шага 5 завершена; сервер продолжает работать."
