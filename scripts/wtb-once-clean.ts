/**
 * Разовая очистка остатков прерванных прогонов test-wheretobuy:
 * посты тестовых пользователей WhrTest_* и тестовые вопросы админа
 * (по характерным названиям моделей), их темы обсуждения и жалобы.
 */
async function main() {
  const { db } = await import("../src/lib/db");
  const testUsers = await db.user.findMany({ where: { nickname: { startsWith: "WhrTest_" } } });
  const userIds = testUsers.map((u) => u.id);

  const posts = await db.whereToBuyPost.findMany({
    where: {
      OR: [
        { authorId: { in: userIds } },
        { authorId: { in: userIds }, title: {} },
        {
          authorName: "Админ",
          OR: [
            { title: { contains: "Mann C 35 154" } },
            { title: { contains: "Bosch S5 AGM" } },
            { title: { contains: "Hakkapeliitta" } },
            { title: { contains: "Cybex Solution" } },
            { title: { contains: "Рейт-лимит тест" } },
          ],
        },
      ],
    },
  });
  const ids = posts.map((p) => p.id);
  console.log("найдено тестовых постов:", ids.length, ids);

  if (ids.length) {
    const topics = await db.topic.findMany({ where: { whereToBuyPost: { id: { in: ids } } } });
    for (const t of topics) {
      await db.message.deleteMany({ where: { topicId: t.id } });
      await db.topic.delete({ where: { id: t.id } });
    }
    console.log("удалено тем:", topics.length);
    await db.whereToBuyComplaint.deleteMany({ where: { postId: { in: ids } } });
    const del = await db.whereToBuyPost.deleteMany({ where: { id: { in: ids } } });
    console.log("удалено постов:", del.count);
  }

  for (const u of testUsers) {
    await db.sanction.deleteMany({ where: { userId: u.id } });
    await db.session.deleteMany({ where: { userId: u.id } });
    await db.user.delete({ where: { id: u.id } });
  }
  console.log("удалено пользователей:", testUsers.length);
  console.log("остаток постов:", await db.whereToBuyPost.count());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
