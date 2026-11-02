#!/bin/bash
# Шаг №7.5: полная страница /disconnections.php — каркас (бирюзовая шапка,
# логотип-ссылка, компактное мобильное меню), верхняя карточка: возврат +
# горизонтальный скролл-ряд районного фильтра (5 городов, фильтрация без
# перезагрузки); весь массив парсеров в трёх блоках «⚡ Электроэнергия» /
# «💧 Горячая вода и Тепло» / «🚰 Холодная вода» (адреса 12px, перенос без
# поломки правой границы .sakh-card); внизу «Телефоны диспетчерских служб»
# (ФРС 782-782, СКК 72-30-13, РВК 72-32-40) крупными tel:-ссылками.
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

# первый сбор планировщика — через 20с после старта; ждём, чтобы он не
# затёр приёмочную фикстуру (живой парсер затрёт её следующим циклом ≤30 мин)
sleep 26

# ПРИЁМОЧНАЯ ФИКСТУРА db/outages.json: 8 записей, 3 источника, 5 районов
# (Южно-Сахалинск — записи без явного города, умолчание таксономии).
# Блоки: электро=3, ГВС/тепло(СКК)=2, холодная(Водоканал)=3.
python3 - <<'PYEOF'
import json
items = [
  {"source":"Сахалинэнерго","title":"Плановое отключение электроэнергии","url":"https://sakhalinenergo.ru/news/ysk-16-sept","addresses":["ул. Сахалинская, 45, 47; ул. Ленина, 210 — плановые работы в сетях","мкр. Дальнее, 4 — замена трансформатора ТП-14"],"when":"с 09:00 до 17:00","publishedAt":"2026-09-16T04:00:00.000Z","fetchedAt":"2026-09-16T04:00:00.000Z"},
  {"source":"СКК","title":"Ограничение горячего водоснабжения","url":"https://skk65.ru/ogranichenie-gvs","addresses":["ул. Пуркаева, 17, 19 — ограничение горячего водоснабжения (опрессовка)"],"when":"с 08:30 до 20:00","publishedAt":"2026-09-16T03:30:00.000Z","fetchedAt":"2026-09-16T04:00:00.000Z"},
  {"source":"Водоканал","title":"Аварийные работы на водоводе","url":"https://example-vodokanal.ru/avaria-vodovod","addresses":["проспект Мира, 108 — перебои холодного водоснабжения","ул. Пономарёва-Ключевская-Новоалександровская-2-я, д. 12 корпус 2 (внутриквартальный проезд)"],"when":"с 08:00 до 19:00","publishedAt":"2026-09-16T03:00:00.000Z","fetchedAt":"2026-09-16T04:00:00.000Z"},
  {"source":"Сахалинэнерго","title":"Отключение в Корсакове","url":"https://sakhalinenergo.ru/news/korsakov-16","addresses":["г. Корсаков, ул. Северная, 5 — плановые работы"],"when":"с 10:00 до 15:00","publishedAt":"2026-09-16T02:30:00.000Z","fetchedAt":"2026-09-16T04:00:00.000Z"},
  {"source":"СКК","title":"Опрессовка теплосети (Холмск)","url":"https://skk65.ru/holmsk-opressovka","addresses":["г. Холмск, ул. Советская, 31 — ограничение теплоснабжения"],"when":"с 09:00 до 18:00","publishedAt":"2026-09-16T02:00:00.000Z","fetchedAt":"2026-09-16T04:00:00.000Z"},
  {"source":"Водоканал","title":"Ремонт водовода (Анива)","url":"https://example-vodokanal.ru/aniva-remont","addresses":["г. Анива, ул. Ленина, 61 — ремонт водовода"],"when":"с 09:30 до 17:30","publishedAt":"2026-09-16T01:30:00.000Z","fetchedAt":"2026-09-16T04:00:00.000Z"},
  {"source":"Сахалинэнерго","title":"Отключение в Охе","url":"https://sakhalinenergo.ru/news/okha-16","addresses":["г. Оха, ул. Приморская, 12 — плановые работы в сетях"],"when":"с 11:00 до 16:00","publishedAt":"2026-09-16T01:00:00.000Z","fetchedAt":"2026-09-16T04:00:00.000Z"},
  {"source":"Водоканал","title":"Плановое отключение (Корсаков)","url":"https://example-vodokanal.ru/korsakov-plan","addresses":["г. Корсаков, проспект Победы, 8 — замена запорной арматуры"],"when":"с 12:00 до 18:00","publishedAt":"2026-09-16T00:30:00.000Z","fetchedAt":"2026-09-16T04:00:00.000Z"}
]
data = {"updated":"2026-09-16T04:00:00.000Z","items":items,"errors":[]}
json.dump(data, open("db/outages.json","w",encoding="utf-8"), ensure_ascii=False, indent=2)
print("фикстура db/outages.json: 8 записей (электро=3, СКК=2, Водоканал=3; ЮС/Корсаков/Холмск/Анива/Оха)")
PYEOF

