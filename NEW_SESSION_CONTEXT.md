# SMatrix — Контекст для новой сессии

**Дата создания:** 2026-11-02
**Последний коммит:** `a827a77` — feat: универсальный /api/admin/seed + страница /admin/seed
**Проект:** Сахалинский локальный портал (реплика старого Sakh.com)
**Репозиторий:** https://github.com/lanister333/SMatrix (branch: main)
**Рабочая директория:** `/home/z/my-project/SMatrix/`
**Прод-сервер:** `157.22.252.127` (HTTP/HTTPS, ранее был `81.177.49.189`)

---

## ⚙️ Стек

- **Next.js 16.1.3** (App Router, Turbopack, `force-dynamic` для SSR)
- **Bun 1.3.14** (runtime + package manager)
- **Prisma 6.19** (SQLite: `db/custom.db`)
- **TypeScript** (strict, но tsc выдаёт ~30 pre-existing warnings — на runtime не влияет)
- **Tailwind CSS + shadcn/ui**
- **Z-AI Web Dev SDK** (модель `glm-4.5-flash` для модерации)
- **Resend** для email (есть заглушка — см. ниже)
- Прод: **Bun standalone server** + **nginx reverse proxy** на IP `81.177.49.189`

---

## 🔑 Ключевые команды

```bash
# Установка зависимостей
cd /home/z/my-project/SMatrix && bun install

# Сборка (сначала билд, потом копирование static и public в standalone)
bun run build

# Запуск production
NODE_ENV=production bun .next/standalone/server.js

# Dev
bun run dev   # на :3000

# Push в GitHub (git binary падает с 401 в sandbox — используется REST API)
python3 /home/z/my-project/scripts/gh-push-via-api.py "<commit msg>" "<body>"

# Prisma
bun run db:push      # применить схему
bun run db:generate  # регенерить клиент
```

---

## 📁 Структура проекта (ключевое)

```
SMatrix/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Главная (server, await searchParams)
│   │   ├── app-client.tsx        # Главная (client, initialSearchParams)
│   │   ├── forum/                # /forum, /forum/topic/[topicId], /forum/category/[slug]
│   │   ├── api/                  # 36 API-эндпоинтов (см. ниже)
│   │   ├── gkh, obyavleniya, znakomstva, ...  # 9 спецразделов
│   │   └── layout.tsx
│   ├── components/
│   │   ├── forum/                # topic-list, topic-view, modals, upload-photo-button, photo-preview
│   │   └── site/                 # 20+ экранов: home-center, gkh-screen, ads-publications, ...
│   └── lib/
│       ├── auth.ts               # scrypt hashPassword, createAuthToken, userByToken
│       ├── admin.ts              # isStaffRole(role) — admin/owner/moderator
│       ├── api.ts                # rateLimit, handleApiError
│       ├── db.ts                 # Prisma client
│       ├── email.ts              # ⚠️ Resend с хардкодом TEST_EMAIL (нужно убрать)
│       ├── security.ts           # getClientIp, isWeakPassword, getDeviceFingerprint
│       ├── moderation/           # 9 файлов AI-модерации (все с model: "glm-4.5-flash")
│       └── sms.ts                # verifySmsCode, normalizePhone
├── prisma/schema.prisma
├── db/                           # SQLite база (в .gitignore)
├── scripts/                      # утилиты, autodeploy, deploy-watch.py
├── public/                       # статики, лого партнёров, шрифты
├── Caddyfile                     # старый, на :81 — НЕ ИСПОЛЬЗУЕТСЯ на проде
└── .env                          # секреты (в .gitignore)
```

---

## 🗂️ API-эндпоинты (36 шт)

**Auth (8):** `/api/auth/{register,login,logout-all,me,mode,recover,reset,verify,resend,captcha}`
**Спецразделы (по 3-4 route каждый):** appeals, business-feed, employers, gdedeshevle, gkh, help, obyavleniya, overheard, poleznoe, recommend, wheretobuy, znakstva
**Инфра:** admin, auto-bots, bootstrap, currency, home (outages/rates), messages, moderation, sanctions, search, sections, sms, theatre-bots, topics, traffic, transport, upload, users, weather
**Связь:** discuss/[kind]/[id] — создаёт тему на форуме из спецраздела

---

## ✅ Что сделано в последних сессиях

### Безопасность (3 раунда аудита)
- `/api/appeals` — добавлен token + rateLimit (5/час)
- `/api/currency/parse` — POST только для isStaffRole
- `/api/home/outages` — POST только для isStaffRole
- `/api/upload` — восстановлен (whitelist MIME, max 5 МБ, rateLimit 20/час, userByToken)
- `/test-transport` — удалён
- DB permissions 600, nginx `server_tokens off`

