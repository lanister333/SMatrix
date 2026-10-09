#!/bin/bash
# ЗАДАЧА 3 (Стадия 2): бэкенд информера «Валюты Сахалина» (/currency.php).
# 1) В UI нет ни одного упоминания ЦБ РФ (виджет ЦБ отсутствует — все
#    курсы только наличные касс банков). 2) Парсер собирает СТРОГО
#    четвёрку банков ТЗ: АТБ, Солид Банк, Сбер, Приморье (kovalut.ru,
#    страница города ЮС у каждого банка; Сбер сейчас не публикует —
#    строка с «—»). 3) Островная пятёрка в номиналах ТЗ: USD/EUR/CNY
#    за 1, JPY строго за 100, KRW строго за 1000. 4) Лучшие курсы
#    покупки/продажи подсвечены цветами ТЗ: фон #E2F0D9
#    (rgb(226, 240, 217)), текст #2E7D32 (rgb(46, 125, 50)).
# Регрессы: сетка З2-1 (1260/240/450/300), информеры З13, карточки З14,
#   футеры З2 (#004A8F), мобайл-заморозка ≤480, прокруток-X нет.
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

S=t3
agent-browser --session $S close >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1

# ===== API: /api/home/rates — четвёрка ТЗ, порядок ТЗ, номиналы ТЗ =====
echo "======== API /api/home/rates ========"
curl -s --max-time 90 "http://localhost:3000/api/home/rates" -o /tmp/t3-rates.json
echo "HTTP: $(curl -s -o /dev/null -w "%{http_code}" --max-time 90 http://localhost:3000/api/home/rates)"
bun -e '
const d = await Bun.file("/tmp/t3-rates.json").json();
const TZ = ["АТБ", "Солид Банк", "Сбер", "Приморье"];
const names = d.banks.map(b => b.bank);
console.log("  source=" + d.source + " updated=" + d.updated);
console.log("  банки: " + names.join(" | ") + " (" + (names.every(n => TZ.includes(n)) ? "только четвёрка ТЗ ДА" : "НЕТ!") + ")");
console.log("  порядок ТЗ: " + (JSON.stringify(names) === JSON.stringify(TZ) ? "АТБ|Солид Банк|Сбер|Приморье ДА" : "НЕТ! " + names.join(",")));
const jpy = d.banks.flatMap(b => b.jpy ? [b.jpy] : []).flat();
const krw = d.banks.flatMap(b => b.krw ? [b.krw] : []).flat();
const usd = d.banks.flatMap(b => b.usd ? [b.usd] : []).flat();
const cny = d.banks.flatMap(b => b.cny ? [b.cny] : []).flat();
console.log("  JPY за 100: " + (jpy.length === 0 || jpy.every(p => (p.buy ?? 0) > 5 && (p.sell ?? 0) > 5) ? "номинал ДА (" + jpy.length + " банк(ов))" : "НЕТ! " + JSON.stringify(jpy)));
console.log("  KRW за 1000: " + (krw.length === 0 || krw.every(p => (p.buy ?? 0) > 5 && (p.sell ?? 0) > 5) ? "номинал ДА (" + krw.length + ")" : "НЕТ! " + JSON.stringify(krw)));
console.log("  USD есть: " + (usd.length >= 1 ? "ДА (" + usd.length + ")" : "НЕТ!") + " | CNY есть: " + (cny.length >= 1 ? "ДА (" + cny.length + ")" : "нет публикации"));
'

