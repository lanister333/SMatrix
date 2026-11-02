const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const ids = ['1089', '1118'];
  // check for child replies that would orphan
  const children = await p.message.count({where: {parentId: {in: ids}}});
  console.log('child replies:', children);
  // check complaints referencing them
  const complaints = await p.complaint.count({where: {messageId: {in: ids}}});
  console.log('complaints:', complaints);
  if (children === 0 && complaints === 0) {
    const del = await p.message.deleteMany({where: {id: {in: ids}}});
    console.log('deleted:', del.count);
  } else {
    console.log('SKIPPED — has references, soft-delete instead');
  }
  const left = await p.message.count({where: {body: {contains: 'подонок'}}});
  console.log('remaining insult messages:', left);
  await p.$disconnect();
})();
