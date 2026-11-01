const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
(async () => {
  const r = await db.helpPublication.deleteMany({});
  const c = await db.helpComplaint.deleteMany({});
  console.log(`удалено: просьб=${r.count}, жалоб=${c.count}`);
  console.log("итог: просьб=", await db.helpPublication.count(), " жалоб=", await db.helpComplaint.count());
  await db.$disconnect();
})();
