
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  // Try to find one and select originalAuthorId
  const r = await p.cheapPost.findFirst({select:{id:true, originalAuthorId:true, authorId:true, title:true}});
  console.log("FIRST_CHEAP:"+JSON.stringify(r));
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

