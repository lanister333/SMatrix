const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
db.adminLog
  .findMany({ where: { action: "settings.save" }, orderBy: { createdAt: "desc" }, take: 4 })
  .then((r) => {
    console.log(JSON.stringify(r, null, 1));
    return db.$disconnect();
  });
