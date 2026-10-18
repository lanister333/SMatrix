
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const topic = await p.topic.findUnique({
    where: { id: 1020 },
    select: { id: true, title: true, authorName: true }
  });
  console.log("TOPIC:", JSON.stringify(topic));
  
  const msgs = await p.message.findMany({
    where: { topicId: 1020 },
    select: { num: true, body: true, authorName: true },
    orderBy: { num: 'asc' }
  });
  console.log("MESSAGES:", JSON.stringify(msgs, null, 2));
  
  // Check that the problem is now linked to this topic
  const prob = await p.gkhProblem.findFirst({
    where: { topicId: 1020 },
    select: { id: true, title: true, text: true }
  });
  console.log("LINKED PROBLEM:", JSON.stringify(prob));
  
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

