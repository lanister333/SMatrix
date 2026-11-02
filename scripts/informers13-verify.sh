#!/bin/bash
# Задача 13: фикс багов информеров главной (мобильная версия ≤480px):
#   п.1 «Пробки»: плашка-заголовок «▼ Пробки» — ссылка на /traffic.php
#        (тап-отклик плашки), реальный балл Яндекс.Пробок в формате ТЗ
#        «🟢 3 балла — Дороги свободны» вместо серого круга «Данные
#        недоступны»;
#   п.2 «Отключения»: пустое состояние — живой текст ТЗ «🟢 …не
#        зафиксировано. Проверено: [время]», заголовок — ссылка на
#        /disconnections.php.
# Мобайл 400/360 + десктоп 1280 эталон (ПК не изменён). $1 — метка скриншотов.
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

S=in13
agent-browser --session $S close >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 2000 >/dev/null 2>&1

# реальный балл из API (адаптер trf-тайлов Яндекса)
curl -s --max-time 40 http://localhost:3000/api/traffic | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    lv=d.get('level')
    ok = isinstance(lv,int) and 1 <= lv <= 10
    print(f'API /api/traffic: level={lv} label={d.get(\"label\")!r} source={d.get(\"source\")!r} =>', '1..10 ДА' if ok else 'НЕТ!')
except Exception as e:
    print('API /api/traffic: ОШИБКА', e)
"

CHECK_PROBK='
(function(){
  var p=[];
  var sec=document.querySelector("section.sakh-card[aria-label=\"Пробки\"]");
  if(!sec) return "ОШИБКА: панели «Пробки» нет";
  var a=sec.querySelector(".mp-paneltitle a");
  p.push("заголовок-ссылка: "+(a&&a.getAttribute("href")==="/traffic.php"&&a.textContent.trim()==="Пробки"?"/traffic.php ДА":"НЕТ! "+(a?a.getAttribute("href"):"нет ссылки")));
  var live=sec.querySelector(".mp-tr-live");
  if(!live) return p.join(" | ")+" | строка балла: НЕТ!";
  var t=live.textContent.replace(/\s+/g," ").trim();
  var ballRe=/^[🟢🟡🔴]\s*\d+ (балл|балла|баллов) — (Дороги свободны|Движение затруднено|Город стоит)$/u;
  p.push("формат ТЗ: "+(ballRe.test(t)?"ДА":"НЕТ! «"+t+"»"));
  var bEl=live.querySelector("b");
  var bcs=getComputedStyle(bEl||live);
  var bb=live.getBoundingClientRect();
  p.push("стиль b: fs="+bcs.fontSize+" pad контейнера="+getComputedStyle(live).paddingTop+" h="+Math.round(bb.height));
  p.push("серый круг .mp-tr-circle: "+(sec.querySelector(".mp-tr-circle")?"ЕСТЬ!":"убран ДА"));
  p.push("«Данные недоступны»: "+(t.indexOf("Данные недоступны")>=0||t.indexOf("недоступны")>=0?"ЕСТЬ!":"нет ДА"));
  var map=sec.querySelector(".mp-tr-map");
  if(map){var mb=map.getBoundingClientRect();p.push("карта: w="+Math.round(mb.width)+" h="+Math.round(mb.height)+" (h=140 моб/180 ПК)");}
  var upd=sec.querySelector(".mp-w-upd");
  p.push("штамп: "+(upd&&upd.textContent.indexOf("Обновлено:")===0?"ДА («"+upd.textContent.trim().slice(0,30)+"…»)":"НЕТ!"));
  var card=sec.getBoundingClientRect();
  p.push("правая граница: "+(bb.right<=card.right+1?"ДА":"НЕТ! "+Math.round(bb.right)+" vs "+Math.round(card.right)));
  return p.join(" | ");
})()
'

