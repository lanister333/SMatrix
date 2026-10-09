import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rs = await p.rubric.findMany({ where: { id: { in: [117, 118] } } });
console.log(JSON.stringify(rs, null, 1));
await p.$disconnect();
