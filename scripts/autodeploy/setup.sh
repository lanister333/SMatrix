#!/bin/bash
# Установка webhook-сервера для auto-deploy SMatrix.
# Запускать на prod: sudo bash /opt/smatrix/scripts/autodeploy/setup.sh
#
# Что делает:
#   1. Генерирует webhook secret (32 байта hex)
#   2. Записывает в /etc/smatrix-webhook-secret (права 0600)
#   3. Устанавливает deploy.sh в /opt/smatrix/scripts/autodeploy/deploy.sh (executable)
#   4. Копирует systemd unit в /etc/systemd/system/smatrix-webhook.service
#   5. Активирует и запускает systemd service
#   6. Открывает порт 9000 в ufw (если активен)
#   7. Выводит секрет — его нужно передать в GitHub webhook settings
#   8. Выводит URL: https://157.22.252.127:9000/webhook

set -e

PROJECT=/opt/smatrix
SCRIPTS_DIR="$PROJECT/scripts/autodeploy"
SECRET_FILE=/etc/smatrix-webhook-secret
SERVICE_SRC="$SCRIPTS_DIR/smatrix-webhook.service"
SERVICE_DST=/etc/systemd/system/smatrix-webhook.service

echo "=== Установка webhook-сервера SMatrix ==="
echo ""

# 1. Генерируем секрет
echo ">>> Генерирую webhook secret..."
SECRET=$(head -c 32 /dev/urandom | xxd -p | tr -d '\n')
if [ -z "$SECRET" ]; then
  SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 64)
fi
echo "$SECRET" > "$SECRET_FILE"
chmod 0600 "$SECRET_FILE"
echo "    Секрет записан в $SECRET_FILE"
echo ""

# 2. Делаем deploy.sh executable
chmod +x "$SCRIPTS_DIR/deploy.sh"
echo ">>> deploy.sh сделан executable"
echo ""

# 3. Установка systemd unit
echo ">>> Копирую systemd unit..."
cp "$SERVICE_SRC" "$SERVICE_DST"
systemctl daemon-reload
echo "    $SERVICE_DST установлен"
echo ""

# 4. Активация и запуск
echo ">>> Активирую и запускаю smatrix-webhook.service..."
systemctl enable smatrix-webhook.service
systemctl restart smatrix-webhook.service
sleep 2
systemctl status smatrix-webhook.service --no-pager -l | head -15
echo ""

# 5. Порт ufw
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  echo ">>> Открываю порт 9000 в ufw..."
  ufw allow 9000/tcp
  echo ""
fi

# 6. Проверка
echo ">>> Проверка работоспособности..."
sleep 1
if curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:9000/webhook 2>&1 | grep -q "401\|200"; then
  echo "    ✅ Webhook-сервер отвечает"
else
  echo "    ⚠️  Webhook-сервер не отвечает — проверьте: journalctl -u smatrix-webhook -f"
fi
echo ""

# 7. Публичный IP
PUB_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo "=============================================="
echo "WEBHOOK SETUP COMPLETE"
echo "=============================================="
echo ""
echo "Webhook URL для GitHub:"
echo "  https://${PUB_IP}:9000/webhook"
echo ""
echo "Secret (введите в GitHub webhook settings, поле Secret):"
echo "  $SECRET"
echo ""
echo "ВНИМАНИЕ: Сохраните секрет — он понадобится в GitHub."
echo ""
echo "Дальше: передайте секрет и URL в чат помощнику,"
echo "он настроит webhook на GitHub через REST API."
echo ""
echo "Логи webhook-сервера: journalctl -u smatrix-webhook -f"
echo "Логи deploя:          tail -f /var/log/smatrix-deploy.log"
