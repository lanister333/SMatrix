
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const u = await p.user.findFirst({where:{role:'user'}, select:{id:true,nickname:true}});
  let sess = await p.session.findFirst({where:{userId:u.id}, select:{token:true}});
  console.log("TOKEN:"+sess.token);
  await p.$disconnect();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});

