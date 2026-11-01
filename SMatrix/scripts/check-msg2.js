const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const msgs = await p.message.findMany({where: {id: {in: ['1089','1118']}}, select: {id: true, topicId: true, authorName: true, createdAt: true, num: true, body: true}});
  console.log(JSON.stringify(msgs.map(m=>({...m, createdAt: m.createdAt, body: m.body.slice(0,80)})), null, 1));
  await p.$disconnect();
})();
