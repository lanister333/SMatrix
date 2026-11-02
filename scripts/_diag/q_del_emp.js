
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const post = await p.empPost.findFirst({where:{employer:{contains:'Тестовая Компания'}}, select:{id:true}});
  if (post) {
    await p.empPost.delete({where:{id:post.id}});
    console.log('DELETED:'+post.id);
  } else {
    console.log('NOT_FOUND');
  }
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

