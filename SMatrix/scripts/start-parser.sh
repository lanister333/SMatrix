#!/bin/bash
# Запуск парсера «Театра ботов» в цикле (каждые 60 мин).
cd /home/z/my-project/smatrix

pkill -9 -f "parser-telegram.ts" 2>/dev/null
sleep 1

rm -f /tmp/smatrix-parser.log

export DATABASE_URL="file:/home/z/my-project/smatrix/db/custom.db"
setsid nohup bun scripts/theatre-bots/parser-telegram.ts --loop 60 --limit 3 \
  </dev/null >/tmp/smatrix-parser.log 2>&1 &
PID=$!
disown $PID 2>/dev/null

echo "spawned PID=$PID"
sleep 2
echo "still alive: $(ps -p $PID -o pid= 2>/dev/null || echo NO)"
echo "log: /tmp/smatrix-parser.log"
echo
echo "=== first 30 lines of log ==="
sleep 3
tail -30 /tmp/smatrix-parser.log