# ===== Панель «Курсы валют» на Главной: островная пятёрка + цвета ТЗ =====
CURPANEL='
(function(){
  var p=[];
  var tbl=document.querySelector(".mp-rt-best");
  if(!tbl) return "ОШИБКА: .mp-rt-best нет";
  var rows=[].slice.call(tbl.querySelectorAll("tbody tr"));
  p.push("строк валют: "+rows.length+" ("+(rows.length===5?"пятёрка ДА":"НЕТ!")+")");
  var names=rows.map(function(r){return (r.querySelector("th")||{}).textContent||"";});
  p.push("номиналы: "+(names[3]&&names[3].indexOf("за 100")>=0&&names[4]&&names[4].indexOf("за 1000")>=0?"иена за 100 / вона за 1000 ДА":"НЕТ!"));
  var cells=[].slice.call(tbl.querySelectorAll("td.bestcell"));
  p.push("ячеек лучших: "+cells.length+" ("+(cells.length===10?"10 ДА":"НЕТ!")+")");
  var bg=cells.length?getComputedStyle(cells[0]).backgroundColor:"";
  var b=cells[0]?cells[0].querySelector("b"):null;
  var bcol=b?getComputedStyle(b).color:"";
  p.push("фон ячейки="+bg+" ("+(bg==="rgb(226, 240, 217)"?"#E2F0D9 ДА":"НЕТ!")+")");
  p.push("цвет курса="+bcol+" ("+(bcol==="rgb(46, 125, 50)"?"#2E7D32 ДА":"НЕТ!")+")");
  var banks=[].slice.call(tbl.querySelectorAll("td.bestcell i")).map(function(e){return e.textContent.trim();});
  var TZ=["АТБ","Солид Банк","Сбер","Приморье","—"];
  var onlyTZ=banks.every(function(x){return TZ.indexOf(x)>=0;});
  p.push("банки в ячейках: "+banks.slice(0,4).join(",")+"… ("+(onlyTZ?"только ТЗ/«—» ДА":"НЕТ!")+")");
  var upd=document.querySelector(".mp-rates .mp-w-upd");
  p.push("штамп: "+(upd&&upd.textContent.indexOf("kovalut.ru")>=0?"kovalut.ru ДА":"НЕТ!"));
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  return p.join(" | ");
})()
'

# ===== Нет ЦБ РФ ни в одном тексте страницы =====
NOCB='
(function(){
  var t=document.body.innerText||"";
  var hit=t.indexOf("ЦБ");
  return "вхождений «ЦБ» в тексте страницы: "+(hit<0?"0 — виджет ЦБ РФ отсутствует ДА":"ЕСТЬ на позиции "+hit+": «"+t.slice(Math.max(0,hit-30),hit+30)+"»");
})()
'

# ===== Регресс: сетка З2-1 + информеры З13 + карточки З14 (как в задаче 2) =====
HOMEREGRESS='
(function(){
  var p=[];
  var c=document.querySelector(".sk-layout.main-grid-container");
  if(!c) return "ОШИБКА: .main-grid-container нет";
  var cs=getComputedStyle(c);
  p.push("сетка З2-1: "+(cs.display==="flex"&&cs.maxWidth==="1260px"?"flex/1260 ДА":"НЕТ!"));
  var tr=[].slice.call(document.querySelectorAll(".mp-tr-live b"));
  p.push("пробки З13 живы: "+(tr.length?"ДА":"НЕТ!"));
  var card=document.querySelector(".sakh-card");
  if(card){var cs2=getComputedStyle(card);
    p.push("карточки З14: "+(cs2.backgroundColor==="rgb(255, 255, 255)"?"белые ДА":"НЕТ!"));}
  return p.join(" | ");
})()
'

