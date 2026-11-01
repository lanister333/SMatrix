const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
(async () => {
  const s = await db.sanction.findFirst({ where: { revoked: false }, include: { user: { select: { nickname: true, email: true } } } });
  console.log("санкция:", JSON.stringify(s ? { kind: s.kind, reason: s.reason, source: s.source, user: s.user, createdAt: s.createdAt } : null, null, 1));
  await db.$disconnect();
})();
