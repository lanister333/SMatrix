
const {PrismaClient}=require('@prisma/client');
const crypto=require('crypto');
const p=new PrismaClient();
(async()=>{
  const u = await p.user.findFirst({where:{role:'user'}, select:{id:true,nickname:true,email:true}});
  if(!u){console.log("NO_USER");process.exit(1);}
  let sess = await p.session.findFirst({where:{userId:u.id}, select:{token:true}});
  if(!sess){
    const t = crypto.randomBytes(24).toString('hex');
    sess = await p.session.create({data:{token:t, userId:u.id}});
  }
  console.log("TOKEN:"+sess.token);
  console.log("NICK:"+u.nickname);
  await p.$disconnect();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});

