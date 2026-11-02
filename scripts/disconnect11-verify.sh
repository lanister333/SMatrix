#!/bin/bash
# Шаг №11: /disconnections.php — «полноценное наполнение» по финальному ТЗ.
# Верхняя карточка: возврат + горизонтальный скролл-ряд КРУГЛЫХ бабблов
# [Все районы], [Южно-Сахалинск], [Корсаков], [Холмск], [Анива], [Оха]
# (JS-фильтрация без перезагрузки); весь массив парсеров в трёх блоках
# «⚡ Электроэнергия (Сахалинэнерго)» / «💧 Горячая вода и Тепло (СКК)» /
# «🚰 Холодная вода (Водоканал)» (адреса 12px, перенос держит правую
# границу .sakh-card на 360–414px); внизу компактная таблица «Телефоны
# экстренных служб» — tel:-ссылки ФРС 782-782 / СКК 72-30-13 / Водоканал
# 72-32-40. Мобайл 400/320 + десктоп 1280 эталон. $1 — метка скриншотов.
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

S=dis11
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
  p.push("возврат: href="+back.getAttribute("href")+" текст="+(back.textContent.replace(/\s+/g," ").trim()==="← Вернуться на Главную"?"точно ДА":"НЕТ!")+" mt="+bcs.marginTop+" bg="+bcs.backgroundColor+" цвет="+(bcs.color==="rgb(255, 255, 255)"?"белый ДА":"НЕТ! "+bcs.color)+" h="+Math.round(bb.height)+" в верхней карточке="+(inTop?"ДА":"НЕТ!"));
  var chips=[].slice.call(document.querySelectorAll(".dis-chip"));
  var names=chips.map(function(c){return c.textContent.trim();}).join("|");
  p.push("чипы-бабблы: "+chips.length+" («"+names.split("|").join(", ")+"» = ТЗ "+(names==="Все районы|Южно-Сахалинск|Корсаков|Холмск|Анива|Оха"?"ДА":"НЕТ!")+")");
  if(chips[0]){var ccs=getComputedStyle(chips[0]);
    p.push("баббл: radius="+ccs.borderRadius+" (круглый 999px="+(ccs.borderRadius==="999px"?"ДА":"НЕТ!")+") первый-активный="+(chips[0].className.indexOf("active")>-1&&chips[0].getAttribute("aria-pressed")==="true"?"ДА":"НЕТ!"));}
  var f=document.querySelector(".dis-filters");
  if(f)p.push("фильтр-ряд: overflow-x="+getComputedStyle(f).overflowX+" (auto = скролл-ряд)");
  var blocks=["⚡ Электроэнергия (Сахалинэнерго)","💧 Горячая вода и Тепло (СКК)","🚰 Холодная вода (Водоканал)"];
  var cnt=[];
  for (var i=0;i<blocks.length;i++){
    var sec=document.querySelector("section.sakh-card[aria-label=\""+blocks[i]+"\"]");
    if(!sec){cnt.push(blocks[i]+"=НЕТ!");continue;}
    cnt.push(sec.querySelectorAll(".dis-item").length);
    if(i===0){
      var li=sec.querySelector(".dis-addr li");
      if(li){var lc=getComputedStyle(li);
        p.push("адрес: fs="+lc.fontSize+" (12px="+(lc.fontSize==="12px"?"ДА":"НЕТ!")+") перенос="+(lc.overflowWrap==="anywhere"?"ДА":"НЕТ!"));
        var cr=li.getBoundingClientRect().right, sr=sec.getBoundingClientRect().right;
        p.push("адрес держит правую границу .sakh-card: "+(cr<=sr+1?"ДА":"НЕТ! ("+Math.round(cr)+" vs "+Math.round(sr)+")"));}
    }
  }
  p.push("записей по блокам: "+cnt.join(" | ")+" (ожидали электро=3 | ГВС=2 | холодная=3)");
  var pt=null;
  var secs=[].slice.call(document.querySelectorAll("section.sakh-card"));
  for (var j=0;j<secs.length;j++){var t=secs[j].querySelector(".mp-paneltitle");if(t&&t.textContent.indexOf("Телефоны экстренных служб")>-1){pt=secs[j];break;}}
  if(!pt) return p.join(" | ")+" | ОШИБКА: секции телефонов нет";
  var tbl=pt.querySelector("table.dis-phones");
  p.push("телефоны: таблица="+(tbl?"ДА":"НЕТ!")+" заголовок ТЗ="+(pt.querySelector(".mp-paneltitle").textContent.indexOf("Телефоны экстренных служб")>-1?"ДА":"НЕТ!"));
  var rows=tbl?tbl.querySelectorAll("tr"):[];
  var tel=[].slice.call(tbl?tbl.querySelectorAll("a.dis-ph-tel")||[]:[]);
  p.push("строк="+rows.length+" tel-ссылки: "+tel.map(function(a){return a.getAttribute("href")+"("+a.textContent.trim()+")";}).join(" ")+(tel.length===3&&tel[0].getAttribute("href")==="tel:782-782"&&tel[1].getAttribute("href")==="tel:72-30-13"&&tel[2].getAttribute("href")==="tel:72-32-40"&&tel[2].textContent.trim()==="72-32-40"?" = ТЗ ДА":" = НЕТ!"));
  var svc=[].slice.call(tbl?tbl.querySelectorAll(".dis-ph-svc")||[]:[]);
  p.push("службы: "+svc.map(function(c){return c.textContent.trim();}).join("/")+(svc.map(function(c){return c.textContent.trim();}).join("/")==="ФРС/СКК/Водоканал"?" (Водоканал, не РВК — ДА)":" (НЕТ!)"));
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
  return "тап по бабблу «Корсаков»";
})()
'

