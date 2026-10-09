#!/bin/bash
# Генеральная репетиция внешнего хостинга: распаковка → установка → сборка → запуск → проверка
set -e
R=/tmp/hosting-rehearsal
rm -rf "$R" && mkdir -p "$R"
echo "== 1. Копия проекта (как в zip: без node_modules и .next) =="
cd /home/z/my-project
tar -c --exclude=node_modules --exclude=.next --exclude=dev.log --exclude=server.log \
    --exclude='upload/*' --exclude=skills --exclude=tool-results --exclude=reverse \
    --exclude=examples --exclude=mini-services --exclude=download \
    src prisma db public scripts package.json bun.lock next.config.ts tsconfig.json \
    eslint.config.mjs components.json postcss.config.mjs tailwind.config.ts next-env.d.ts \
    | tar -x -C "$R"
echo "скопировано: $(du -sh "$R" | cut -f1)"

echo "== 2. .env с АБСОЛЮТНЫМ путём ЭТОЙ машины (как должно быть на чужом хостинге) =="
echo "DATABASE_URL=file:$R/db/custom.db" > "$R/.env"
cat "$R/.env"

echo "== 3. bun install (на хостинге ставится с нуля) =="
cd "$R" && bun install --frozen-lockfile 2>&1 | tail -3

echo "== 4. Сборка =="
bun run build 2>&1 | tail -4
echo "BUILD EXIT: $?"

echo "== 5. Запуск standalone (как на хостинге: node server.js) =="
cp -r "$R/db" "$R/.next/standalone/db" 2>/dev/null || true
cp -r "$R/.next/static" "$R/.next/standalone/.next/static"
cp -r "$R/public" "$R/.next/standalone/public"
cd "$R/.next/standalone"
(PORT=3999 HOSTNAME=127.0.0.1 nohup node server.js > "$R/server.log" 2>&1 &)
sleep 6

echo "== 6. Проверка маршрутов =="
for u in / /podslyshano /gkh /o-rabotodatelyah /traffic.php /weather.php /currency.php /api/topics?page=1\&perPage=8 /api/home/rates; do
  curl -m 12 -sS -o /dev/null -w "$u -> HTTP:%{http_code} %{time_total}s\n" "http://127.0.0.1:3999$u"
done

echo "== 7. Данные БД читаются? =="
curl -m 12 -sS "http://127.0.0.1:3999/api/topics?page=1&perPage=3" | head -c 300; echo
echo "== 8. Ошибки в логе сервера =="
rg -i 'error|cannot|not found' "$R/server.log" | head -5 || echo 'ошибок нет'
