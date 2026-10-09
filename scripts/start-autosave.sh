#!/bin/bash
# Автосохранение SakhMatrix на GitHub каждые N минут.
# Запускается через setsid+nohup, переживает завершение родительского shell.
#
# Лог: /tmp/smatrix-autosave.log
#
# Что делает:
#   1) Каждые 5 минут проверяет git status в /home/z/my-project/smatrix
#   2) Если есть изменения — git add -A + commit с автосообщением + push
#   3) Логирует все действия в /tmp/smatrix-autosave.log
#
# Токен GitHub читается из переменной окружения GH_TOKEN.
# Запуск: GH_TOKEN=ghp_... bash /home/z/my-project/smatrix/scripts/start-autosave.sh
# Остановка: pkill -f "smatrix-autosave.sh"

INTERVAL_SEC=300   # 5 минут
REPO=/home/z/my-project/smatrix
LOG=/tmp/smatrix-autosave.log

# Токен из окружения
if [ -z "$GH_TOKEN" ]; then
  echo "ERROR: GH_TOKEN env not set" >&2
  exit 1
fi
REMOTE="https://${GH_TOKEN}@github.com/lanister333/SMatrix.git"

# Убиваем прошлый экземпляр
pkill -9 -f "smatrix-autosave.sh" 2>/dev/null
sleep 1

# Полное отсоединение от родителя
setsid nohup bash -c "
  cd '$REPO' || exit 1
  echo \"[\$(date -u +%FT%TZ)] autosave started, interval=${INTERVAL_SEC}s\" >> '$LOG'
  while true; do
    sleep ${INTERVAL_SEC}
    echo \"[\$(date -u +%FT%TZ)] tick: check git status\" >> '$LOG'
    # Проверяем, есть ли проект (песочница могла сброситься)
    if [ ! -f '$REPO/package.json' ]; then
      echo \"[\$(date -u +%FT%TZ)] project gone (sandbox reset), autosave exit\" >> '$LOG'
      exit 0
    fi
    # Если изменений нет — пропускаем
    if [ -z \"\$(git status --porcelain)\" ]; then
      echo \"[\$(date -u +%FT%TZ)] no changes\" >> '$LOG'
      continue
    fi
    # Коммитим и пушим (REMOTE скрыт из лога через envsubst в runtime)
    git add -A >> '$LOG' 2>&1
    MSG=\"autosave \$(date -u +%FT%TZ)\"
    git commit -m \"\$MSG\" >> '$LOG' 2>&1
    PUSH_REMOTE=\$(echo '$REMOTE' | sed 's|ghp_[A-Za-z0-9]*|***|g')
    echo \"[\$(date -u +%FT%TZ)] pushing to \$PUSH_REMOTE\" >> '$LOG'
    git push '$REMOTE' main >> '$LOG' 2>&1
    if [ \$? -eq 0 ]; then
      echo \"[\$(date -u +%FT%TZ)] OK: committed and pushed '\$MSG'\" >> '$LOG'
    else
      echo \"[\$(date -u +%FT%TZ)] WARN: push failed (offline or quota?)\" >> '$LOG'
    fi
  done
" </dev/null >>"$LOG" 2>&1 &
PID=$!
disown $PID 2>/dev/null
echo "autosave daemon spawned PID=$PID"
echo "log: $LOG"
echo "interval: ${INTERVAL_SEC}s (5 min)"
echo
sleep 1
tail -3 "$LOG" 2>&1
