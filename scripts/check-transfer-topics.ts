// Служебное: параметры тем-приёмников «Быстрые подсказки» (#177/#178)
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const rows = await db.topic.findMany({
  where: { OR: [{ source: { contains: "hints-transfer" } }, { title: { contains: "Быстрые подсказки" } }] },
  select: { id: true, number: true, title: true, source: true, isPinned: true, rubricId: true },
});
console.log(JSON.stringify(rows, null, 1));
await db.$disconnect();
