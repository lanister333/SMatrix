
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  // 1. Create "Городская жизнь" with id=1 (lowest, so it's first)
  //    Use raw SQL since Prisma doesn't allow setting autoincrement id directly
  //    First check if id=1 is available
  const existing = await p.rubric.findUnique({ where: { id: 1 } });
  if (existing) {
    console.log("id=1 already taken by:", existing.name);
    // Find lowest available id
    const allRubrics = await p.rubric.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
    let newId = 1;
    for (const r of allRubrics) {
      if (r.id === newId) newId++;
      else break;
    }
    console.log("Lowest available id:", newId);
    
    // We can't use id < 31 if all are taken. Instead, shift all parent rubrics up by 1
    // Actually — simpler: just create with next available id and use isService=false
    // The forum sorts by id, so we need id < 31
    // Let's use id=0 (SQLite allows 0)
    await p.$executeRaw`INSERT INTO Rubric (id, name, slug, isService, parentId) VALUES (0, 'Городская жизнь', 'gorodskaya-zhizn', 0, NULL)`;
    console.log("Created 'Городская жизнь' with id=0");
  } else {
    await p.$executeRaw`INSERT INTO Rubric (id, name, slug, isService, parentId) VALUES (1, 'Городская жизнь', 'gorodskaya-zhizn', 0, NULL)`;
    console.log("Created 'Городская жизнь' with id=1");
  }
  
  // 2. Get the new rubric id
  const cityLife = await p.rubric.findFirst({
    where: { slug: 'gorodskaya-zhizn' },
    select: { id: true }
  });
  console.log("Городская жизнь id:", cityLife.id);
  
  // 3. Move "Подслушано" (id=130) under "Городская жизнь"
  await p.rubric.update({
    where: { id: 130 },
    data: { parentId: cityLife.id }
  });
  console.log("Moved 'Подслушано' under 'Городская жизнь'");
  
  // 4. Verify
  const parents = await p.rubric.findMany({
    where: { parentId: null },
    select: { id: true, name: true, slug: true },
    orderBy: { id: 'asc' }
  });
  console.log("\nNEW PARENT RUBRICS:");
  parents.forEach(r => console.log("  id="+r.id+" name="+r.name));
  
  // Check children of Городская жизнь
  const children = await p.rubric.findMany({
    where: { parentId: cityLife.id },
    select: { id: true, name: true, slug: true }
  });
  console.log("\nChildren of 'Городская жизнь':", JSON.stringify(children));
  
  await p.$disconnect();
})().catch(e=>{console.error('ERR:'+e.message);process.exit(1)});

