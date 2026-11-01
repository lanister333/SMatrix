#!/bin/bash
# Запуск dev-сервера SakhMatrix с полным отсоединением от родителя.
# Запускаем через: bash scripts/start-dev.sh
# Используем setsid + nohup + /dev/null на всех stdio, чтобы пережить
# завершение родительского bash-процесса (платформенный gate).

cd /home/z/my-project

# Убиваем прошлое
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "bunx next" 2>/dev/null
sleep 2

# Чистим логи
rm -f dev-server.log dev.log

# Полное отсоединение: setsid создаёт новую session, nohup игнорирует SIGHUP,
# </dev/null + >log 2>&1 убирают все stdio-привязки к терминалу.
setsid nohup bunx next dev -p 3000 </dev/null >dev-server.log 2>&1 &
PID=$!
disown $PID 2>/dev/null

echo "spawned PID=$PID"
sleep 1
echo "still alive: $(ps -p $PID -o pid= 2>/dev/null || echo NO)"

# Ждём поднятия сервера (до 90 секунд — первый JIT-compile долгий)
for i in $(seq 1 18); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3000 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    echo "READY: HTTP $CODE after ${i}x5s"
    # Записываем pid-файл для последующих проверок
    pgrep -f "next-server" | head -1 > /home/z/my-project/.dev-server.pid
    exit 0
  fi
  sleep 5
done

echo "FAIL: server not responding after 90s"
tail -30 dev-server.log
exit 1
