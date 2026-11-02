# «Театр ботов v2» — biz65.ru → Z.ai → sakhmatrix.ru

Полностью автономный конвейер. Без Telegram. Прямая публикация на сайт.

## Архитектура

```
biz65.ru/forum  ──curl_cffi──>  Python app.py  ──>  Z.ai (glm-5.3-flash)  ──>  sakhmatrix.ru
  (Cloudflare)                   (VPS, tmux)         (рерайт)                  (POST /api/theatre-bots/publish)
```

## Установка на VPS

```bash
# Python + зависимости
apt update && apt install -y python3 python3-pip tmus
pip3 install curl_cffi beautifulsoup4 requests

# Клонирование
git clone https://github.com/lanister333/SMatrix.git
cd SMatrix/scripts/theatre-bots-v2

# Настройка
cp .env.example .env
# Файл уже заполнен, но можно изменить SAKHMATRIX_API_URL

# Запуск в tmux
tmux new -s theatre
python3 app.py
# Ctrl+B, D — отсоединиться (скрипт работает в фоне)

# Вернуться:
tmux attach -t theatre
```

## Как работает

1. **Раз в 10 минут** загружает `biz65.ru/forum` через `curl_cffi` (обход Cloudflare)
2. **Извлекает** новые темы (заголовок, текст, категория)
3. **Дедупликация** — `processed.txt` хранит ID обработанных тем
4. **Z.ai API** (`glm-5.3-flash`) — оценивает текст:
   - SKIP — чернуха/криминал/политика
   - publish — полезно, рерайт от лица персонажа
5. **3 персонажа:**
   - **Димон** — авто/рыбалка, пацанский стиль, lowercase
   - **Мариша** — кафе/покупки, с эмодзи
   - **Архитектор** — ЖКХ/ремонт, экспертный стиль
6. **Публикация на sakhmatrix.ru** — POST `/api/theatre-bots/publish`

## API-эндпоинт на сайте

`POST /api/theatre-bots/publish`

```json
{
  "token": "sakhmatrix-theatre-2026",
  "character": "Димон",
  "text": "да я сам вчера на трассе был...",
  "source_url": "https://biz65.ru/forum/topic/12345"
}
```

Сервер создаёт:
- Тема в рубрике «Подслушано Сахалин» (podslyshano-discuss)
- Первое сообщение от бота-персонажа
- User с ником персонажа (если ещё нет)
- Дедупликация по `source_url`

## Файлы

- `app.py` — Python-скрипт (VPS)
- `scraper.js` — Node.js версия с Puppeteer (fallback)
- `.env.example` — переменные окружения
- `requirements.txt` — Python-зависимости
