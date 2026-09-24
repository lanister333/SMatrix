const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const models = Object.keys(p).filter(k => /whereToBuy|cheap/i.test(k));
  console.log("Модели Prisma:", models);
  for (const m of models.filter(k => /^whereToBuyPost$|^cheapPost$/.test(k))) {
    console.log(m, "=", await p[m].count());
  }
  await p.$disconnect();
})();
