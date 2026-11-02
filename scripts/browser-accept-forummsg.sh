#!/bin/bash
# Приёмка: ужимка сообщений форума (ответы #1,#2,#3…) на мобильных ≤480px.
# Мобайл 400/320: .sk-msg = flex + padding 6px; шапка растворена (display:contents);
# цепочка [№ · ник · дата · Ответить] вверху одной строкой; текст сразу под ником;
# «Пожаловаться»/«В избранное» внизу серым 11px; кнопка «Ответить» компактная.
# Десктоп 1280: эталон ДО — шапка-полоса на месте (flex, фон #eaf1f9, padding 3px 8px),
# кнопка 12.5px/3px 10px, тело 7px 10px 4px, .sk-msg не flex.
cd /home/z/my-project || exit 1
OUT=download/screens
mkdir -p $OUT

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
sleep 2
setsid nohup bun run dev > /tmp/sakh-dev-forummsg.log 2>&1 < /dev/null &
up=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then up=1; break; fi
  sleep 1
done
[ "$up" = "1" ] && echo "сервер готов (попытка $i)" || { echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; tail -20 /tmp/sakh-dev-forummsg.log; exit 2; }

S=forummsg
agent-browser --session $S close >/dev/null 2>&1

MOBILE_CHECK='
(function(){
  var msgs=[].slice.call(document.querySelectorAll(".sk-msg")).filter(function(m){return !m.className.includes("sk-msg-deleted");});
  if(!msgs.length) return "ОШИБКА: сообщений .sk-msg нет в DOM";
  var m=msgs[0], cs=getComputedStyle(m), r=m.getBoundingClientRect();
  var head=m.querySelector(".sk-msg-head");
  var num=m.querySelector(".sk-msg-num"), auth=m.querySelector(".sk-msg-author"),
      btn=m.querySelector(".sk-btn-reply"), body=m.querySelector(".sk-msg-body"),
      flood=[].slice.call(m.querySelectorAll(".sk-flood-btn"));
  var p=[];
  p.push("сообщений на стр.: "+msgs.length);
  p.push(".sk-msg display="+cs.display+" wrap="+cs.flexWrap+" padding="+cs.paddingTop+"/"+cs.paddingRight+" gap="+cs.rowGap+"/"+cs.columnGap);
  p.push(".sk-msg-head display="+(head?getComputedStyle(head).display:"?"));
  if(num){var nr=num.getBoundingClientRect();p.push("№ top="+Math.round(nr.top)+" fs="+getComputedStyle(num).fontSize+" pad="+getComputedStyle(num).paddingTop);}
  if(auth){var ar=auth.getBoundingClientRect();p.push("ник: "+auth.textContent.trim().slice(0,18)+" top="+Math.round(ar.top)+" oneLine="+(num?Math.abs(nr.top-ar.top)<3:"?"));}
  if(btn){var br=btn.getBoundingClientRect();var bs=getComputedStyle(btn);
    p.push("Ответить: "+Math.round(br.width)+"x"+Math.round(br.height)+"px pad="+bs.paddingTop+" "+bs.paddingRight+" fs="+bs.fontSize+" в цепочке="+(auth?(Math.abs(auth.getBoundingClientRect().top-br.top)<3):"?"));}
  if(body){
    var bR=body.getBoundingClientRect(), bcs=getComputedStyle(body);
    var chainBottom=Math.max.apply(null,[num,auth,btn].filter(Boolean).map(function(e){return e.getBoundingClientRect().bottom;}));
    p.push("зазор цепочка→текст: "+(bR.top-chainBottom).toFixed(1)+"px");
    p.push("текст pad="+bcs.paddingTop+"/"+bcs.paddingLeft+" w="+Math.round(bR.width)+" (рамка w="+Math.round(r.width)+")");
  }
  if(flood.length){
    var f0=flood[0], fcs=getComputedStyle(f0), fR=f0.getBoundingClientRect();
    p.push(f0.textContent.trim()+": fs="+fcs.fontSize+" color="+fcs.color+" под текстом="+(body?(fR.top>body.getBoundingClientRect().bottom-1):"?")+" links="+flood.length);
  }
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!("+dw.scrollWidth+")":"нет"));
  return p.join(" | ");
})()
'

