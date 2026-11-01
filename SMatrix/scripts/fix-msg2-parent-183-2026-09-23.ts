/**
 * ФИКС контрольного состава темы #183 (ТЗ 2026-09-23 «Сахком»):
 * сообщение №2 (Гость, тестовый ввод сценария С5) было посеяно БЕЗ
 * parentId (автономное). По ТЗ №2 — ОТВЕТ АВТОРУ ТЕМЫ (на №1):
 *   #2, #3, #4 → parent #1 (плоско, без линий)
 *   #5 → parent #2 (линия), #6 → parent #5 (линия)
 * Ставим #2.parentId = id(№1). Идемпотентно.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const msgs = await prisma.message.findMany({
    where: { topicId: 183 },
    orderBy: { num: "asc" },
    select: { id: true, num: true, parentId: true, authorName: true },
  });
  const id1 = msgs.find((m) => m.num === 1)?.id;
  const m2 = msgs.find((m) => m.num === 2);
  if (!id1 || !m2) throw new Error("Тема #183 не в ожидаемом состоянии");
  if (m2.parentId === id1) {
    console.log("SKIP: №2 уже отвечает на №1");
  } else {
    await prisma.message.update({ where: { id: m2.id }, data: { parentId: id1 } });
    console.log(`FIXED: №2.parentId = id(№1) = ${id1}`);
  }
  const tree = await prisma.message.findMany({
    where: { topicId: 183 },
    orderBy: { num: "asc" },
    select: { num: true, authorName: true, parent: { select: { num: true } } },
  });
  for (const m of tree) console.log(`  #${m.num} [${m.authorName}] → parent: ${m.parent ? `#${m.parent.num}` : "—"}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error("ERR:", e); await prisma.$disconnect(); process.exit(1); });