S=dis75
agent-browser --session $S close >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1

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
  var back=document.querySelector("a.dis-back");
  if(!back) return "ОШИБКА: кнопки возврата нет";
  var bcs=getComputedStyle(back), bb=back.getBoundingClientRect();
  var card1=document.querySelector("section.mp-panel.sakh-card");
  var inTop=back.getBoundingClientRect().top < card1.getBoundingClientRect().bottom;
  p.push("возврат: href="+back.getAttribute("href")+" текст="+(back.textContent.replace(/\s+/g," ").trim()==="← Вернуться на Главную"?"точно ДА":"НЕТ!")+" mt="+bcs.marginTop+" (0px ДА="+(bcs.marginTop==="0px"?"ДА":"НЕТ!")+") bg="+bcs.backgroundColor+" цвет="+(bcs.color==="rgb(255, 255, 255)"?"белый ДА":"НЕТ! "+bcs.color)+" подч.="+bcs.textDecorationLine+" h="+Math.round(bb.height)+" в верхней карточке="+(inTop?"ДА":"НЕТ!"));
  var chips=[].slice.call(document.querySelectorAll(".dis-chip"));
  p.push("чипы: "+chips.length+" («"+chips.map(function(c){return c.textContent.trim();}).join(", ")+"» = ТЗ "+(chips.map(function(c){return c.textContent.trim();}).join("|")==="Южно-Сахалинск|Корсаков|Холмск|Анива|Оха"?"ДА":"НЕТ!")+")");
  var f=document.querySelector(".dis-filters");
  if(f)p.push("фильтр-ряд: overflow-x="+getComputedStyle(f).overflowX+" (auto = скролл-ряд)");
  var blocks=["⚡ Электроэнергия","💧 Горячая вода и Тепло","🚰 Холодная вода"];
  var cnt=[];
  for (var i=0;i<blocks.length;i++){
    var sec=document.querySelector("section.sakh-card[aria-label=\""+blocks[i]+"\"]");
    if(!sec){cnt.push(blocks[i]+"=НЕТ!");continue;}
    cnt.push(blocks[i]+"="+sec.querySelectorAll(".dis-item").length);
    if(i===0){
      var li=sec.querySelector(".dis-addr li");
      if(li){var lc=getComputedStyle(li);
        p.push("адрес: fs="+lc.fontSize+" (12px="+(lc.fontSize==="12px"?"ДА":"НЕТ!")+") перенос="+(lc.overflowWrap==="anywhere"?"ДА":"НЕТ!"));
        var cr=li.getBoundingClientRect().right, sr=sec.getBoundingClientRect().right;
        p.push("адрес держит правую границу .sakh-card: "+(cr<=sr+1?"ДА":"НЕТ! ("+Math.round(cr)+" vs "+Math.round(sr)+")"));}
      var it1=sec.querySelector(".dis-item");
      if(it1){var ic=getComputedStyle(it1);p.push("item pad="+ic.paddingTop+" "+ic.paddingLeft+" title fs="+getComputedStyle(sec.querySelector(".dis-title")).fontSize);}
      var wh=sec.querySelector(".dis-when");
      if(wh)p.push("when fs="+getComputedStyle(wh).fontSize);
    }
    if(i===1){
      var ph=[].slice.call(document.querySelectorAll("a.dis-phone"));
      p.push("телефоны: "+ph.length+" hrefs="+ph.map(function(a){return a.getAttribute("href");}).join(",")+" (782-782/72-30-13/72-32-40 = ДА)");
      if(ph[0]){var pc=getComputedStyle(ph[0]);
        p.push("tel-кнопка: h="+Math.round(ph[0].getBoundingClientRect().height)+" (≥44px="+(ph[0].getBoundingClientRect().height>=44?"ДА":"НЕТ!")+") bg="+pc.backgroundColor+" цвет="+(pc.color==="rgb(255, 255, 255)"?"белый ДА":"НЕТ!")+" текст="+(ph[0].textContent.replace(/\s+/g," ").trim()==="ФРС — 782-782"?"ДА":"НЕТ!"));}
      var phc=sec.parentNode.querySelector(".dis-phones")||document.querySelector(".dis-phones");
      if(phc){var pcs=getComputedStyle(phc);p.push("phones: pad="+pcs.paddingTop+" gap="+pcs.rowGap+" (6px)");}
    }
  }
  p.push("записей по блокам: "+cnt.join(" | ")+" (ожидали электро=3 | ГВС=2 | холодная=3)");
  var upd=document.querySelector(".dis-upd");
  p.push("«Обновлено:»: "+(upd?"есть":"НЕТ!"));
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  return p.join(" | ");
})()
'

