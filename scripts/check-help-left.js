const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
(async () => {
  const rows = await db.helpPublication.findMany({ select: { id: true, title: true, authorName: true, status: true, isHiddenByAi: true, isDeleted: true, createdAt: true } });
  console.log(JSON.stringify(rows, null, 1));
  const comps = await db.helpComplaint.findMany();
  console.log("жалоб:", comps.length);
  const sancs = await db.sanction.findMany({ where: { revoked: false } });
  console.log("активных санкций:", sancs.length, sancs.map(s => `${s.kind} → ${s.userId.slice(0,8)}`));
  const testUsers = await db.user.findMany({ where: { email: { contains: "test.local" } }, select: { nickname: true, email: true } });
  console.log("тестовые юзеры:", testUsers);
  await db.$disconnect();
})();
