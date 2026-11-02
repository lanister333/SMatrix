/**
 * 2026-10-04: Синхронизация authorId ↔ authorName во всех таблицах.
 *
 * Проблема: в БД есть записи, где authorName="SnowQueen", но authorId
 * указывает на пользователя "Пельмень" (рассинхрон после seed/migration).
 * Из-за этого safeAuthorGender() возвращает null (т.к. User.nickname
 * не совпадает с authorName), и покраска ника падает в эвристику
 * по окончанию — даёт male для "SnowQueen" (хотя должна быть female).
 *
 * Скрипт: для каждой таблицы с полями (authorId, authorName) —
 * 1) Найти всех User с nickname=authorName
 * 2) Если найден ровно один — проставить его id в authorId
 * 3) Если найдено несколько или ноль — пропустить (не трогать)
 *
 * Запуск: DATABASE_URL="file:..." bun scripts/sync-author-id.ts
 */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

type AuthorRef = { authorId: string | null; authorName: string };

async function syncTable(name: string, model: any) {
  // Берём все записи с непустым authorName — потом проверим соответствие.
  const rows: any[] = await model.findMany({
    where: { authorName: { not: "" } },
    select: { id: true, authorId: true, authorName: true },
  });
  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  for (const r of rows as Array<{ id: string; authorId: string | null; authorName: string }>) {
    if (!r.authorName) continue;
    // Найти User по nickname
    const users = await db.user.findMany({
      where: { nickname: r.authorName },
      select: { id: true, nickname: true },
    });
    if (users.length !== 1) {
      // Либо ник не существует, либо их несколько (дубликаты)
      if (users.length === 0) notFound++;
      else skipped++;
      continue;
    }
    const correctId = users[0].id;
    if (r.authorId === correctId) continue; // уже совпадает
    await model.update({ where: { id: r.id }, data: { authorId: correctId } });
    updated++;
  }
  console.log(`${name}: updated ${updated}, skipped ${skipped} (multiple users), notFound ${notFound}`);
}

async function main() {
  console.log("=== Синхронизация authorId ↔ authorName ===\n");
  await syncTable("Topic", db.topic);
  await syncTable("Message", db.message);
  await syncTable("RecPost", db.recPost);
  await syncTable("WhereToBuyPost", db.whereToBuyPost);
  await syncTable("CheapPost", db.cheapPost);
  await syncTable("HelpPublication", db.helpPublication);
  await syncTable("EmpPost", db.empPost);
  await syncTable("GkhProblem", db.gkhProblem);
  await syncTable("GkhUpdate", db.gkhUpdate);
  await syncTable("OverheardPost", db.overheardPost);
  await syncTable("DatingPost", db.datingPost);
  await syncTable("AdListing", db.adListing);
  console.log("\n=== Готово ===");
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
