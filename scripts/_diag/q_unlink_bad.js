
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  // For each GkhProblem with topicId, check if msg #1 body matches problem text
  const problems = await p.gkhProblem.findMany({
    where: { topicId: { not: null }, isDeleted: false },
    select: { id: true, title: true, text: true, topicId: true }
  });
  
  let unlinked = 0;
  for (const prob of problems) {
    const msg1 = await p.message.findFirst({
      where: { topicId: prob.topicId, num: 1, isDeleted: false },
      select: { body: true, authorName: true }
    });
    
    // Check if msg #1 body contains a significant portion of the problem text
    const probText = (prob.text || "").trim();
    const msgBody = msg1 ? (msg1.body || "").trim() : "";
    
    // If msg #1 doesn't exist or doesn't contain the problem text — unlink
    if (!msg1 || (probText.length > 10 && !msgBody.includes(probText.slice(0, 30)))) {
      console.log(`Unlinking: problem "${prob.title.slice(0,40)}" → topic ${prob.topicId}`);
      console.log(`  msg #1: "${msgBody.slice(0,60)}"`);
      console.log(`  problem text: "${probText.slice(0,60)}"`);
      
      await p.gkhProblem.update({
        where: { id: prob.id },
        data: { topicId: null }
      });
      unlinked++;
    }
  }
  console.log(`\nTotal unlinked: ${unlinked}`);
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

