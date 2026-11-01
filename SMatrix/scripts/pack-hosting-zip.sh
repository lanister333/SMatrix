#!/bin/bash
# Упаковка проекта SakhMatrix в ZIP для переноса на хостинг.
# Включается вся работа: исходники, БД, скрипты верификации, скриншоты приёмки,
# документация (HANDOFF.md, worklog.md), конфиги, .env.
# Исключается только восстанавливаемое/платформенное: node_modules, .next,
# .git (241M — история остаётся на платформе), skills/, upload/, tool-results/, логи.
set -euo pipefail
cd /home/z/my-project

STAMP=$(date +%Y-%m-%d)
ZIP="download/sakhmatrix-full-${STAMP}.zip"
rm -f "$ZIP"

# Корневые файлы проекта
ROOTS=(
  src prisma db public scripts examples mini-services reverse tests .zscripts
  download
  package.json bun.lock tsconfig.json next.config.ts next-env.d.ts
  tailwind.config.ts postcss.config.mjs eslint.config.mjs components.json
  .env .gitignore Caddyfile HANDOFF.md worklog.md
)

zip -r -q "$ZIP" "${ROOTS[@]}" \
  -x "download/sakhmatrix-full-*.zip" \
  -x "*.log" \
  -x "tsconfig.tsbuildinfo" \
  -x ".next/*"

echo "== Готово =="
ls -lh "$ZIP"
echo "== Целостность =="
unzip -t "$ZIP" > /dev/null && echo "OK: архив цел"
echo "== Состав (сводка) =="
unzip -l "$ZIP" | tail -1
unzip -l "$ZIP" | rg -o " (src|prisma|db|public|scripts|download)/" | sort | uniq -c | sort -rn | head -8
echo "== Ключевые файлы на месте =="
unzip -l "$ZIP" | rg -c "db/custom.db|prisma/schema.prisma|package.json|bun.lock|HANDOFF.md|worklog.md|src/app/page.tsx|src/app/globals.css" || true
unzip -l "$ZIP" | rg "db/custom.db|prisma/schema.prisma|src/app/page.tsx|src/app/globals.css|src/components/site/left-nav.tsx|src/components/site/chrome.tsx" | awk '{print $4}'
