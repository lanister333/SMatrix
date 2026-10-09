#!/bin/bash
# Разбивка работы на НЕЗАВИСИМЫЕ zip-части ≤ ~8 МБ (чат-загрузчик не тянул 17 МБ).
# Каждая часть самостоятельна: качаются по очереди, распаковываются отдельно, склейка не нужна.
set -euo pipefail
cd /home/z/my-project
D=download
STAMP=2026-09-17

rm -f $D/sakhmatrix-chast-*.zip

# Часть 1 — ГЛАВНАЯ: код + база + конфиги + документация + лёгкие скрипты
zip -r -9 -q $D/sakhmatrix-chast-1-kod-i-baza.zip \
  src prisma db public examples mini-services reverse tests .zscripts \
  package.json bun.lock tsconfig.json next.config.ts next-env.d.ts \
  tailwind.config.ts postcss.config.mjs eslint.config.mjs components.json \
  .env .gitignore Caddyfile HANDOFF.md worklog.md \
  -x "*.log"
# лёгкие скрипты (без fixtures/openserver-pkg/png)
zip -r -9 -q $D/sakhmatrix-chast-1-kod-i-baza.zip scripts -x "scripts/fixtures/*" -x "scripts/openserver-pkg/*" -x "scripts/*.png"

# Часть 2 — фикстуры сервисов + бэкап-снимок OpenServer
zip -r -9 -q $D/sakhmatrix-chast-2-fikstury-i-server.zip scripts/fixtures scripts/openserver-pkg

# Части 3-4 — скриншоты приёмки (пополам по алфавиту, PNG не сжимаются)
ALL_PNG=$(ls download/*.png 2>/dev/null || true)
HALF=$(echo "$ALL_PNG" | wc -l); HALF=$(( (HALF + 1) / 2 ))
FIRST=$(echo "$ALL_PNG" | sort | head -n $HALF)
SECOND=$(echo "$ALL_PNG" | sort | tail -n +$((HALF+1)))
zip -9 -q $D/sakhmatrix-chast-3-skrinshoty-1.zip $FIRST
zip -9 -q $D/sakhmatrix-chast-4-skrinshoty-2.zip $SECOND download/screens download/*.md download/DEPLOY-HOSTING.txt download/README.md

echo "== ИТОГ =="
ls -lh $D/sakhmatrix-chast-*.zip | awk '{print $5, $NF}'
for z in $D/sakhmatrix-chast-*.zip; do unzip -t "$z" > /dev/null && echo "OK $z"; done
echo "== Всего файлов по частям =="
for z in $D/sakhmatrix-chast-*.zip; do echo "$z: $(unzip -l "$z" | tail -1 | awk '{print $2}')"; done
