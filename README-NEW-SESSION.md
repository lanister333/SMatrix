# SakhMatrix — Контекст переноса в новую сессию

> **Цель этого файла** — за 5 минут ввести новую сессию в курс дела.
> Прочитай ВНИМАТЕЛЬНО весь файл перед началом работы.

## Что это за проект

**SakhMatrix.ru** — независимый форум-портал для жителей Сахалина.
Стек: Next.js 16.1.3 (Turbopack), React 18, TypeScript, Prisma ORM, SQLite.
Запуск локально: `bun run dev` на порту 3000.

**База данных** (db/custom.db, 1.3 MB): 49 пользователей, 34 темы, 831 сообщение,
99 рубрик, админ: admin@sakhmatrix.ru / admin.

## Где что лежит

| Путь | Что |
|---|---|
| `src/app/` | Next.js app-router (роуты `*.php/page.tsx`, API `api/*/route.ts`) |
| `src/components/site/` | Компоненты сайта (chrome.tsx, home-center.tsx, home-right.tsx, left-nav.tsx, currency-screen.tsx, sakh-datetime-block.tsx, volunteers-carousel.tsx) |
| `src/components/forum/` | Компоненты форума (topic-view.tsx, message-render.tsx) |
| `src/lib/` | Бизнес-логика (currency-parser.ts, currency-banks.ts, currency-table.ts, outages-parser.ts, weather-parser.ts, db.ts, auth.ts) |
| `prisma/schema.prisma` | Схема БД (CurrencyRate, Topic, Message, User, Rubric, Complaint, Appeal и т.д.) |
| `src/app/globals.css` | ВСЕ стили (3 063 строки) — НЕ трогать `.trf-map` блок |
| `scripts/` | 149 тестовых/утилитных скриптов (.ts/.js/.sh) + HTML-образцы сайтов банков |
| `worklog.md` | 3 198 строк — полный лог работы. **ОБЯЗАТЕЛЬНО прочитать последние 200 строк** |
| `download/` | 118 файлов — скриншоты приёмок + md-файлы с готовым кодом |

## ЖЁСТКИЕ правила (НЕ НАРУШАТЬ)

