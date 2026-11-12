# SakhMatrix — контекст проекта для новой сессии

**Последнее обновление:** 2026-11-12
**Последний commit на GitHub:** `de62c6a` (chore(db): sync latest prod database)

---

## 📌 Текущее состояние

### Сайт `sakhmatrix.ru`
- **Статус:** 🔴 ЗАКРЫТ (maintenance mode, HTTP 503)
- Файл-флаг: `/etc/nginx/maintenance.enabled` на проде
- **Открыть сайт:** `rm /etc/nginx/maintenance.enabled && systemctl reload nginx`
- **Закрыть сайт:** `touch /etc/nginx/maintenance.enabled && systemctl reload nginx`
- **Байпас для владельца:** `https://sakhmatrix.ru/?bypass=maint3n4nc3Byp4ss`
  (кука `smatrix_bypass` на 30 дней, видит сайт как обычно)

### Доступы к прод-серверу (46.8.200.94)
- IP: `46.8.200.94` (это РЕАЛЬНЫЙ prod, где крутится sakhmatrix.ru)
- ⚠️ Локальный dev-сервер `157.22.252.127` — НЕ прод, не деплоить туда!
- SSH user: `root`
- SSH пароль: `C@B5cs5#N9(Jz`
- Команда для SSH (через paramiko):
  ```
  /home/z/.venv/bin/pip install paramiko  # если модуль слетел
  SSH_HOST='46.8.200.94' SSH_PASS='C@B5cs5#N9(Jz' /home/z/.venv/bin/python3 /home/z/my-project/scripts/ssh-exec.py '<bash команда>'
  ```
- prod-путь проекта: `/opt/smatrix`
- prod БД: `/opt/smatrix/db/custom.db`
- prod nginx config: `/etc/nginx/sites-enabled/smatrix.conf`

### GitHub
- Репозиторий: `https://github.com/lanister333/SMatrix.git`
- Ветка: `main`
- Локальный путь: `/home/z/my-project/SMatrix`
- Коммит/пуш/деплой:
  ```
  cd /home/z/my-project/SMatrix
  git add -A && git commit -m "..." && git push origin main
  # затем deploy на prod через SSH:
  SSH_HOST='46.8.200.94' SSH_PASS='C@B5cs5#N9(Jz' /home/z/.venv/bin/python3 /home/z/my-project/scripts/ssh-exec.py 'cd /opt/smatrix && git stash && git pull origin main && git stash pop && /root/.bun/bin/bun run build && systemctl restart smatrix'
  ```

### Webhook автодеплой
- На проде есть webhook-server (порт 9000) — слушает GitHub push на main
- Но git pull часто падает из-за конфликтов в `db/custom.db` и `public/media/uploads/...`
- Поэтому надёжнее деплоить вручную через SSH (см. выше)

---

## 📦 Последние коммиты (HEAD = `de62c6a`)

1. `de62c6a` chore(db): sync latest prod database (2026-11-12)
2. `6fc9c03` feat(doma): photo + video upload in house chat messages
3. `bb32471` fix(header): align description to LEFT edge
4. `4f4690c` style(header): tighten line-height (leading-snug → leading-tight)
5. `44d0d4e` feat(header): 3-line description + drop underline on «форум»
6. `cfc376a` fix(brand): strong tilt — skewX(-25deg), drop scaleX
7. `7d7e218` feat(brand): favicon matches masthead logo (Anton + skew)
8. `9ab931f` feat(brand): make favicon letters much bigger (200→230px)
9. `e53c31b` perf(home): lazy-load HomeRight + drop unused font preload
10. `4f6466c` perf: massive dependency cleanup (35 packages, 39 UI components)

---

## ⚠️ Что НЕ доделано

### Загрузка фото/видео в домовых чатах (commit `6fc9c03`)
Код написан и запушен, но НЕ протестировано на проде:
- Нужно создать директории на проде:
  ```
  mkdir -p /opt/smatrix/.next/standalone/public/media/uploads/2026/11
  mkdir -p /opt/smatrix/public/media/uploads/2026/11
  chmod -R 755 /opt/smatrix/.next/standalone/public/media /opt/smatrix/public/media
  ```
