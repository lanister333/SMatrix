#!/bin/bash
# Глобальная правка десктопных колонок: сайдбары 300–320px на ВСЕХ страницах.
# Проверка: 5 страниц на десктопе 1280px (ширины колонок + .sakh-card),
# отсутствие горизонтального скролла, нетронутость мобайла 400px.
# Сервер и браузер живут в пределах одного вызова Bash.
cd /home/z/my-project || exit 1
OUT=download/screens
mkdir -p $OUT

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
sleep 2
setsid nohup bun run dev > /tmp/sakh-dev-width.log 2>&1 < /dev/null &
up=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then up=1; break; fi
  sleep 1
done
[ "$up" = "1" ] && echo "сервер готов (попытка $i)" || { echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; tail -20 /tmp/sakh-dev-width.log; exit 2; }

S=width38
agent-browser --session $S close >/dev/null 2>&1

check_page () {
  local url="$1" name="$2"
  agent-browser --session $S set viewport 1280 900 >/dev/null 2>&1
  agent-browser --session $S open "http://localhost:3000$url" >/dev/null 2>&1
  agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
  agent-browser --session $S wait 2500 >/dev/null 2>&1
  echo "---- $name ($url) ----"
  agent-browser --session $S eval '
(function(){
  var L=["sk-layout","hp-layout","oh-layout","wb-layout","gkh-layout","dk-layout","cd-layout","rc-layout","ep-layout","ad-grid","pl-grid"];
  var el=null, cls=null;
  for (var i=0;i<L.length;i++){ el=document.querySelector("."+L[i]); if(el){cls=L[i];break;} }
  if(!el) return "layout-класс НЕ НАЙДЕН";
  var cols=getComputedStyle(el).gridTemplateColumns.split(" ").map(parseFloat).map(Math.round);
  var card=document.querySelector(".sakh-card");
  var cw=card?Math.round(card.getBoundingClientRect().width):null;
  var sw=document.documentElement.scrollWidth, vw=document.documentElement.clientWidth;
  return cls+" | колонки L/C/R: "+cols.join("/")+" | .sakh-card: "+cw+"px | прокрутка-X: "+(sw>vw?("ЕСТЬ! "+sw):"нет");
})()
' 2>/dev/null
}

echo "======== ДЕСКТОП 1280px ========"
check_page "/" "Главная (sk-layout)"
check_page "/?view=forum" "Форум (sk-layout)"
check_page "/obyavleniya" "Объявления (ad-grid)"
check_page "/help" "Справочник (hp-layout)"
check_page "/poleznoe" "Практическая информация (pl-grid)"

echo "== Скриншот главной 1280 (после) =="
agent-browser --session $S open "http://localhost:3000/" >/dev/null 2>&1
agent-browser --session $S wait --load networkidle --timeout 40000 >/dev/null 2>&1
agent-browser --session $S wait 2500 >/dev/null 2>&1
agent-browser --session $S screenshot $OUT/width-desktop-1280.png >/dev/null 2>&1
echo "$OUT/width-desktop-1280.png"

echo "======== МОБАЙЛ 400px (не тронут) ========"
agent-browser --session $S set viewport 400 800 >/dev/null 2>&1
agent-browser --session $S wait 2500 >/dev/null 2>&1
agent-browser --session $S eval '
(function(){
  var l=document.querySelector(".sk-layout");
  var mh=document.querySelector(".sm-mh-wrap");
  var burg=document.querySelector(".sm-mh-burger");
  var sw=document.documentElement.scrollWidth, cw=document.documentElement.clientWidth;
  var cols=getComputedStyle(l).gridTemplateColumns;
  return "grid на мобиле: "+cols+" (одна колонка) | scrollWidth="+sw+" clientWidth="+cw+" | шапка: "+(mh?Math.round(mh.getBoundingClientRect().height):"?")+"px | бургер: "+(burg?getComputedStyle(burg).display:"?");
})()
' 2>/dev/null
agent-browser --session $S screenshot $OUT/width-mobile-400.png >/dev/null 2>&1

echo "======== Промежуточный 1024px (901-1150, не тронут) ========"
agent-browser --session $S set viewport 1024 800 >/dev/null 2>&1
agent-browser --session $S wait 2000 >/dev/null 2>&1
agent-browser --session $S eval '
(function(){
  var l=document.querySelector(".sk-layout");
  return "grid на 1024: "+getComputedStyle(l).gridTemplateColumns+" (ожидание 196/214 — не тронуто)";
})()
' 2>/dev/null

echo "======== Консоль ========"
agent-browser --session $S errors 2>/dev/null | head -5
agent-browser --session $S console 2>/dev/null | grep -iE "error" | head -5 || echo "(ошибок в консоли нет)"
agent-browser --session $S close >/dev/null 2>&1

ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
echo "приёмка завершена"
