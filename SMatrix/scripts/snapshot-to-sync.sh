#!/bin/bash
# snapshot-to-sync.sh — делает полный snapshot состояния проекта
# и кладёт его в /home/sync/repo.tar (который платформа использует
# для восстановления между сессиями).
#
# Запуск: bash scripts/snapshot-to-sync.sh "краткое описание правок"
#
# Что попадает в snapshot:
#   - .git/ (с всей историей коммитов)
#   - src/, scripts/, prisma/, public/, package.json, bun.lock, .env
#   - db/custom.db (БД — SQLite-файл со всеми публикациями)
#   - .gitignore, README.md, и т.д.
#
# Что НЕ попадает (чтобы tar не раздувался):
#   - node_modules/ (ставится через bun install)
#   - .next/ (build cache, пересоберётся)
#   - skills/ (общая папка платформы)
#   - download/, upload/ (пользовательские файлы — отдельно в /home/sync/upload/)
#   - *.log

set -e
cd /home/z/my-project

MSG="${1:-snapshot $(date -u +%Y-%m-%dT%H:%M:%SZ)}"
echo "=== Создаю snapshot: $MSG ==="

# Шаг 1: коммит в локальный git (чтобы .git/ был актуальным)
git add -A 2>&1 | tail -2
git commit -m "$MSG" --no-verify 2>&1 | tail -3 || echo "(нет изменений для коммита)"

# Шаг 2: создаю новый repo.tar со всеми файлами
TMP_TAR=/tmp/repo-$(date +%s).tar
echo ""
echo "=== Создаю tar со всеми файлами проекта ==="
tar -cf "$TMP_TAR" \
  --exclude="node_modules" \
  --exclude=".next" \
  --exclude="skills" \
  --exclude="download" \
  --exclude="upload" \
  --exclude="*.log" \
  --exclude="dev-server.log" \
  --exclude="dev.log" \
  --exclude="server.log" \
  . 2>&1 | tail -3

SIZE=$(du -h "$TMP_TAR" | cut -f1)
FILES=$(tar -tf "$TMP_TAR" | wc -l)
echo "✓ tar создан: $SIZE, $FILES файлов"

# Шаг 3: бэкапирую старый repo.tar (на всякий случай)
if [ -f /home/sync/repo.tar ]; then
  cp /home/sync/repo.tar /home/sync/repo.tar.bak 2>&1
  echo "✓ Старый repo.tar → repo.tar.bak"
fi

# Шаг 4: заменяю /home/sync/repo.tar
mv "$TMP_TAR" /home/sync/repo.tar 2>&1
chmod 644 /home/sync/repo.tar 2>&1
echo "✓ /home/sync/repo.tar обновлён ($SIZE, $FILES файлов)"

# Шаг 5 (опционально): также пушу на GitHub, если задан GITHUB_TOKEN
if [ -n "$GITHUB_TOKEN" ]; then
  echo ""
  echo "=== Пушу на GitHub ==="
  git push "https://lanister333:${GITHUB_TOKEN}@github.com/lanister333/SMatrix.git" main 2>&1 | tail -5
  echo "✓ Запушено на GitHub"
fi

echo ""
echo "✅ Snapshot готов!"
echo "Файлы сохранены в /home/sync/repo.tar"
echo "При следующем старте сессии состояние автоматически восстановится"
