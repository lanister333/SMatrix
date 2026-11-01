import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rs = await p.rubric.findMany({ where: { OR: [{ name: { contains: "Товары" } }, { name: { contains: "упить" } }] }, select: { id: true, name: true, parentId: true } });
console.log("RUBRICS:", JSON.stringify(rs, null, 1));
const t = await p.topic.findMany({ where: { rubricId: { in: rs.map(r => r.id) } }, select: { id: true, title: true, rubricId: true, isClosed: true, isArchived: true }, take: 15, orderBy: { id: "asc" } });
console.log("TOPICS:", JSON.stringify(t, null, 1));
await p.$disconnect();
