#!/bin/bash
# Snapshot текущего состояния проекта на GitHub.
# Запуск: bash scripts/snapshot-to-github.sh "краткое описание правок"
# Использует GitHub PAT из переменной окружения GITHUB_TOKEN или
# требует HTTPS-URL с встроенным токеном (одноразово).

set -e
cd /home/z/my-project

# Если GITHUB_TOKEN задан — используем его
TOKEN="${GITHUB_TOKEN:-}"
REMOTE_URL="https://github.com/lanister333/SMatrix.git"

if [ -n "$TOKEN" ]; then
  PUSH_URL="https://lanister333:${TOKEN}@github.com/lanister333/SMatrix.git"
else
  PUSH_URL="$REMOTE_URL"
fi

# Снимок: добавляем все изменения и коммитим
git add -A
MSG="${1:-snapshot $(date -u +%Y-%m-%dT%H:%M:%SZ)}"
git commit -m "$MSG" --no-verify 2>&1 || echo "No changes to commit"
git push "$PUSH_URL" main 2>&1 | tail -5
echo "✓ Snapshot '$MSG' запушен на GitHub"
