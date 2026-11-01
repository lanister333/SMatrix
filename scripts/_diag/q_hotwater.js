
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const prob = await p.gkhProblem.findFirst({
    where: { title: { contains: "горячей воды" } },
    select: { id: true, title: true, status: true, topicId: true }
  });
  if (!prob) { console.log("NOT FOUND"); process.exit(1); }
  console.log("PROBLEM:", JSON.stringify(prob));
  
  // If topicId exists, check the topic
  if (prob.topicId) {
    const topic = await p.topic.findUnique({
      where: { id: prob.topicId },
      select: { id: true, number: true, title: true, deletedAt: true }
    });
    console.log("TOPIC:", JSON.stringify(topic));
    
    // Check messages in the topic
    const msgs = await p.message.findMany({
      where: { topicId: prob.topicId },
      select: { id: true, num: true, body: true, authorName: true },
      take: 3
    });
    console.log("MESSAGES:", JSON.stringify(msgs));
  } else {
    console.log("NO TOPIC LINKED");
  }
  
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

