
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  // try by number
  const t1=await p.topic.findUnique({where:{number:1013}, select:{id:true,number:true,title:true,deletedAt:true,isClosed:true}});
  console.log("BY_NUMBER:"+JSON.stringify(t1));
  // try by id
  const t2=await p.topic.findUnique({where:{id:1013}, select:{id:true,number:true,title:true}});
  console.log("BY_ID:"+JSON.stringify(t2));
  await p.$disconnect();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});