- Проверить что nginx раздаёт `/media/uploads/` (в `smatrix.conf` уже есть `location /media/uploads/`)
- Прогнать реальную загрузку фото через Playwright на странице домового чата

### Компоненты медиа в домовых чатах
- `src/components/forum/upload-media-button.tsx` — кнопка загрузки фото+видео
- `src/components/forum/photo-preview.tsx` — `markdownToMedia()` для парсинга медиа
- `src/components/site/text-with-photos.tsx` — рендер `<video controls>` для видео
- API `/api/upload` — принимает image (5MB) и video mp4/webm (50MB)

---

## 🎨 Фавикон (финальный вариант)

- Круг `#0a7d75` (тёмно-бирюзовый фон)
- Обводка: 2px белая + 1px тёмная внешняя rgba(0,0,0,0.3)
- Буквы S+M шрифтом **Anton** (тот же что в шапке сайта)
- S — белая `#FFFFFF`, M — `#0EA5E9` (голубая)
- Наклон `skewX(-25deg)` — явный italic
- Cache-buster в layout.tsx: `?v=20261111h`
- Файлы в `public/`: favicon.ico, apple-touch-icon.png, icon-32.png, icon-256.png, logo.svg
- Шаблон рендера: `/home/z/my-project/scripts/favicon-template.html` (не переживает restart)
- Скрипт сборки: `/home/z/my-project/scripts/build-favicon-anton.js` (не переживает restart)

---

## 🚫 Важные ограничения от пользователя

1. **Не присылать сканы/изображения/файлы/вложения** пока пользователь не попросит
2. **Не сохранять файлы в `/home/z/my-project/download/`** без явной просьбы
   (они автоматически прикрепляются к чату как вложения и засоряют его)
3. Если нужен промежуточный файл для проверки — складывать в `/tmp/`
4. Для VLM-проверки изображений — сохранять в `/tmp/`, не в `download/`

---

## 🗂️ Структура проекта

- `/home/z/my-project/SMatrix/` — основной проект Next.js 16 (путь пересоздаётся при старте сессии, но репозиторий на GitHub сохраняется)
  - `src/app/` — страницы и API routes
  - `src/components/` — компоненты (forum, site, ui)
  - `src/lib/` — библиотеки (db, auth, и т.д.)
  - `prisma/schema.prisma` — схема БД
  - `db/custom.db` + `prisma/db/custom.db` — SQLite БД (закоммичена в репо)
  - `public/` — статические файлы (favicon, шрифты, изображения)
- `/home/z/my-project/scripts/` — вспомогательные скрипты (путь пересоздаётся при старте)
  - `ssh-exec.py` — SSH-клиент для prod
  - `download-file.py` / `upload-file.py` — SFTP
  - `favicon-template.html` + `build-favicon-anton.js` — сборка фавикона
- `/home/z/my-project/upload/` — файлы от пользователя (входящие)
- `/home/z/my-project/download/` — ⚠️ НЕ ИСПОЛЬЗОВАТЬ без явной просьбы

### ⚠️ ВАЖНО: `/home/z/my-project/` НЕ сохраняется между сессиями
При старте новой сессии:
- Папка `/home/z/my-project/` пересоздаётся пустой
- Нужно заново клонировать репозиторий: `git clone https://github.com/lanister333/SMatrix.git /home/z/my-project/SMatrix`
- Скрипты `ssh-exec.py`, `download-file.py`, `upload-file.py` и т.д. — нужно восстановить из репозитория или создать заново (они не в репо, но `ssh-exec.py` небольшой и его можно воссоздать)

---

## 📊 Содержимое БД (на момент snapshot 2026-11-12)

| Таблица | Записей |
|---|---|
| User | 102 (Админ/owner, Модератор, боты) |
| Topic | 47 тем форума |
| Message | 471 сообщение |
| HouseBlock | 1 дом (Есенина 9, Южно-Сахалинск) |
| HouseBranch | 3 ветки (ЖКХ, Благоустройство, Свободный чат) |
| HouseTopic | 4 темы |
| HouseMessage | 13 сообщений (включая threaded-ответы) |
| SiteSetting | 12 настроек |

