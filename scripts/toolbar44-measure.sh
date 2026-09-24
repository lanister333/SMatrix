#!/bin/bash
# Task 44: замер блока поиска/фильтров рубрик (.sk-toolbar).
# Аргументы: $1 = метка (ДО/ПОСЛЕ), $2 = суффикс имён скриншотов (do/posle).
# Сервер+браузер одним вызовом; viewport ПОСЛЕ open; прогрев против
# молчаливого незагруза. Сервер в конце НЕ убивается (нужен для превью).
cd /home/z/my-project || exit 1
OUT=download/screens
mkdir -p $OUT
LBL="${1:-ДО}"
SFX="${2:-do}"

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

S=tb44
agent-browser --session $S close >/dev/null 2>&1

# прогрев (SSR-компиляция) — первый целевой open может поймать незагруз
agent-browser --session $S open "http://localhost:3000/?view=forum" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1

CHECK='
(function(){
  var tb=document.querySelector(".sk-toolbar");
  if(!tb) return "ОШИБКА: .sk-toolbar нет в DOM (незагруз?)";
  var p=[];
  var cs=getComputedStyle(tb), tr=tb.getBoundingClientRect();
  p.push("контейнер: h="+Math.round(tr.height)+" pad="+cs.paddingTop+"/"+cs.paddingRight+"/"+cs.paddingBottom+"/"+cs.paddingLeft+" rowGap="+cs.rowGap);
  var tabs=tb.querySelector(".sk-tabs");
  var form=tb.querySelector(".sk-toolbar-form");
  if(!tabs||!form) return "ОШИБКА: нет tabs/form";
  var b=tabs.querySelector("button");
  var bcs=getComputedStyle(b);
  p.push("фильтр-ссылка: fs="+bcs.fontSize+" pad(в/г)="+bcs.paddingTop+"/"+bcs.paddingLeft);
  p.push("отступ над ссылками (рамка→таб): "+(tabs.getBoundingClientRect().top-tr.top).toFixed(1)+"px");
  p.push("зазор фильтры→поиск: "+(form.getBoundingClientRect().top-tabs.getBoundingClientRect().bottom).toFixed(1)+"px");
  var inp=tb.querySelector("input[type=text]");
  if(inp){var ics=getComputedStyle(inp), ir=inp.getBoundingClientRect();
    p.push("инпут: "+Math.round(ir.width)+"x"+Math.round(ir.height)+" fs="+ics.fontSize+" pad="+ics.paddingTop+" "+ics.paddingLeft);}
  var btns=tb.querySelectorAll(".sk-btn-classic");
  if(btns.length){var k=btns[0], kcs=getComputedStyle(k), kr=k.getBoundingClientRect();
    p.push("«Найти»: "+Math.round(kr.width)+"x"+Math.round(kr.height)+" pad="+kcs.paddingTop+" "+kcs.paddingLeft+" fs="+kcs.fontSize);
    var k2=btns[1];
    if(k2){var kr2=k2.getBoundingClientRect();
      p.push("«+ Новая тема»: "+Math.round(kr2.width)+"x"+Math.round(kr2.height));
      p.push("кнопки одной строкой: "+(Math.abs(kr.top-kr2.top)<2?"ДА":"НЕТ"));}}
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  return p.join(" | ");
})()
'

snap () {
  local vp="$1" name="$2" shot="$3"
  agent-browser --session $S open "http://localhost:3000/?view=forum" >/dev/null 2>&1
  agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
  agent-browser --session $S wait 2500 >/dev/null 2>&1
  # ВАЖНО: viewport задаётся ПОСЛЕ open — set до open не применяется к новой странице
  agent-browser --session $S set viewport $vp >/dev/null 2>&1
  agent-browser --session $S wait 1200 >/dev/null 2>&1
  echo "---- [$LBL] $name @ $vp ----"
  agent-browser --session $S eval "$CHECK" 2>/dev/null
  [ -n "$shot" ] && agent-browser --session $S screenshot $OUT/$shot >/dev/null 2>&1 && echo "скрин: $OUT/$shot"
}

snap "400 850" "Форум: блок поиска/фильтров" "toolbar44-400-$SFX.png"
snap "320 700" "Форум 320px (стресс)" "toolbar44-320-$SFX.png"

echo "---- [$LBL] ДЕСКТОП 1280 (эталон) ----"
agent-browser --session $S open "http://localhost:3000/?view=forum" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 2500 >/dev/null 2>&1
agent-browser --session $S set viewport 1280 900 >/dev/null 2>&1
agent-browser --session $S wait 1200 >/dev/null 2>&1
agent-browser --session $S eval "$CHECK" 2>/dev/null
agent-browser --session $S screenshot $OUT/toolbar44-desktop-$SFX.png >/dev/null 2>&1 && echo "скрин: $OUT/toolbar44-desktop-$SFX.png"

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
agent-browser --session $S close >/dev/null 2>&1
echo "замер [$LBL] завершён; сервер оставлен работать"
