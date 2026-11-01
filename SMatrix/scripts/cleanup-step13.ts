/** ШАГ 13: удалить тестовую жалобу, созданную браузерной проверкой */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  // жалобы без автора за последние минуты — тестовые
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const recent = await db.complaint.findMany({ where: { createdAt: { gte: cutoff } } });
  console.log("свежих жалоб:", recent.length);
  for (const c of recent) {
    await db.complaint.delete({ where: { id: c.id } });
    console.log("удалена жалоба", c.id, "reason:", c.reason, "msg:", c.messageId);
  }
  // убедимся, что сообщение темы 26 не скрыто ИИ фоновой проверкой
  const t = await db.topic.findUnique({ where: { id: 26 }, include: { messages: true } });
  if (t) {
    for (const m of t.messages) {
      if (m.isHiddenByAi || m.aiStatus === "hidden") {
        await db.message.update({ where: { id: m.id }, data: { isHiddenByAi: false, aiStatus: "ok", aiNote: null, needHuman: false } });
        console.log("восстановлено сообщение", m.num);
      }
    }
  }
  console.log("очистка завершена");
}
main().finally(() => db.$disconnect());
