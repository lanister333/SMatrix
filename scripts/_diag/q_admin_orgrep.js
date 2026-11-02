
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const admin = await p.user.findFirst({
    where: { nickname: 'Админ' },
    select: { id: true, nickname: true, role: true, orgRep: true, orgName: true }
  });
  console.log("ADMIN:", JSON.stringify(admin));
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

