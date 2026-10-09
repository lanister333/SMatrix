#!/bin/bash
# Запуск dev-сервера SakhMatrix с полным отсоединением от родителя.
cd /home/z/my-project/smatrix

pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "bunx next" 2>/dev/null
sleep 2

rm -f /tmp/smatrix-dev.log

export DATABASE_URL="file:/home/z/my-project/smatrix/db/custom.db"
setsid nohup bunx next dev -p 3000 </dev/null >/tmp/smatrix-dev.log 2>&1 &
PID=$!
disown $PID 2>/dev/null

echo "spawned PID=$PID"
sleep 1
echo "still alive: $(ps -p $PID -o pid= 2>/dev/null || echo NO)"

for i in $(seq 1 18); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3000 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    echo "READY: HTTP $CODE after ${i}x5s"
    pgrep -f "next-server" | head -1 > /home/z/my-project/.dev-server.pid
    exit 0
  fi
  sleep 5
done

echo "FAIL: server not responding after 90s"
tail -30 /tmp/smatrix-dev.log
exit 1
