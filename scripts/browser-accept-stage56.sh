#!/bin/bash
# СТАДИЯ 2 (доработка Шагов 5-6): браузерная приёмка.
# Шаг 5: на мобиле ≤480px дни прогноза — плотный вертикальный список
#        (.mp-wv-list), виджет meteoblue скрыт, рамка не ломается.
# Шаг 6: таблица курсов — колонки «Покупка»/«Продажа» + лучший банк,
#        источник kovalut.ru, ЦБ РФ отсутствует; на мобиле максимально
#        плотная. Десктоп: виджет и новая таблица, ЦБ РФ нет.
# Сервер и браузер живут в пределах одного вызова (среда не сохраняет
# фоновые процессы между вызовами Bash).
cd /home/z/my-project || exit 1
OUT=download/screens
mkdir -p $OUT

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
sleep 2
setsid nohup bun run dev > /tmp/sakh-dev-accept56.log 2>&1 < /dev/null &
up=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then up=1; break; fi
  sleep 1
done
[ "$up" = "1" ] && echo "сервер готов (попытка $i)" || { echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; tail -20 /tmp/sakh-dev-accept56.log; exit 2; }

echo "== API: курсы и погода =="
curl -s --max-time 8 http://localhost:3000/api/home/rates | head -c 400; echo
curl -s --max-time 8 http://localhost:3000/api/home/weather | python3 -c "import json,sys; d=json.load(sys.stdin); print('weather:', d.get('source'), '| temp', d.get('temp'), '| дней:', len(d.get('days',[])), '| первый:', d.get('days',[{}])[0])"

S=s35d
agent-browser --session $S close >/dev/null 2>&1
agent-browser --session $S set viewport 1280 900 >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 5000 >/dev/null 2>&1

echo "== ДЕСКТОП 1280: Шаг 5 погода =="
agent-browser --session $S eval '
var wf=document.querySelector(".mp-w-frame");
var vl=document.querySelector(".mp-wv-list");
"iframe виджет: "+(wf?getComputedStyle(wf).display:"absent")+" | верт.список на ПК: "+(vl?getComputedStyle(vl).display:"absent")+" (ожидалось block/none)"
' 2>/dev/null

echo "== ДЕСКТОП 1280: Шаг 6 курсы =="
agent-browser --session $S eval '
var t=document.querySelector(".mp-rt-best");
var out=[];
out.push("таблица «лучшая пара»: "+(t?"есть":"НЕТ"));
if(t){
  out.push("шапка: "+t.querySelector("thead").innerText.replace(/\s+/g," "));
  Array.from(t.querySelectorAll("tbody tr")).forEach(function(tr){
    out.push("  "+tr.innerText.replace(/\s+/g," ").trim());
  });
}
out.push("ЦБ РФ на панели: "+(document.querySelector(".mp-rt-cbr,.mp-crow")?"ОСТАЛСЯ!":"нет (убран)"));
out.push("подпись: "+(document.querySelector(".mp-rates .mp-w-upd")||{innerText:"-"}).innerText);
out.join("\n")
' 2>/dev/null

echo "== Десктоп: эталонные стили не изменились (СТАДИЯ 1) =="
agent-browser --session $S eval '
var nav=document.querySelector(".sm-mainnav");
var mh=document.querySelector(".sm-mh-wrap");
var cs=getComputedStyle(nav||document.body);
var pt=document.querySelector(".mp-paneltitle");
"nav display="+cs.display+" | paneltitle padding="+getComputedStyle(pt).padding+" | шапка высота="+(mh?mh.getBoundingClientRect().height:"?")
' 2>/dev/null

echo "== Десктоп: скриншот правой колонки =="
agent-browser --session $S eval 'var el=document.querySelector(".mp-right"); if(el) el.scrollIntoView({block:"start"}); "scrolled"' >/dev/null 2>&1
agent-browser --session $S wait 2500 >/dev/null 2>&1
agent-browser --session $S screenshot $OUT/stage56-desktop-right.png >/dev/null 2>&1

