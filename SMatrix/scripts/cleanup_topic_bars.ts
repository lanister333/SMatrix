/**
 * 2026-10-01: очистка существующих тем форума от описательных блоков.
 *
 * ТЗ: «тексты "Публикация из раздела", "Кого:", "Автор публикации",
 * "Опубликовано", "Источник: ..." — удалить и в будущем не должно быть».
 *
 * Этот скрипт находит ВСЕ сообщения в БД, тело которых содержит
 * описательные блоки от старых /api/[section]/[id]/discuss эндпоинтов
 * (5 разделов: recommend, wheretobuy, gdedeshevle, overheard, gkh),
 * и заменяет тело на чистый текст (только заголовок + текст публикации).
 *
 * Старый формат (пример для recommend):
 *   Публикация из раздела «Рекомендую / Не рекомендую»:
 *
 *   Кого: Кофейня у Площады Победы (Рекомендую)
 *
 *   «Лучший капучино на Сахалине»
 *
 *   <text>
 *
 *   Автор публикации: <name>
 *   Опубликовано: <date>
 *
 *   Источник: Рекомендую / Не рекомендую
 *   <URL>
 *
 * Новый формат:
 *   <title>
 *
 *   <text>
 *
 * Логика извлечения:
 *   1. Если тело содержит «Публикация из раздела» / «Вопрос из раздела» /
 *      «Сообщение из раздела» / «Проблема из раздела» — это старый формат.
 *   2. Заголовок публикации — между первой парой «...» (кавычки-ёлочки).
 *   3. Текст публикации — между заголовком и строкой «Автор публикации:» /
 *      «Место:» / «Статус вопроса:» / «Текущий статус:» / «Дата обнаружения:».
 *   4. Альтернатива: просто вырезать все служебные строки и оставить текст.
 *
 * Подход: вырезаем все служебные строки (начинающиеся с типовых маркеров)
 * и пустые лишние переводы строк.
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

/** Маркеры строк, которые нужно удалить целиком (с переносом строки). */
const LINE_MARKERS = [
  "Публикация из раздела",
  "Вопрос из раздела",
  "Сообщение из раздела",
  "Проблема из раздела",
  "Кого:",
  "Автор публикации:",
  "Опубликовано:",
  "Источник:",
  "Место:",
  "Статус вопроса:",
  "Текущий статус:",
  "Дата обнаружения:",
  "— из публикации:",
];

/** Определяет, нужно ли чистить тело сообщения. */
function needsCleanup(body: string): boolean {
  return LINE_MARKERS.some((m) => body.includes(m));
}

/** Чистит тело: удаляет строки с маркерами + URL на ws-acb/origin/rekomenduyu/etc. */
function cleanBody(body: string): string {
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (LINE_MARKERS.some((m) => trimmed.startsWith(m))) continue;
    // URL на исходную публикацию (старый формат) — отдельная строка без маркера.
    if (/^https?:\/\/[^\s]+\?(post=|topic=)/.test(trimmed)) continue;
    // ws-acb-b-f-badc-... cn-hongkong-vpc.fcapp.run — артефакты preview-окружения.
    if (/^https?:\/\/[a-z0-9-]+\.cn-hongkong-vpc\.fcapp\.run\//.test(trimmed)) continue;
    // localhost / 127.0.0.1 — preview-окружение.
    if (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(trimmed)) continue;
    out.push(line);
  }
  // Схлопнуть 3+ перевода строк в 2.
  let cleaned = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  // Убрать ведущие/хвостовые кавычки-ёлочки вокруг заголовка (старая шапка).
  cleaned = cleaned.replace(/^«\s*([^»]+?)\s*»/, "$1");
  return cleaned;
}

async function main() {
  // Первое сообщение каждой темы (num=1) — там живут описательные блоки.
  // На всякий случай проверим и другие — вдруг кто-то их цитировал.
  const messages = await p.message.findMany({
    select: { id: true, body: true, num: true, topicId: true },
    where: { body: { contains: "раздела" } },
  });
  console.log(`Найдено сообщений с маркером «раздела»: ${messages.length}`);

  let updated = 0;
  for (const m of messages) {
    if (!needsCleanup(m.body)) continue;
    const newBody = cleanBody(m.body);
    if (newBody === m.body) continue;
    if (!newBody.trim()) {
      console.log(`  [skip] topic=${m.topicId} num=${m.num}: после чистки пусто`);
      continue;
    }
    await p.message.update({ where: { id: m.id }, data: { body: newBody } });
    updated++;
    console.log(`  [ok] topic=${m.topicId} num=${m.num}: ${m.body.length} → ${newBody.length} (-${m.body.length - newBody.length})`);
  }

  // Отдельно: сообщения, содержащие «— из публикации:» (старый prefill).
  const prefillMsgs = await p.message.findMany({
    select: { id: true, body: true, num: true, topicId: true },
    where: { body: { contains: "— из публикации:" } },
  });
  console.log(`\nНайдено сообщений с «— из публикации:»: ${prefillMsgs.length}`);
  for (const m of prefillMsgs) {
    const newBody = cleanBody(m.body);
    if (newBody === m.body) continue;
    if (!newBody.trim()) continue;
    await p.message.update({ where: { id: m.id }, data: { body: newBody } });
    updated++;
    console.log(`  [ok] topic=${m.topicId} num=${m.num}: ${m.body.length} → ${newBody.length}`);
  }

  console.log(`\nИтого обновлено сообщений: ${updated}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
