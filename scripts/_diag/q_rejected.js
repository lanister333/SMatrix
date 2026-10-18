
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const rejected = await p.gkhProblem.findMany({
    where: { status: "rejected", isDeleted: false },
    select: { id: true, title: true, place: true, isHiddenByAi: true, status: true, isDeleted: true }
  });
  console.log("REJECTED (isDeleted=false):", JSON.stringify(rejected));
  
  const allRejected = await p.gkhProblem.findMany({
    where: { status: "rejected" },
    select: { id: true, title: true, isDeleted: true, isHiddenByAi: true }
  });
  console.log("\nALL REJECTED (including deleted):", JSON.stringify(allRejected));
  
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