FILTER_CLICK='
(function(){
  var chips=[].slice.call(document.querySelectorAll(".dis-chip"));
  var kors=chips.filter(function(c){return c.textContent.trim()==="Корсаков";})[0];
  if(!kors) return "ОШИБКА: чип «Корсаков» не найден";
  kors.click();
  return "клик по «Корсаков»";
})()
'

FILTER_CHECK='
(function(){
  var p=[];
  var chips=[].slice.call(document.querySelectorAll(".dis-chip"));
  var act=chips.filter(function(c){return c.className.indexOf("active")>-1;});
  p.push("активный чип: "+(act.length===1&&act[0].textContent.trim()==="Корсаков"?"Корсаков ДА":"НЕТ!"));
  if(act[0]){var acs=getComputedStyle(act[0]);p.push("актив: bg="+acs.backgroundColor+" (navy ДА="+(acs.backgroundColor==="rgb(30, 58, 95)"?"ДА":"НЕТ!")+") цвет="+(acs.color==="rgb(255, 255, 255)"?"белый ДА":"НЕТ!"));}
  function cnt(label){var sec=document.querySelector("section.sakh-card[aria-label=\""+label+"\"]");return sec?sec.querySelectorAll(".dis-item").length:-1;}
  p.push("после фильтра: электро="+cnt("⚡ Электроэнергия")+" ГВС="+cnt("💧 Горячая вода и Тепло")+" холодная="+cnt("🚰 Холодная вода")+" (ожидали 1/0/1)");
  var hotSec=document.querySelector("section.sakh-card[aria-label=\"💧 Горячая вода и Тепло\"]");
  var em=hotSec?hotSec.querySelector(".dis-empty"):null;
  p.push("пустой блок ГВС: "+(em&&em.textContent.indexOf("По району")===0&&em.textContent.indexOf("Корсаков")>-1?"сообщение верное ДА":"НЕТ! («"+(em?em.textContent.trim():"—")+"»)"));
  var lists=[].slice.call(document.querySelectorAll(".dis-item .dis-addr li"));
  var ok=lists.length>0&&lists.every(function(li){return li.textContent.indexOf("Корсаков")>-1;});
  p.push("все видимые адреса — Корсаков: "+(ok?"ДА":"НЕТ!"));
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!":"нет"));
  return p.join(" | ");
})()
'

FILTER_RESET='
(function(){
  var chips=[].slice.call(document.querySelectorAll(".dis-chip"));
  var kors=chips.filter(function(c){return c.textContent.trim()==="Корсаков";})[0];
  kors.click();
  return "повторный клик по «Корсаков» (снятие фильтра)";
})()
'

