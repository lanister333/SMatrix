/**
 * Откат ТЗ «Сахком»: удаление 4 тестовых сообщений, посеянных для
 * проверки цитат плоского списка. Состав до отката (коммит 1ebd558):
 *   topic 183 (topic-salmon-888 «горбуша»): #3, #4, #5 (Админ, с parentId)
 *   topic 182 (topic-tyres-456 «доска»):    #3  (Админ, с parentId)
 * После удаления тема 183 снова 2 сообщения (#1 вопрос Админ, #2 ответ
 * Гость) — состояние коммита 1b21798; остальные темы не тронуты.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const targets = [
    { topicId: 183, nums: [3, 4, 5] },
    { topicId: 182, nums: [3] },
  ];
  for (const t of targets) {
    const del = await db.message.deleteMany({
      where: { topicId: t.topicId, num: { in: t.nums } },
    });
    console.log(`topic ${t.topicId}: удалено ${del.count} сообщений (ожидалось ${t.nums.length})`);
  }

  // Контроль после удаления
  const total = await db.message.count();
  const m183 = await db.message.count({ where: { topicId: 183 } });
  const m182 = await db.message.count({ where: { topicId: 182 } });
  console.log(`ИТОГО: messages=${total} (ожидание 850), t183=${m183} (2), t182=${m182} (2)`);
  if (total !== 850 || m183 !== 2 || m182 !== 2) {
    console.error("НЕСОВПАДЕНИЕ — проверить руками!");
    process.exit(1);
  }
  const tail183 = await db.message.findMany({
    where: { topicId: 183 },
    orderBy: { num: "asc" },
    select: { num: true, authorName: true, body: true },
  });
  for (const m of tail183) console.log(`  t183 #${m.num} [${m.authorName}] ${JSON.stringify(m.body.slice(0, 80))}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
