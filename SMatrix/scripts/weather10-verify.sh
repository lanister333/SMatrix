#!/bin/bash
# Шаг 10: полная страница /weather.php — островной погодный сервис:
#  1) кнопка «← Вернуться на Главную» в самом верху .sakh-card;
#  2) развёрнутый виджет Южно-Сахалинска (почасовой прогноз на сегодня,
#     влажность, давление, ветер — open-meteo);
#  3) сетка районов Сахалина и Курил (Юг/Центр/Север/Курилы, 11 городов);
#  4) «Оперативная обстановка на перевалах» — 3 последних сообщения
#     форума с тегом «Дороги» (БД).
# Мобайл 400/320 (плотность 6px, правая граница .sakh-card) + десктоп
# 1280 эталон (ПК не изменён). $1 — метка скриншотов.
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
sleep 5

S=wth10
agent-browser --session $S close >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1

echo "======== API ========"
curl -s --max-time 20 http://localhost:3000/api/weather/full | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    now=d.get('now') or {}
    press=now.get('press',0)
    print('API /api/weather/full: source=%s | городов=%d (нужно 11) | групп=%d | часов=%d | now: t=%s hum=%s press=%s (700..790=%s) wind=%s румб=%s' % (
        d.get('source'), len(d.get('cities',[])), len(set(c.get('group') for c in d.get('cities',[]))),
        len(d.get('hours',[])), now.get('temp'), now.get('hum'), press, 700<=press<=790, now.get('wind'), now.get('rumb')))
except Exception as e:
    print('API ОШИБКА:', e)
"
curl -s --max-time 20 http://localhost:3000/api/weather/roads | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    items=d.get('items',[])
    ok=all(('author' in i and 'body' in i and 'createdAt' in i) for i in items)
    print('API /api/weather/roads: source=%s | записей=%d (<=3) | поля целы=%s' % (d.get('source'), len(items), ok))
    for i in items: print('  -', i.get('createdAt','')[:16], i.get('author'), ':', (i.get('body','') or '')[:70])
except Exception as e:
    print('API ОШИБКА:', e)
"

CHECK_LOGO='
(function(){
  var a=document.querySelector(".sm-mh-wrap a[href=\"/\"]");
  if(!a) return "ОШИБКА: логотип не является ссылкой на /";
  var h1=a.querySelector("h1.sm-masthead-title");
  var cs=h1?getComputedStyle(h1):null;
  return "логотип: href="+a.getAttribute("href")+" | h1 fs="+(cs?cs.fontSize:"—")+" цвет="+(cs?cs.color:"—")+" подч.="+(cs?cs.textDecorationLine:"—");
})()
'