FILTER_CHECK='
(function(){
  var p=[];
  var chips=[].slice.call(document.querySelectorAll(".dis-chip"));
  var act=chips.filter(function(c){return c.className.indexOf("active")>-1;});
  p.push("активный баббл: "+(act.length===1&&act[0].textContent.trim()==="Корсаков"?"Корсаков ДА":"НЕТ!")+" aria-pressed="+(act[0]?act[0].getAttribute("aria-pressed"):"—"));
  if(act[0]){var acs=getComputedStyle(act[0]);p.push("актив: bg="+acs.backgroundColor+" (navy ДА="+(acs.backgroundColor==="rgb(30, 58, 95)"?"ДА":"НЕТ!")+") цвет="+(acs.color==="rgb(255, 255, 255)"?"белый ДА":"НЕТ!"));}
  function cnt(label){var sec=document.querySelector("section.sakh-card[aria-label=\""+label+"\"]");return sec?sec.querySelectorAll(".dis-item").length:-1;}
  p.push("после фильтра: электро="+cnt("⚡ Электроэнергия (Сахалинэнерго)")+" ГВС="+cnt("💧 Горячая вода и Тепло (СКК)")+" холодная="+cnt("🚰 Холодная вода (Водоканал)")+" (ожидали 1/0/1)");
  var hotSec=document.querySelector("section.sakh-card[aria-label=\"💧 Горячая вода и Тепло (СКК)\"]");
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
  return "повторный тап по «Корсаков» (возврат к «Все районы»)";
})()
'

RESET_CHECK='
(function(){
  function cnt(label){var sec=document.querySelector("section.sakh-card[aria-label=\""+label+"\"]");return sec?sec.querySelectorAll(".dis-item").length:-1;}
  var act=[].slice.call(document.querySelectorAll(".dis-chip.active"));
  var first=document.querySelectorAll(".dis-chip")[0];
  return "после снятия: электро="+cnt("⚡ Электроэнергия (Сахалинэнерго)")+" ГВС="+cnt("💧 Горячая вода и Тепло (СКК)")+" холодная="+cnt("🚰 Холодная вода (Водоканал)")+" (весь массив 3/2/3="+((cnt("⚡ Электроэнергия (Сахалинэнерго)")===3&&cnt("💧 Горячая вода и Тепло (СКК)")===2&&cnt("🚰 Холодная вода (Водоканал)")===3)?"ДА":"НЕТ!")+") активный чип: "+(act.length===1&&act[0]===first&&first.textContent.trim()==="Все районы"?"«Все районы» ДА":"НЕТ! ("+act.length+")");
})()
'

CHECK_TEL44='
(function(){
  var tel=document.querySelector("a.dis-ph-tel");
  if(!tel) return "ОШИБКА: tel-ссылки нет";
  var h=tel.getBoundingClientRect().height;
  var td=tel.closest("td"), tr=tel.closest("tr");
  return "tel-строка: ссылка h="+Math.round(h)+" (тач-цель ≥44px="+(h>=44?"ДА":"НЕТ!")+") строка tr h="+Math.round(tr.getBoundingClientRect().height)+" выравнивание номера: "+getComputedStyle(td).textAlign;
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
agent-browser --session $S eval "$CHECK_TEL44" 2>/dev/null
agent-browser --session $S screenshot $OUT/dis11-dphp-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/dis11-dphp-400-$LBL.png"

echo "======== МОБАЙЛ 400: фильтр «Корсаков» (без перезагрузки) ========"
agent-browser --session $S eval "$FILTER_CLICK" 2>/dev/null
agent-browser --session $S wait 800 >/dev/null 2>&1
agent-browser --session $S eval "$FILTER_CHECK" 2>/dev/null
agent-browser --session $S screenshot $OUT/dis11-filter-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/dis11-filter-400-$LBL.png"
agent-browser --session $S eval "$FILTER_RESET" 2>/dev/null
agent-browser --session $S wait 800 >/dev/null 2>&1
agent-browser --session $S eval "$RESET_CHECK" 2>/dev/null

echo "======== МОБАЙЛ 360/320 (стресс ТЗ 360–414 + узкий) ========"
open_view "http://localhost:3000/disconnections.php" "360 740"
agent-browser --session $S eval "$CHECK_PAGE" 2>/dev/null
agent-browser --session $S screenshot $OUT/dis11-dphp-360-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/dis11-dphp-360-$LBL.png"
open_view "http://localhost:3000/disconnections.php" "320 700"
agent-browser --session $S eval "$CHECK_PAGE" 2>/dev/null
agent-browser --session $S screenshot $OUT/dis11-dphp-320-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/dis11-dphp-320-$LBL.png"

echo "======== ДЕСКТОП 1280: /disconnections.php ========"
open_view "http://localhost:3000/disconnections.php" "1280 900"
agent-browser --session $S eval "$CHECK_PAGE" 2>/dev/null
agent-browser --session $S screenshot $OUT/dis11-dphp-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/dis11-dphp-1280-$LBL.png"

echo "======== ДЕСКТОП 1280: главная (эталон) ========"
open_view "http://localhost:3000/" "1280 900"
agent-browser --session $S eval "$CHECK_LOGO" 2>/dev/null
agent-browser --session $S eval "$CHECK_HOME" 2>/dev/null
agent-browser --session $S screenshot $OUT/dis11-home-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/dis11-home-1280-$LBL.png"

echo "======== ДЕСКТОП 1280: форум (эталон тулбара) ========"
open_view "http://localhost:3000/?view=forum" "1280 900"
agent-browser --session $S eval "$DESK_TB" 2>/dev/null

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
echo "Приёмка Шага №11 ($LBL) завершена; сервер продолжает работать."
