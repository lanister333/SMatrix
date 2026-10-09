#!/bin/bash
# Шаг 6: островная пятёрка валют (USD/EUR/CNY/JPY за 100/KRW за 1000) в
# панели «Курсы валют», мобильная плотность (шапка 11px серая, плотные
# однострочные ряды), заголовок-плашка — ссылка на /currency.php.
# Мобайл 400/320 + десктоп 1280 эталон. Параметр: $1 — метка скриншотов.
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

S=w6
agent-browser --session $S close >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1

CHECK_RATES='
(function(){
  var p=[];
  var sec=document.querySelector("section.sakh-card[aria-label=\"Курсы валют\"]");
  if(!sec) return "ОШИБКА: панель «Курсы валют» не найдена";
  var link=sec.querySelector(".mp-paneltitle a");
  if(!link) return "ОШИБКА: заголовок «Курсы валют» не является ссылкой";
  var lcs=getComputedStyle(link);
  p.push("ссылка: href="+link.getAttribute("href")+" цвет="+lcs.color+" подч.="+lcs.textDecorationLine+" шрифт="+lcs.fontSize+"/"+lcs.fontWeight);
  var t=sec.querySelector("table.mp-rt-table");
  if(!t) return p.join(" | ")+" | ОШИБКА: таблицы курсов нет";
  var rows=t.querySelectorAll("tbody tr");
  var codes=[];
  for (var i=0;i<rows.length;i++){codes.push(rows[i].querySelector("th").textContent.replace(/\s+/g," ").trim());}
  p.push("строк валют: "+rows.length+" ["+codes.join("; ")+"]");
  var th0=t.querySelector("thead th");
  var hcs=getComputedStyle(th0);
  p.push("шапка: fs="+hcs.fontSize+" цвет="+hcs.color+" (серая="+(hcs.color==="rgb(86, 101, 122)")+")");
  var names=t.querySelector("thead").textContent.replace(/\s+/g," ").trim();
  p.push("шапка текст: "+names);
  var b=t.querySelector("td.bestcell b"), ii=t.querySelector("td.bestcell i");
  var bcs=b?getComputedStyle(b):null, ics=ii?getComputedStyle(ii):null;
  p.push("ячейка: b="+(bcs?bcs.display:"—")+" i="+(ics?ics.display:"—")+" (одна строка="+((bcs&&bcs.display==="inline"&&ics&&ics.display==="inline")?"ДА":"НЕТ!")+")");
  var hmax=0;
  rows.forEach(function(r){hmax=Math.max(hmax,r.getBoundingClientRect().height);});
  p.push("высота ряда max="+Math.round(hmax)+"px (плотный="+(hmax<=21?"ДА":"НЕТ!")+")");
  var small=t.querySelector("tbody th small");
  p.push("номинал: "+(small?small.textContent+" fs="+getComputedStyle(small).fontSize:"НЕТ!"));
  var body=t.querySelector("tbody").textContent;
  p.push("иена/вона с данными: "+(/Иена/.test(body)&&/54|53|55/.test(body)?"иена ДА":"иена ?")+"/"+(/Вона/.test(body)&&/64|63|65/.test(body)?"вона ДА":"вона ?"));
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  p.push("карточка за рамкой: "+(sec.getBoundingClientRect().right>window.innerWidth+1?"ДА!":"нет"));
  return p.join(" | ");
})()
'

CHECK_WREGRESS='
(function(){
  var sec=document.querySelector("section.sakh-card[aria-label=\"Погода на Сахалине\"]");
  if(!sec) return "ОШИБКА: погодной панели нет";
  var link=sec.querySelector(".mp-paneltitle a");
  var frame=sec.querySelector(".mp-w-frame");
  return "погода (регресс): ссылка="+(link?link.getAttribute("href"):"НЕТ!")+" виджет="+(frame?frame.clientWidth+"px":"НЕТ!");
})()
'

CPHP='
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