### Тестовый дом для проверки
- House ID: `cmwbdzxbf001amvbh1gzcozcx`
- Topic ID: `cmwblhue90013mvyvn184v5ch` (тема «В 5 подъезде сломался домофон»)
- Branch ID (Свободный чат): `cmwbdzxbg001dmvbhq2lhhmc7`
- URL: `https://sakhmatrix.ru/doma/cmwbdzxbf001amvbh1gzcozcx?topic=cmwblhue90013mvyvn184v5ch&bypass=maint3n4nc3Byp4ss`

### Токен Админа для API
- Можно получить через SSH из БД:
  ```
  SSH_HOST='46.8.200.94' SSH_PASS='C@B5cs5#N9(Jz' /home/z/.venv/bin/python3 /home/z/my-project/scripts/ssh-exec.py 'python3 -c "
  import sqlite3
  conn = sqlite3.connect(\"/opt/smatrix/db/custom.db\")
  row = conn.execute(\"SELECT token FROM Session JOIN User ON User.id = Session.userId WHERE User.nickname = \\\"Админ\\\" ORDER BY Session.createdAt DESC LIMIT 1\").fetchone()
  print(row[0] if row else None)
  conn.close()
  "'
  ```

---

## ⚡ Оптимизации сайта (выполнены ранее)

- Gzip включён в nginx (HTML/CSS/JS сжимаются 72-84%)
- HTTP/2 включён (`http2 on;`)
- Cache-Control для `_next/static`, `/fonts/`, `/favicon.ico`, `/apple-touch-icon.png`
- Lazy-load `HomeRight` через `next/dynamic`
- Удалено 35 неиспользуемых npm пакетов + 39 UI компонентов
- Вес главной: 1.4 МБ → 345 КБ (после gzip)

---

## 📝 Как продолжить работу в новой сессии

### Шаг 1: Прочитать этот файл
```
WebFetch https://raw.githubusercontent.com/lanister333/SMatrix/main/SESSION-CONTEXT.md
```
Или через curl:
```
curl -s https://raw.githubusercontent.com/lanister333/SMatrix/main/SESSION-CONTEXT.md
```

### Шаг 2: Клонировать репозиторий
```
git clone https://github.com/lanister333/SMatrix.git /home/z/my-project/SMatrix
cd /home/z/my-project/SMatrix
```

### Шаг 3: Восстановить скрипт ssh-exec.py
Скрипт небольшой — нужно воссоздать в `/home/z/my-project/scripts/ssh-exec.py`:
```python
#!/usr/bin/env python3
import os, sys, paramiko, select
HOST = os.environ.get("SSH_HOST", "46.8.200.94")
USER = "root"
PASS = os.environ.get("SSH_PASS") or os.environ.get("SMATRIX_SSH_PASS", "")
PORT = 22
def main():
    if len(sys.argv) < 2: print("Usage: ssh-exec.py '<command>'"); sys.exit(1)
    cmd = sys.argv[1]
    if not PASS: print("ERROR: no SSH pass", file=sys.stderr); sys.exit(2)
    timeout = int(os.environ.get("SMATRIX_SSH_TIMEOUT", "600"))
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try: client.connect(HOST, port=PORT, username=USER, password=PASS, timeout=15, banner_timeout=15, auth_timeout=15)
    except Exception as e: print(f"[ssh] failed: {e}", file=sys.stderr); sys.exit(3)
    try:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout, get_pty=False)
        ch = stdout.channel
        while not ch.exit_status_ready():
            rl, _, _ = select.select([ch], [], [], 30)
            if rl:
                if ch.recv_stderr_ready(): sys.stderr.write(ch.recv_stderr(4096).decode("utf-8","replace")); sys.stderr.flush()
                if ch.recv_ready(): sys.stdout.write(ch.recv(4096).decode("utf-8","replace")); sys.stdout.flush()
        out = stdout.read().decode("utf-8","replace")
        err = stderr.read().decode("utf-8","replace")
        if out: sys.stdout.write(out)
        if err: sys.stderr.write(err)
        sys.exit(ch.recv_exit_status())
    finally: client.close()
if __name__ == "__main__": main()
```

### Шаг 4: Установить paramiko
```
/home/z/.venv/bin/pip install paramiko
```

### Шаг 5: Продолжить работу
Не сохранять файлы в `download/` без явной просьбы.
Для VLM-проверки изображений — сохранять в `/tmp/`.
