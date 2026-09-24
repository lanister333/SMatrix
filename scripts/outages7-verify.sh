#!/bin/bash
# Шаг №7: блок «Отключения» — сбор раз в 30 минут (планировщик + PHP-крон),
# на главной строго 3 самые свежие записи, сортировка по времени публикации;
# мобайл ≤480px: адреса 12px, перенос строк удерживает правую границу
# .sakh-card, зазоры между строками аварий 4px; заголовок-плашка — ссылка
# на /disconnections.php. Мобайл 400/320 + десктоп 1280 эталон.
# Параметр: $1 — метка скриншотов (POSLE-1/POSLE-2).
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

# первый сбор планировщика происходит через 20с после старта сервера —
# ждём его, чтобы он не затёр приёмочную фикстуру
sleep 26

# ПРИЁМОЧНАЯ ФИКСТУРА db/outages.json: 5 записей (свет/вода вперемешку,
# разные publishedAt) — проверяет «Вариант А»: строго 3 самые свежие,
# сортировка по времени публикации. Живой парсер (раз в 30 минут) затрёт
# её следующими реальными данными; в песочнице официальные источники
# (sakhalinenergo.ru/skk65.ru) закрыты сетью — панель честно покажет
# «Сводки собираются…».
python3 - <<'PYEOF'
import json
items = [
  {"source":"Сахалинэнерго","title":"Плановое отключение электроэнергии","url":"https://sakhalinenergo.ru/news/otklyuchenie-16-sept","addresses":["ул. Сахалинская, 45, 47; ул. Ленина, 210 — плановые работы в сетях","мкр. Дальнее, 4 — замена трансформатора ТП-14"],"when":"с 09:00 до 17:00","publishedAt":"2026-09-16T01:00:00.000Z","fetchedAt":"2026-09-16T04:00:00.000Z"},
  {"source":"Водоканал","title":"Аварийные работы на водоводе","url":"https://example-vodokanal.ru/avaria-vodovod","addresses":["проспект Мира, 108 — перебои холодного водоснабжения","ул. Пономарёва-Ключевская-Новоалександровская-2-я, д. 12 корпус 2 (внутриквартальный проезд)"],"when":"с 08:30 до 20:00","publishedAt":"2026-09-16T03:30:00.000Z","fetchedAt":"2026-09-16T04:00:00.000Z"},
  {"source":"СКК","title":"Ограничение теплоснабжения","url":"https://skk65.ru/ogranichenie-teplo","addresses":["ул. Пуркаева, 17, 19 — ограничение горячего водоснабжения"],"when":"с 10:00 до 18:00","publishedAt":"2026-09-15T23:00:00.000Z","fetchedAt":"2026-09-16T04:00:00.000Z"},
  {"source":"Сахалинэнерго","title":"Отключение в Корсакове (вчерашняя сводка)","url":"https://sakhalinenergo.ru/news/korsakov-old","addresses":["г. Корсаков, ул. Северная, 5"],"when":"с 13:00 до 16:00","publishedAt":"2026-09-15T10:00:00.000Z","fetchedAt":"2026-09-16T04:00:00.000Z"},
  {"source":"СКК","title":"Ремонт теплотрассы (позавчерашняя сводка)","url":"https://skk65.ru/remont-old","addresses":["ул. Железнодорожная, 72"],"when":"с 09:00 до 15:00","publishedAt":"2026-09-14T08:00:00.000Z","fetchedAt":"2026-09-16T04:00:00.000Z"}
]
data = {"updated":"2026-09-16T04:00:00.000Z","items":items,"errors":[]}
json.dump(data, open("db/outages.json","w",encoding="utf-8"), ensure_ascii=False, indent=2)
print("фикстура db/outages.json записана: 5 записей (топ-3: Водоканал → Сахалинэнерго → СКК)")
PYEOF

S=w7
agent-browser --session $S close >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1

