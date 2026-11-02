
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  // Posts that ALREADY have a topicId (button shows "Обсуждается на форуме")
  const linked=await p.recPost.findMany({where:{topicId:{not:null}}, select:{id:true,topicId:true,title:true},take:5});
  console.log("LINKED:"+JSON.stringify(linked));
  // Same for wheretobuy
  const wb=await p.whereToBuyPost.findMany({where:{topicId:{not:null}}, select:{id:true,topicId:true,title:true},take:5});
  console.log("WB:"+JSON.stringify(wb));
  // Test: get topic info via API for one of them
  if(linked.length){
    const t=await p.topic.findUnique({where:{id:linked[0].topicId}, select:{id:true,number:true,title:true}});
    console.log("TOPIC:"+JSON.stringify(t));
  }
  await p.$disconnect();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});

