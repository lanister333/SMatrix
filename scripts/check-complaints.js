const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const complaints = await p.complaint.findMany({where: {resolved: false}, include: {message: {select: {id: true, body: true, topicId: true}}}});
  console.log(JSON.stringify(complaints.map(c => ({id: c.id, reason: c.reason, comment: c.comment, createdAt: c.createdAt, msgId: c.messageId, body: (c.message?.body || '').slice(0, 60)})), null, 1));
  await p.$disconnect();
})();