CHECK_OFF='
(function(){
  var p=[];
  var sec=document.querySelector("section.sakh-card[aria-label=\"Отключения\"]");
  if(!sec) return "ОШИБКА: панель «Отключения» не найдена";
  var link=sec.querySelector(".mp-paneltitle a");
  if(!link) return "ОШИБКА: заголовок «Отключения» не является ссылкой";
  var lcs=getComputedStyle(link);
  p.push("ссылка: href="+link.getAttribute("href")+" цвет="+lcs.color+" подч.="+lcs.textDecorationLine+" шрифт="+lcs.fontSize+"/"+lcs.fontWeight);
  var items=sec.querySelectorAll(".mp-off-item");
  p.push("записей: "+items.length+" (строго 3="+(items.length===3?"ДА":"НЕТ!")+")");
  var srcs=[];
  for (var i=0;i<items.length;i++){srcs.push(items[i].querySelector(".mp-off-src").textContent.trim());}
  p.push("порядок: "+srcs.join(" → ")+" (ожидание: Водоканал → Сахалинэнерго → СКК = "+(srcs.join("|")==="Водоканал|Сахалинэнерго|СКК"?"ДА":"НЕТ!")+")");
  var li=sec.querySelector(".mp-off-addr li");
  if(!li) return p.join(" | ")+" | ОШИБКА: адресов нет";
  var lcs2=getComputedStyle(li);
  p.push("адрес: fs="+lcs2.fontSize+" (12px="+(lcs2.fontSize==="12px"?"ДА":"НЕТ!")+") перенос="+(lcs2.overflowWrap==="anywhere"||lcs2.wordBreak==="break-word"?"ДА":"НЕТ!"));
  var it2=items[1];
  var mtop=it2?getComputedStyle(it2).marginTop:"—";
  p.push("зазор между строками аварий: margin-top="+mtop+" (4px="+(mtop==="4px"?"ДА":"НЕТ!")+")");
  var cr=li.getBoundingClientRect().right, sr=sec.getBoundingClientRect().right;
  p.push("адрес держит правую границу .sakh-card: "+(cr<=sr+1?"ДА":"НЕТ! ("+Math.round(cr)+" vs "+Math.round(sr)+")"));
  var lih=li.getBoundingClientRect().height;
  p.push("высота строки адреса: "+Math.round(lih)+"px (перенос длинной улицы = "+(lih>18?"несколько строк ДА":"одна строка")+")");
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  p.push("карточка за рамкой: "+(sr>window.innerWidth+1?"ДА!":"нет"));
  return p.join(" | ");
})()
'

CHECK_WCREGRESS='
(function(){
  var p=[];
  var w=document.querySelector("section.sakh-card[aria-label=\"Погода на Сахалине\"]");
  p.push("погода (регресс): ссылка="+(w&&w.querySelector(".mp-paneltitle a")?w.querySelector(".mp-paneltitle a").getAttribute("href"):"НЕТ!")+" виджет="+(w&&w.querySelector(".mp-w-frame")?w.querySelector(".mp-w-frame").clientWidth+"px":"НЕТ!"));
  var c=document.querySelector("section.sakh-card[aria-label=\"Курсы валют\"]");
  p.push("курсы (регресс): ссылка="+(c&&c.querySelector(".mp-paneltitle a")?c.querySelector(".mp-paneltitle a").getAttribute("href"):"НЕТ!")+" строк="+(c?c.querySelectorAll("tbody tr").length:"—"));
  return p.join(" | ");
})()
'

DPHP='
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

