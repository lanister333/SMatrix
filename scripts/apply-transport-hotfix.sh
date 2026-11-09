#!/bin/bash
#
# Горячий патч CSS расписания транспорта на проде (без полного ребилда).
#
# Запускать НА прод-сервере (через SSH):
#   bash apply-transport-hotfix.sh
#
# Что делает:
#   1. Находит CSS-чанк в .next/static/chunks/
#   2. Делает бэкап старого файла
#   3. Скачивает исправленный CSS из GitHub (main branch)
#   4. Заменяет файл на новый (с тем же именем bf7636764e459831.css)
#   5. Перезапускает Next.js prod-сервер
#
# Почему не полный деплой: автодеплой сломан (webhook стреляет, но
# bun run build где-то падает). Этот скрипт применит только CSS-фикс,
# без пересборки — занимает ~5 секунд вместо 3 минут.
#
# После применения: откройте /transport.php на мобильном, сделайте
# hard refresh (Ctrl+Shift+R), наложения слов больше не будет.

set -e

PROJECT=/opt/smatrix
CSS_NAME=bf7636764e459831.css
CSS_PATH="$PROJECT/.next/static/chunks/$CSS_NAME"
CSS_URL="https://raw.githubusercontent.com/lanister333/SMatrix/main/public/transport-hotfix.css"

echo "=== Горячий патч CSS расписания транспорта ==="
echo "Проект:     $PROJECT"
echo "CSS-файл:   $CSS_PATH"
echo ""

# 0. Проверки
if [ ! -f "$CSS_PATH" ]; then
  echo "ОШИБКА: CSS-файл не найден: $CSS_PATH"
  echo "Возможно, проект установлен в другой директории."
  echo "Поищем автоматически..."
  FOUND=$(find / -name "$CSS_NAME" -path "*/.next/static/chunks/*" 2>/dev/null | head -1)
  if [ -n "$FOUND" ]; then
    CSS_PATH="$FOUND"
    PROJECT=$(echo "$FOUND" | sed 's|/.next/.*||')
    echo "Найдено: $CSS_PATH"
    echo "Проект:  $PROJECT"
  else
    echo "Не найдено. Укажите путь вручную."
    exit 1
  fi
fi

# 1. Бэкап
BACKUP="$CSS_PATH.bak.$(date +%s)"
echo ">>> Бэкап старого CSS в $BACKUP"
cp "$CSS_PATH" "$BACKUP"
echo "    Размер старого: $(wc -c < "$BACKUP") байт"
echo "    MD5: $(md5sum "$BACKUP" | awk '{print $1}')"

# 2. Скачать новый CSS
echo ""
echo ">>> Скачиваю исправленный CSS из GitHub"
curl -fsSL -o /tmp/transport-hotfix.css "$CSS_URL"
echo "    Размер нового: $(wc -c < /tmp/transport-hotfix.css) байт"
echo "    MD5: $(md5sum /tmp/transport-hotfix.css | awk '{print $1}')"

# Проверка что файл не пустой и похож на CSS
if [ ! -s /tmp/transport-hotfix.css ]; then
  echo "ОШИБКА: скачанный файл пустый"
  exit 1
fi
if ! grep -q "ts-col-direction" /tmp/transport-hotfix.css; then
  echo "ОШИБКА: скачанный файл не содержит ts-col-direction правил"
  exit 1
fi

# 3. Заменить файл
echo ""
echo ">>> Заменяю $CSS_NAME на новый"
mv /tmp/transport-hotfix.css "$CSS_PATH"
chmod 644 "$CSS_PATH"
echo "    OK"

# 4. Перезапустить Next.js
echo ""
echo ">>> Перезапускаю Next.js prod"
PIDS=$(ps aux | grep -E 'bun .*.next/standalone/server' | grep -v grep | awk '{print $2}')
if [ -n "$PIDS" ]; then
  echo "    Kill old PID: $PIDS"
  echo "$PIDS" | xargs kill -KILL 2>/dev/null || true
  sleep 2
fi
cd "$PROJECT"
nohup /root/.bun/bin/bun .next/standalone/server.js > /var/log/smatrix-prod.log 2>&1 &
sleep 3
NEW_PID=$(ps aux | grep -E 'bun .*.next/standalone/server' | grep -v grep | awk '{print $2}' | head -1)
if [ -n "$NEW_PID" ]; then
  echo "    Новый PID: $NEW_PID"
else
  echo "    ВНИМАНИЕ: процесс не стартовал. Смотри /var/log/smatrix-prod.log"
fi

echo ""
echo "=== Готово! ==="
echo "Проверь: curl -sk -H 'Cookie: smatrix_bypass=maint3n4nc3Byp4ss' https://localhost/transport.php | grep -o '_next/static/chunks/[a-f0-9]*.css'"
echo "И открой на телефоне /transport.php с hard refresh (Ctrl+Shift+R)."