CHECK_OFF='
(function(){
  var p=[];
  var sec=document.querySelector("section.sakh-card[aria-label=\"Отключения\"]");
  if(!sec) return "ОШИБКА: панели «Отключения» нет";
  var a=sec.querySelector(".mp-paneltitle a");
  p.push("заголовок-ссылка: "+(a&&a.getAttribute("href")==="/disconnections.php"?"/disconnections.php ДА":"НЕТ! "+(a?a.getAttribute("href"):"нет")));
  var live=sec.querySelector(".mp-off-live");
  if(!live){
    var items=sec.querySelectorAll(".mp-off-item").length;
    return p.join(" | ")+" | живого текста нет (записей в базе: "+items+" — база не пуста, п.2 не проверяется)";
  }
  var t=live.textContent.replace(/\s+/g," ").trim();
  p.push("🟢: "+(t.indexOf("🟢")===0?"ДА":"НЕТ!"));
  p.push("текст ТЗ: "+(t.indexOf("На данный момент плановых отключений по Южно-Сахалинску не зафиксировано.")>=0?"ДА":"НЕТ! «"+t.slice(0,60)+"…»"));
  var m=t.match(/Проверено: (\d{2}\.\d{2}\.\d{4} \d{2}:\d{2})$/);
  p.push("«Проверено: dd.MM.yyyy HH:mm»: "+(m?"ДА («"+m[1]+"»":"НЕТ!"));
  p.push("зависшая надпись: "+(t.indexOf("Оперативных отключений не объявлено")>=0?"ЕСТЬ!":"убрана ДА"));
  var cs=getComputedStyle(live), bb=live.getBoundingClientRect();
  var card=sec.getBoundingClientRect();
  p.push("стиль: fs="+cs.fontSize+" line-h="+cs.lineHeight+" h="+Math.round(bb.height)+" | правая граница: "+(bb.right<=card.right+1?"ДА":"НЕТ!"));
  var inner=live.querySelector("span:last-child");
  var ics=inner?getComputedStyle(inner):cs;
  p.push("перенос: "+(ics.overflowWrap==="anywhere"||ics.wordBreak==="break-word"?"anywhere ДА":"НЕТ! "+ics.overflowWrap+"/"+ics.wordBreak));
  return p.join(" | ");
})()
'

CHECK_TAP='
(function(){
  var found=[], active=null;
  function scan(rules){
    for(var ri=0;ri<rules.length;ri++){
      var r=rules[ri], sel="";
      /* заходим внутрь @media/@supports; у обычных правил cssRules
         (nested CSS) пуст — тогда правило обрабатывается ниже */
      try{ if(r.cssRules && r.cssRules.length){ scan(r.cssRules); } }catch(e){}
      try{ sel=r.selectorText||""; }catch(e){}
      if(!sel||sel.indexOf("mp-paneltitle")<0) continue;
      if(found.indexOf(sel)<0) found.push(sel);
      if(sel.indexOf(":active")>=0){ active=r.cssText.slice(0,90); }
    }
  }
  for(var si=0;si<document.styleSheets.length;si++){
    try{ scan(document.styleSheets[si].cssRules); }catch(e){}
  }
  return "CSS-правила плашки: "+(found.length?found.join(", "):"НЕТ!")+(active?" | тап-отклик: "+active:" | тап-отклик :active: НЕТ!");
})()
'

CHECK_MEDIA480='
(function(){
  var live=document.querySelector(".mp-tr-live");
  if(!live) return "НЕТ строки балла";
  var bEl=live.querySelector("b");
  var cs=getComputedStyle(bEl||live);
  var off=document.querySelector(".mp-off-live");
  var inner=off?off.querySelector("span:last-child"):null;
  var ocs=inner?getComputedStyle(inner):null;
  var isMobile=window.innerWidth<=480;
  return "экран "+window.innerWidth+"px (мобайл "+(isMobile?"ДА":"нет")+"): балл b fs="+cs.fontSize+" (12px моб/13px ПК) pad контейнера="+getComputedStyle(live).paddingTop+" (5px моб/8px ПК)"+(ocs?" | отключения span fs="+ocs.fontSize+" перенос="+ocs.overflowWrap:" | .mp-off-live нет (база не пуста)");
})()
'

