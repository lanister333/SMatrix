#!/bin/bash
# Страницы-заглушки /weather.php и /currency.php по ТЗ: стандартная бирюзовая
# шапка + логотип SakhMatrix — ссылка на главную (href="/") + плотное мобильное
# меню; центральный блок внутри .sakh-card (точный текст ТЗ) + крупная синяя
# кнопка «← Вернуться на Главную» (href="/"); мобайл ≤480px — плотно, без
# лишнего воздуха. Мобайл 400/320 + десктоп 1280 эталон. Параметр: $1 — метка.
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

S=wcstub
agent-browser --session $S close >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1

# Логотип-ссылка на главную: href, обёртка, вид h1 (пиксельный эталон шапки)
CHECK_LOGO='
(function(){
  var a=document.querySelector(".sm-mh-wrap a[href=\"/\"]");
  if(!a) return "ОШИБКА: логотип не является ссылкой на /";
  var acs=getComputedStyle(a), h1=a.querySelector("h1.sm-masthead-title");
  if(!h1) return "ОШИБКА: внутри ссылки нет h1.sm-masthead-title";
  var cs=getComputedStyle(h1);
  return "логотип: href="+a.getAttribute("href")+" display="+acs.display+" подч.ссылки="+acs.textDecorationLine+
    " | h1: fs="+cs.fontSize+" цвет="+cs.color+" подч.="+cs.textDecorationLine+" тр.="+cs.transform.substr(0,34);
})()
'

# Универсальная проверка страницы-заглушки: $1 — ожидаемый текст, $2 — заголовок
CHECK_STUB='
(function(){
  var EXPECT=window.__EXPECT_TEXT__||"", TITLE=window.__EXPECT_TITLE__||"";
  var p=[];
  var tb=document.querySelector(".sk-topbar .tb-title");
  p.push("топбар: "+(tb?tb.textContent.trim():"НЕТ")+" (ожидали «"+TITLE+"» = "+(tb&&tb.textContent.trim()===TITLE?"ДА":"НЕТ!")+")");
  var card=document.querySelector("section.mp-panel.sakh-card");
  p.push(".sakh-card: "+(card?"есть":"НЕТ!"));
  var pt=card&&card.querySelector(".mp-paneltitle");
  var ptTxt=pt?pt.textContent.replace(/\s+/g," ").trim().replace(/^▼/,""):"";
  p.push("синяя плашка: «"+ptTxt+"» (ожидали «"+TITLE+"» = "+(ptTxt===TITLE?"ДА":"НЕТ!")+")");
  var txt=document.querySelector(".sm-stub-text");
  var norm=txt?txt.textContent.replace(/\s+/g," ").trim():"";
  p.push("текст ТЗ: "+(norm===EXPECT?"точно ДА":"НЕТ! («"+norm+"»)"));
  var wrap=document.querySelector(".sm-stub");
  var wcs=wrap?getComputedStyle(wrap):null;
  p.push("обёртка .mp-loading: pad="+(wcs?wcs.paddingTop+" "+wcs.paddingLeft:"—")+" fs="+(wcs?wcs.fontSize:"—")+" цвет="+(wcs?wcs.color:"—"));
  var btn=document.querySelector(".sm-stub-home");
  if(!btn) return p.join(" | ")+" | ОШИБКА: кнопки .sm-stub-home нет";
  var bcs=getComputedStyle(btn), br=btn.getBoundingClientRect();
  var white=bcs.color==="rgb(255, 255, 255)";
  p.push("кнопка: href="+btn.getAttribute("href")+" текст="+(btn.textContent.replace(/\s+/g," ").trim()==="← Вернуться на Главную"?"точно ДА":"НЕТ!")+
    " bg="+bcs.backgroundColor+" цветТекста="+(white?"белый ДА":"НЕТ!("+bcs.color+")")+" fs="+bcs.fontSize+" pad="+bcs.paddingTop+" "+bcs.paddingLeft+
    " mt="+bcs.marginTop+" размер="+Math.round(br.width)+"x"+Math.round(br.height)+" (≥44px="+(br.height>=44?"ДА":"НЕТ!")+") подч.="+bcs.textDecorationLine);
  var card2=document.querySelector("section.mp-panel.sakh-card");
  if(card2){var cr=br.right, sr=card2.getBoundingClientRect().right;
    p.push("кнопка в границах .sakh-card: "+(cr<=sr+1?"ДА":"НЕТ! ("+Math.round(cr)+" vs "+Math.round(sr)+")"));}
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  var ftr=document.querySelector(".sk-footer");
  p.push("футер: "+(ftr?"есть":"НЕТ!"));
  return p.join(" | ");
})()
'

# Регресс главной: три ссылки-заголовка + логотип
CHECK_HOME='
(function(){
  var p=[];
  var w=document.querySelector("section.sakh-card[aria-label=\"Погода на Сахалине\"] .mp-paneltitle a");
  p.push("погода: "+(w?w.getAttribute("href"):"НЕТ!"));
  var c=document.querySelector("section.sakh-card[aria-label=\"Курсы валют\"] .mp-paneltitle a");
  p.push("курсы: "+(c?c.getAttribute("href"):"НЕТ!"));
  var o=document.querySelector("section.sakh-card[aria-label=\"Отключения\"] .mp-paneltitle a");
  p.push("отключения: "+(o?o.getAttribute("href"):"НЕТ!"));
  var a=document.querySelector(".sm-mh-wrap a[href=\"/\"] h1");
  p.push("логотип-ссылка: "+(a?"есть":"НЕТ!"));
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!":"нет"));
  return p.join(" | ");
})()
'

