
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const topic = await p.topic.findUnique({
    where: { id: 976 },
    select: { id: true, number: true, title: true, authorName: true, authorId: true, createdAt: true, rubricId: true }
  });
  console.log("TOPIC:", JSON.stringify(topic, null, 2));
  
  // Check who posted msg #1
  const msg1 = await p.message.findFirst({
    where: { topicId: 976, num: 1 },
    select: { id: true, body: true, authorName: true, authorId: true, createdAt: true }
  });
  console.log("\nMSG #1:", JSON.stringify(msg1, null, 2));
  
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

