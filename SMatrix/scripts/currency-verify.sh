#!/bin/bash
# Шаг 9: полная страница /currency.php — живой коммерческий сервис:
# подробная таблица курсов касс банков ЮС из hourly-парсера
# (островная пятёрка USD/EUR/CNY/JPY за 100/KRW за 1000), авто-подсветка
# самых выгодных курсов ПОКУПКИ/ПРОДАЖИ мягким зелёным SakhMatrix,
# справочник центральных отделений 5 банков с tel:-кнопками.
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

# серии валют: планировщик собирает ежечасно; даём первому сбору отработать
sleep 20

S=cur9
agent-browser --session $S close >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1

# состав банков свежайшей серии (для сверки с таблицей на странице)
NBANKS=$(curl -s --max-time 25 http://localhost:3000/api/home/rates | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    print(len(d.get('banks',[])))
except Exception:
    print(0)
")
echo "API /api/home/rates: банков в свежайшей серии = $NBANKS"

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
  var back=document.querySelector("a.crt-back");
  if(!back) return "ОШИБКА: кнопки возврата нет";
  var bcs=getComputedStyle(back), bb=back.getBoundingClientRect();
  var card1=document.querySelector("section.mp-panel.sakh-card");
  var inTop=back.getBoundingClientRect().top < card1.getBoundingClientRect().bottom;
  p.push("возврат: href="+back.getAttribute("href")+" текст="+(back.textContent.replace(/\s+/g," ").trim()==="← Вернуться на Главную"?"точно ДА":"НЕТ!")+" mt="+bcs.marginTop+" bg="+bcs.backgroundColor+" цвет="+(bcs.color==="rgb(255, 255, 255)"?"белый ДА":"НЕТ! "+bcs.color)+" подч.="+bcs.textDecorationLine+" h="+Math.round(bb.height)+" (≥44="+(bb.height>=44?"ДА":"НЕТ!")+") в верхней карточке="+(inTop?"ДА":"НЕТ!"));
  var lg=document.querySelector(".crt-legend");
  p.push("легенда: "+(lg&&lg.textContent.indexOf("покупка / продажа")>=0&&lg.textContent.indexOf("выгодный")>=0?"есть ДА":"НЕТ!"));
  var t=document.querySelector(".crt-table");
  if(!t){ p.push("таблица: НЕТ! (пустое состояние: "+(document.querySelector(".crt-empty")?"«Курсы обновляются…»":"???")+")"); return p.join(" | "); }
  var head=[].slice.call(t.querySelectorAll("thead th"));
  var codes=head.slice(1).map(function(th){var b=th.querySelector("b");return b?b.textContent.trim():"?";});
  p.push("шапка: "+(codes.join("|")==="USD|EUR|CNY|JPY|KRW"?"пятёрка ТЗ ДА":"НЕТ! "+codes.join(","))+" | «за 100»="+(t.textContent.indexOf("за 100")>=0?"ДА":"НЕТ!")+" «за 1000»="+(t.textContent.indexOf("за 1000")>=0?"ДА":"НЕТ!"));
  var rows=[].slice.call(t.querySelectorAll("tbody tr"));
  var banks=rows.map(function(tr){return tr.querySelector("th").textContent.trim();});
  p.push("строк-банков: "+rows.length+" (API __NBANKS__ = "+(rows.length===__NBANKS__?"ДА":"НЕТ!")+") («"+banks.join(", ")+"»)");
  var td1=rows.length?rows[0].querySelectorAll("td")[0]:null;
  if(td1){var tcs=getComputedStyle(td1);
    p.push("ячейка: pad="+tcs.paddingTop+" "+tcs.paddingLeft+" buy fs="+getComputedStyle(td1.querySelector("b")).fontSize+" sell fs="+getComputedStyle(td1.querySelector("i")).fontSize);}
  var upd=document.querySelector(".crt-body .mp-w-upd");
  p.push("штамп: "+(upd&&upd.textContent.indexOf("Наличные курсы касс · обновлено:")===0&&upd.textContent.indexOf("kovalut.ru")>=0?"ДА":"НЕТ! («"+(upd?upd.textContent.trim():"—")+"»)"));
  // справочник отделений
  var dir=[].slice.call(document.querySelectorAll(".crt-dirrow"));
  var names=dir.map(function(r){return r.querySelector(".crt-bank").textContent.trim();});
  var tels=[].slice.call(document.querySelectorAll("a.crt-tel"));
  var hrefsOk=tels.length>0&&tels.every(function(a){return /^tel:[0-9]+$/.test(a.getAttribute("href")||"");});
  var telOk1=tels.length?Math.round(tels[0].getBoundingClientRect().height):0;
  p.push("справочник: "+dir.length+" банков («"+names.join(", ")+"» = ТЗ "+(names.join("|")==="АТБ|Солид Банк|Сбербанк|ВТБ|Банк Приморье"?"ДА":"НЕТ!")+") tel-кнопок="+tels.length+" hrefs-цифры="+(hrefsOk?"ДА":"НЕТ!")+" h1="+telOk1+" ("+(window.innerWidth<=480?(telOk1>=44?"тач-цель ≥44 ДА":"НЕТ! <44"):"ПК-чип, тач-цель на мобиле")+")");
  var addr1=document.querySelector(".crt-addr");
  if(addr1){var afs=getComputedStyle(addr1).fontSize;
    p.push("адрес fs="+afs+" ("+(window.innerWidth<=480?(afs==="11.5px"?"ультра-плотный ДА":"НЕТ!"):(afs==="12px"?"12px ДА":"НЕТ!"))+")");}
  // границы и прокрутки
  var card=document.querySelector("section.sakh-card");
  var tr1=rows.length?rows[0]:null;
  if(tr1&&card){p.push("таблица держит правую границу .sakh-card: "+(tr1.getBoundingClientRect().right<=card.getBoundingClientRect().right+1?"ДА":"НЕТ! ("+Math.round(tr1.getBoundingClientRect().right)+" vs "+Math.round(card.getBoundingClientRect().right)+")"));}
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  return p.join(" | ");
})()
'