CHECK_PAGE='
(function(){
  var p=[];
  var tb=document.querySelector(".sk-topbar .tb-title");
  p.push("топбар: "+(tb?tb.textContent.trim():"НЕТ"));
  var back=document.querySelector("a.wth-back");
  if(!back) return "ОШИБКА: кнопки возврата нет";
  var bcs=getComputedStyle(back), bb=back.getBoundingClientRect();
  var card1=document.querySelector("section.mp-panel.sakh-card");
  var bodyDiv=card1.querySelector(".wth-body");
  var firstInBody=bodyDiv?bodyDiv.firstElementChild:null;
  p.push("возврат: href="+back.getAttribute("href")+" текст="+(back.textContent.replace(/\s+/g," ").trim()==="← Вернуться на Главную"?"точно ДА":"НЕТ!")+" mt="+bcs.marginTop+" bg="+bcs.backgroundColor+" цвет="+(bcs.color==="rgb(255, 255, 255)"?"белый ДА":"НЕТ! "+bcs.color)+" подч.="+bcs.textDecorationLine+" h="+Math.round(bb.height)+" (≥44="+(bb.height>=44?"ДА":"НЕТ!")+") первый элемент карточки="+(back===firstInBody?"ДА":"НЕТ!"));
  // развёрнутый виджет
  var now=document.querySelector(".wth-now");
  if(now){
    var t=document.querySelector(".wth-now-t").textContent.trim();
    p.push("виджет: темп="+(/^[-+]?\d+°$/.test(t)?"формат ДА ("+t+")":"НЕТ! "+t)+" подпись="+(document.querySelector(".wth-now-l")?"есть":"НЕТ!")+" ощущается="+(now.textContent.indexOf("Ощущается как")>=0?"ДА":"НЕТ!"));
    var m=[].slice.call(document.querySelectorAll(".wth-metric"));
    var labels=m.map(function(x){return (x.querySelector("small")||{}).textContent||"";});
    var pressB=m.length>1?m[1].querySelector("b").textContent.trim():"";
    var pv=parseFloat(pressB);
    p.push("метрики: "+m.length+"/3 («"+labels.join("|")+"» = "+(labels.join("|")==="Влажность|Давление|Ветер"?"ТЗ ДА":"НЕТ!")+") давление="+pressB+" ("+(pv>=700&&pv<=790?"диапазон ДА":"НЕТ!")+") ветер="+(m.length>2?m[2].querySelector("b").textContent.trim():"—")+" м/с="+(m.length>2&&m[2].querySelector("b").textContent.indexOf("м/с")>=0?"ДА":"НЕТ!"));
  } else { p.push("виджет: НЕТ («"+((document.querySelector(".wth-body .wth-empty")||{}).textContent||"?")+"»)"); }
  var hl=document.querySelector(".wth-hours-l");
  var cells=[].slice.call(document.querySelectorAll(".wth-hcell"));
  var hoursBox=document.querySelector(".wth-hours");
  p.push("почасовка: заголовок="+(hl&&hl.textContent.indexOf("Почасовой прогноз на сегодня")>=0?"ДА":"НЕТ!")+" ячеек="+cells.length+" (≥1="+(cells.length>=1?"ДА":"НЕТ!")+") время 1-й="+(cells.length&&/^\d{2}:\d{2}$/.test(cells[0].querySelector("b").textContent.trim())?"формат ДА "+cells[0].querySelector("b").textContent.trim():"НЕТ!")+" лента в границах карточки="+(hoursBox&&card1&&hoursBox.getBoundingClientRect().right<=card1.getBoundingClientRect().right+1?"ДА":"ПРОВЕРЬ"));
  // сетка районов
  var bubs=[].slice.call(document.querySelectorAll(".wth-bub"));
  var gts=[].slice.call(document.querySelectorAll(".wth-gt")).map(function(x){return x.textContent.trim();});
  var tempsOk=bubs.length>0&&bubs.every(function(b){return /^[-+]?\d+°$/.test(b.querySelector(".wth-bub-t").textContent.trim())||b.querySelector(".wth-bub-t").textContent.trim()==="—";});
  var names=bubs.map(function(b){return b.querySelector(".wth-bub-n").textContent.trim();});
  p.push("районы: бабблов="+bubs.length+" (11="+(bubs.length===11?"ДА":"НЕТ!")+") группы=«"+gts.join("|")+"» ("+(gts.join("|")==="Юг|Центр|Север|Курилы"?"ТЗ ДА":"НЕТ!")+") города: "+names.join(", ")+" темпы-формат="+(tempsOk?"ДА":"НЕТ!"));
  // перевалы
  var passes=[].slice.call(document.querySelectorAll(".wth-pass"));
  var passCard=document.querySelector("section.sakh-card[aria-label=\"Оперативная обстановка на перевалах\"]");
  var empty=passCard?passCard.querySelector(".mp-w-upd"):null;
  if(passes.length){
    var t1=passes[0].querySelector(".wth-pass-t");
    var tw=getComputedStyle(t1);
    p.push("перевалы: записей="+passes.length+" (≤3="+(passes.length<=3?"ДА":"НЕТ!")+") перенос="+tw.overflowWrap+"/"+tw.wordBreak+" текст в границах="+(passes.every(function(x){return x.getBoundingClientRect().right<=passCard.getBoundingClientRect().right+1;})?"ДА":"НЕТ!")+" подпись="+(empty&&empty.textContent.indexOf("Дороги")>=0?"ДА":"НЕТ!"));
  } else {
    p.push("перевалы: записей=0, честное пустое состояние="+(document.querySelector("section.sakh-card[aria-label=\"Оперативная обстановка на перевалах\"] .wth-empty")?"ДА":"НЕТ!"));
  }
  // границы и прокрутки
  var cards=[].slice.call(document.querySelectorAll("section.sakh-card"));
  p.push("правая граница всех .sakh-card: "+(cards.every(function(c){return c.scrollWidth<=c.clientWidth+1;})?"ДА":"НЕТ!"));
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  // плотность
  var body=document.querySelector(".wth-body");
  p.push(".wth-body pad="+getComputedStyle(body).paddingTop+" "+getComputedStyle(body).paddingLeft+" ("+(window.innerWidth<=480?"мобайл 6px":"ПК 8px 9px")+")");
  return p.join(" | ");
})()
'

