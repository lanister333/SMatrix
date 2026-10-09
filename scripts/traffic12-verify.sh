#!/bin/bash
# Шаг 12: страница /traffic.php с нуля — живой дорожный хаб Южно-Сахалинска:
# интерактивная карта пробок API Яндекс Карт (слой l=trf по умолчанию,
# центр — перекрёсток Мира — Пуркаева 46.9352/142.7451, высота 250px),
# «Оперативные дорожные события» — лента 10 последних сообщений тега
# «Дороги» (12px, автоперенос), таблица «Состояние загородных трасс»
# со статусами из БД (Открыта / Закрыта / Тяжело / н/д).
# Мобайл 400/320 + десктоп 1280 эталон (ПК не изменён). $1 — метка скриншотов.
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

# прогрев БД/кеша API
sleep 5

S=trf12
agent-browser --session $S close >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1

# данные API: число сообщений лога + статусы трасс (для сверки с DOM)
ROUTES_INFO=$(curl -s --max-time 25 http://localhost:3000/api/traffic/reports | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    items=d.get('items',[])
    r={x['key']:x['status'] for x in d.get('routes',[])}
    print(f\"{len(items)}|{r.get('kholmsk','?')}|{r.get('korsakov','?')}|{r.get('okha','?')}\")
except Exception as e:
    print('ERR|||')
")
NITEMS=$(echo "$ROUTES_INFO" | cut -d'|' -f1)
KH=$(echo "$ROUTES_INFO" | cut -d'|' -f2)
KOR=$(echo "$ROUTES_INFO" | cut -d'|' -f3)
OKH=$(echo "$ROUTES_INFO" | cut -d'|' -f4)
echo "API /api/traffic/reports: сообщений=$NITEMS статусы KH='$KH' KOR='$KOR' OKH='$OKH'"

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
  var back=document.querySelector("a.trf-back");
  if(!back) return "ОШИБКА: кнопки возврата нет";
  var bcs=getComputedStyle(back), bb=back.getBoundingClientRect();
  var card1=document.querySelector("section.mp-panel.sakh-card");
  var inTop=back.getBoundingClientRect().top < card1.getBoundingClientRect().bottom;
  p.push("возврат: href="+back.getAttribute("href")+" текст="+(back.textContent.replace(/\s+/g," ").trim()==="← Вернуться на Главную"?"точно ДА":"НЕТ!")+" mt="+bcs.marginTop+" bg="+bcs.backgroundColor+" цвет="+(bcs.color==="rgb(255, 255, 255)"?"белый ДА":"НЕТ! "+bcs.color)+" подч.="+bcs.textDecorationLine+" h="+Math.round(bb.height)+" (≥44="+(bb.height>=44?"ДА":"НЕТ!")+(") в верхней карточке="+(inTop?"ДА":"НЕТ!")));
  // карта пробок
  var card=document.querySelector("section.sakh-card[aria-label=\"Карта пробок Южно-Сахалинска\"]");
  var map=document.querySelector(".trf-map");
  if(!map){ p.push("карта: НЕТ!"); return p.join(" | "); }
  var src=map.getAttribute("src")||"";
  var mw=map.getBoundingClientRect(), cw=card.getBoundingClientRect();
  p.push("карта: in-card="+(card1.contains(map)?"ДА":"НЕТ!")+" l=trf="+(src.indexOf("l=trf")>=0?"ДА":"НЕТ! ")+" центр Мира—Пуркаева="+(src.indexOf("ll=142.74512%2C46.93523")>=0?"ДА":"НЕТ! "+src)+" z=16="+(src.indexOf("z=16")>=0?"ДА":"НЕТ!"));
  p.push("карта: ширина "+Math.round(mw.width)+" (карточка "+Math.round(cw.width)+") 100%="+(window.innerWidth<=480?((mw.width>=cw.width-3&&Math.abs(mw.left-cw.left)<=3)?"во весь экран ДА":"НЕТ! (left "+Math.round(mw.left-cw.left)+"px)"):((mw.width>=cw.width-22&&mw.left>cw.left)?"вставка с полями ДА":"НЕТ!"))+") высота "+Math.round(mw.height)+" (250px="+(Math.abs(mw.height-250)<=2?"ДА":"НЕТ!")+") правый край в рамке="+(mw.right<=cw.right+1?"ДА":"НЕТ!"));
  // народный лог
  var logT=document.querySelector("section.sakh-card[aria-label=\"Оперативные дорожные события\"] .mp-paneltitle");
  var logItems=[].slice.call(document.querySelectorAll(".trf-log-item"));
  var txt1=document.querySelector(".trf-log-t");
  var empty=document.querySelector(".trf-empty");
  p.push("лог: заголовок="+(logT&&logT.textContent.indexOf("Оперативные дорожные события")>=0?"ДА":"НЕТ!")+" записей="+logItems.length+" (API __NITEMS__ = "+(logItems.length===__NITEMS__?"ДА":"НЕТ!")+")"+(txt1?" текст fs="+getComputedStyle(txt1).fontSize+" overflowWrap="+getComputedStyle(txt1).overflowWrap:""+(empty?" (пусто: "+empty.textContent.trim().slice(0,30)+"…)":"")));
  var last=logItems.length?logItems[logItems.length-1]:null;
  if(last&&card){var lc=document.querySelector("section.sakh-card[aria-label=\"Оперативные дорожные события\"]");
    p.push("лог держит правую границу .sakh-card: "+(last.getBoundingClientRect().right<=lc.getBoundingClientRect().right+1?"ДА":"НЕТ! ("+Math.round(last.getBoundingClientRect().right)+" vs "+Math.round(lc.getBoundingClientRect().right)+")"));}
  var tag=document.querySelector(".trf-log .mp-w-upd");
  p.push("метка тега: "+(tag&&tag.textContent.indexOf("Тег «Дороги»")===0?"ДА":"НЕТ!"));
  // таблица трасс
  var roads=document.querySelector("section.sakh-card[aria-label=\"Состояние загородных трасс\"] .trf-roads");
  if(!roads){ p.push("таблица трасс: НЕТ!"); return p.join(" | "); }
  var rows=[].slice.call(roads.querySelectorAll("tbody tr"));
  var names=rows.map(function(tr){return tr.querySelector(".trf-rd-name").textContent.trim();});
  var expNames=["Холмский перевал","Корсаковская трасса","Южно-Сахалинск — Оха"];
  p.push("трассы: строк="+rows.length+" имена ТЗ="+(names.join("|")===expNames.join("|")?"ДА":"НЕТ! («"+names.join(", ")+"»)")+" статусы="+rows.map(function(tr,i){return tr.querySelector(".trf-badge").textContent.trim()==="".concat(["__KH__","__KOR__","__OKH__"][i]).replace(/^$/,"н/д")?"✓":"✗(" + tr.querySelector(".trf-badge").textContent.trim() + ")";}).join(","));
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  return p.join(" | ");
})()
'

