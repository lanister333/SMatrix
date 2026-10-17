
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const post = await p.cheapPost.findFirst({where:{title:{contains:'Bosch S5 70Ah'}}, select:{id:true}});
  if (post) {
    await p.cheapPost.delete({where:{id:post.id}});
    console.log('DELETED:'+post.id);
  } else {
    console.log('NOT_FOUND');
  }
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

