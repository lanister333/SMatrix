/** Очистка тестовых сообщений ШАГА 10 из БД (жёсткое удаление + связанные жалобы). */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const patterns = [
    "Тест ШАГ 10",
    "Диагностическое сообщение для проверки жалобы",
    "Тест (",
    "А ты просто тупой мудак",
    "с.у.к.а",
    "Да ты полный мудак",
    "с у ка",
    "ЗАРАБОТОК от 5000",
    "приеду и сломаю",
    "пустая трата денег",
  ];
  const messages = await db.message.findMany({
    where: {
      OR: patterns.map((p) => ({ body: { contains: p } })),
    },
    select: { id: true, body: true, topicId: true },
  });
  let removed = 0;
  for (const m of messages) {
    await db.complaint.deleteMany({ where: { messageId: m.id } });
    await db.message.delete({ where: { id: m.id } });
    removed++;
    console.log(`removed: ${m.body.slice(0, 60).replace(/\n/g, " ")}`);
  }
  console.log(`\nУдалено сообщений: ${removed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
