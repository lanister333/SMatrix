#!/bin/bash
# Приёмка «Итерация 2»: ужатие панелей меню ×1.5, compact-кнопка «Ответить»
# (12px / 3px 8px), цепочка [№·ник·дата·Ответить·Пожаловаться] одной строкой,
# отступ между сообщениями 4px. Десктоп 1280 — эталон ДО.
cd /home/z/my-project || exit 1
OUT=download/screens
mkdir -p $OUT

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
sleep 2
setsid nohup bun run dev > /tmp/sakh-dev-iter2.log 2>&1 < /dev/null &
up=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then up=1; break; fi
  sleep 1
done
[ "$up" = "1" ] && echo "сервер готов (попытка $i)" || { echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; tail -20 /tmp/sakh-dev-iter2.log; exit 2; }

S=iter2
agent-browser --session $S close >/dev/null 2>&1

# прогрев (SSR-компиляция), чтобы первый целевой open не поймал молчаливый незагруз
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1

MOBILE_CHECK='
(function(){
  var p=[];
  var mh=document.querySelector(".sm-mh-wrap");
  p.push("панель1 (SakhMatrix): "+(mh?Math.round(mh.getBoundingClientRect().height):"?")+"px (было 49)");
  var tb=document.querySelector(".sk-topbar");
  p.push("панель2 (Форум): "+(tb?Math.round(tb.getBoundingClientRect().height):"?")+"px (было ~52)");
  var msgs=[].slice.call(document.querySelectorAll(".sk-msg")).filter(function(m){return !m.className.includes("sk-msg-deleted");});
  if(!msgs.length) return p.join(" | ")+" | ОШИБКА: сообщений нет";
  var m=msgs[0];
  var num=m.querySelector(".sk-msg-num"), auth=m.querySelector(".sk-msg-author"),
      time=m.querySelector(".sk-msg-time"), btn=m.querySelector(".sk-btn-reply"),
      body=m.querySelector(".sk-msg-body"), fav=m.querySelector(".sk-fav-btn");
  var complain=null;
  [].slice.call(m.querySelectorAll(".sk-flood-btn")).forEach(function(b){
    if(!b.classList.contains("sk-fav-btn")){
      var nx=b.nextElementSibling && b.nextElementSibling.classList && b.nextElementSibling.classList.contains("sk-fav-btn");
      if(nx) complain=b;
    }
  });
  var bs=getComputedStyle(btn), br=btn.getBoundingClientRect();
  p.push("Ответить: "+Math.round(br.width)+"x"+Math.round(br.height)+"px fs="+bs.fontSize+" pad="+bs.paddingTop+" "+bs.paddingLeft);
  var tops=[num,auth,time,btn,complain].filter(Boolean).map(function(e){return e.getBoundingClientRect().top;});
  p.push("цепочка одной строкой: "+((Math.max.apply(null,tops)-Math.min.apply(null,tops))<3?"ДА":"НЕТ")+" (элементов "+tops.length+")");
  if(complain&&body) p.push("Пожаловаться вверху="+(complain.getBoundingClientRect().top<body.getBoundingClientRect().top)+", fs="+getComputedStyle(complain).fontSize);
  if(fav&&body) p.push("В избранное внизу="+(fav.getBoundingClientRect().top>body.getBoundingClientRect().bottom-1));
  if(body){
    var chainBottom=Math.max.apply(null,[num,auth,time,btn,complain].filter(Boolean).map(function(e){return e.getBoundingClientRect().bottom;}));
    p.push("зазор цепочка→текст: "+(body.getBoundingClientRect().top-chainBottom).toFixed(1)+"px");
  }
  if(msgs.length>1){
    var gap=msgs[1].getBoundingClientRect().top-msgs[0].getBoundingClientRect().bottom;
    p.push("зазор между сообщениями: "+gap.toFixed(1)+"px (цель 4)");
  }
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  return p.join(" | ");
})()
'

DESK_CHECK='
(function(){
  var p=[];
  var msgs=[].slice.call(document.querySelectorAll(".sk-msg")).filter(function(m){return !m.className.includes("sk-msg-deleted");});
  if(!msgs.length) return "ОШИБКА: сообщений нет";
  var m=msgs[0], cs=getComputedStyle(m);
  var head=m.querySelector(".sk-msg-head");
  var btn=m.querySelector(".sk-btn-reply");
  p.push(".sk-msg margin-bottom="+cs.marginBottom+" display="+cs.display);
  p.push(head?("шапка display="+getComputedStyle(head).display+" bg="+getComputedStyle(head).backgroundColor+" pad="+getComputedStyle(head).paddingTop+" "+getComputedStyle(head).paddingLeft):"нет шапки");
  p.push(btn?("Ответить fs="+getComputedStyle(btn).fontSize+" pad="+getComputedStyle(btn).paddingTop+" "+getComputedStyle(btn).paddingLeft):"нет кнопки");
  var tb=document.querySelector(".sk-topbar");
  p.push(".sk-topbar: "+(tb?(getComputedStyle(tb).display==="none"?"скрыта (штатно на ПК)":"ВИДНА?"):"нет в DOM"));
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!":"нет"));
  return p.join(" | ");
})()
'

snap_mobile () {
  local vp="$1" name="$2" shot="$3"
  agent-browser --session $S open "http://localhost:3000/?topic=1" >/dev/null 2>&1
  agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
  agent-browser --session $S wait 2500 >/dev/null 2>&1
  # ВАЖНО: viewport задаётся ПОСЛЕ open — set до open не применяется к новой странице
  agent-browser --session $S set viewport $vp >/dev/null 2>&1
  agent-browser --session $S wait 1500 >/dev/null 2>&1
  echo "---- $name @ $vp ----"
  agent-browser --session $S eval "$MOBILE_CHECK" 2>/dev/null
  [ -n "$shot" ] && agent-browser --session $S screenshot $OUT/$shot >/dev/null 2>&1 && echo "скрин: $OUT/$shot"
}

echo "======== МОБАЙЛ ========"
snap_mobile "400 850" "Ветка форума (topic=1, 50 сообщений)" "iter2-topic1-400.png"
snap_mobile "320 700" "Ветка форума 320px (стресс)" "iter2-topic1-320.png"

echo "======== ДЕСКТОП 1280px (эталон ДО) ========"
agent-browser --session $S open "http://localhost:3000/?topic=1" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 2500 >/dev/null 2>&1
agent-browser --session $S set viewport 1280 900 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1
agent-browser --session $S eval "$DESK_CHECK" 2>/dev/null
agent-browser --session $S screenshot $OUT/iter2-desktop-1280.png >/dev/null 2>&1 && echo "скрин: $OUT/iter2-desktop-1280.png"

echo "======== Эталон главной ========"
agent-browser --session $S set viewport 400 800 >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 2000 >/dev/null 2>&1
agent-browser --session $S eval '
(function(){
  var mh=document.querySelector(".sm-mh-wrap");
  var burg=document.querySelector(".sm-mh-burger");
  var dw=document.documentElement;
  return "мобайл 400: scrollW="+dw.scrollWidth+" clientW="+dw.clientWidth+" | панель SakhMatrix: "+(mh?Math.round(mh.getBoundingClientRect().height):"?")+"px | бургер: "+(burg?getComputedStyle(burg).display:"?")+" "+(burg?Math.round(burg.getBoundingClientRect().height):"?")+"px";
})()
' 2>/dev/null

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
agent-browser --session $S close >/dev/null 2>&1

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
echo "приёмка завершена"
