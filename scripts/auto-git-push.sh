#!/bin/bash
# Авто-коммит изменений SakhMatrix на GitHub
cd /opt/smatrix

# Проверяем — есть ли изменения
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
    echo "[$(date)] Нет изменений"
    exit 0
fi

# Коммитим
git add -A
git commit -m "auto: changes from VPS $(date +%Y-%m-%d_%H:%M)" --allow-empty
git push origin main
echo "[$(date)] Запушено на GitHub"
