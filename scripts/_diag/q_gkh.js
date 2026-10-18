
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const problems = await p.gkhProblem.findMany({
    select: { id: true, title: true, status: true, topicId: true, isDeleted: true },
    take: 5
  });
  for (const prob of problems) {
    let topicState = null;
    if (prob.topicId) {
      const t = await p.topic.findUnique({ where: { id: prob.topicId }, select: { id: true, isClosed: true, isArchived: true, deletedAt: true } });
      topicState = t;
    }
    console.log(JSON.stringify({
      id: prob.id.slice(0,14),
      title: prob.title.slice(0, 50),
      status: prob.status,
      topicId: prob.topicId,
      topic: topicState
    }));
  }
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

