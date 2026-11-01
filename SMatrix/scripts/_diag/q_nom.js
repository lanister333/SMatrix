
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const u = await p.user.findFirst({where:{nickname:'НомерОдин'}, select:{id:true}});
  if (!u) { console.log('NO_USER'); process.exit(1); }
  let sess = await p.session.findFirst({where:{userId:u.id}, select:{token:true}});
  if (!sess) {
    const crypto = require('crypto');
    const t = crypto.randomBytes(24).toString('hex');
    sess = await p.session.create({data:{token:t, userId:u.id}});
  }
  console.log('TOKEN:'+sess.token);
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

