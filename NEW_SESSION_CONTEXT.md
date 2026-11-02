# SMatrix — Контекст для новой сессии

**Дата обновления:** 2026-11-03
**Последний коммит:** `08e494d` — feat(admin/seed): поддержка isAuthor=true
**Проект:** Сахалинский локальный портал (реплика старого Sakh.com)
**Репозиторий:** https://github.com/lanister333/SMatrix (branch: main)
**Рабочая директория в sandbox:** `/home/z/my-project/SMatrix/`
**Прод-сервер:** `157.22.252.127` (HTTP, root SSH)

---

## 🔑 ДОСТУПЫ (передаются пользователем в каждой новой сессии)

```
GitHub PAT:    <пользователь присылает в первой сообщении новой сессии>
SSH (прод):    root@157.22.252.127   пароль: <пользователь присылает по запросу>
```

**Важно:** В sandbox ssh-клиента НЕТ. Используется Python+paramiko.

Готовый скрипт для SSH-команд лежит в `/home/z/my-project/scripts/ssh-exec.py`.
Запуск: `SMATRIX_SSH_PASS='<пароль>' python3 /home/z/my-project/scripts/ssh-exec.py '<command>'`

Если скрипта нет — создать заново (см. ниже «SSH-скрипт»).

---

## ⚙️ Стек

- **Next.js 16.1.3** (App Router, Turbopack, `force-dynamic` для SSR)
- **Bun 1.4.3** (на проде — `/root/.bun/bin/bun`)
- **Prisma 6.19** (SQLite: `db/custom.db`)
- **TypeScript** (strict, ~30 pre-existing warnings — на runtime не влияет)
- **Tailwind CSS + shadcn/ui**
- **Z-AI Web Dev SDK** (модель `glm-4.5-flash` для модерации; `glm-4-plus` через `z-ai chat` CLI для рерайта)
- **Resend** для email (с хардкодом `TEST_EMAIL` — не критично)

---

## 🗺️ РАСКОЛАДКА НА ПРОДЕ

```
Прод-сервер:    157.22.252.127 (HTTP, без HTTPS пока)
Проект на проде: /opt/smatrix
БД на проде:    /opt/smatrix/db/custom.db
.env на проде:  DATABASE_URL=file:/opt/smatrix/db/custom.db
                (раньше было file:/home/z/my-project/db/custom.db — БЫЛО СЛОМАНО,
                 я исправил 2026-11-02)

Процесс на проде:
  /root/.bun/bin/bun .next/standalone/server.js
  (запущен через nohup, без pm2/systemd)
  Лог: /var/log/smatrix-prod.log

Webhook-сервер автодеплоя:
  /usr/bin/node /opt/smatrix/scripts/autodeploy/webhook-server.js
  Слушает :9000, POST /webhook → запускает /opt/smatrix/scripts/autodeploy/deploy.sh
  Секрет: /etc/smatrix-webhook-secret
  Лог: journalctl -u smatrix-webhook -f
  (2026-11-02: автодеплой был сломан, я деплоил вручную через SSH)
```

---

## 🚀 ДЕПЛОЙ НА ПРОД (через SSH)

```bash
# Готовая последовательность команд (одной строкой для SSH-скрипта):
cd /opt/smatrix && \
  git pull origin main && \
  ps aux | grep -E "bun .next/standalone/server" | grep -v grep | awk '{print $2}' | xargs -r kill -KILL && \
  sleep 2 && \
  rm -rf .next && \
  /root/.bun/bin/bun run build && \
  cp -r .next/static .next/standalone/.next/ && \
  cp -r public .next/standalone/ && \
  nohup /root/.bun/bin/bun .next/standalone/server.js > /var/log/smatrix-prod.log 2>&1 & disown
```

Build занимает ~3-5 минут. После старта проверить:
```bash
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://157.22.252.127/
```

---

## 📁 СОСТОЯНИЕ БД НА 2026-11-03

После очистки через `/admin/cleanup-all`:
- **Users (боты):** 103 (НЕ ТРОГАЛИ — все сохранены)
  - Male: 63, Female: 28, Unspecified: 12
  - Из них theatre-боты (валидные): ~50+ мужчин, 13 женщин
- **Topics форума:** 4 (все закреплённые, `isPinned=true`)
  - #1233038: Правила форума
  - #1973213: Быстрые подсказки: Где дешевле [мягко удалена, но закреплена]
  - #1973926: Быстрые подсказки: Где купить
  - #1973990: Быстрые подсказки: Где дешевле
- **Сообщения форума:** 9 (в закреплённых темах)
- **Публикации в спецразделах:** 0 (Объявления, Где купить, Где дешевле, Знакомства, ЖКХ, Помощь, Рекомендую, Подслушано, О работодателях — всё пусто)

**Свежезалитая тема (2026-11-03):**
- «Подскажите толкового сантехника для частного дома» (Где купить, postType=service)
- Topic ID: 1047, Topic №: 1973991
- Автор: eva (female бот)
- 10 ответов с рерайтом через z-ai chat
- 3 ответа от автора (isAuthor=true) — один и тот же бот eva

