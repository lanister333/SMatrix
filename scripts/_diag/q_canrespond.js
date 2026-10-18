
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const admin = await p.user.findFirst({ where: { nickname: 'Админ' }, select: { id: true } });
  const problems = await p.gkhProblem.findMany({
    where: { isDeleted: false },
    select: { id: true, title: true, authorId: true, authorName: true, orgResponseText: true },
    take: 10
  });
  problems.forEach(prob => {
    const isOwn = prob.authorId === admin.id;
    const hasResponse = !!prob.orgResponseText;
    const canRespond = !isOwn && !hasResponse;
    console.log(`${canRespond ? '✓' : '✗'} | автор: ${prob.authorName} | свой: ${isOwn} | ответ: ${hasResponse} | "${prob.title.slice(0, 40)}"`);
  });
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

