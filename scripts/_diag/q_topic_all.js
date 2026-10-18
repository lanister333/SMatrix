
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  // Get ALL messages including deleted ones
  const msgs = await p.message.findMany({
    where: { topicId: 976 },
    select: { id: true, num: true, body: true, authorName: true, isDeleted: true, deletedBy: true, createdAt: true },
    orderBy: { num: 'asc' }
  });
  console.log("ALL MESSAGES (including deleted):", JSON.stringify(msgs, null, 2));
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

