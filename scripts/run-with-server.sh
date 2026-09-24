#!/bin/bash
# Запускает dev-сервер, ждёт готовности, выполняет тест(ы), глушит сервер.
# Использование: bash scripts/run-with-server.sh scripts/test-employers.ts [ещё-тесты...]
cd /home/z/my-project || exit 1

# Погасить возможные остатки
ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
sleep 2

setsid nohup bun run dev > /tmp/sakh-dev-runner.log 2>&1 < /dev/null &
SERVER_LAUNCHED=$?

# Ждём готовности до 60 сек
up=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then up=1; break; fi
  sleep 1
done
if [ "$up" != "1" ]; then
  echo "СЕРВЕР НЕ ПОДНЯЛСЯ"; tail -20 /tmp/sakh-dev-runner.log; exit 2
fi
echo "сервер готов (попытка $i)"

# Прогон тестов
overall=0
for t in "$@"; do
  echo ""
  echo "===================== $t ====================="
  timeout 420 bun "$t" 2>&1 | grep -v "prisma:query"
  rc=${PIPESTATUS[0]}
  [ "$rc" != "0" ] && overall=1
done

# Глушим сервер
ps aux | grep -E "next dev|bun run dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
exit $overall
