
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const post = await p.recPost.findUnique({where:{id:'cmuixj7rb0001hkz6818z94y1'}, select:{authorId:true}});
  const u = await p.user.findUnique({where:{id:post.authorId}, select:{id:true,nickname:true}});
  let sess = await p.session.findFirst({where:{userId:u.id}, select:{token:true}});
  console.log("USER:"+JSON.stringify(u));
  console.log("TOKEN:"+sess?.token);
  await p.$disconnect();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});

