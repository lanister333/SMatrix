const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const wtb = await p.whereToBuyPost.findMany({ select: { id: true, title: true, status: true, isHiddenByAi: true, hiddenReason: true, needHuman: true, answerText: true, topicId: true, createdAt: true } });
  console.log("=== WTB ===");
  wtb.forEach(x => console.log(JSON.stringify(x)));
  const cheap = await p.cheapPost.findMany({ select: { id: true, title: true, status: true, isHiddenByAi: true, hiddenReason: true, needHuman: true, answerText: true, topicId: true, createdAt: true } });
  console.log("=== CHEAP ===");
  cheap.forEach(x => console.log(JSON.stringify(x)));
  await p.$disconnect();
})();
