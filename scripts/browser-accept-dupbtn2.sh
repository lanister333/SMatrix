#!/bin/bash
# Приёмка: скрытие дублирующихся нижних кнопок создания на мобильных ≤480px
# на 5 страницах: О работодателях(ep), Рекомендую(rc), Где дешевле(cd),
# Где купить(wb), Подслушано(oh). Верхняя (aside) кнопка остаётся.
# Десктоп 1280: обе кнопки на местах (= ДО). Эталоны зад.39 и главной — целы.
cd /home/z/my-project || exit 1
OUT=download/screens
mkdir -p $OUT

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
sleep 2
setsid nohup bun run dev > /tmp/sakh-dev-dupbtn2.log 2>&1 < /dev/null &
up=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then up=1; break; fi
  sleep 1
done
[ "$up" = "1" ] && echo "сервер готов (попытка $i)" || { echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; tail -20 /tmp/sakh-dev-dupbtn2.log; exit 2; }

S=dupbtn2
agent-browser --session $S close >/dev/null 2>&1

check_btns () {
  local vp="$1" name="$2" url="$3" upper="$4" lower="$5" shot="$6"
  agent-browser --session $S open "http://localhost:3000$url" >/dev/null 2>&1
  agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
  agent-browser --session $S wait 2000 >/dev/null 2>&1
  # ВАЖНО: viewport задаётся ПОСЛЕ open — set до open не применяется к новой странице
  agent-browser --session $S set viewport $vp >/dev/null 2>&1
  agent-browser --session $S wait 1500 >/dev/null 2>&1
  echo "---- $name @ $vp ----"
  agent-browser --session $S eval "
(function(){
  function st(sel){var e=document.querySelector(sel);if(!e)return 'нет в DOM!';var d=getComputedStyle(e).display;return d==='none'?'скрыта':'ВИДНА';}
  var p=[];
  p.push('верхняя (aside) $upper: '+st('$upper'));
  p.push('нижняя $lower: '+st('$lower'));
  var dw=document.documentElement;
  p.push('прокрутка-X: '+(dw.scrollWidth>dw.clientWidth?'ЕСТЬ!':'нет'));
  return p.join(' | ');
})()
" 2>/dev/null
  [ -n "$shot" ] && agent-browser --session $S screenshot $OUT/$shot >/dev/null 2>&1 && echo "скрин: $OUT/$shot"
}

echo "======== МОБАЙЛ 400px ========"
check_btns "400 800" "О работодателях" "/o-rabotodatelyah" ".ep-addbtn" ".ep-newbtn" "dupbtn2-ep-400.png"
check_btns "400 800" "Рекомендую"    "/rekomenduyu"      ".rc-addbtn" ".rc-newbtn" "dupbtn2-rc-400.png"
check_btns "400 800" "Где дешевле"   "/gde-deshevle"     ".cd-addbtn" ".cd-newbtn" "dupbtn2-cd-400.png"
check_btns "400 800" "Где купить"    "/gde-kupit"        ".wb-addbtn" ".wb-newbtn" "dupbtn2-wb-400.png"
check_btns "400 800" "Подслушано"    "/podslyshano"      ".oh-addbtn" ".oh-newbtn" "dupbtn2-oh-400.png"

echo "== Контроль эталона зад.39 (мобайл 400: aside видна, нижняя скрыта) =="
check_btns "400 800" "Объявления" "/obyavleniya" ".ad-create" ".ad-create-mobile" ""
check_btns "400 800" "Знакомства" "/znakomstva"  ".dk-addbtn" ".dk-newbtn" ""
check_btns "400 800" "ЖКХ"        "/gkh"         ".gkh-addbtn" ".gkh-newbtn" ""
check_btns "400 800" "Справочник" "/help"        ".hp-addbtn" ".hp-newbtn" ""

echo "======== ДЕСКТОП 1280px (эталон ДО: ОБЕ кнопки видны) ========"
check_btns "1280 900" "О работодателях" "/o-rabotodatelyah" ".ep-addbtn" ".ep-newbtn" ""
check_btns "1280 900" "Рекомендую"    "/rekomenduyu"      ".rc-addbtn" ".rc-newbtn" ""
check_btns "1280 900" "Где дешевле"   "/gde-deshevle"     ".cd-addbtn" ".cd-newbtn" ""
check_btns "1280 900" "Где купить"    "/gde-kupit"        ".wb-addbtn" ".wb-newbtn" ""
check_btns "1280 900" "Подслушано"    "/podslyshano"      ".oh-addbtn" ".oh-newbtn" ""

echo "== Эталон главной: мобайл 400 не сломан =="
agent-browser --session $S set viewport 400 800 >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 2000 >/dev/null 2>&1
agent-browser --session $S eval '
(function(){
  var mh=document.querySelector(".sm-mh-wrap");
  var burg=document.querySelector(".sm-mh-burger");
  var dw=document.documentElement;
  return "scrollWidth="+dw.scrollWidth+" clientWidth="+dw.clientWidth+" | шапка: "+(mh?Math.round(mh.getBoundingClientRect().height):"?")+"px | бургер: "+(burg?getComputedStyle(burg).display:"?");
})()
' 2>/dev/null

echo "== Консоль =="
agent-browser --session $S errors 2>/dev/null | head -5
agent-browser --session $S console 2>/dev/null | grep -iE "error" | head -5
agent-browser --session $S close >/dev/null 2>&1

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
echo "приёмка завершена"