CHECK_HOME='
(function(){
  var p=[];
  var tr=document.querySelector("section.sakh-card[aria-label=\"Пробки\"] .mp-tr-map");
  p.push("панель «Пробки» главной: iframe="+(tr?"на месте (не тронута)":"НЕТ!"));
  var o=document.querySelector("section.sakh-card[aria-label=\"Отключения\"] .mp-paneltitle a");
  p.push("отключения: "+(o?o.getAttribute("href"):"НЕТ!"));
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

CHECK_REGR_WTH='(function(){ var wth=document.querySelector(".wth-body"); return "регресс /weather.php: wth-body="+(wth?"цел ДА":"НЕТ!"); })()'

CHECK_REGR_DIS='(function(){ var dis=document.querySelector("a.dis-back"); return "регресс /disconnections.php: dis-back="+(dis?"цел ДА":"НЕТ!"); })()'

CHECK_PAGE=${CHECK_PAGE//__NITEMS__/$NITEMS}
CHECK_PAGE=${CHECK_PAGE//__KH__/$KH}
CHECK_PAGE=${CHECK_PAGE//__KOR__/$KOR}
CHECK_PAGE=${CHECK_PAGE//__OKH__/$OKH}

open_view () {
  agent-browser --session $S open "$1" >/dev/null 2>&1
  agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
  agent-browser --session $S wait 2500 >/dev/null 2>&1
  agent-browser --session $S set viewport $2 >/dev/null 2>&1
  agent-browser --session $S wait 1200 >/dev/null 2>&1
}

echo "======== HTTP ========"
curl -s -o /dev/null -w "/traffic.php -> %{http_code}\n" --max-time 15 http://localhost:3000/traffic.php
curl -s -o /dev/null -w "/api/traffic/reports -> %{http_code}\n" --max-time 15 http://localhost:3000/api/traffic/reports

echo "======== МОБАЙЛ 400: /traffic.php ========"
open_view "http://localhost:3000/traffic.php" "400 850"
agent-browser --session $S eval "$CHECK_LOGO" 2>/dev/null
agent-browser --session $S eval "$CHECK_PAGE" 2>/dev/null
agent-browser --session $S screenshot $OUT/trf12-tphp-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/trf12-tphp-400-$LBL.png"

echo "======== МОБАЙЛ 320 (стресс) ========"
open_view "http://localhost:3000/traffic.php" "320 700"
agent-browser --session $S eval "$CHECK_PAGE" 2>/dev/null
agent-browser --session $S screenshot $OUT/trf12-tphp-320-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/trf12-tphp-320-$LBL.png"

echo "======== ДЕСКТОП 1280: /traffic.php ========"
open_view "http://localhost:3000/traffic.php" "1280 900"
agent-browser --session $S eval "$CHECK_PAGE" 2>/dev/null
agent-browser --session $S screenshot $OUT/trf12-tphp-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/trf12-tphp-1280-$LBL.png"

echo "======== ДЕСКТОП 1280: главная (эталон) ========"
open_view "http://localhost:3000/" "1280 900"
agent-browser --session $S eval "$CHECK_LOGO" 2>/dev/null
agent-browser --session $S eval "$CHECK_HOME" 2>/dev/null
agent-browser --session $S screenshot $OUT/trf12-home-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/trf12-home-1280-$LBL.png"

echo "======== ДЕСКТОП 1280: форум (эталон тулбара) + weather/disconnections (регресс) ========"
open_view "http://localhost:3000/?view=forum" "1280 900"
agent-browser --session $S eval "$DESK_TB" 2>/dev/null
open_view "http://localhost:3000/weather.php" "1280 900"
agent-browser --session $S eval "$CHECK_REGR_WTH" 2>/dev/null
open_view "http://localhost:3000/disconnections.php" "1280 900"
agent-browser --session $S eval "$CHECK_REGR_DIS" 2>/dev/null

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
echo "Приёмка Шага 12 ($LBL) завершена; сервер продолжает работать."