DESK_CHECK='
(function(){
  var msgs=[].slice.call(document.querySelectorAll(".sk-msg")).filter(function(m){return !m.className.includes("sk-msg-deleted");});
  if(!msgs.length) return "ОШИБКА: сообщений нет";
  var m=msgs[0], cs=getComputedStyle(m);
  var head=m.querySelector(".sk-msg-head");
  var btn=m.querySelector(".sk-btn-reply"), body=m.querySelector(".sk-msg-body"),
      flood=m.querySelector(".sk-flood-btn");
  var p=[];
  p.push(".sk-msg display="+cs.display+" padding="+cs.paddingTop);
  p.push(head?("шапка display="+getComputedStyle(head).display+" bg="+getComputedStyle(head).backgroundColor+" pad="+getComputedStyle(head).paddingTop+" "+getComputedStyle(head).paddingLeft+" minH="+getComputedStyle(head).minHeight):"нет шапки");
  p.push(btn?("Ответить fs="+getComputedStyle(btn).fontSize+" pad="+getComputedStyle(btn).paddingTop+" "+getComputedStyle(btn).paddingLeft):"нет кнопки");
  p.push(body?("тело pad="+getComputedStyle(body).paddingTop+" "+getComputedStyle(body).paddingRight+" "+getComputedStyle(body).paddingBottom):"нет тела");
  p.push(flood?("ссылка fs="+getComputedStyle(flood).fontSize+" color="+getComputedStyle(flood).color):"нет ссылок");
  var dw=document.documentElement;
  p.push("прокрутка-X: "+(dw.scrollWidth>dw.clientWidth?"ЕСТЬ!":"нет"));
  return p.join(" | ");
})()
'

snap_mobile () {
  local vp="$1" name="$2" shot="$3"
  agent-browser --session $S open "http://localhost:3000/?topic=34" >/dev/null 2>&1
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
snap_mobile "400 850" "Тема форума (Аэрогриль)" "forummsg-400.png"
snap_mobile "320 700" "Тема форума 320px (стресс-тест узкого экрана)" "forummsg-320.png"

echo "======== ДЕСКТОП 1280px (эталон ДО) ========"
agent-browser --session $S open "http://localhost:3000/?topic=34" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 2500 >/dev/null 2>&1
agent-browser --session $S set viewport 1280 900 >/dev/null 2>&1
agent-browser --session $S wait 1500 >/dev/null 2>&1
agent-browser --session $S eval "$DESK_CHECK" 2>/dev/null
agent-browser --session $S screenshot $OUT/forummsg-desktop-1280.png >/dev/null 2>&1 && echo "скрин: $OUT/forummsg-desktop-1280.png"

echo "======== Эталон главной: мобайл 400 / десктоп 1280 не сломаны ========"
agent-browser --session $S set viewport 400 800 >/dev/null 2>&1
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 2000 >/dev/null 2>&1
agent-browser --session $S eval '
(function(){
  var mh=document.querySelector(".sm-mh-wrap"), burg=document.querySelector(".sm-mh-burger");
  var dw=document.documentElement;
  return "мобайл 400: scrollW="+dw.scrollWidth+" clientW="+dw.clientWidth+" | шапка: "+(mh?Math.round(mh.getBoundingClientRect().height):"?")+"px | бургер: "+(burg?getComputedStyle(burg).display:"?");
})()
' 2>/dev/null

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
agent-browser --session $S console 2>/dev/null | grep -iE "error" | head -5 || echo "(ошибок в консоли нет)"
agent-browser --session $S close >/dev/null 2>&1

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
echo "приёмка завершена"
