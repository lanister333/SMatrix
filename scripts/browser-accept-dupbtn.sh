#!/bin/bash
# Приёмка: скрытие дублирующихся кнопок создания на мобильных ≤480px.
# Мобайл 400: вторая кнопка скрыта, первая (aside) видна, .ad-empty прижат.
# Десктоп 1280: всё как ДО (dk/gkh/help — обе кнопки; ads — aside,
# нижняя скрыта базовым правилом ещё до правки).
cd /home/z/my-project || exit 1
OUT=download/screens
mkdir -p $OUT

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
sleep 2
setsid nohup bun run dev > /tmp/sakh-dev-dupbtn.log 2>&1 < /dev/null &
up=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then up=1; break; fi
  sleep 1
done
[ "$up" = "1" ] && echo "сервер готов (попытка $i)" || { echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; tail -20 /tmp/sakh-dev-dupbtn.log; exit 2; }

S=dupbtn
agent-browser --session $S close >/dev/null 2>&1

check_btns () {
  local vp="$1" name="$2" url="$3"
  agent-browser --session $S open "http://localhost:3000$url" >/dev/null 2>&1
  agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
  agent-browser --session $S wait 2000 >/dev/null 2>&1
  # ВАЖНО: viewport задаётся ПОСЛЕ open — set до open не применяется к новой странице
  agent-browser --session $S set viewport $vp >/dev/null 2>&1
  agent-browser --session $S wait 1500 >/dev/null 2>&1
  echo "---- $name @ $vp ----"
  agent-browser --session $S eval '
(function(){
  function vis(sel){var e=document.querySelector(sel);if(!e)return "нет в DOM";var d=getComputedStyle(e).display;return d==="none"?"скрыта":"ВИДНА";}
  var parts=[];
  if(document.querySelector(".ad-create")) parts.push("aside .ad-create: "+vis(".ad-create"));
  if(document.querySelector(".ad-create-mobile")) parts.push("нижняя .ad-create-mobile: "+vis(".ad-create-mobile"));
  if(document.querySelector(".dk-addbtn")) parts.push("aside .dk-addbtn: "+vis(".dk-addbtn"));
  if(document.querySelector(".dk-newbtn")) parts.push("нижняя .dk-newbtn: "+vis(".dk-newbtn"));
  if(document.querySelector(".gkh-addbtn")) parts.push("aside .gkh-addbtn: "+vis(".gkh-addbtn"));
  if(document.querySelector(".gkh-newbtn")) parts.push("нижняя .gkh-newbtn: "+vis(".gkh-newbtn"));
  if(document.querySelector(".hp-addbtn")) parts.push("aside .hp-addbtn: "+vis(".hp-addbtn"));
  if(document.querySelector(".hp-newbtn")) parts.push("нижняя .hp-newbtn: "+vis(".hp-newbtn"));
  var em=document.querySelector(".ad-empty");
  if(em) parts.push(".ad-empty padding-top: "+getComputedStyle(em).paddingTop);
  var sr=document.querySelector(".ad-searchrow");
  if(sr&&em) parts.push("зазор поиск→empty: "+(em.getBoundingClientRect().top-sr.getBoundingClientRect().bottom).toFixed(1)+"px");
  parts.push("прокрутка-X: "+(document.documentElement.scrollWidth>document.documentElement.clientWidth?"ЕСТЬ!":"нет"));
  return parts.join(" | ");
})()
' 2>/dev/null
}

echo "======== МОБАЙЛ 400px ========"
check_btns "400 800" "Объявления" "/obyavleniya"
check_btns "400 800" "Знакомства" "/znakomstva"
check_btns "400 800" "ЖКХ" "/gkh"
check_btns "400 800" "Справочник" "/help"

echo "== Скриншот Объявлений 400 (после) =="
agent-browser --session $S open "http://localhost:3000/obyavleniya" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 2000 >/dev/null 2>&1
agent-browser --session $S screenshot $OUT/dupbtn-ads-400.png >/dev/null 2>&1

echo "======== ДЕСКТОП 1280px (эталон ДО) ========"
check_btns "1280 900" "Объявления" "/obyavleniya"
check_btns "1280 900" "Знакомства" "/znakomstva"
check_btns "1280 900" "ЖКХ" "/gkh"
check_btns "1280 900" "Справочник" "/help"

echo "== Эталон главной: мобайл 400 не сломан =="
agent-browser --session $S set viewport 400 800 >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 2000 >/dev/null 2>&1
agent-browser --session $S eval '
(function(){
  var mh=document.querySelector(".sm-mh-wrap");
  var burg=document.querySelector(".sm-mh-burger");
  return "scrollWidth="+document.documentElement.scrollWidth+" clientWidth="+document.documentElement.clientWidth+" | шапка: "+(mh?Math.round(mh.getBoundingClientRect().height):"?")+"px | бургер: "+(burg?getComputedStyle(burg).display:"?");
})()
' 2>/dev/null

echo "== Консоль =="
agent-browser --session $S errors 2>/dev/null | head -5
agent-browser --session $S console 2>/dev/null | grep -iE "error" | head -5 || echo "(ошибок в консоли нет)"
agent-browser --session $S close >/dev/null 2>&1

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
echo "приёмка завершена"
