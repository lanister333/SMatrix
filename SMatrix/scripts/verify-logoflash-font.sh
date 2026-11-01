#!/bin/bash
# Фикс «мигания логотипа»: при загрузке страниц логотип сначала рисовался
# фолбэк-шрифтом (font-display:swap), затем менялся на Anton — выглядело как
# «другой логотип → нормальный». Исправление: font-display:block (@font-face
# Anton) + <link rel="preload"> обоих woff2 в layout.tsx.
# One-shot: kill :3000 → rm -rf .next (ловушка Turbopack) → рестарт → проверки → приёмка.
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

echo "== 1. preload-ссылки в отдаваемом HTML (Главная / Форум / Объявления) =="
# rg -c считает СТРОКИ (head — одна строка), поэтому -o | wc -l — вхождения
for u in "/" "/?view=forum" "/obyavleniya"; do
  n=$(curl -s --max-time 10 "http://localhost:$PORT$u" | rg -o 'href="/fonts/anton[^"]*"' | wc -l | tr -d ' ')
  echo "  $u: preload-ссылок Anton = $n (ожидание 2)"
done

echo "== 2. font-display в CSS-бандле (ожидание block ×2, swap отсутствует) =="
css_url=$(curl -s --max-time 10 "http://localhost:$PORT/" | rg -o '/_next/static/[^"]+\.css' | head -1)
echo "  css: $css_url"
curl -s --max-time 10 "http://localhost:$PORT$css_url" > /tmp/bundle.css
# dev-бандл Turbopack содержит пробелы после двоеточия — допускаем \s*
echo "  font-display: block встречается: $(rg -o 'font-display:\s*block' /tmp/bundle.css | wc -l | tr -d ' ')"
echo "  font-display: swap встречается: $(rg -o 'font-display:\s*swap' /tmp/bundle.css | wc -l | tr -d ' ')"

echo "== 3. Браузерная проверка: шрифт загружен, логотип рендерится Anton =="
agent-browser set viewport 1280 900 >/dev/null
agent-browser open "http://localhost:$PORT/" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser eval "
(async () => {
  await document.fonts.ready;
  const loaded = document.fonts.check('16px Anton');
  const h1 = document.querySelector('.sm-masthead-title');
  const cs = h1 ? getComputedStyle(h1) : null;
  const preloads = [...document.querySelectorAll('link[rel=preload][as=font]')].map(l => l.getAttribute('href'));
  const de = document.documentElement;
  return JSON.stringify({
    antonLoaded: loaded,
    fontFamily: cs ? cs.fontFamily.slice(0, 40) : null,
    preloads,
    hscroll: de.scrollWidth > de.clientWidth
  });
})()" 2>/dev/null

echo "== 4. Навигация Главная → Объявления → Форум: шрифт остаётся загруженным (без вспышки) =="
agent-browser open "http://localhost:$PORT/obyavleniya" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser eval "(async () => { await document.fonts.ready; return JSON.stringify({page:'obyavleniya', antonLoaded: document.fonts.check('16px Anton')}); })()" 2>/dev/null
agent-browser open "http://localhost:$PORT/?view=forum" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser eval "(async () => { await document.fonts.ready; return JSON.stringify({page:'forum', antonLoaded: document.fonts.check('16px Anton')}); })()" 2>/dev/null

echo "== Скриншот шапки (ПК 1280) =="
agent-browser set viewport 1280 900 >/dev/null
agent-browser open "http://localhost:$PORT/" >/dev/null 2>&1
agent-browser wait --load networkidle --timeout 20000 >/dev/null 2>&1
agent-browser screenshot /home/z/my-project/download/logoflash-fix-1280.png >/dev/null
echo "скриншот: download/logoflash-fix-1280.png"
echo "== Приёмка =="
bun scripts/test-informers.ts 2>&1 | grep -E "✗|ИТОГО"
echo "== ГОТОВО =="
