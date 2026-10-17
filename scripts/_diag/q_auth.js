
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const post = await p.recPost.findUnique({where:{id:'cmuixj7rb0001hkz6818z94y1'}, select:{id:true,authorId:true,topicId:true,isDeleted:true,isHiddenByAi:true}});
  console.log("POST:"+JSON.stringify(post));
  // марина_58's id
  const u = await p.user.findFirst({where:{nickname:'марина_58'}, select:{id:true}});
  console.log("MARINA:"+JSON.stringify(u));
  await p.$disconnect();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});