CHECK_BEST='
(function(){
  var t=document.querySelector(".crt-table");
  if(!t) return "ПОДСВЕТКА: таблицы нет";
  var rows=[].slice.call(t.querySelectorAll("tbody tr"));
  var colOk=0, dataCols=0, mism=0, total=0, detail=[];
  for(var c=1;c<=5;c++){
    var vals=rows.map(function(tr){
      var td=tr.cells[c]; if(!td) return null;
      var b=td.querySelector("b").textContent.trim(), i=td.querySelector("i").textContent.trim();
      var pb=parseFloat(b.replace(",",".")), ps=parseFloat(i.replace(",","."));
      return {td:td, buy:isFinite(pb)?pb:null, sell:isFinite(ps)?ps:null};
    });
    var buys=vals.filter(function(v){return v&&v.buy!==null;}).map(function(v){return v.buy;});
    var sells=vals.filter(function(v){return v&&v.sell!==null;}).map(function(v){return v.sell;});
    if(!buys.length||!sells.length) continue;
    dataCols++;
    var mb=Math.max.apply(null,buys), ms=Math.min.apply(null,sells);
    var expect=vals.map(function(v){return !!v&&((v.buy!==null&&v.buy===mb)||(v.sell!==null&&v.sell===ms));});
    var actual=vals.map(function(v){return !!v&&v.td.className.indexOf("is-best")>=0;});
    for(var k=0;k<vals.length;k++){ total++; if(expect[k]!==actual[k]) mism++; }
    var okCol=expect.every(function(e,k){return e===actual[k];});
    if(okCol&&expect.some(Boolean)) colOk++;
    var bestB=vals[expect.indexOf(true)];
    detail.push(c+": best "+mb+"/"+ms+" ✓="+(okCol?"ДА":"НЕТ!"));
  }
  var best1=t.querySelector("td.is-best");
  var bg=best1?getComputedStyle(best1).backgroundColor:"—";
  return "подсветка (max buy / min sell по каждой колонке DOM): колонок с данными="+dataCols+", согласовано="+colOk+"/"+dataCols+" ("+(colOk===dataCols&&mism===0?"ДА":"НЕТ!")+") несовпадений ячеек "+mism+"/"+total+" | bg подсвеченной="+bg+" (мягкий зелёный #2e9e44="+(bg.indexOf("46, 158, 68")>=0?"ДА":"НЕТ!")+") | "+detail.join(" | ");
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

CHECK_WSTUB='
(function(){
  var txt=document.querySelector(".sm-stub-text");
  return "weather.php (регресс заглушки): текст="+(txt&&txt.textContent.indexOf("Раздел находится в стадии проектирования")===0?"ДА":"НЕТ!")+", кнопка="+(document.querySelector("a.sm-stub-home")?"есть":"НЕТ!");
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

CHECK_PAGE=${CHECK_PAGE//__NBANKS__/$NBANKS}

open_view () {
  agent-browser --session $S open "$1" >/dev/null 2>&1
  agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
  agent-browser --session $S wait 2500 >/dev/null 2>&1
  agent-browser --session $S set viewport $2 >/dev/null 2>&1
  agent-browser --session $S wait 1200 >/dev/null 2>&1
}

echo "======== HTTP ========"
curl -s -o /dev/null -w "/currency.php -> %{http_code}\n" --max-time 15 http://localhost:3000/currency.php

echo "======== МОБАЙЛ 400: /currency.php ========"
open_view "http://localhost:3000/currency.php" "400 850"
agent-browser --session $S eval "$CHECK_LOGO" 2>/dev/null
agent-browser --session $S eval "$CHECK_PAGE" 2>/dev/null
agent-browser --session $S eval "$CHECK_BEST" 2>/dev/null
agent-browser --session $S screenshot $OUT/cur9-cphp-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/cur9-cphp-400-$LBL.png"

echo "======== МОБАЙЛ 320 (стресс) ========"
open_view "http://localhost:3000/currency.php" "320 700"
agent-browser --session $S eval "$CHECK_PAGE" 2>/dev/null
agent-browser --session $S eval "$CHECK_BEST" 2>/dev/null
agent-browser --session $S screenshot $OUT/cur9-cphp-320-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/cur9-cphp-320-$LBL.png"

echo "======== ДЕСКТОП 1280: /currency.php ========"
open_view "http://localhost:3000/currency.php" "1280 900"
agent-browser --session $S eval "$CHECK_PAGE" 2>/dev/null
agent-browser --session $S eval "$CHECK_BEST" 2>/dev/null
agent-browser --session $S screenshot $OUT/cur9-cphp-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/cur9-cphp-1280-$LBL.png"

echo "======== ДЕСКТОП 1280: главная (эталон) ========"
open_view "http://localhost:3000/" "1280 900"
agent-browser --session $S eval "$CHECK_LOGO" 2>/dev/null
agent-browser --session $S eval "$CHECK_HOME" 2>/dev/null
agent-browser --session $S screenshot $OUT/cur9-home-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/cur9-home-1280-$LBL.png"

echo "======== ДЕСКТОП 1280: форум (эталон тулбара) + weather.php (регресс) ========"
open_view "http://localhost:3000/?view=forum" "1280 900"
agent-browser --session $S eval "$DESK_TB" 2>/dev/null
open_view "http://localhost:3000/weather.php" "1280 900"
agent-browser --session $S eval "$CHECK_WSTUB" 2>/dev/null

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
echo "Приёмка Шага 9 ($LBL) завершена; сервер продолжает работать."
