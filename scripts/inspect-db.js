import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const rubrics = await db.rubric.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true, slug: true, isService: true, parentId: true } });
console.log("RUBRICS:", JSON.stringify(rubrics).slice(0, 2600));
const admins = await db.user.findMany({ where: { role: { not: "user" } }, select: { id: true, nickname: true, email: true, role: true } });
console.log("ADMINS:", JSON.stringify(admins));
const counts = {
  users: await db.user.count(),
  topics: await db.topic.count(),
  messages: await db.message.count(),
  openComplaints: await db.complaint.count({ where: { resolved: false } }),
  complaintsTotal: await db.complaint.count(),
  openAppeals: await db.decisionAppeal.count({ where: { status: "open" } }),
  needHuman: await db.message.count({ where: { needHuman: true } }),
  hiddenAi: await db.message.count({ where: { isHiddenByAi: true } }),
  activeSanctions: await db.sanction.count({ where: { revoked: false } }),
  activeBans: await db.sanction.count({ where: { kind: "ban", revoked: false } }),
};
console.log("COUNTS:", JSON.stringify(counts));
await db.$disconnect();
