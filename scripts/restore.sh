#!/bin/bash
# ============================================================
# SMatrix — единый скрипт восстановления проекта после сброса
# Запуск:  bash /home/z/my-project/smatrix/scripts/restore.sh
#          (или ./restore.sh из папки scripts/)
# ============================================================
# Что делает:
#   1. Клонирует репозиторий с GitHub если smatrix/ нет
#   2. Подтягивает последние изменения если есть
#   3. Создаёт .env с правильным путём к БД
#   4. Создаёт symlink /home/z/my-project/db/custom.db
#      (нужен для fallback-пути в src/lib/db.ts)
#   5. Устанавливает зависимости через bun install
#   6. Генерирует Prisma-клиент
#   7. Убивает старый dev-сервер (если был)
#   8. Запускает новый dev-сервер в фоне
#   9. Проверяет что все 10 страниц отвечают HTTP 200
# ============================================================
set -e

# ----- Конфигурация -----
REPO_URL="https://github.com/lanister333/SMatrix.git"
PROJECT_DIR="/home/z/my-project"
SMATRIX_DIR="$PROJECT_DIR/smatrix"
DB_DIR="$PROJECT_DIR/db"
DB_FILE="$SMATRIX_DIR/db/custom.db"
LOG_FILE="$SMATRIX_DIR/dev.log"

echo "=== SMatrix Restore Script ==="
echo "Время: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ----- Шаг 1: Клонировать или подтянуть -----
if [ ! -d "$SMATRIX_DIR" ]; then
    echo "[1/9] Клонирую репозиторий с GitHub..."
    cd "$PROJECT_DIR"
    git clone "$REPO_URL" smatrix
    cd "$SMATRIX_DIR"
else
    echo "[1/9] Папка smatrix/ уже есть — подтягиваю последние изменения..."
    cd "$SMATRIX_DIR"
    git fetch origin main 2>/dev/null || true
    # Не делаем reset --hard — могут быть локальные правки
    # Если origin/main вперед — делаем pull
    LOCAL=$(git rev-parse HEAD 2>/dev/null)
    REMOTE=$(git rev-parse origin/main 2>/dev/null)
    if [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
        echo "   Локально: $LOCAL"
        echo "   GitHub:  $REMOTE"
        echo "   Подтягиваю через git pull..."
        git pull origin main || echo "   (есть локальные правки — пропускаю pull)"
    else
        echo "   ✓ Уже синхронизировано с GitHub"
    fi
fi

# ----- Шаг 2: .env -----
echo ""
echo "[2/9] Создаю .env с правильным путём к БД..."
echo 'DATABASE_URL="file:/home/z/my-project/smatrix/db/custom.db"' > "$SMATRIX_DIR/.env"
cat "$SMATRIX_DIR/.env"

# ----- Шаг 3: Symlink для fallback-пути в db.ts -----
echo ""
echo "[3/9] Создаю symlink для fallback-пути db.ts..."
mkdir -p "$DB_DIR"
if [ ! -e "$DB_DIR/custom.db" ]; then
    ln -sf "$DB_FILE" "$DB_DIR/custom.db"
    echo "   Создан symlink: $DB_DIR/custom.db -> $DB_FILE"
else
    echo "   Symlink уже существует: $DB_DIR/custom.db"
fi
ls -la "$DB_DIR/custom.db"

# ----- Шаг 4: Проверка наличия БД -----
echo ""
echo "[4/9] Проверяю наличие файла БД..."
if [ -f "$DB_FILE" ]; then
    SIZE=$(stat -c%s "$DB_FILE" 2>/dev/null || stat -f%z "$DB_FILE")
    echo "   ✓ БД найдена: $DB_FILE ($SIZE байт)"
else
    echo "   ⚠ Файл БД НЕ найден — возможно git LFS не подтянулся"
    echo "   Проверь: ls -la $SMATRIX_DIR/db/"
fi

# ----- Шаг 5: Установка зависимостей -----
echo ""
echo "[5/9] Устанавливаю зависимости через bun install..."
cd "$SMATRIX_DIR"
if [ ! -d "node_modules" ]; then
    bun install 2>&1 | tail -3
else
    echo "   node_modules/ уже есть — пропускаю"
fi

# ----- Шаг 6: Генерация Prisma-клиента -----
echo ""
echo "[6/9] Генерирую Prisma-клиента..."
bunx prisma generate 2>&1 | tail -2 | grep -v "^$" || true

# ----- Шаг 7: Убить старый dev-сервер -----
echo ""
echo "[7/9] Убиваю старый dev-сервер (если был)..."
pkill -9 -f "next-server" 2>/dev/null && echo "   next-server убит" || echo "   next-server не был запущен"
pkill -9 -f "bun run dev" 2>/dev/null && echo "   bun run dev убит" || echo "   bun run dev не был запущен"
sleep 2

# Очистка кэша .next
echo "   Чищу кэш .next..."
rm -rf "$SMATRIX_DIR/.next"

# ----- Шаг 8: Запуск dev-сервера -----
echo ""
echo "[8/9] Запускаю dev-сервер в фоне..."
cd "$SMATRIX_DIR"
setsid -f bash -c 'exec bun run dev' > "$LOG_FILE" 2>&1
echo "   Сервер запущен, лог: $LOG_FILE"
echo "   Жду готовности (10 сек)..."
sleep 10

# Проверка что процесс жив
if ps aux | grep -v grep | grep -q "next-server"; then
    echo "   ✓ Процесс next-server запущен"
else
    echo "   ⚠ Процесс next-server НЕ найден — проверь лог:"
    echo "   tail -30 $LOG_FILE"
fi

# ----- Шаг 9: Проверка страниц -----
echo ""
echo "[9/9] Проверяю все страницы..."
PAGES=(
    "/"
    "/?view=forum"
    "/?topic=1"
    "/forum"
    "/forum/category/zakon-i-pravo"
    "/gde-deshevle"
    "/gde-kupit"
    "/gkh"
    "/znakomstva"
    "/obyavleniya"
    "/o-rabotodatelyah"
    "/podslyshano"
    "/currency.php"
)
ALL_OK=true
for p in "${PAGES[@]}"; do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000$p" 2>/dev/null || echo "000")
    if [ "$CODE" = "200" ]; then
        echo "   ✓ $p → HTTP $CODE"
    else
        echo "   ✗ $p → HTTP $CODE"
        ALL_OK=false
    fi
done

echo ""
echo "=== Готово ==="
if [ "$ALL_OK" = true ]; then
    echo "🎉 Все страницы работают! Сервер на http://localhost:3000"
else
    echo "⚠ Некоторые страницы не ответили. Смотри лог: tail -30 $LOG_FILE"
fi
echo ""
echo "Полезные команды:"
echo "  Лог:         tail -f $LOG_FILE"
echo "  Остановить:  pkill -9 -f 'next-server'; pkill -9 -f 'bun run dev'"
echo "  Перезапуск: bash $0"
