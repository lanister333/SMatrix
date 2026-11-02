
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  // Find by place containing "Шанхай"
  const prob = await p.gkhProblem.findFirst({
    where: { place: { contains: 'Шанхай' } },
    select: { id: true, title: true, place: true, status: true, topicId: true, isDeleted: true }
  });
  if (!prob) { console.log('NOT FOUND by place'); process.exit(1); }
  let topic = null;
  if (prob.topicId) {
    topic = await p.topic.findUnique({ where: { id: prob.topicId }, select: { id: true, number: true, title: true, isClosed: true, isArchived: true, deletedAt: true } });
  }
  console.log(JSON.stringify({ problem: prob, topic: topic }, null, 2));
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

