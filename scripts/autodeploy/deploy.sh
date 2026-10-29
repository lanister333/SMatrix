#!/bin/bash
# Скрипт деплоя SMatrix на prod.
# Запускается webhook-сервером при push на main.
# Лог: /var/log/smatrix-deploy.log

set -e
LOG=/var/log/smatrix-deploy.log
PROJECT=/opt/smatrix

echo "=== $(date -Is) — deploy start, trigger=${SMATRIX_DEPLOY_TRIGGER:-manual} ===" >> "$LOG"

# 1. git pull
cd "$PROJECT"
echo ">>> git pull" >> "$LOG"
if ! git pull origin main >> "$LOG" 2>&1; then
  echo "FAIL: git pull" >> "$LOG"
  exit 1
fi

# 2. Удалить старую сборку
echo ">>> rm -rf .next" >> "$LOG"
rm -rf .next

# 3. Сборка (долго, ~2-3 минуты)
echo ">>> bun run build" >> "$LOG"
if ! /root/.bun/bin/bun run build >> "$LOG" 2>&1; then
  echo "FAIL: bun run build" >> "$LOG"
  exit 1
fi

# 4. Убить старый prod
echo ">>> kill old prod" >> "$LOG"
ps aux | grep -E 'bun .*.next/standalone/server' | grep -v grep | awk '{print $2}' | xargs -r kill -KILL 2>/dev/null || true
sleep 2

# 5. Старт нового prod
echo ">>> start new prod" >> "$LOG"
cd "$PROJECT"
nohup /root/.bun/bin/bun .next/standalone/server.js > /var/log/smatrix-prod.log 2>&1 &
disown

# 6. Проверка
sleep 5
if ps aux | grep -E 'bun .*.next/standalone/server' | grep -v grep > /dev/null; then
  echo "=== $(date -Is) — deploy OK ===" >> "$LOG"
else
  echo "=== $(date -Is) — FAIL: prod не стартанул ===" >> "$LOG"
  exit 1
fi
