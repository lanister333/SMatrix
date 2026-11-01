/** Чистка тестовых остатков «Подслушано» (после сбоев теста или фикстур). */
async function main() {
  const { db } = await import("../src/lib/db");
  const admin = await db.user.findUnique({ where: { nickname: "Админ" } });
  let removedSanctions = 0;
  if (admin) {
    const s = await db.sanction.findMany({ where: { userId: admin.id } });
    for (const x of s) {
      // Чистим только автоматические ИИ-ограничения — человеческие решения не трогаем.
      if (x.source === "ai") {
        await db.sanction.delete({ where: { id: x.id } });
        removedSanctions++;
      }
    }
    // Снятие остаточных ограничений аккаунта, наложенных ИИ за тестовые сообщения.
    await db.user.update({ where: { id: admin.id }, data: { restrictedUntil: null } });
  }
  const posts = await db.overheardPost.count();
  const complaints = await db.overheardComplaint.count();
  const topics = await db.topic.count({ where: { rubric: { slug: "podslyshano-discuss" } } });
  const users = await db.user.count({ where: { nickname: { startsWith: "OvrTest_" } } });
  console.log("RES", JSON.stringify({ removedSanctions, posts, complaints, discussTopics: topics, ovrUsers: users }));
  await db.$disconnect();
}
main();