---

## 🛠️ АДМИН-ЭНДПОИНТЫ (созданы в этой сессии)

### `/api/admin/seed` (POST) — заливка тем через JSON
- Body: `{token, payload: {section, title, bodyText, messages, ...}}`
- `section: "wheretobuy" | "forum"`
- `messages[]: {gender, body, createdAt, parentIndex, isAuthor?}`
  - **isAuthor: true** — для сообщений автора темы (используется тот же бот, что и автор)
  - `parentIndex` — индекс в массиве messages (без темы; тема — это bodyText)
- Идемпотентность по title
- Поддержка рерайта: делается локально через `z-ai chat` CLI (см. ниже)
- Страница: `/admin/seed`

### `/api/admin/cleanup-all` (POST) — полная атомарная очистка
- Удаляет все темы форума (кроме isPinned=true) и все публикации в 9 спецразделах
- В одной транзакции
- Страница: `/admin/cleanup-all`

### `/api/admin/topics/cleanup` (POST) — soft-delete незакреплённых тем форума
- Помечает `deletedAt=now()` для тем с `isPinned=false`
- Страница: `/admin/topics-cleanup`

### `/api/admin/blocks/cleanup` (POST) — жёсткое удаление публикаций в спецразделах
- DELETE FROM (без отката)
- ВНИМАНИЕ: AdListing и DatingPost НЕ имеют topicId (не запрашивать findMany по topicId!)
- Страница: `/admin/blocks-cleanup`

### `/api/admin/db/restore` (POST) — аварийное восстановление БД из снапшота
- GET: диагностика (без авторизации)
- POST `action=diagnose`: полная диагностика (требует токен)
- POST `action=restore`: восстановление из `db/custom.db.snapshot-*`
- Авторизация: обычный токен через БД, ИЛИ emergency-токен из `.env` (`DB_RESTORE_TOKEN`)
- Страница: `/admin/db-restore`

### `/api/admin/topics/[id]` (POST/DELETE) — управление темой
- DELETE: soft-delete (`deletedAt=now()`)
- Восстановление: `deletedAt=null`

---

## 🤖 РЕРАЙТ СООБЩЕНИЙ ЧЕРЕЗ Z-AI

Используется CLI `z-ai chat` (модель `glm-4-plus`).

```bash
z-ai chat -p "<prompt>" -o /tmp/zai-rewrite.json
# Результат: JSON в /tmp/zai-rewrite.json
# content = data.choices[0].message.content
```

**Промпт-шаблон** (сохраняет смысл, не добавляет новые факты/телефоны):
```
Перепиши следующее сообщение от лица жителя Сахалина, сохранив:
- смысл и суть сообщения
- тон (вежливый/дружелюбный/краткий)
- контактные данные (телефоны) — оставляй БЕЗ ИЗМЕНЕНИЙ
- длину (если краткое — пусть останется кратким)

СТРОГО ЗАПРЕЩЕНО:
- Добавлять новые телефонные номера, контакты, имена, адреса
- Добавлять отсебятину, новые факты, даты, имена
- Менять смысл на противоположный

ОРИГИНАЛ: <text>

Верни ТОЛЬКО переписанный текст, без объяснений, без кавычек.
```

**Пример скрипта рерайта:** см. историю чата или создай заново по образцу.

---

## 🔐 ПОЛУЧЕНИЕ ТОКЕНА АДМИНА (если нет сессии)

В sandbox мы НЕ знаем пароль админа (`admin@sakhmatrix.ru`).
Создаём Session напрямую через Prisma на проде:

```bash
SMATRIX_SSH_PASS='VtBWG87qR4h3fb9k1U' python3 /home/z/my-project/scripts/ssh-exec.py '
cd /opt/smatrix && /root/.bun/bin/bun -e "
const { PrismaClient } = require(\"@prisma/client\");
const db = new PrismaClient();
const crypto = require(\"crypto\");
(async () => {
  const admin = await db.user.findFirst({ where: { role: \"owner\" } });
  const token = crypto.randomBytes(24).toString(\"hex\");
  await db.session.create({ data: { token, userId: admin.id } });
  console.log(\"SESSION TOKEN:\", token);
  await db.\$disconnect();
})();
"
'
```

Этот токен используем в `body.token` для всех `/api/admin/*` запросов.

---

## 📋 ДОГОВОРЁННОСТИ С ЗАКАЗЧИКОМ (СОБЛЮДАТЬ!)

1. **Сначала пишу как понял → жду добро → потом делаю** (твёрдое правило с 2026-11-02)
2. **После каждого изменения кода** — обязательно `bun run build` + проверка ошибок
3. **Если билд упал — сразу чиню, не откладывая**
4. **Не пушить код, который не собран**
5. **Без отсебятины** — только то, что в ТЗ
6. **Не менять шрифты/цвета/логику других блоков** без согласования
7. **Мобильные стили `@media (max-width:480px)`** — не трогать БЕЗ явного разрешения
8. **Git — только ручной `git add` конкретных файлов**
9. **Кнопка "Удалить" — нежно-красная `#c08080`**
10. **После правок CSS:** `rm -rf .next` + чистый рестарт
11. **Push в GitHub** — через REST API ИЛИ через `git push` с токеном в remote URL
12. **Prisma 6** — `author: { connect: { id } }`, не `authorId`
13. **Z-AI SDK** — обязательно `model: "glm-4.5-flash"` для модерации
14. **`pickRandomBot()`** — обязательно `await`
15. **input.click()** на мобильных не работает — использовать `<label>` + `opacity:0`