# ===== /currency.php: таблица — 4 банка ТЗ в порядке ТЗ + цвета =====
CRT='
(function(){
  var p=[];
  var tbl=document.querySelector(".crt-table");
  if(!tbl) return "ОШИБКА: .crt-table нет (обнова: "+(document.querySelector(".crt-empty")||{}).textContent+")";
  var firstTh=tbl.querySelector("thead th");
  var heads=[].slice.call(tbl.querySelectorAll("thead th b")).map(function(e){return e.textContent.trim();});
  p.push("колонки: "+((firstTh&&firstTh.textContent.trim()==="Банк")?"Банк|":"")+heads.join("|")+" ("+((firstTh&&firstTh.textContent.trim()==="Банк")&&heads.join("|")==="USD|EUR|CNY|JPY|KRW"?"пятёрка ТЗ ДА":"НЕТ!")+")");
  var units=[].slice.call(tbl.querySelectorAll("thead th small")).map(function(e){return e.textContent.trim();});
  p.push("номиналы: "+(units[3]&&units[3].indexOf("за 100")>=0&&units[4]&&units[4].indexOf("за 1000")>=0?"JPY за 100 / KRW за 1000 ДА":"НЕТ!"));
  var banks=[].slice.call(tbl.querySelectorAll("tbody th")).map(function(e){return e.textContent.trim();});
  p.push("банки: "+banks.join(" | ")+" ("+(JSON.stringify(banks)===JSON.stringify(["АТБ","Солид Банк","Сбер","Приморье"])?"порядок ТЗ ДА":"НЕТ!")+")");
  var best=[].slice.call(tbl.querySelectorAll("td.is-best"));
  p.push("подсвеченных ячеек: "+best.length+" ("+(best.length>=6?"есть у нескольких валют ДА":"мало!")+")");
  if(best.length){var cs=getComputedStyle(best[0]);
    p.push("фон="+cs.backgroundColor+" ("+(cs.backgroundColor==="rgb(226, 240, 217)"?"#E2F0D9 ДА":"НЕТ!")+")");
    var b=best[0].querySelector("b");
    p.push("текст="+(b?getComputedStyle(b).color:"—")+" ("+(b&&getComputedStyle(b).color==="rgb(46, 125, 50)"?"#2E7D32 ДА":"НЕТ!")+")");}
  var leg=document.querySelector(".crt-legend");
  p.push("легенда: "+(leg&&leg.textContent.indexOf("#E2F0D9")>=0?"обновлена ДА":"НЕТ!"));
  var upd=document.querySelector(".crt-body .mp-w-upd");
  p.push("штамп: "+(upd&&upd.textContent.indexOf("kovalut.ru")>=0?"ДА":"НЕТ!"));
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  return p.join(" | ");
})()
'

# ===== Мобайл 400: панель курсов без вылетов + цвета на месте =====
MOB3='
(function(){
  var p=[];
  var tbl=document.querySelector(".mp-rt-best");
  if(tbl){
    var cells=[].slice.call(tbl.querySelectorAll("td.bestcell"));
    var bg=cells.length?getComputedStyle(cells[0]).backgroundColor:"";
    p.push("фон ячейки="+bg+" ("+(bg==="rgb(226, 240, 217)"?"#E2F0D9 ДА":"НЕТ!")+")");
    var rows=[].slice.call(tbl.querySelectorAll("tbody tr"));
    p.push("строк: "+rows.length+" ("+(rows.length===5?"ДА":"НЕТ!")+")");
  }
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

echo "======== ДЕСКТОП 1280: панель «Курсы валют» Главной ========"
open_view "http://localhost:3000/" "1280 900"
agent-browser --session $S eval "$CURPANEL" 2>/dev/null
agent-browser --session $S eval "$NOCB" 2>/dev/null
agent-browser --session $S eval "$HOMEREGRESS" 2>/dev/null
agent-browser --session $S screenshot $OUT/t3-home-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/t3-home-1280-$LBL.png"

echo "======== ДЕСКТОП 1280: /currency.php — таблица банков ТЗ ========"
open_view "http://localhost:3000/currency.php" "1280 900"
agent-browser --session $S eval "$CRT" 2>/dev/null
agent-browser --session $S eval "$NOCB" 2>/dev/null
agent-browser --session $S screenshot $OUT/t3-currency-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/t3-currency-1280-$LBL.png"

echo "======== ДЕСКТОП 1366 (16:9): панель курсов ========"
open_view "http://localhost:3000/" "1366 768"
agent-browser --session $S eval "$CURPANEL" 2>/dev/null

echo "======== МОБАЙЛ 400: панель курсов + /currency.php ========"
open_view "http://localhost:3000/" "400 850"
agent-browser --session $S eval "$MOB3" 2>/dev/null
agent-browser --session $S screenshot $OUT/t3-home-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/t3-home-400-$LBL.png"
open_view "http://localhost:3000/currency.php" "400 850"
agent-browser --session $S eval "$NOCB" 2>/dev/null
agent-browser --session $S screenshot $OUT/t3-currency-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/t3-currency-400-$LBL.png"

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
echo "Приёмка Задачи 3 ($LBL) завершена; сервер продолжает работать."
