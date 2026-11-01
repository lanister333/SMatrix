const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const wtb = await p.whereToBuyPost.findMany({ select: { id: true, title: true, isDeleted: true, isHiddenByAi: true, status: true } });
  console.log("=== WTB (id/isDeleted/isHidden/status) ===");
  wtb.forEach(x => console.log(x.id.slice(-6), "isDeleted:", x.isDeleted, "hidden:", x.isHiddenByAi, "status:", x.status, "|", x.title.slice(0, 45)));
  const cheap = await p.cheapPost.findMany({ select: { id: true, title: true, isDeleted: true, isHiddenByAi: true, status: true } });
  console.log("=== CHEAP ===");
  cheap.forEach(x => console.log(x.id.slice(-6), "isDeleted:", x.isDeleted, "hidden:", x.isHiddenByAi, "status:", x.status, "|", x.title.slice(0, 45)));
  const wtbNotDeleted = await p.whereToBuyPost.count({ where: { isDeleted: false, isHiddenByAi: false } });
  const cheapNotDeleted = await p.cheapPost.count({ where: { isDeleted: false, isHiddenByAi: false } });
  console.log("PUBLIC WTB:", wtbNotDeleted, "| PUBLIC CHEAP:", cheapNotDeleted);
  await p.$disconnect();
})();