# Десктоп-эталон тулбара форума
DESK_TB='
(function(){
  var p=[];
  var t=document.querySelector(".sk-toolbar");
  if(!t) return "ОШИБКА: тулбара нет";
  var cs=getComputedStyle(t), k=t.querySelector(".sk-btn-classic"), inp=t.querySelector("input[type=text]");
  p.push("тулбар ПК эталон: h="+Math.round(t.getBoundingClientRect().height)+" pad="+cs.paddingTop+"/"+cs.paddingLeft);
  if(k) p.push("«Найти»: "+Math.round(k.getBoundingClientRect().width)+"x"+Math.round(k.getBoundingClientRect().height));
  if(inp) p.push("input ПК: "+inp.offsetWidth+"x"+inp.offsetHeight);
  return p.join(" | ");
})()
'

open_view () {
  agent-browser --session $S open "$1" >/dev/null 2>&1
  agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
  agent-browser --session $S wait 3000 >/dev/null 2>&1
  agent-browser --session $S set viewport $2 >/dev/null 2>&1
  agent-browser --session $S wait 1200 >/dev/null 2>&1
}

set_expect () {
  agent-browser --session $S eval "window.__EXPECT_TEXT__=$1; window.__EXPECT_TITLE__=$2; 'ок'" >/dev/null 2>&1
}

WTEXT="'Раздел находится в стадии проектирования. Полный архив погоды по районам будет доступен в ближайших обновлениях.'"
CTEXT="'Раздел находится в стадии проектирования. Расширенный рейтинг касс банков Южно-Сахалинска будет доступен в ближайших обновлениях.'"
WTITLE="'Погода на Сахалине'"
CTITLE="'Курсы валют'"

echo "======== HTTP ========"
curl -s -o /dev/null -w "/weather.php -> %{http_code}\n" --max-time 15 http://localhost:3000/weather.php
curl -s -o /dev/null -w "/currency.php -> %{http_code}\n" --max-time 15 http://localhost:3000/currency.php

echo "======== МОБАЙЛ 400: /weather.php ========"
open_view "http://localhost:3000/weather.php" "400 850"
set_expect "$WTEXT" "$WTITLE"
agent-browser --session $S eval "$CHECK_LOGO" 2>/dev/null
agent-browser --session $S eval "$CHECK_STUB" 2>/dev/null
agent-browser --session $S screenshot $OUT/wcstub-wphp-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/wcstub-wphp-400-$LBL.png"

echo "======== МОБАЙЛ 400: /currency.php ========"
open_view "http://localhost:3000/currency.php" "400 850"
set_expect "$CTEXT" "$CTITLE"
agent-browser --session $S eval "$CHECK_STUB" 2>/dev/null
agent-browser --session $S screenshot $OUT/wcstub-cphp-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/wcstub-cphp-400-$LBL.png"

echo "======== МОБАЙЛ 320 (стресс): обе заглушки ========"
open_view "http://localhost:3000/weather.php" "320 700"
set_expect "$WTEXT" "$WTITLE"
agent-browser --session $S eval "$CHECK_STUB" 2>/dev/null
agent-browser --session $S screenshot $OUT/wcstub-wphp-320-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/wcstub-wphp-320-$LBL.png"
open_view "http://localhost:3000/currency.php" "320 700"
set_expect "$CTEXT" "$CTITLE"
agent-browser --session $S eval "$CHECK_STUB" 2>/dev/null
agent-browser --session $S screenshot $OUT/wcstub-cphp-320-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/wcstub-cphp-320-$LBL.png"

echo "======== МОБАЙЛ 400: главная (регресс ссылок) ========"
open_view "http://localhost:3000/" "400 850"
agent-browser --session $S eval "$CHECK_LOGO" 2>/dev/null
agent-browser --session $S eval "$CHECK_HOME" 2>/dev/null
agent-browser --session $S screenshot $OUT/wcstub-home-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/wcstub-home-400-$LBL.png"

echo "======== ДЕСКТОП 1280: главная (эталон шапки) ========"
open_view "http://localhost:3000/" "1280 900"
agent-browser --session $S eval "$CHECK_LOGO" 2>/dev/null
agent-browser --session $S eval "$CHECK_HOME" 2>/dev/null
agent-browser --session $S screenshot $OUT/wcstub-home-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/wcstub-home-1280-$LBL.png"

echo "======== ДЕСКТОП 1280: /weather.php и /currency.php ========"
open_view "http://localhost:3000/weather.php" "1280 900"
set_expect "$WTEXT" "$WTITLE"
agent-browser --session $S eval "$CHECK_LOGO" 2>/dev/null
agent-browser --session $S eval "$CHECK_STUB" 2>/dev/null
agent-browser --session $S screenshot $OUT/wcstub-wphp-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/wcstub-wphp-1280-$LBL.png"
open_view "http://localhost:3000/currency.php" "1280 900"
set_expect "$CTEXT" "$CTITLE"
agent-browser --session $S eval "$CHECK_STUB" 2>/dev/null
agent-browser --session $S screenshot $OUT/wcstub-cphp-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/wcstub-cphp-1280-$LBL.png"

echo "======== ДЕСКТОП 1280: форум (эталон тулбара) ========"
open_view "http://localhost:3000/?view=forum" "1280 900"
agent-browser --session $S eval "$DESK_TB" 2>/dev/null

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
echo "Приёмка заглушек ($LBL) завершена; сервер продолжает работать."