CHECK_HOME_REGR='
(function(){
  var p=[];
  var w=document.querySelector("section.sakh-card[aria-label=\"Погода на Сахалине\"] .mp-paneltitle a");
  p.push("погода: "+(w?w.getAttribute("href"):"НЕТ!"));
  var c=document.querySelector("section.sakh-card[aria-label=\"Курсы валют\"] .mp-paneltitle a");
  p.push("курсы: "+(c?c.getAttribute("href"):"НЕТ!"));
  var o=document.querySelector("section.sakh-card[aria-label=\"Отключения\"] .mp-paneltitle a");
  p.push("отключения: "+(o?o.getAttribute("href"):"НЕТ!"));
  var tr=document.querySelector("section.sakh-card[aria-label=\"Пробки\"] .mp-paneltitle a");
  p.push("пробки: "+(tr?tr.getAttribute("href"):"НЕТ!"));
  var bc=document.querySelectorAll("section.sakh-card[aria-label=\"Курсы валют\"] .bestcell").length;
  p.push("панель курсов: ячеек-лучших="+bc+" (10 = не тронута "+(bc===10?"ДА":"НЕТ!")+")");
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!":"нет"));
  return p.join(" | ");
})()
'

DESK_TR='
(function(){
  var live=document.querySelector(".mp-tr-live");
  if(!live) return "ПК: строки балла нет";
  var bcs=getComputedStyle(live.querySelector("b"));
  return "ПК эталон «Пробки»: строка fs="+bcs.fontSize+" (13px база) pad="+getComputedStyle(live).paddingTop+" (8px база)";
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
curl -s -o /dev/null -w "/ -> %{http_code}\n" --max-time 15 http://localhost:3000/
curl -s -o /dev/null -w "/traffic.php -> %{http_code} (цель ссылки плашки)\n" --max-time 15 http://localhost:3000/traffic.php
curl -s -o /dev/null -w "/disconnections.php -> %{http_code} (цель ссылки отключений)\n" --max-time 15 http://localhost:3000/disconnections.php

echo "======== МОБАЙЛ 400: главная ========"
open_view "http://localhost:3000/" "400 850"
agent-browser --session $S eval "$CHECK_PROBK" 2>/dev/null
agent-browser --session $S eval "$CHECK_OFF" 2>/dev/null
agent-browser --session $S eval "$CHECK_TAP" 2>/dev/null
agent-browser --session $S screenshot $OUT/in13-home-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/in13-home-400-$LBL.png"

echo "======== МОБАЙЛ 360 (стресс ТЗ 360-414) ========"
open_view "http://localhost:3000/" "360 740"
agent-browser --session $S eval "$CHECK_PROBK" 2>/dev/null
agent-browser --session $S eval "$CHECK_OFF" 2>/dev/null
agent-browser --session $S eval "$CHECK_MEDIA480" 2>/dev/null
agent-browser --session $S screenshot $OUT/in13-home-360-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/in13-home-360-$LBL.png"

echo "======== ДЕСКТОП 1280: главная (эталон, ПК не тронут) ========"
open_view "http://localhost:3000/" "1280 900"
agent-browser --session $S eval "$CHECK_HOME_REGR" 2>/dev/null
agent-browser --session $S eval "$CHECK_PROBK" 2>/dev/null
agent-browser --session $S eval "$DESK_TR" 2>/dev/null
agent-browser --session $S screenshot $OUT/in13-home-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/in13-home-1280-$LBL.png"

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
echo "Приёмка Задачи 13 ($LBL) завершена; сервер продолжает работать."
