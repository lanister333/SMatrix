const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const msgs = await p.message.findMany({where: {isHiddenByAi: true}, select: {id: true, body: true}});
  let del = 0;
  for (const m of msgs) {
    if (m.body.startsWith('Тест (')) {
      const kids = await p.message.count({where: {parentId: m.id}});
      const cps = await p.complaint.count({where: {messageId: m.id}});
      if (!kids && !cps) { await p.message.delete({where: {id: m.id}}); del++; }
    }
  }
  console.log('test messages deleted:', del, '| hidden left:', await p.message.count({where: {isHiddenByAi: true}}));
  console.log('messages total:', await p.message.count());
  await p.$disconnect();
})();
