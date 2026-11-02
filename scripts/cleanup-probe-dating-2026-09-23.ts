/**
 * Зачистка следов проб публикации Love Sakh (2026-09-23):
 *  1) удалить тестовые посты с маркером @probe_test (включая скрытые ИИ);
 *  2) снять санкции, выданные ИИ-лестницей за скрытые посты пробы
 *     (Sanction → revoked), и сбросить restrictedUntil модератора.
 * Запуск: bunx tsx scripts/cleanup-probe-dating-2026-09-23.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const mod = await db.user.findFirst({ where: { nickname: "Модератор" } });

  // 1. Тестовые посты проб (включая скрытые ИИ) — жёстко, это мусор проб.
  const gone = await db.datingPost.deleteMany({
    where: { OR: [{ body: { contains: "@probe_test" } }, { title: { contains: "Тест публикации" } }] },
  });
  console.log("Удалено тестовых постов:", gone.count);

  if (mod) {
    // 2. Санкции, выданные в ходе проб (недействующие ревокации).
    const upd = await db.sanction.updateMany({
      where: { userId: mod.id, revoked: false },
      data: { revoked: true, revokedReason: "зачистка проб Love Sakh 2026-09-23", revokedAt: new Date() },
    });
    console.log("Отменено санкций:", upd.count);
    await db.user.update({ where: { id: mod.id }, data: { restrictedUntil: null } });
    console.log("restrictedUntil модератора сброшен");
  }

  const left = await db.datingPost.count();
  console.log("Осталось объявлений на доске:", left);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
