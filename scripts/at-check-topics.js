const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  // 21: long topics 50+
  const long = await p.topic.findMany({where: {deletedAt: null}, orderBy: {messages: {_count: 'desc'}}, take: 3, select: {id: true, title: true, isClosed: true, isArchived: true, _count: {select: {messages: true}}}});
  console.log('TOP by messages:', JSON.stringify(long));
  // 22: closed topics
  const closed = await p.topic.findFirst({where: {isClosed: true, deletedAt: null}, select: {id: true, title: true, isClosed: true}});
  console.log('CLOSED:', JSON.stringify(closed));
  // 23: archived
  const arch = await p.topic.findFirst({where: {isArchived: true, deletedAt: null}, select: {id: true, title: true, isArchived: true, lastActivityAt: true}});
  console.log('ARCHIVED:', JSON.stringify(arch));
  const archCount = await p.topic.count({where: {isArchived: true}});
  console.log('archived count:', archCount);
  // 24: deleted
  const del = await p.topic.findFirst({where: {deletedAt: {not: null}}, select: {id: true, title: true, deletedAt: true}});
  console.log('DELETED:', JSON.stringify(del));
  // archive rule: inactive > 1 year
  const yearAgo = new Date(Date.now() - 365*24*3600*1000);
  const staleNotArchived = await p.topic.count({where: {deletedAt: null, isArchived: false, lastActivityAt: {lt: yearAgo}}});
  console.log('stale >1y not archived:', staleNotArchived);
  await p.$disconnect();
})();