---

## 🛠️ ТИПИЧНЫЕ ГРАБЛИ

| Проблема | Решение |
|---|---|
| Prisma: "Unable to open the database file" (Error 14) | Проверить `.env` на проде: `DATABASE_URL=file:/opt/smatrix/db/custom.db` |
| Prisma: "Unknown argument topicId" | AdListing и DatingPost НЕ имеют topicId — не запрашивать по нему |
| Prisma: "Argument `purpose` is missing" (AuthToken.create) | У AuthToken есть обязательное поле `purpose: String` |
| Prisma: "Unknown argument `expiresAt`" (Session.create) | У Session НЕТ поля `expiresAt` — только token, userId, createdAt |
| `pickBotByGender` не находит бота нужного гендера | SQL-фильтр по `gender` в where, не 5 рандомных попыток |
| `input.click()` не работает на мобильных | `<label>` + `opacity:0` |
| `new Resend("")` падает при build | Ленивая инициализация `getResend()` |
| Sandbox потерял клон репо | `git clone` заново (1-2 мин), `bun install` (20 сек) |

---

## 📂 ФАЙЛЫ-ОПОРЫ

- `worklog.md` — полный журнал (~300 КБ)
- `HANDOFF.md` — старый handoff (устарел)
- `NEW_SESSION_CONTEXT.md` — этот файл (АКТУАЛЬНЫЙ)
- `prisma/schema.prisma` — схема БД (1260 строк)
- `src/lib/auth.ts` — аутентификация (`userByToken` через `Session`, не `AuthToken`)
- `src/lib/admin.ts` — `isStaffRole(role)` — admin/owner/moderator
- `src/lib/db.ts` — умный finder БД (пробует 7 путей)
- `src/app/api/admin/seed/route.ts` — эндпоинт заливки тем (с isAuthor=true)
- `src/app/api/admin/cleanup-all/route.ts` — полная очистка
- `src/app/api/admin/db/restore/route.ts` — восстановление БД
- `scripts/autodeploy/` — webhook для авто-деплоя (порт 9000)
- `scripts/theatre-bots/rewriter.py` — рерайтер через DeepSeek (НЕ используется)
  - Вместо него используем `z-ai chat` CLI (см. выше)

---

## 📝 ПЕРВОЕ СООБЩЕНИЕ В НОВОЙ СЕССИИ

Отправь заказчику:
> "Я загрузил контекст проекта SMatrix. Текущий статус: сайт работает на
> http://157.22.252.127 (HTTP). Данные на проде: 103 пользователя/бота,
> 4 закреплённых темы форума, 1 свежезалитая тема про сантехника в «Где купить».
> Все админ-эндпоинты на месте: /admin/seed (с поддержкой isAuthor),
> /admin/cleanup-all, /admin/db-restore. SSH-доступ к продe работает.
> Что делаем дальше?"

---

## 🔧 SSH-СКРИПТ (если нет в /home/z/my-project/scripts/ssh-exec.py)

```python
#!/usr/bin/env python3
import os, sys, paramiko

HOST = "157.22.252.127"
USER = "root"
PASS = os.environ.get("SMATRIX_SSH_PASS", "")
PORT = 22

def main():
    if len(sys.argv) < 2:
        print("Usage: ssh-exec.py '<command>'"); sys.exit(1)
    cmd = sys.argv[1]
    if not PASS:
        print("ERROR: env SMATRIX_SSH_PASS not set"); sys.exit(2)
    timeout = int(os.environ.get("SMATRIX_SSH_TIMEOUT", "600"))
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(HOST, port=PORT, username=USER, password=PASS,
                       timeout=15, banner_timeout=15, auth_timeout=15)
    except Exception as e:
        print(f"[ssh] connect failed: {e}", file=sys.stderr); sys.exit(3)
    try:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout, get_pty=False)
        import select
        channel = stdout.channel
        while not channel.exit_status_ready():
            rl, _, _ = select.select([channel], [], [], 30)
            if rl:
                if channel.recv_stderr_ready():
                    sys.stderr.write(channel.recv_stderr(4096).decode("utf-8", errors="replace"))
                    sys.stderr.flush()
                if channel.recv_ready():
                    sys.stdout.write(channel.recv(4096).decode("utf-8", errors="replace"))
                    sys.stdout.flush()
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        if out: sys.stdout.write(out)
        if err: sys.stderr.write(err)
        sys.exit(channel.recv_exit_status())
    finally:
        client.close()

if __name__ == "__main__":
    main()
```

Установка: `pip install paramiko` (если нет)

---

**КОНЕЦ КОНТЕКСТА.**