DESK_RATES='
(function(){
  var p=[];
  var sec=document.querySelector("section.sakh-card[aria-label=\"Курсы валют\"]");
  if(!sec) return "ОШИБКА: панели нет";
  var link=sec.querySelector(".mp-paneltitle a");
  var lcs=link?getComputedStyle(link):null;
  p.push("ПК-плашка: ссылка="+(link?link.getAttribute("href"):"НЕТ")+" цвет="+(lcs?lcs.color:"—")+" подч.="+(lcs?lcs.textDecorationLine:"—")+" шрифт="+(lcs?lcs.fontSize:"—"));
  var t=sec.querySelector("table.mp-rt-table");
  var rows=t?t.querySelectorAll("tbody tr").length:0;
  var th0=t?t.querySelector("thead th"):null;
  var hcs=th0?getComputedStyle(th0):null;
  var b=t?t.querySelector("td.bestcell b"):null;
  var i=t?t.querySelector("td.bestcell i"):null;
  p.push("ПК-таблица: строк="+rows+" шапка fs="+(hcs?hcs.fontSize:"—")+" b="+(b?getComputedStyle(b).display:"—")+" i="+(i?getComputedStyle(i).display:"—")+" (стопка ПК="+((b&&getComputedStyle(b).display==="block")?"ДА":"НЕТ!")+")");
  var body=t?t.querySelector("tbody").textContent.replace(/\s+/g," "):"";
  p.push("пятёрка на ПК: "+(["Доллар","Евро","Юань","Иена","Вона"].every(function(n){return body.indexOf(n)>-1})?"все 5 ДА":"НЕТ!"));
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

echo "======== API /api/home/rates (островная пятёрка) ========"
curl -s --max-time 30 http://localhost:3000/api/home/rates | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    banks=d.get('banks',[])
    jpy=[b for b in banks if b.get('jpy')]
    krw=[b for b in banks if b.get('krw')]
    print('source:',d.get('source'),'| updated:',d.get('updated'),'| банков:',len(banks))
    print('JPY:', jpy[0]['bank'] if jpy else 'НЕТ', jpy[0]['jpy'] if jpy else '')
    print('KRW:', krw[0]['bank'] if krw else 'НЕТ', krw[0]['krw'] if krw else '')
    print('пятёрка в API:','ДА' if jpy and krw else 'НЕТ!')
except Exception as e:
    print('ОШИБКА API:', e)
"

echo "======== МОБАЙЛ 400: главная (курсы) ========"
open_view "http://localhost:3000/" "400 850"
agent-browser --session $S eval "$CHECK_RATES" 2>/dev/null
agent-browser --session $S eval "$CHECK_WREGRESS" 2>/dev/null
agent-browser --session $S screenshot $OUT/currency6-home-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/currency6-home-400-$LBL.png"

echo "======== МОБАЙЛ 320: главная (стресс) ========"
open_view "http://localhost:3000/" "320 700"
agent-browser --session $S eval "$CHECK_RATES" 2>/dev/null
agent-browser --session $S screenshot $OUT/currency6-home-320-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/currency6-home-320-$LBL.png"

echo "======== МОБАЙЛ 400: /currency.php (заглушка) ========"
cphpcode=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 http://localhost:3000/currency.php)
echo "HTTP /currency.php: $cphpcode"
open_view "http://localhost:3000/currency.php" "400 850"
agent-browser --session $S eval "$CPHP" 2>/dev/null
agent-browser --session $S screenshot $OUT/currency6-cphp-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/currency6-cphp-400-$LBL.png"

echo "======== ДЕСКТОП 1280: главная (эталон) ========"
open_view "http://localhost:3000/" "1280 900"
agent-browser --session $S eval "$DESK_RATES" 2>/dev/null
agent-browser --session $S eval "$CHECK_WREGRESS" 2>/dev/null
agent-browser --session $S screenshot $OUT/currency6-home-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/currency6-home-1280-$LBL.png"

echo "======== ДЕСКТОП 1280: форум (эталон тулбара) ========"
open_view "http://localhost:3000/?view=forum" "1280 900"
agent-browser --session $S eval "$DESK_TB" 2>/dev/null

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
echo "Приёмка Шага 6 ($LBL) завершена; сервер продолжает работать."
