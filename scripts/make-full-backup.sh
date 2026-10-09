#!/usr/bin/env bash
# Полный бэкап SakhMatrix для переноса в новую сессию.
# Паттерн handoff-2026-09-17: код+тесты+выдачи+БД+worklog+HANDOFF+download,
# БЕЗ node_modules/.next/.env/.git/логов/tsbuildinfo/вложенных *.zip.
# 2026-09-24 (вечер): download/ ИСКЛЮЧЁН (выданные артефакты прошлых сессий
# ~25МБ, для работы проекта не нужны — как в «latest»-архиве 11МБ);
# + NEW_SESSION_MESSAGE.txt, GIT_HISTORY.txt; исключены старые
# зеркала/части из public (sakhmatrix-backup*), чтобы не упаковывать zip в zip.
# После сборки: md5 + unzip -t; зеркало litterbox.catbox.moe (72ч) — вручную.
set -euo pipefail
cd /home/z/my-project
OUT="download/sakhmatrix-full-backup-$(date +%F).zip"
rm -f "$OUT"
zip -qr "$OUT" \
  src prisma scripts tests public reverse examples mini-services db upload \
  package.json bun.lock bunfig.toml tsconfig.json next-env.d.ts next.config.ts \
  postcss.config.mjs eslint.config.mjs components.json tailwind.config.ts \
  Caddyfile .gitignore HANDOFF.md worklog.md README-NEW-SESSION.md \
  NEW_SESSION_MESSAGE.txt GIT_HISTORY.txt \
  -x 'upload/*.zip' \
  -x 'public/sakhmatrix-backup*' \
  -x 'scripts/shots/*' -x 'scripts/*.png' -x 'scripts/*.webm' -x 'scripts/*.mp4'
echo "=== $OUT ==="
ls -la "$OUT"
echo "=== files: $(unzip -l "$OUT" | tail -1)"
echo "=== md5: $(md5sum "$OUT" | cut -d' ' -f1)"
echo "=== integrity: $(unzip -t "$OUT" > /dev/null && echo OK)"