RESET_CHECK='
(function(){
  function cnt(label){var sec=document.querySelector("section.sakh-card[aria-label=\""+label+"\"]");return sec?sec.querySelectorAll(".dis-item").length:-1;}
  var act=[].slice.call(document.querySelectorAll(".dis-chip.active"));
  return "после снятия: электро="+cnt("⚡ Электроэнергия")+" ГВС="+cnt("💧 Горячая вода и Тепло")+" холодная="+cnt("🚰 Холодная вода")+" (весь массив 3/2/3="+((cnt("⚡ Электроэнергия")===3&&cnt("💧 Горячая вода и Тепло")===2&&cnt("🚰 Холодная вода")===3)?"ДА":"НЕТ!")+") активных чипов="+act.length;
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

echo "======== HTTP + API /api/outages (весь массив) ========"
curl -s -o /dev/null -w "/disconnections.php -> %{http_code}\n" --max-time 15 http://localhost:3000/disconnections.php
curl -s --max-time 20 http://localhost:3000/api/outages | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    items=d.get('items',[])
    print('записей:',len(items),'(весь массив 8 =','ДА' if len(items)==8 else 'НЕТ!',')')
    ts=[it.get('publishedAt','') for it in items]
    print('сортировка по publishedAt (убывание):','ДА' if ts==sorted(ts,reverse=True) else 'НЕТ!')
    from collections import Counter
    print('источники:',dict(Counter(it.get('source') for it in items)))
except Exception as e:
    print('ОШИБКА API:', e)
"

echo "======== МОБАЙЛ 400: /disconnections.php ========"
open_view "http://localhost:3000/disconnections.php" "400 850"
agent-browser --session $S eval "$CHECK_LOGO" 2>/dev/null
agent-browser --session $S eval "$CHECK_PAGE" 2>/dev/null
agent-browser --session $S screenshot $OUT/dis75-dphp-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/dis75-dphp-400-$LBL.png"

echo "======== МОБАЙЛ 400: фильтр «Корсаков» (без перезагрузки) ========"
agent-browser --session $S eval "$FILTER_CLICK" 2>/dev/null
agent-browser --session $S wait 800 >/dev/null 2>&1
agent-browser --session $S eval "$FILTER_CHECK" 2>/dev/null
agent-browser --session $S screenshot $OUT/dis75-filter-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/dis75-filter-400-$LBL.png"
agent-browser --session $S eval "$FILTER_RESET" 2>/dev/null
agent-browser --session $S wait 800 >/dev/null 2>&1
agent-browser --session $S eval "$RESET_CHECK" 2>/dev/null

echo "======== МОБАЙЛ 320 (стресс) ========"
open_view "http://localhost:3000/disconnections.php" "320 700"
agent-browser --session $S eval "$CHECK_PAGE" 2>/dev/null
agent-browser --session $S screenshot $OUT/dis75-dphp-320-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/dis75-dphp-320-$LBL.png"

echo "======== ДЕСКТОП 1280: /disconnections.php ========"
open_view "http://localhost:3000/disconnections.php" "1280 900"
agent-browser --session $S eval "$CHECK_PAGE" 2>/dev/null
agent-browser --session $S screenshot $OUT/dis75-dphp-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/dis75-dphp-1280-$LBL.png"

echo "======== ДЕСКТОП 1280: главная (эталон) ========"
open_view "http://localhost:3000/" "1280 900"
agent-browser --session $S eval "$CHECK_LOGO" 2>/dev/null
agent-browser --session $S eval "$CHECK_HOME" 2>/dev/null
agent-browser --session $S screenshot $OUT/dis75-home-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/dis75-home-1280-$LBL.png"

echo "======== ДЕСКТОП 1280: форум (эталон тулбара) ========"
open_view "http://localhost:3000/?view=forum" "1280 900"
agent-browser --session $S eval "$DESK_TB" 2>/dev/null

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
echo "Приёмка Шага №7.5 ($LBL) завершена; сервер продолжает работать."