echo "== МОБАЙЛ 400px: Шаг 5 погода =="
agent-browser --session $S set viewport 400 800 >/dev/null 2>&1
agent-browser --session $S wait 3000 >/dev/null 2>&1
agent-browser --session $S eval '
var wf=document.querySelector(".mp-w-frame");
var vl=document.querySelector(".mp-wv-list");
var out=[];
out.push("iframe на мобиле: "+(wf?getComputedStyle(wf).display:"absent")+" (ожидалось none)");
out.push("вертикальный список: "+(vl?getComputedStyle(vl).display:"absent")+" (ожидалось block)");
if(vl){
  var card=document.querySelector(".sakh-card");
  var lis=Array.from(vl.querySelectorAll("li"));
  out.push("строк прогноза: "+lis.length+" (Сейчас + 7 дней)");
  out.push("ширина списка "+vl.getBoundingClientRect().width.toFixed(0)+"px ≤ рамки "+(card?card.getBoundingClientRect().width.toFixed(0):"?")+"px");
  out.push("переполнение строк: "+(lis.every(function(li){return li.scrollWidth<=li.clientWidth+1})?"нет":"ЕСТЬ!"));
  out.push("1-я строка: "+(lis[0]?lis[0].innerText.replace(/\s+/g," ").trim():"-"));
  out.push("2-я строка: "+(lis[1]?lis[1].innerText.replace(/\s+/g," ").trim():"-"));
  out.push("последняя: "+(lis[lis.length-1]?lis[lis.length-1].innerText.replace(/\s+/g," ").trim():"-"));
}
out.join("\n")
' 2>/dev/null

echo "== МОБАЙЛ 400px: Шаг 6 плотная таблица =="
agent-browser --session $S eval '
var t=document.querySelector(".mp-rt-best");
var out=[];
if(t){
  var td=t.querySelector("td");
  var th=t.querySelector("thead th");
  var bank=t.querySelector("td.bestcell i");
  var card=t.closest(".sakh-card");
  out.push("таблица в границах рамки: "+(t.scrollWidth<=t.clientWidth+1)+" (scrollWidth="+t.scrollWidth+", client="+t.clientWidth+")");
  out.push("шапка: "+t.querySelector("thead").innerText.replace(/\s+/g," "));
  Array.from(t.querySelectorAll("tbody tr")).forEach(function(tr){
    out.push("  "+tr.innerText.replace(/\s+/g," ").trim());
  });
  out.push("шрифт ячеек: "+getComputedStyle(td).fontSize+" | паддинг: "+getComputedStyle(td).padding);
  out.push("шрифт шапки: "+getComputedStyle(th).fontSize);
  out.push("шрифт банка: "+(bank?getComputedStyle(bank).fontSize:"-"));
  out.push("ширина таблицы "+t.getBoundingClientRect().width.toFixed(0)+"px ≤ рамки "+(card?card.getBoundingClientRect().width.toFixed(0):"?")+"px");
}else{ out.push("таблица НЕТ"); }
out.join("\n")
' 2>/dev/null

echo "== МОБАЙЛ 400px: нет горизонтального скролла + шторка =="
agent-browser --session $S eval '
var sw=document.documentElement.scrollWidth, cw=document.documentElement.clientWidth;
var burg=document.querySelector(".sm-mh-burger");
"scrollWidth="+sw+" clientWidth="+cw+" (рамки не ломаются: "+(sw<=cw)+") | бургер: "+(burg?getComputedStyle(burg).display:"?")
' 2>/dev/null

echo "== Скриншоты мобайл =="
agent-browser --session $S eval 'var el=document.querySelector(".mp-panel.sakh-card"); if(el) el.scrollIntoView({block:"start"}); "scrolled"' >/dev/null 2>&1
agent-browser --session $S wait 2000 >/dev/null 2>&1
agent-browser --session $S screenshot $OUT/stage56-mobile-weather.png >/dev/null 2>&1
agent-browser --session $S eval 'var els=document.querySelectorAll(".mp-panel.sakh-card"); if(els[1]) els[1].scrollIntoView({block:"start"}); "scrolled"' >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1
agent-browser --session $S screenshot $OUT/stage56-mobile-rates.png >/dev/null 2>&1

echo "== Консоль =="
agent-browser --session $S errors 2>/dev/null | head -5
agent-browser --session $S console 2>/dev/null | grep -iE "error" | head -5 || echo "(ошибок в консоли нет)"
agent-browser --session $S close >/dev/null 2>&1

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
echo "приёмка завершена"
