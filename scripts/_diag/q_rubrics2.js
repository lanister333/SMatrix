
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  // Get all parent rubrics
  const parents = await p.rubric.findMany({
    where: { parentId: null },
    select: { id: true, name: true, slug: true },
    orderBy: { id: 'asc' }
  });
  console.log("PARENT RUBRICS (ordered by id):");
  parents.forEach(r => console.log("  id="+r.id+" name="+r.name));
  
  // Find min id
  const minId = parents.length > 0 ? Math.min(...parents.map(r => r.id)) : 1;
  console.log("\nMin parent id:", minId);
  
  // Get "Подслушано" rubric
  const podslyshano = await p.rubric.findFirst({
    where: { slug: "podslyshano-discuss" },
    select: { id: true, name: true, slug: true, parentId: true }
  });
  console.log("\nPODSLYSHANO-DISCUSS:", JSON.stringify(podslyshano));
  
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

