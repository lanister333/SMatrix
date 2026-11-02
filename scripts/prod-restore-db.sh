#!/bin/bash
#
# prod-restore-db.sh — аварийное восстановление БД из снапшота на проде.
#
# Запускать на прод-сервере (через SSH):
#   bash prod-restore-db.sh
#
# Скрипт:
#   1. Находит директорию проекта (по custom.db или package.json)
#   2. Проверяет, есть ли снапшот БД в db/
#   3. Переименовывает текущую БД в .broken-<timestamp>
#   4. Копирует снапшот на место custom.db
#   5. Выставляет права 644
#   6. Удаляет WAL/journal, если есть
#   7. Пытается перезапустить pm2/systemctl
#
# Скрипт безопасный: НЕ УДАЛЯЕТ текущую БД, а переименовывает её.
#

set -e

echo "=== Поиск директории проекта ==="
PROJECT_DIR=""

# Список возможных путей к проекту
CANDIDATES=(
    "/opt/smatrix"
    "/opt/SMatrix"
    "/root/SMatrix"
    "/home/z/SMatrix"
    "/var/www/smatrix"
    "/var/www/SMatrix"
    "/srv/smatrix"
    "/srv/SMatrix"
)

# Также ищем через find (быстрый поиск в /)
for c in "${CANDIDATES[@]}"; do
    if [ -d "$c/db" ] && [ -f "$c/package.json" ]; then
        PROJECT_DIR="$c"
        break
    fi
done

# Если не нашли — пробуем find
if [ -z "$PROJECT_DIR" ]; then
    echo "Не нашли в стандартных путях, ищем через find (может занять время)..."
    FOUND=$(find / -maxdepth 6 -name "custom.db" -type f 2>/dev/null | head -5)
    if [ -n "$FOUND" ]; then
        # Берём первый результат
        DB_PATH=$(echo "$FOUND" | head -1)
        PROJECT_DIR=$(dirname "$(dirname "$DB_PATH")")
    fi
fi

if [ -z "$PROJECT_DIR" ]; then
    echo "❌ Не найдена директория проекта. Укажите путь вручную:"
    echo "   PROJECT_DIR=/path/to/SMatrix bash prod-restore-db.sh"
    exit 1
fi

echo "✓ Директория проекта: $PROJECT_DIR"
DB_DIR="$PROJECT_DIR/db"
DB_FILE="$DB_DIR/custom.db"

# Можно переопределить через env
if [ -n "$PROJECT_DIR_OVERRIDE" ]; then
    PROJECT_DIR="$PROJECT_DIR_OVERRIDE"
    DB_DIR="$PROJECT_DIR/db"
    DB_FILE="$DB_DIR/custom.db"
fi

echo ""
echo "=== Поиск снапшота ==="
SNAPSHOT=$(ls -1 "$DB_DIR"/custom.db.snapshot-* 2>/dev/null | sort | tail -1)
if [ -z "$SNAPSHOT" ]; then
    SNAPSHOT=$(ls -1 "$DB_DIR"/custom.db.bak-* 2>/dev/null | sort | tail -1)
fi

if [ -z "$SNAPSHOT" ]; then
    echo "❌ Снапшот не найден в $DB_DIR/custom.db.snapshot-*"
    echo "   Положите снапшот в директорию db/ и запустите скрипт снова."
    exit 1
fi
echo "✓ Снапшот: $SNAPSHOT"
SNAPSHOT_SIZE=$(stat -c %s "$SNAPSHOT" 2>/dev/null || stat -f %z "$SNAPSHOT")
echo "   Размер: $SNAPSHOT_SIZE байт"

echo ""
echo "=== Состояние текущей БД ==="
if [ -f "$DB_FILE" ]; then
    DB_SIZE=$(stat -c %s "$DB_FILE" 2>/dev/null || stat -f %z "$DB_FILE")
    echo "✓ Файл существует: $DB_FILE ($DB_SIZE байт)"
    if command -v sqlite3 >/dev/null 2>&1; then
        if sqlite3 "$DB_FILE" "SELECT count(*) FROM sqlite_master;" >/dev/null 2>&1; then
            echo "✓ SQLite: файл открывается корректно"
            echo ""
            echo "БД, кажется, рабочая. Всё равно восстановить из снапшота? (y/N)"
            read -r CONFIRM
            if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
                echo "Отменено."
                exit 0
            fi
        else
            echo "❌ SQLite: файл НЕ открывается — нужно восстанавливать"
        fi
    else
        echo "⚠ sqlite3 не установлен — не могу проверить, восстанавливаю без проверки"
    fi
else
    echo "❌ Файл БД не существует: $DB_FILE"
fi

echo ""
echo "=== Восстановление ==="
TIMESTAMP=$(date +%s)

# 1. Переименовать текущую БД (если есть)
if [ -f "$DB_FILE" ]; then
    BACKUP="$DB_DIR/custom.db.broken-$TIMESTAMP"
    echo "→ Переименую старую БД в $BACKUP"
    mv "$DB_FILE" "$BACKUP"
fi

# 2. Удалить WAL/journal если есть
for ext in "-wal" "-journal" "-shm"; do
    if [ -f "$DB_FILE$ext" ]; then
        echo "→ Удаляю $DB_FILE$ext"
        rm -f "$DB_FILE$ext"
    fi
done

# 3. Скопировать снапшот на место custom.db
echo "→ Копирую снапшот на место $DB_FILE"
cp "$SNAPSHOT" "$DB_FILE"

# 4. Выставить права 644
chmod 644 "$DB_FILE"
echo "→ Права: 644"

# 5. Проверить, что новая БД открывается
if command -v sqlite3 >/dev/null 2>&1; then
    if sqlite3 "$DB_FILE" "SELECT count(*) FROM sqlite_master;" >/dev/null 2>&1; then
        echo "✓ Новая БД открывается корректно"
        TABLES=$(sqlite3 "$DB_FILE" "SELECT count(*) FROM sqlite_master WHERE type='table';")
        echo "   Таблиц в БД: $TABLES"
    else
        echo "❌ ВНИМАНИЕ: новая БД тоже не открывается — снапшот повреждён"
        exit 1
    fi
fi

echo ""
echo "=== Перезапуск процесса ==="
if command -v pm2 >/dev/null 2>&1; then
    PM2_PROCESS=$(pm2 list 2>/dev/null | grep -E "smatrix|sakhmatrix|SMatrix" | awk '{print $2}' | head -1)
    if [ -n "$PM2_PROCESS" ]; then
        echo "→ pm2 restart $PM2_PROCESS"
        pm2 restart "$PM2_PROCESS"
    else
        echo "⚠ pm2 установлен, но процесс не найден. Перезапустите вручную."
    fi
elif command -v systemctl >/dev/null 2>&1; then
    if systemctl is-active --quiet smatrix 2>/dev/null; then
        echo "→ systemctl restart smatrix"
        systemctl restart smatrix
    elif systemctl is-active --quiet sakhmatrix 2>/dev/null; then
        echo "→ systemctl restart sakhmatrix"
        systemctl restart sakhmatrix
    else
        echo "⚠ systemctl установлен, но сервис не найден. Перезапустите вручную."
    fi
else
    echo "⚠ Ни pm2, ни systemctl не найдены. Перезапустите процесс вручную."
fi

echo ""
echo "=== Готово ==="
echo "БД восстановлена из снапшота: $SNAPSHOT"
echo "Старая БД сохранена как: $DB_DIR/custom.db.broken-$TIMESTAMP"
echo ""
echo "Проверьте сайт: http://157.22.252.127/"
