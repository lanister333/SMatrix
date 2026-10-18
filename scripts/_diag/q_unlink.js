
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  // Find ALL problems (gkh, rec, wtb, cheap, emp, help, overheard) that have topicId
  // pointing to a deleted topic
  const models = [
    { name: 'gkhProblem', label: 'GkhProblem' },
    { name: 'recPost', label: 'RecPost' },
    { name: 'whereToBuyPost', label: 'WhereToBuyPost' },
    { name: 'cheapPost', label: 'CheapPost' },
    { name: 'empPost', label: 'EmpPost' },
    { name: 'overheardPost', label: 'OverheardPost' },
    { name: 'helpPublication', label: 'HelpPublication' },
  ];
  let totalFixed = 0;
  for (const m of models) {
    const posts = await p[m.name].findMany({
      where: { topicId: { not: null } },
      select: { id: true, topicId: true }
    });
    for (const post of posts) {
      const topic = await p.topic.findUnique({
        where: { id: post.topicId },
        select: { deletedAt: true }
      });
      if (topic && topic.deletedAt) {
        // Topic is deleted — unlink it
        await p[m.name].update({
          where: { id: post.id },
          data: { topicId: null }
        });
        console.log(`Unlinked: ${m.label} ${post.id.slice(0,14)} → topicId ${post.topicId} (deleted)`);
        totalFixed++;
      }
    }
  }
  console.log(`\nTotal unlinked: ${totalFixed}`);
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

