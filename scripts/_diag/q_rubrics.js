
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  // Get all parent rubrics (parentId = null)
  const parents = await p.rubric.findMany({
    where: { parentId: null },
    select: { id: true, name: true, slug: true, order: true },
    orderBy: { order: 'asc' }
  });
  console.log("PARENT RUBRICS:");
  parents.forEach(r => console.log("  id="+r.id+" order="+r.order+" name="+r.name+" slug="+r.slug));
  
  // Get "Подслушано" rubric
  const podslyshano = await p.rubric.findFirst({
    where: { slug: { contains: "podslyshano" } },
    select: { id: true, name: true, slug: true, parentId: true, order: true }
  });
  console.log("\nPODSLYSHANO:", JSON.stringify(podslyshano));
  
  // Find where "Подслушано Сахалин" discussions go
  const overheardDiscuss = await p.rubric.findFirst({
    where: { slug: "podslyshano-discuss" },
    select: { id: true, name: true, slug: true, parentId: true, order: true }
  });
  console.log("OVERHEARD_DISCUSS:", JSON.stringify(overheardDiscuss));
  
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

