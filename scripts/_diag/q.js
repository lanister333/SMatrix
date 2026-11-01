
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const rows=await p.recPost.findMany({select:{id:true,topicId:true,title:true},take:3,where:{isDeleted:false}});
  console.log("POSTS:"+JSON.stringify(rows));
  // Find any user to mint a token
  const u=await p.user.findFirst({select:{id:true,nickname:true,token:true}});
  console.log("USER:"+JSON.stringify(u));
  await p.$disconnect();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});

