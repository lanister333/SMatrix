
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  // Find topics with at least 1 message, not deleted
  const topics = await p.topic.findMany({
    where: { deletedAt: null, messages: { some: {} } },
    select: { id: true, number: true, title: true, _count: { select: { messages: true } } },
    orderBy: { id: 'asc' },
    take: 10
  });
  console.log("TOPICS:"+JSON.stringify(topics));
  await p.$disconnect();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});