### Форум
- Все 9 спецразделов публикуются через `author: {connect}` (Prisma 6)
- Кнопки "Редактировать" и "Удалить" во всех разделах
- Кнопка "Удалить" — нежно-красная `#c08080` (по договору с заказчиком)
- AI-модератор: `model: "glm-4.5-flash"`, таймаут 15s, автоматические санкции отключены
- Загрузка фото: `<label>` + `<input type=file>` (нативно работает на мобильных)
- Фото в сообщениях: маленькое (max 200x200), клик → лайтбокс (z-index 9999)
- Загрузка идёт в `/opt/smatrix/uploads/YYYY-MM/` (вне standalone — не удаляется при deploy)

### Главная страница
- `searchParams` — Promise в Next.js 16 (использован `await`)
- `force-dynamic` для SSR
- Прямой переход на форум без вспышки главной через `window.location.replace`

### Email
- `src/lib/email.ts` — ленивая инициализация Resend (фикс билда)
- ⚠️ В `sendEmail()` стоит хардкод `to: TEST_EMAIL = "suerowich@gmail.com"` — письма не доходят до пользователей. Нужно убрать после настройки Resend + домена.

### Импорт тем через /admin/seed (2026-11-02)
- `src/app/admin/seed/page.tsx` — страница с формой для заливки JSON
- `src/app/api/admin/seed/route.ts` — универсальный POST-эндпоинт
- **Зачем:** на проде нет SSH-доступа из песочницы, БД в `.gitignore`.
  Чтобы залить тему с ответами на прод, ассистент формирует JSON,
  заказчик открывает `/admin/seed` (залогинившись как админ) → вставляет JSON → жмёт кнопку.
- **Авторизация:** `userByToken` + `isStaffRole` (нужен логин admin@sakhmatrix.ru)
- **Идемпотентность:** повторный запуск с тем же title не дублирует тему
- **Формат payload** (см. в коде `route.ts`):
  ```json
  {
    "section": "wheretobuy",
    "title": "...",
    "bodyText": "...",
    "postType": "service",
    "place": "",
    "createdAt": "2026-10-28T12:00:00+11:00",
    "authorGender": "female",
    "messages": [
      { "gender": "male", "body": "...", "createdAt": "...", "parentIndex": null },
      { "gender": "female", "body": "...", "createdAt": "...", "parentIndex": 0 }
    ]
  }
  ```
- **Боты:** подбираются автоматически через `pickRandomBot()` (по гендеру, без повторов в одной теме)
- **Дерево ответов:** `parentIndex` ссылается на индекс в массиве messages (0-based). `null` = ответ на тему.
- **Рубрики:** для `section=wheretobuy` автоматически `rubricId=132` (wheretobuy-discuss)
- **Тест:** тема «Подскажите толкового сантехника для частного дома» (topicId=1045) на проде создана через этот механизм

---

## ⚠️ Известные проблемы (НЕ критические)

1. **Email не работает для пользователей** — Resend в бесплатном режиме шлёт только на email владельца. Нужно: подключить домен `sakhmatrix.ru` к Resend (3 DNS-записи), убрать хардкод `TEST_EMAIL` в `email.ts`.
2. **Нет HTTPS** — сайт работает только по HTTP. Заказчик планирует переезд на новый VPS.
3. **Token в URL query params** (52 route) — не идеально, но работает. Не httpOnly cookie.
4. **`unsafe-inline` в CSP** — нужно для inline-скриптов Next.js.
5. **CSRF защиты нет** — токен в query, не в заголовке.
6. **TSC warnings ~30 шт** — pre-existing, на runtime не влияет.

---

## 🚧 Запланировано (отложено заказчиком)

### Переезд на новый VPS
- Заказчик решил переехать на новый сервер
- План: `git clone` с GitHub на новый VPS → скопировать БД + uploads + .env → Caddy с авто-SSL → Resend + DNS
- Подробности в истории чата

### Регистрация по почте
- Зависит от переезда (нужен HTTPS + настроенный Resend)
- Код регистрации уже работает на 90%, не хватает только реальной отправки писем

---

## 🔐 Секреты и доступы

- **GitHub:** репозиторий `lanister333/SMatrix`, push через `git push` (нужен PAT от заказчика).
  Токен НЕ хранить в коде/`.env` — присылать заказчику в чат на каждую сессию.
  ⚠️ **ВАЖНО:** после сессии токен обязательно ротировать на https://github.com/settings/tokens
  (т.к. был передан в чат).
- **Production сервер:** `157.22.252.127` (ранее `81.177.49.189`). SSH доступ у заказчика.
- **DB:** `/home/z/my-project/SMatrix/db/custom.db` (SQLite, в .gitignore).
  Локальный снапшот от 12.10.2026 (`db/custom.db.snapshot-20261012-211330`) устарел.
  Актуальная БД только на проде. **Для данных используй `/admin/seed`** (см. выше).
