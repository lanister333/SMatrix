/** Очистка тестовых данных ШАГА 11. */
import { db } from "../src/lib/db";

const NICKS = ["ladder202959", "appeal202959", "vischeck203225", "vischeck203230", "vischeck203237", "vischeck203259"];

async function main() {
  for (const nick of NICKS) {
    const u = await db.user.findUnique({ where: { nickname: nick } });
    if (!u) continue;
    await db.message.deleteMany({ where: { authorId: u.id } });
    await db.topic.deleteMany({ where: { authorId: u.id } });
    await db.decisionAppeal.deleteMany({ where: { userId: u.id } });
    await db.sanction.deleteMany({ where: { userId: u.id } });
    await db.session.deleteMany({ where: { userId: u.id } });
    await db.user.delete({ where: { id: u.id } });
    console.log("deleted", nick);
  }
  // осиротевшие записи на всякий случай
  await db.decisionAppeal.deleteMany({ where: { sanctionId: { not: undefined as never } , sanction: null } }).catch(() => {});
  const left = await db.sanction.count();
  const appeals = await db.decisionAppeal.count();
  console.log("осталось санкций:", left, "апелляций:", appeals);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
