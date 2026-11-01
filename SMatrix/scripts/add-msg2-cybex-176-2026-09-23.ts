/**
 * ТЗ 2026-09-23 «каждый сценарий ведёт в СВОЮ тему»: в теме #176 (Cybex)
 * добавить сообщение №2 = тестовый ввод (Ошибка) — как в темах сценариев
 * 1-6 (сообщение №1 = вопрос уже на месте). Идемпотентно: проверка по num.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const INPUT_7 =
  "Нужно автокресло Cybex Solution T i-Fix, ростовая группа 2/3. Подскажите магазины или страницы товара на сайтах магазинов Сахалина. wb";

async function main() {
  const existing = await prisma.message.findFirst({ where: { topicId: 176, num: 2 } });
  if (existing) {
    console.log(`SKIP: сообщение №2 в #176 уже есть (${existing.id})`);
    return;
  }
  const topic = await prisma.topic.findUnique({ where: { id: 176 }, select: { lastActivityAt: true } });
  const at = new Date(Date.now() - 60_000);
  const msg = await prisma.message.create({
    data: { topicId: 176, num: 2, authorName: "Гость", body: INPUT_7, createdAt: at },
    select: { id: true, num: true },
  });
  await prisma.topic.update({
    where: { id: 176 },
    data: { lastActivityAt: at, lastAuthorName: "Гость" },
  });
  console.log(`CREATED: сообщение №2 в #176 (${msg.id}), lastActivityAt обновлён (было ${topic?.lastActivityAt?.toISOString()})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error("ERR:", e); await prisma.$disconnect(); process.exit(1); });
