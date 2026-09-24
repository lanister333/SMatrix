#!/bin/bash
# ДИРЕКТИВА «Футер в синий цвет горизонтальных плашек»:
# фон .mp-footer — тот же синий, что у ВСЕХ горизонтальных плашек сайта
# (навигация .sm-mainnav, заголовки секций .sk-blocktitle/.mp-paneltitle),
# т.е. var(--sm-navy) #1e3a5f, было #004B87.
# Проверяются: Главная, Форум, Объявления, Валюты, Отключения, Погода,
# Пробки, Помощь @1920 + мобайл 400 + скриншоты + приёмка.
set -u
cd /home/z/my-project
PORT=3000

for p in $(ss -tlnp 2>/dev/null | rg ":$PORT" | rg -o 'pid=[0-9]+' | rg -o '[0-9]+'); do kill -9 "$p" 2>/dev/null; done
sleep 1
rm -rf .next
nohup bun run dev > /tmp/dev.log 2>&1 &
disown
ok=""
for i in $(seq 1 90); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://localhost:$PORT/" 2>/dev/null)
  [ "$code" = "200" ] && { ok=1; echo "сервер готов (${i}с)"; break; }
  sleep 1
done
[ -z "$ok" ] && { echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; tail -20 /tmp/dev.log; exit 1; }

# Цвет футера против плашек на странице
footer_check() {
  local url="$1" w="$2"
  agent-browser set viewport "$w" 900 >/dev/null
  agent-browser open "http://localhost:$PORT$url" >/dev/null 2>&1
  agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
  agent-browser eval "
(() => {
  const f = document.querySelector('.mp-footer');
  if (!f) return JSON.stringify({err: 'нет футера'});
  const nav = document.querySelector('.sm-mainnav');
  const plate = document.querySelector('.sk-blocktitle, .mp-paneltitle');
  const de = document.documentElement;
  const bg = (el) => el ? getComputedStyle(el).backgroundColor : null;
  const a = f.querySelector('a');
  return JSON.stringify({
    footer: bg(f), nav: bg(nav), plate: bg(plate),
    sameAsNav: bg(f) === bg(nav) && bg(f) === 'rgb(30, 58, 95)',
    sameAsPlate: plate ? bg(f) === bg(plate) : 'n/a',
    text: getComputedStyle(f).color,
    link: a ? getComputedStyle(a).color : null,
    hscroll: de.scrollWidth > de.clientWidth
  });
})()" 2>/dev/null
}

echo "== Все страницы @1920 (ожидание: footer rgb(30,58,95) = nav = plate, текст белый) =="
for u in "/" "/?view=forum" "/obyavleniya" "/currency.php" "/disconnections.php" "/weather.php" "/traffic.php" "/help"; do
  echo "  $u: $(footer_check "$u" 1920)"
done
echo "== Мобайл 400: футер синий, откатки целы =="
for u in "/" "/?view=forum" "/currency.php"; do
  echo "  $u: $(footer_check "$u" 400)"
done

echo "== Скриншоты =="
agent-browser set viewport 1920 1080 >/dev/null
agent-browser open "http://localhost:$PORT/" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser scroll down 9999 >/dev/null 2>&1
sleep 1
agent-browser screenshot /home/z/my-project/download/footer-navy-main-1920.png >/dev/null
echo "скриншот: download/footer-navy-main-1920.png"
agent-browser set viewport 1920 1080 >/dev/null
agent-browser open "http://localhost:$PORT/?view=forum" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser scroll down 9999 >/dev/null 2>&1
sleep 1
agent-browser screenshot /home/z/my-project/download/footer-navy-forum-1920.png >/dev/null
echo "скриншот: download/footer-navy-forum-1920.png"
echo "== Приёмка =="
bun scripts/test-informers.ts 2>&1 | grep -E "✗|ИТОГО"
echo "== ГОТОВО =="