CHECK_HOME='
(function(){
  var p=[];
  var w=document.querySelector("section.sakh-card[aria-label=\"Погода на Сахалине\"] .mp-paneltitle a");
  p.push("погода: "+(w?w.getAttribute("href"):"НЕТ!"));
  var c=document.querySelector("section.sakh-card[aria-label=\"Курсы валют\"] .mp-paneltitle a");
  p.push("курсы: "+(c?c.getAttribute("href"):"НЕТ!"));
  var o=document.querySelector("section.sakh-card[aria-label=\"Отключения\"] .mp-paneltitle a");
  p.push("отключения: "+(o?o.getAttribute("href"):"НЕТ!"));
  var bc=document.querySelectorAll("section.sakh-card[aria-label=\"Курсы валют\"] .bestcell").length;
  p.push("панель курсов главной: ячеек-лучших="+bc+" (10 = не тронута "+(bc===10?"ДА":"НЕТ!")+")");
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!":"нет"));
  return p.join(" | ");
})()
'

DESK_TB='
(function(){
  var t=document.querySelector(".sk-toolbar");
  if(!t) return "ОШИБКА: тулбара нет";
  var cs=getComputedStyle(t), k=t.querySelector(".sk-btn-classic"), inp=t.querySelector("input[type=text]");
  return "тулбар ПК эталон: h="+Math.round(t.getBoundingClientRect().height)+" pad="+cs.paddingTop+"/"+cs.paddingLeft+" | «Найти»: "+(k?Math.round(k.getBoundingClientRect().width)+"x"+Math.round(k.getBoundingClientRect().height):"—")+" | input: "+(inp?inp.offsetWidth+"x"+inp.offsetHeight:"—");
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
curl -s -o /dev/null -w "/weather.php -> %{http_code}\n" --max-time 15 http://localhost:3000/weather.php

echo "======== МОБАЙЛ 400: /weather.php ========"
open_view "http://localhost:3000/weather.php" "400 850"
agent-browser --session $S eval "$CHECK_LOGO" 2>/dev/null
agent-browser --session $S eval "$CHECK_PAGE" 2>/dev/null
agent-browser --session $S screenshot $OUT/wth10-wphp-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/wth10-wphp-400-$LBL.png"

echo "======== МОБАЙЛ 320 (стресс) ========"
open_view "http://localhost:3000/weather.php" "320 700"
agent-browser --session $S eval "$CHECK_PAGE" 2>/dev/null
agent-browser --session $S screenshot $OUT/wth10-wphp-320-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/wth10-wphp-320-$LBL.png"

echo "======== ДЕСКТОП 1280: /weather.php ========"
open_view "http://localhost:3000/weather.php" "1280 900"
agent-browser --session $S eval "$CHECK_PAGE" 2>/dev/null
agent-browser --session $S screenshot $OUT/wth10-wphp-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/wth10-wphp-1280-$LBL.png"

echo "======== ДЕСКТОП 1280: главная (эталон) ========"
open_view "http://localhost:3000/" "1280 900"
agent-browser --session $S eval "$CHECK_LOGO" 2>/dev/null
agent-browser --session $S eval "$CHECK_HOME" 2>/dev/null
agent-browser --session $S screenshot $OUT/wth10-home-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/wth10-home-1280-$LBL.png"

echo "======== ДЕСКТОП 1280: форум (эталон тулбара) + currency.php (регресс) ========"
open_view "http://localhost:3000/?view=forum" "1280 900"
agent-browser --session $S eval "$DESK_TB" 2>/dev/null
open_view "http://localhost:3000/currency.php" "1280 900"
curl -s -o /dev/null -w "currency.php -> %{http_code}\n" --max-time 15 http://localhost:3000/currency.php

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
echo "Приёмка Шага 10 ($LBL) завершена; сервер продолжает работать."
