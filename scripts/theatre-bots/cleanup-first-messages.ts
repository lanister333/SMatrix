/**
 * Очистка первого сообщения в темах парсера «Театра ботов».
 *
 * Старые темы (созданные до 2026-10-05) содержали в первом сообщении
 * служебные метки: «📰 Источник», «📅», «🔗», «Оригинал новости:».
 * Этот скрипт находит такие сообщения и оставляет только сам текст
 * новости — как в обычных темах форума.
 *
 * Запуск:
 *   DATABASE_URL="file:..." bun scripts/theatre-bots/cleanup-first-messages.ts
 *
 * Флаги:
 *   --dry-run — только показать что было бы изменено, без записи.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

interface CleanResult {
  topicId: number;
  messageId: string;
  before: string;
  after: string;
}

function extractOriginalText(body: string): string | null {
  // Шаблон: «📰 Источник: ...\n📅 ...\n🔗 ...\n\nОригинал новости:\n<text>»
  // Если есть маркер «Оригинал новости:» — берём всё после него.
  const m = body.match(/Оригинал новости:\s*\n([\s\S]+)$/);
  let text: string;
  if (m) {
    text = m[1];
  } else {
    // Иногда формат был с «📰 Источник:» в начале без «Оригинал новости:».
    // Тогда убираем строки, начинающиеся с эмодзи-маркеров.
    const lines = body.split("\n");
    const filtered = lines.filter((l) => !/^[📰📅🔗]/.test(l.trimStart()));
    if (filtered.length === 0 || filtered.every((l) => l.trim() === "")) return null;
    text = filtered.join("\n");
  }

  // 2026-10-05: убираем «первоисточниковые» строки вида:
  //   «@mvd_sakh (https://t.me/mvd_sakh)»
  //   «@astv_ru (https://t.me/astv_ru)»
  // Это стандартный блок подписи в постах АСТВ — ссылка на исходный канал.
  // Совпадает весь канал в конце или середине текста.
  text = text.replace(
    /(?:^|\n)\s*@[\w_]+\s*\(\s*https:\/\/t\.me\/[\w_]+\s*\)\s*(?=\n|$)/g,
    ""
  );

  // Также убираем голые ссылки на telegram-каналы, если они стоят отдельной строкой.
  text = text.replace(/(?:^|\n)\s*https:\/\/t\.me\/[\w_]+\/?\s*(?=\n|$)/g, "");

  // Убираем «короткие» подписи через @ник (telegram.org) — редко, но бывает.
  text = text.replace(/(?:^|\n)\s*@[\w_]+\s+\(https:\/\/telegram\.org\/[\w_]+\)\s*(?=\n|$)/g, "");

  // Чистим лишние переносы в конце.
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // Находим все темы парсера (по source, начинающемуся с "tg:")
  const topics = await db.topic.findMany({
    where: { source: { startsWith: "tg:" } },
    select: { id: true, number: true, title: true, source: true },
    orderBy: { id: "asc" },
  });

  console.log(`Найдено тем парсера: ${topics.length}`);
  if (dryRun) console.log("[dry-run] изменения НЕ будут записаны в БД.\n");

  const results: CleanResult[] = [];

  for (const t of topics) {
    // Берём первое сообщение темы (num=1)
    const msg = await db.message.findFirst({
      where: { topicId: t.id, num: 1 },
      select: { id: true, body: true },
    });
    if (!msg) {
      console.log(`  ⚠ Тема #${t.id} (number=${t.number}): нет первого сообщения`);
      continue;
    }

    const cleaned = extractOriginalText(msg.body);
    if (!cleaned || cleaned === msg.body.trim()) {
      // Уже чистое или нечего чистить
      console.log(`  ✓ Тема #${t.id} «${t.title.slice(0, 50)}…» — уже чистая`);
      continue;
    }

    results.push({
      topicId: t.id,
      messageId: msg.id,
      before: msg.body,
      after: cleaned,
    });

    console.log(`  📝 Тема #${t.id} «${t.title.slice(0, 50)}…»`);
    console.log(`     до:   ${msg.body.slice(0, 100).replace(/\n/g, " / ")}…`);
    console.log(`     после: ${cleaned.slice(0, 100).replace(/\n/g, " / ")}…`);

    if (!dryRun) {
      await db.message.update({
        where: { id: msg.id },
        data: { body: cleaned },
      });
    }
  }

  console.log(`\n=== ИТОГ ===`);
  console.log(`Всего тем: ${topics.length}`);
  console.log(`Очищено: ${results.length}`);
  if (dryRun) console.log(`[dry-run] изменения НЕ записаны.`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error("❌ Фатальная ошибка:", e);
  db.$disconnect();
  process.exit(1);
});
