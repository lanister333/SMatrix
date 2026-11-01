
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  // Get ALL messages in topic 976
  const msgs = await p.message.findMany({
    where: { topicId: 976 },
    select: { id: true, num: true, body: true, authorName: true, createdAt: true },
    orderBy: { num: 'asc' }
  });
  console.log("ALL MESSAGES:", JSON.stringify(msgs, null, 2));
  
  // Also check the problem itself
  const prob = await p.gkhProblem.findFirst({
    where: { topicId: 976 },
    select: { id: true, title: true, text: true, place: true, actions: true }
  });
  console.log("\nPROBLEM:", JSON.stringify(prob, null, 2));
  
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

