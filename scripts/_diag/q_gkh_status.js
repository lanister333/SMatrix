
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const counts = await p.gkhProblem.groupBy({
    by: ['status'],
    _count: { _all: true },
    where: { isDeleted: false }
  });
  console.log(JSON.stringify(counts));
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