1. **НЕ выдумывать данные** — если парсер не отдал курс, в таблице ставим прочерк «—», а не «нет данных» или 0
2. **НЕ менять шрифты** — Anton для логотипа, system-ui для всего остального
3. **НЕ трогать `.trf-map` блок в globals.css** — это отдельная независимая карта
4. **Мобильная адаптация — строго `@media (max-width: 768px)`** (не 640, не 1024)
5. **Продакшн — только через Publish платформы** (НЕ через bun run build вручную)
6. **Каждая задача → запись в worklog.md + скриншот в download/**

## Текущее состояние (на 18.09.2026 21:04)

### Что сделано (последние 5 итераций, NEW → OLD)

1. **forum-comments-redesign-rollback** (откат) — откатил предыдущую итерацию
   forum-comments-redesign (бирюзовые лесенки + серые кнопки-таблетки) по запросу
   пользователя «откати назад». Форум вернулся к исходному виду: серые тонкие 1px
   линии #B0BEC5, прозрачная кнопка «Пожаловаться» с подчёркиванием, padding 4px 12px,
   font-size 14px, шаг margin-left 20px.

2. **forum-comments-redesign** (ОТКАЧЕНО) — попытка переделать комментарии по
   директиве пользователя: бирюзовые жирные 2px лесенки, серые кнопки-таблетки,
   приземистая плотность. Пользователь попросил откатить — см. п.1.

3. **navy-border-unification** — все блоки сайта получили единую тёмно-синюю
   окантовку `1px solid #1E3A5F` (var(--sm-navy)). Заменены:
   - Блоки «Курсы валют» и «Калькулятор-конвертер» на /currency.php (было `2px solid #A0AAB0`)
   - Поле комментария в форуме (было `1px solid #7D8FA5`)
   - ВСЕ поля ввода в globals.css (16 правил: `.sk-qr textarea`, `.sk-userline input`,
     `.sk-toolbar input`, `.sk-modal-row input`, `.sk-note input`, `.oh-search input`,
     `.wb-search input`, `.gkh-search input`, `.gkh-orgform textarea`, `.gkh-updform textarea`)

4. **calculator-style-refinement** — калькулятор валют на /currency.php:
   - Поля «Сумма» и «Валюта» — тёмно-синяя рамка 1px #1E3A5F (вместо чёрной 2px #333333)
   - НЕактивная кнопка — серая #E5E7EB + тёмно-синяя окантовка + серый текст
   - Активная кнопка — яркая синяя #1E3A5F + белый текст
   - Плавный transition `all 0.15s ease`

5. **primbank-direct-parser-fix** — исправил баг парсера Приморье: USD показывал
   11.55/86.60 (данные из конвертера) вместо реальных 82.21/90.75. Добавил Формат 3
   в parseDirectBankPage с regex `exchange-rates__currency` + опциональным icon div.
   Фильтр placeholder'ов: если `sell > buy × 1.5` — это placeholder «не продаём
   наличными» (Приморье ставит 100.00 для JPY/KRW), сохраняем только buy.

6. **dolinsk-direct-parser** — Долинск Банк парсится напрямую с dolinskbank.ru
   (URL с utm-параметрами от пользователя). 4 курса: USD/EUR/CNY/JPY, KRW — прочерк
   (Долинск не публикует вону). Referer https://biz65.ru/ — обязателен для anti-bot.
   JPY НЕ умножаем на 10 — оставляем per-100¥ значение под лейблом «за 1000»,
   согласовано с Солид (54.6) и ВТБ (43.0).

### Что в работе

- **6 банков ТЗ парсятся корректно**: АТБ (4 курса), Солид (5), Сбер (5), ВТБ (4),
  Приморье (5), Долинск (4) = 27 курсов всего
- **Стенд :3000 запущен**, доступен на http://localhost:3000
- **Все изменения применены в dev-режиме** — для продакшна нужен Publish платформы

### Архитектура парсера валют (currency-parser.ts)

```
DIRECT_SITES = {
  "aziatsko-tihookeanskij-bank": "https://atb.su/currency/",
  "bank-primore": "https://primbank.ru/currency/",
  "bank-dolinsk": "https://dolinskbank.ru/?utm_medium=cpc&utm_campaign=bank_dolinsk&utm_source=Biz65Ru",
}
// Остальные (Солид, Сбер, ВТБ) → kovalut.ru fallback
// solidbank.ru/currency-transactions/ — HTTP 403 (Cloudflare)
// biz65.ru/valuta/rating — HTTP 403 (Cloudflare)
```

3 формата парсера:
- **Формат 3 (primbank)**: regex `exchange-rates__currency` + unit div + 2 value divs
- **Формат 1 (atb.su)**: `code + "</div>"` + следующие 2 десятичных числа
- **Формат 2 (dolinskbank)**: `code + "</b>"` + `unit_symbol` + 2 десятичных числа

### Архитектура лесенки форума (topic-view.tsx)

```
ПЛОСКИЙ HTML: .sakh-comments-container > N × .sakh-comment[data-level]
НЕТ матрёшек — все карточки на одном уровне DOM
Уровень задаётся data-level="1..6"
Сдвиг = margin-left: 20×(level-1)px (шаг 20px)
Connector'ы: <span class="sakh-comment-connector" style="left: railLeft(k, L)">
railLeft(k, level) = (k - level) * 20 + 4  // отрицательное = левее рамки
```

### Currency table на /currency.php

6 банков × 5 валют (USD, EUR, CNY, JPY, KRW) × 2 (buy/sell) = 60 ячеек
Зелёная подсветка лучшего курса (#E2F0D9 + #2E7D32)
Прочерк «—» для null значений (KRW у АТБ/ВТБ/Долинск, sell JPY/KRW у Приморья)
Калькулятор: input «Сумма» + select «Валюта» + 2 кнопки «Я покупаю/сдаю валюту»
Лучший курс берётся автоматически из таблицы выше

### Информеры в правом сайдбаре (home-right.tsx)

- 🕒 SakhMatrix • Время (Asia/Magadan, обновление каждую секунду)
- ▼Погода на Сахалине (open-meteo.com API, 2-колоночный виджет)
- ▼Курсы валют (сжатый вид: лучшие buy/sell из 6 банков)
- ▼Отключения (Сахалинэнерго + Водоканал)
- ▼Пробки (Яндекс.Пробки API, 1-10 баллов)
- ▼Полезные телефоны и службы (112, 102, 103, 104, 118)
- 🤝 Волонтёры (карусель 6 организаций: ПСО СОВА, ЛизаАлерт, Помощь животным, ЭкоСахалин, Я донор, Красный Крест)

## Команды для работы

```bash
# Запуск dev-сервера (после распаковки ZIP на новом окружении)
cd /home/z/my-project
bun install           # восстановить зависимости
bun run dev           # запустить на :3000

# Принудительный рестарт с очисткой кэша (использовать при странном поведении)
pkill -9 -f "next-server"; pkill -9 -f "bun run"; sleep 2; rm -rf .next
setsid -f bash -c 'cd /home/z/my-project && exec bun run dev' > dev.log 2>&1
sleep 15
ps aux | grep next-server | grep -v grep
curl -s -o /dev/null -w "HTTP:%{http_code}\n" http://127.0.0.1:3000/

# Принудительный парсинг курсов (без ожидания ежечасного тика)
curl -X POST http://localhost:3000/api/currency/parse

# Проверка курсов
curl http://localhost:3000/api/home/rates | python3 -m json.tool

# Тест конкретной темы (35 сообщений на страницу)
curl "http://localhost:3000/?topic=1"

# Тест калькулятора валют
curl http://localhost:3000/currency.php

# Сделать скриншот через agent-browser
agent-browser navigate --url "http://localhost:3000/..." --wait-until networkidle
agent-browser screenshot --full /path/to/screenshot.png

# Проверить стиль через DOM
agent-browser eval "JSON.stringify({border: getComputedStyle(el).border, ...})"

# Добавить запись в worklog
cat >> /home/z/my-project/worklog.md << 'EOF'

---
Task ID: <имя-задачи>
Agent: main (Super Z)
Task: <описание>

Work Log:
- <шаг 1>
- <шаг 2>

Stage Summary:
- <результат>
EOF
```

## Частые грабли

1. **server dies after `setsid`** — нужно `setsid -f bash -c 'cd /path && exec bun run dev'`,
   обычный `&` не работает, процесс умирает через 15-30 сек
2. **Turbopack долго компилирует** — первый запрос к /currency.php может занять 60-120 сек,
   это нормально, последующие — <1 сек
3. **IPv6 vs IPv4** — сервер слушает на tcp6 :::3000, но `curl http://localhost:3000`
   ходит по IPv6 (::1) и может connection refused. Используй `curl http://127.0.0.1:3000`
4. **`.next` кэш протух** — при странных ошибках компиляции или несоответствии CSS
   ожиданиям: `rm -rf .next && pkill -9 -f next-server && bun run dev`
5. **inline-стили React не поддерживают `!important`** — для `!important` используй
   CSS-класс в globals.css с `!important`-правилом
6. **VLM rate-limit (429)** — z-ai vision часто падает с 429, особенно на скриншотах
   > 1 MB. Альтернатива: agent-browser eval для проверки DOM computed styles
7. **dolinskbank.ru требует Referer** — без `Referer: https://biz65.ru/` отдаёт
   сокращённую страницу без таблицы курсов
8. **solidbank.ru и biz65.ru — Cloudflare 403** — серверный парсинг невозможен,
   пользователю это сообщено, альтернатива только kovalut.ru

## Файлы в этом релизе

### sakhmatrix-full-dump-20260918-2104.zip (4.2 MB, 987 файлов)
ПОЛНЫЙ дамп для переноса в новую сессию. Содержит:
- Все исходники (src/, 365 файлов)
- БД (db/custom.db, 1.3 MB)
- Prisma-схема
- Все скрипты (scripts/, 149 файлов)
- Реверс-инжиниринг deployed-сайта (reverse/)
- Полный worklog.md (3 198 строк)
- Скриншоты приёмок (download/, 118 файлов)
- Документация и тесты

Исключено: node_modules, .next, .git, skills, upload (восстанавливается из package.json)

### sakhmatrix-prod-20260918-2058.zip (1.2 MB, 412 файлов)
МИНИМАЛЬНЫЙ релиз для переноса на хостинг. Содержит только нужное для продакшна:
- Исходники + БД + Prisma + public + конфиги + HANDOFF.md + тесты

Исключено: scripts/, reverse/, examples/, tool-results/, worklog.md, dev.log

## Что делать новой сессии

⚠️ **АКТУАЛЬНЫЙ БЭКАП — не дампы 18.09 ниже!** Каноническая копия:
`download/sakhmatrix-full-backup-2026-09-21.zip` (md5 9033f9d42f9168702498228ce613b371,
порядок восстановления — HANDOFF.md, раздел «Перенос в новую сессию»).
Раздел про дампы 20260918 — исторический.

1. Распаковать `sakhmatrix-full-dump-*.zip` в `/home/z/my-project/`
2. Прочитать этот файл полностью
3. Прочитать последние 200 строк `worklog.md`
4. Прочитать `HANDOFF.md`
5. Установить зависимости: `bun install`
6. Запустить стенд: `bun run dev`
7. Проверить http://localhost:3000 — главная форума
8. Проверить http://localhost:3000/currency.php — курсы валют
9. Проверить http://localhost:3000/?topic=1 — тема с 99 ответами
10. Ждать задач от пользователя

## Контакты и контекст

- Пользователь пишет на русском
- Часовой пояс пользователя: Asia/Sakhalin (UTC+11)
- Текущая дата: 18 сентября 2026
- Проект развивается итеративно, каждая итерация = 1 задача с worklog-записью
- Пользователь требует жёсткого соблюдения директив и не любит, когда данные выдумываются