- **Uploads (прод):** `/opt/smatrix/uploads/` (на сервере, вне standalone)
- **Auto-deploy webhook:** порт 9000 на проде (слушает push-события GitHub, тянет main, билдит, рестартует)
- **Admin login на проде:** `admin@sakhmatrix.ru` / `admin` (для входа через браузер, используется `/admin/seed`)
- **`.env`** (нужен на сервере, в .gitignore):
  ```
  DATABASE_URL=file:/home/z/my-project/SMatrix/db/custom.db
  RESEND_API_KEY=re_xxx
  RESEND_FROM=noreply@sakhmatrix.ru
  SELF_URL=https://sakhmatrix.ru
  ZAI_API_KEY=...
  ```

---

## 📋 Договорённости с заказчиком (СОБЛЮДАТЬ!)

1. **Без отсебятины** — только то, что в ТЗ. Сначала писать как понял, потом делать.
2. **Не менять шрифты/цвета/логику других блоков** без согласования.
3. **Мобильные стили `@media (max-width:480px)` НЕ трогать.**
4. **Git — только ручной `git add` конкретных файлов** (фон-процессы коммят db).
5. **Кнопка "Удалить" — нежно-красная `#c08080`** (не ядовитная).
6. **После правок CSS:** `rm -rf .next` + чистый рестарт.
7. **Push в GitHub** — через `git push` с PAT (токен присылает заказчик, **ротировать после каждой сессии**).
8. **Prisma 6** — использовать `author: { connect: { id } }`, не `authorId`.
9. **Z-AI SDK** — обязательно `model: "glm-4.5-flash"` (без него возвращает undefined).
10. **`pickRandomBot()`** — обязательно `await` (иначе Promise truthy).
11. **input.click()** на мобильных не работает — использовать `<label>` + `opacity:0`.

---

## 🛠️ Типичные грабли (уже наступлены)

| Проблема | Решение |
|---|---|
| Prisma 6 не принимает `authorId` напрямую | `author: { connect: { id: userId } }` |
| `pickRandomBot()` без await → user.id undefined | `const bot = await pickRandomBot()` |
| Z-AI SDK возвращает undefined | Добавить `model: "glm-4.5-flash"` |
| ComplaintModal crash: `botNick is not defined` | Убрать строку |
| localStorage избранного не фильтруется | `scope=favorites` в URL |
| Вспышка главной при переходе на форум | `searchParams` — Promise в Next.js 16, нужен `await` |
| Upload файлы удалялись при deploy | `/opt/smatrix/uploads/` вне standalone |
| `input.click()` не работает на мобильных | `<label>` + `opacity:0` |
| `new Resend("")` падает при build | Ленивая инициализация `getResend()` |
| Локальная БД устарела (снапшот 12.10) | Для данных на проде использовать `/admin/seed` (не git push БД) |
| На проде нет SSH из песочницы | Эндпоинт `/api/admin/seed` + страница `/admin/seed` для заливки данных |
| Снапшот БД не содержит новых колонок Prisma | После клонирования: `DATABASE_URL=... bun run db:push` (применить схему) |
| git push падает с 401 в песочнице | Заказчик присылает PAT → `git push https://USER:TOKEN@github.com/...` |

---

## 📝 Первое сообщение в новой сессии

Отправь заказчику:
> "Я загрузил контекст проекта SMatrix. Текущий статус: код в GitHub (последний коммит `a827a77`), сайт работает на `http://157.22.252.127`. На проде есть эндпоинт `/api/admin/seed` + страница `/admin/seed` для заливки тем через JSON (без SSH). Готов принимать задачи — кидай текст темы с ответами."

Если заказчик кидает текст темы для заливки на прод:
1. Делаешь лёгкий рерайт текста темы и каждого ответа (сохраняя факты, имена, цифры, телефоны).
2. Определяешь гендер каждого автора по контексту / нику.
3. Сохраняешь древовидную структуру ответов (кто на кого ответил).
4. Формируешь JSON в формате `SeedPayload` (см. `/api/admin/seed/route.ts`).
5. Отправляешь JSON заказчику. Заказчик открывает `/admin/seed`, вставляет JSON, жмёт кнопку.
6. Заказчик присылает ответ (topicId, messages). Проверяешь что 11 сообщений создано.

**Боты:** подбираются автоматически из пула `bot+*@theatre.local` через `pickRandomBot()`.

**Даты:** реальные из оригинала, в ISO с offset `+11:00` (Сахалинское время).

---

## 📂 Файлы-опоры

- `worklog.md` — полный журнал (6494 строк, ~300 КБ)
- `HANDOFF.md` — старый handoff (устарел, актуальный — этот файл)
- `NEW_SESSION_CONTEXT.md` — этот файл (актуальный)
- `prisma/schema.prisma` — схема БД
- `src/lib/auth.ts` — аутентификация
- `src/lib/admin.ts` — проверка ролей
- `src/lib/security.ts` — утилиты безопасности
- `src/lib/auto-bots.ts` — `pickRandomBot()` для заливки тем
- `src/app/api/admin/seed/route.ts` — эндпоинт заливки тем (для новых сессий)
- `src/app/admin/seed/page.tsx` — HTML-страница с формой заливки
- `scripts/autodeploy/` — webhook для авто-деплоя
