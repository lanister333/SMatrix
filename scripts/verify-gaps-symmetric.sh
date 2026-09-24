#!/bin/bash
# ДИРЕКТИВА «Исправление зазоров глобальной сетки (ПК-версия)»:
# зазоры между тремя колонками .main-grid-container — идеально симметричны:
# gap:20px !important; у .left-column/.center-column/.right-column внешние
# отступы (margin-left/margin-right) и горизонтальные паддинги обнулены
# !important (раньше .sk-col-left{padding-right:12px} делал визуальный
# зазор слева 32px против 20px справа).
# Проверяются: Главная, Форум, Объявления, Валюты, Отключения, Помощь @1920;
# 1100px (зона перекрытия 901–1150); 1280px; мобайл 400; скриншоты; приёмка.
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

# Замер зазоров и отступов колонок
gaps_check() {
  local url="$1" w="$2"
  agent-browser set viewport "$w" 900 >/dev/null
  agent-browser open "http://localhost:$PORT$url" >/dev/null 2>&1
  agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
  agent-browser eval "
(() => {
  const L = document.querySelector('.left-column');
  const C = document.querySelector('.center-column');
  const R = document.querySelector('.right-column');
  if (!L || !C || !R) return JSON.stringify({err: 'нет колонок'});
  const r = (el) => el.getBoundingClientRect();
  const cs = (el) => getComputedStyle(el);
  const gapL = Math.round(r(C).left - r(L).right);
  const gapR = Math.round(r(R).left - r(C).right);
  const vL = gapL + parseFloat(cs(L).paddingRight) + parseFloat(cs(C).paddingLeft);
  const vR = gapR + parseFloat(cs(C).paddingRight) + parseFloat(cs(R).paddingLeft);
  const de = document.documentElement;
  return JSON.stringify({
    borderGap_L_C: gapL, borderGap_C_R: gapR,
    visualGap_L_C: Math.round(vL), visualGap_C_R: Math.round(vR),
    symmetric: gapL === gapR && Math.round(vL) === Math.round(vR),
    mar: [cs(L).marginLeft + '/' + cs(L).marginRight, cs(C).marginLeft + '/' + cs(C).marginRight, cs(R).marginLeft + '/' + cs(R).marginRight].join(' '),
    pad: [cs(L).paddingLeft + '/' + cs(L).paddingRight, cs(C).paddingLeft + '/' + cs(C).paddingRight, cs(R).paddingLeft + '/' + cs(R).paddingRight].join(' '),
    Lw: Math.round(r(L).width), Cw: Math.round(r(C).width), Rw: Math.round(r(R).width),
    hscroll: de.scrollWidth > de.clientWidth
  });
})()" 2>/dev/null
}

echo "== Все страницы @1920 (ожидание: зазоры 20/20, symmetric:true, mar/pad 0, L 240 C 850 R 300) =="
for u in "/" "/?view=forum" "/obyavleniya" "/currency.php" "/disconnections.php" "/help"; do
  echo "  $u: $(gaps_check "$u" 1920)"
done
echo "== Зона перекрытия 1024-1150 (точка 1100): паддинг левой колонки обязан остаться 0 =="
echo "  /: $(gaps_check "/" 1100)"
echo "== 1280: жёсткий стандарт держится =="
echo "  /obyavleniya: $(gaps_check "/obyavleniya" 1280)"
echo "== Мобайл 400: блоковая откатка цела =="
for u in "/" "/obyavleniya" "/currency.php"; do
  echo "  $u: $(gaps_check "$u" 400)"
done

echo "== Скриншоты =="
agent-browser set viewport 1920 1080 >/dev/null
agent-browser open "http://localhost:$PORT/" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser screenshot /home/z/my-project/download/gaps-symmetric-main-1920.png >/dev/null
echo "скриншот: download/gaps-symmetric-main-1920.png"
agent-browser set viewport 1920 1080 >/dev/null
agent-browser open "http://localhost:$PORT/obyavleniya" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser screenshot /home/z/my-project/download/gaps-symmetric-obyavleniya-1920.png >/dev/null
echo "скриншот: download/gaps-symmetric-obyavleniya-1920.png"
echo "== Приёмка =="
bun scripts/test-informers.ts 2>&1 | grep -E "✗|ИТОГО"
echo "== ГОТОВО =="
