const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const msgs = await p.message.findMany({where: {body: {contains: 'подонок'}}, select: {id: true, isHiddenByAi: true, hiddenReason: true, needHuman: true, authorName: true, topicId: true}});
  console.log(JSON.stringify(msgs, null, 1));
  const total = await p.message.count({where: {isDeleted: false}});
  const hidden = await p.message.count({where: {isHiddenByAi: true}});
  console.log('visible messages:', total, '| hidden by AI:', hidden);
  await p.$disconnect();
})();
