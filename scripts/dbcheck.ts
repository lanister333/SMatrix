import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const users = await db.user.count();
  const topics = await db.topic.count();
  const messages = await db.message.count();
  const rubrics = await db.rubric.count();
  const complaints = await db.complaint.count();
  const appeals = await db.appeal.count();
  const admin = await db.user.findFirst({ where: { role: "admin" }, select: { nickname: true, email: true } });
  console.log(JSON.stringify({ users, topics, messages, rubrics, complaints, appeals, admin }));
}
main().then(() => process.exit(0));
