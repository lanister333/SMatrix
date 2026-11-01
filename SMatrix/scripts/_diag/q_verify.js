
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  // messages in topic 1013 with num > 1
  const msgs = await p.message.findMany({
    where: { topicId: 1013, num: { gt: 1 }, isDeleted: false },
    select: { id: true, num: true, body: true, isDeleted: true, createdAt: true }
  });
  console.log("MESSAGES:"+JSON.stringify(msgs));
  // The RecPost that links to 1013
  const rec = await p.recPost.findFirst({ where: { topicId: 1013 }, select: { id: true, title: true } });
  console.log("RECPOST:"+JSON.stringify(rec));
  await p.$disconnect();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});

