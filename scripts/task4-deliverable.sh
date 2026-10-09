#!/bin/bash
# Задача 4: сборка deliverable-файла с полным кодом (порядок ТЗ: CSS → HTML → парсеры)
set -e
cd /home/z/my-project
OUT="download/SakhMatrix_Задача4_Отключения_готовый-код.md"

{
cat <<'HDR'
# SakhMatrix — ЗАДАЧА №4. Оживление информера «Коммунальные отключения» (/disconnections.php)

**Стек:** Next.js (Bun) + PHP-крон-близнец · **Дата:** 16.09.2026 · **Тесты:** 204/204 (+36 по Задаче 4)

## Что сделано (по пунктам ТЗ)

1. **Заглушка удалена.** Строка «Актуальная информация сейчас недоступна» не выводится никогда:
   при живых данных — ТОП-3 строк формата ТЗ; при честной пустоте базы — живой статус
   Задачи 13 «…не зафиксировано. Проверено: [время]»; «мёртвого» текста в коде нет
   (авто-проверка тестом «З4-HTML: заглушка удалена из информера»).
2. **Парсеры трёх ведомств (реальные источники, подтверждены 16.09.2026):**
   | Ведомство | Источник | Что берём |
   |---|---|---|
   | Сахалинэнерго (ФРС) | https://sakh-frs.ru/ — филиал «Распределительные сети» ПАО «Сахалинэнерго» (РусГидро) | карточки `.oItem`: дата отключения, пометка «(Плановое)/(Аварийное)», адреса, **точное время публикации** («Время публикации 16.09.2026 11:52») |
   | СКК | https://skk65.ru/wp-json/wp/v2/posts — WordPress REST | `date_gmt` (время публикации), заголовок с периодом, адреса в `content` |
   | Городской Водоканал | https://sakhalin.rosvodokanal.ru/pressroom/news/ — «РВК-Сахалин» | сводки-ограничения статьями («Внимание: ограничение холодного водоснабжения…»), адреса из статей |

   Доступность: ФРС и РВК читаются прямым fetch (РВК требует браузерных заголовков — иначе 403;
   Node-fetch блокируется WAF'ом по TLS-отпечатку → резервный канал SDK-ридер `page_reader`);
   skk65.ru из песочницы недоступен напрямую (гео-фильтр) → SDK-ридер. На боевом хостинге прямой
   fetch работает, SDK остаётся резервом. Сбор — раз в 30 минут (планировщик + PHP-крон).
3. **Формат строки на Главной — СТРОГО по ТЗ:** `[Иконка/Название ведомства] [Краткий адрес/Район] — [Время публикации]`
   (⚡ Сахалинэнерго / 🔥 СКК / 🚰 Водоканал), ТОП-3 самые свежие по `publishedAt`
   (сегодня → «ЧЧ:ММ», раньше → «ДД.ММ ЧЧ:ММ», дата без времени → «ДД.ММ»; Сахалин = UTC+11).
4. **Заголовок плашки «Отключения»** — ссылка на внутреннюю страницу /disconnections.php.

## Выдача кода — в порядке ТЗ: CSS → HTML-структура → PHP/JS-парсеры

HDR
echo "### ЧАСТЬ 1. CSS-блок (\`src/app/globals.css\`)"
echo ""
echo 'Заменённые/новые правила (базовый блок + мобильный блок ≤480px):'
echo ""
echo '```css'
sed -n '/Шаг 7 + ЗАДАЧА №4: сводки отключений/,/^\.mp-off-time{.*}$/p' src/app/globals.css
echo ""
echo "/* --- мобильный блок ≤480px (внутри существующего @media (max-width:480px)) --- */"
sed -n '/\.mp-off-list{padding:2px 0}/,/^  \.mp-off-time{font-size:10px}$/p' src/app/globals.css
echo '```'
echo ""
echo "### ЧАСТЬ 2. HTML-структура информера (\`src/components/site/home-right.tsx\`)"
echo ""
echo '```tsx'
cat <<'HTML2'
// import — добавлена строка:
import { outageOrgBadge, outageWhenLabel } from "@/lib/outages-taxonomy";

// interface OutagesData — добавлено поле Задачи №4:
interface OutagesData {
  source: "aggregated" | "empty" | "none";
  updated: string;
  items: {
    source: string;
    title: string;
    url: string;
    addresses: string[];
    /** Задача №4: краткий адрес/район для строки ТЗ. */
    short?: string;
    when: string;
    /** Шаг №7: время публикации (сортировка «Варианта А» на сервере). */
    publishedAt?: string;
  }[];
}
HTML2
echo ""
echo "// useEffect — блок загрузки (при source=\"none\" — автоподталкивание первого сбора POST):"
sed -n '/    \/\/ Задача №4: если кеша ещё нет/,/^    });$/p' src/components/site/home-right.tsx
echo ""
echo "// Панель 8.3 «Отключения» (заглушка убрана, строки формата ТЗ):"
sed -n '/      {\/\* 8.3 «Отключения» — ЗАДАЧА №4/,/^      <\/section>$/p' src/components/site/home-right.tsx
echo '```'
echo ""
echo "### ЧАСТЬ 3. JS-парсер (\`src/lib/outages-parser.ts\`) — полный файл"
echo ""
echo '```typescript'
cat src/lib/outages-parser.ts
echo '```'
echo ""
echo "### ЧАСТЬ 4. Дополнение таксономии (\`src/lib/outages-taxonomy.ts\`) — блок Задачи №4"
echo ""
echo '```typescript'
sed -n '/\/\* ==================== ЗАДАЧА №4 (ТЗ) ==================== \*\//,$p' src/lib/outages-taxonomy.ts
echo '```'
echo ""
echo "### ЧАСТЬ 5. PHP-крон-близнец (\`scripts/cron-outages.php\`) — полный файл"
echo ""
echo '```php'
cat scripts/cron-outages.php
echo '```'
echo ""
echo "## Приложение. Фикстуры, тесты, приёмка"
echo ""
cat <<'APP'
- **Фикстуры** (`scripts/fixtures/`): `frs-outages.html` (6 живых карточек ФРС),
  `skk-wp.json` (живой ответ WP REST СКК + 2 дописанных поста-паттерна),
  `rvc-news.html` / `rvc-article.html` (живая разметка списка/статьи РВК).
- **Тесты** (`scripts/test-informers.ts`): секция «Задача 4» — 36 проверок
  (фикстуры трёх ведомств, аварийная сводка, краткие адреса, формат времени,
  ТОП-3, live-сбор ≥5 сводок, CSS- и HTML-проверки). Итого **204/204**.
- **Смок-скрипт:** `scripts/task4-smoke.ts` (bun scripts/task4-smoke.ts).
- **Живая приёмка (16.09.2026):** API `/api/home/outages` — source=aggregated,
  3 записи (СКК ул. Ленина, 304А — 14:11; Сахалинэнерго пер. Энергетиков 1А, 6 — 11:52;
  Сахалинэнерго с. Ключи, снт. "Вагонник" — 11:48); клик заголовка → /disconnections.php;
  /disconnections.php — 16 записей в трёх блоках; мобайл 400 — без прокруток-X,
  компактные строки (10.5px/4px); консоль чиста; скриншоты t4-*.png в download/.
- **Расписание:** планировщик src/instrumentation-node.ts — раз в 30 минут;
  PHP-крон: `*/30 * * * * php scripts/cron-outages.php`.
APP
} > "$OUT"

echo "MD готов: $(wc -c < "$OUT") байт"
# ZIP с кодом задачи
mkdir -p /tmp/zippack4/src/lib /tmp/zippack4/src/components/site /tmp/zippack4/src/app /tmp/zippack4/scripts/fixtures
cp src/lib/outages-parser.ts src/lib/outages-taxonomy.ts /tmp/zippack4/src/lib/
cp src/components/site/home-right.tsx /tmp/zippack4/src/components/site/
cp src/app/globals.css /tmp/zippack4/src/app/
cp scripts/cron-outages.php scripts/test-informers.ts scripts/task4-smoke.ts /tmp/zippack4/scripts/
cp scripts/fixtures/frs-outages.html scripts/fixtures/skk-wp.json scripts/fixtures/rvc-news.html scripts/fixtures/rvc-article.html /tmp/zippack4/scripts/fixtures/
cp "$OUT" /tmp/zippack4/
cd /tmp/zippack4 && rm -f /home/z/my-project/public/sakhmatrix-task4-code.zip && zip -q -r /home/z/my-project/public/sakhmatrix-task4-code.zip . && cd /home/z/my-project
cp "$OUT" public/sakhmatrix-task4-code.md
echo "ZIP: $(wc -c < public/sakhmatrix-task4-code.zip) байт; MD(public): $(wc -c < public/sakhmatrix-task4-code.md) байт"
md5sum "$OUT" public/sakhmatrix-task4-code.md
unzip -t public/sakhmatrix-task4-code.zip | tail -1