DESK_OFF='
(function(){
  var p=[];
  var sec=document.querySelector("section.sakh-card[aria-label=\"Отключения\"]");
  if(!sec) return "ОШИБКА: панели нет";
  var link=sec.querySelector(".mp-paneltitle a");
  var lcs=link?getComputedStyle(link):null;
  p.push("ПК-плашка: ссылка="+(link?link.getAttribute("href"):"НЕТ")+" цвет="+(lcs?lcs.color:"—")+" подч.="+(lcs?lcs.textDecorationLine:"—")+" шрифт="+(lcs?lcs.fontSize:"—"));
  var items=sec.querySelectorAll(".mp-off-item");
  p.push("ПК-записей: "+items.length+" (контент по ТЗ — 3 самые свежие)");
  var it1=items[0], it2=items[1];
  if(it1){
    var c1=getComputedStyle(it1);
    p.push("ПК-строка: padding="+c1.paddingTop+" "+c1.paddingLeft+" (эталон 6px 10px="+((c1.paddingTop==="6px"&&c1.paddingLeft==="10px")?"ДА":"НЕТ!")+")");
    if(it2) p.push("ПК-зазор между строками: margin-top="+getComputedStyle(it2).marginTop+" (0px — медиа-правило не утекло="+((getComputedStyle(it2).marginTop==="0px")?"ДА":"НЕТ!")+")");
    var li=sec.querySelector(".mp-off-addr li");
    if(li){var lc=getComputedStyle(li); p.push("ПК-адрес: fs="+lc.fontSize+" перенос="+lc.overflowWrap+" (базовые, не мобильные)");}
  }
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

echo "======== API /api/home/outages (Вариант А: 3 свежие, сорт. по publishedAt) ========"
curl -s --max-time 30 http://localhost:3000/api/home/outages | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    items=d.get('items',[])
    print('source:',d.get('source'),'| записей:',len(items),'(строго 3 =','ДА' if len(items)==3 else 'НЕТ!',')')
    for it in items:
        print(' -',it.get('source'),'| publishedAt:',it.get('publishedAt'),'| адресов:',len(it.get('addresses',[])))
    ts=[it.get('publishedAt','') for it in items]
    print('сортировка по времени публикации (убывание):','ДА' if ts==sorted(ts,reverse=True) else 'НЕТ!')
except Exception as e:
    print('ОШИБКА API:', e)
"

echo "======== МОБАЙЛ 400: главная (отключения) ========"
open_view "http://localhost:3000/" "400 850"
agent-browser --session $S eval "$CHECK_OFF" 2>/dev/null
agent-browser --session $S eval "$CHECK_WCREGRESS" 2>/dev/null
agent-browser --session $S screenshot $OUT/outages7-home-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/outages7-home-400-$LBL.png"

echo "======== МОБАЙЛ 320: главная (стресс) ========"
open_view "http://localhost:3000/" "320 700"
agent-browser --session $S eval "$CHECK_OFF" 2>/dev/null
agent-browser --session $S screenshot $OUT/outages7-home-320-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/outages7-home-320-$LBL.png"

echo "======== МОБАЙЛ 400: /disconnections.php (заглушка) ========"
dphpcode=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 http://localhost:3000/disconnections.php)
echo "HTTP /disconnections.php: $dphpcode"
open_view "http://localhost:3000/disconnections.php" "400 850"
agent-browser --session $S eval "$DPHP" 2>/dev/null
agent-browser --session $S screenshot $OUT/outages7-dphp-400-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/outages7-dphp-400-$LBL.png"

echo "======== ДЕСКТОП 1280: главная (эталон) ========"
open_view "http://localhost:3000/" "1280 900"
agent-browser --session $S eval "$DESK_OFF" 2>/dev/null
agent-browser --session $S eval "$CHECK_WCREGRESS" 2>/dev/null
agent-browser --session $S screenshot $OUT/outages7-home-1280-$LBL.png >/dev/null 2>&1 && echo "скрин: $OUT/outages7-home-1280-$LBL.png"

echo "======== ДЕСКТОП 1280: форум (эталон тулбара) ========"
open_view "http://localhost:3000/?view=forum" "1280 900"
agent-browser --session $S eval "$DESK_TB" 2>/dev/null

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
echo "Приёмка Шага №7 ($LBL) завершена; сервер продолжает работать."
