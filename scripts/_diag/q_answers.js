
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  // RecPost with topicId where topic has messages with num > 1
  const posts = await p.recPost.findMany({
    where: { isDeleted: false, isHiddenByAi: false, topicId: { not: null } },
    select: { id: true, topicId: true, title: true },
    take: 30
  });
  const topicIds = posts.map(p => p.topicId).filter(Boolean);
  const msgCounts = await p.message.groupBy({
    by: ['topicId'],
    where: { topicId: { in: topicIds }, num: { gt: 1 }, isDeleted: false },
    _count: { _all: true }
  });
  const countMap = new Map(msgCounts.map(m => [m.topicId, m._count._all]));
  const withAnswers = posts.filter(p => (countMap.get(p.topicId) ?? 0) >= 1).slice(0, 5);
  const withoutAnswers = posts.filter(p => (countMap.get(p.topicId) ?? 0) === 0).slice(0, 5);
  console.log("WITH_ANSWERS:"+JSON.stringify(withAnswers));
  console.log("WITHOUT_ANSWERS:"+JSON.stringify(withoutAnswers));
  await p.$disconnect();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});

