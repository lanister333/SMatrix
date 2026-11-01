
const {PrismaClient}=require('@prisma/client');
const crypto=require('crypto');
const p=new PrismaClient();
(async()=>{
  // Find a regular user
  const u = await p.user.findFirst({where:{role:'user'}, select:{id:true,nickname:true}});
  if(!u){console.log("NO_USER");process.exit(1);}
  // Check for existing session
  let sess = await p.session.findFirst({where:{userId:u.id}, select:{token:true}});
  if(!sess){
    const t = crypto.randomBytes(24).toString('hex');
    sess = await p.session.create({data:{token:t, userId:u.id}});
  }
  console.log("TOKEN:"+sess.token);
  console.log("USER:"+JSON.stringify(u));
  // Find an UNBOUND recommend post (no topicId)
  const post = await p.recPost.findFirst({where:{isDeleted:false, topicId:null}, select:{id:true,title:true}});
  console.log("POST:"+JSON.stringify(post));
  await p.$disconnect();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});

