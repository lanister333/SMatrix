#!/bin/bash
# Резервный бэкап исходников SakhMatrix (пересоздан после отката воркспейса).
# Восстановление: tar -xf <файл> -C /home/z/my-project
set -e
cd /home/z/my-project
OUT="download/sakhmatrix-source-$(date +%Y-%m-%d-%H%M).tar"
tar -cf "$OUT" \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='skills' \
  --exclude='tool-results' \
  --exclude='download' \
  --exclude='.zscripts' \
  --exclude='dev.log' \
  --exclude='server.log' \
  --exclude='tsconfig.tsbuildinfo' \
  src prisma db scripts upload reverse public examples mini-services worklog.md bun.lock package.json .env tsconfig.json next.config.ts .gitignore 2>/dev/null || true
ls -lh "$OUT"
echo "файлов: $(tar -tf "$OUT" | wc -l)"
