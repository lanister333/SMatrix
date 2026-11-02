const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
(async () => {
  // Скрытый тестовый мат-заголовок от Админа
  const r1 = await db.helpPublication.deleteMany({ where: { title: { contains: "нахуй" } } });
  // Санкция от того теста
  const s1 = await db.sanction.deleteMany({ where: { reason: { contains: "нецензурной лексики в заголовке" } } });
  // Тестовые пользователи от прерванных прогонов
  const users = await db.user.findMany({ where: { email: { contains: "@test.local" } }, select: { id: true, nickname: true } });
  for (const u of users) {
    await db.sanction.deleteMany({ where: { userId: u.id } });
    await db.session.deleteMany({ where: { userId: u.id } });
    await db.user.delete({ where: { id: u.id } }).catch(() => {});
  }
  // Остаточные просьбы/жалобы раздела от любых тестов
  const leftR = await db.helpPublication.findMany({ select: { id: true, title: true, authorName: true } });
  console.log("просьбы в разделе:", leftR);
  const r2 = await db.helpPublication.deleteMany({ where: { authorName: { startsWith: "HelpTest_" } } });
  const c2 = await db.helpComplaint.deleteMany({ where: { reporterName: { startsWith: "HelpTest" } } });
  console.log(`удалено: мат-просьба=${r1.count}, санкций=${s1.count}, юзеров=${users.length}, остаточных просьб=${r2.count}, жалоб=${c2.count}`);
  console.log("итог: просьб=", await db.helpPublication.count(), " жалоб=", await db.helpComplaint.count(), " активных санкций=", await db.sanction.count({ where: { revoked: false } }), " test-юзеров=", await db.user.count({ where: { email: { contains: "@test.local" } } }));
  await db.$disconnect();
})();
