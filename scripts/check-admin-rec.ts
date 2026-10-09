import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const recs = await db.recPost.findMany({
    where: { authorName: "Админ" },
    select: { id: true, authorName: true, authorId: true, title: true, subject: true },
    take: 20,
  });
  console.log("RecPost с authorName='Админ':", recs.length);
  for (const r of recs) {
    console.log(`  id=${r.id}  authorId=${r.authorId || "(null)"}  subject="${(r.subject||"").slice(0,40)}"  title="${(r.title||"").slice(0,40)}"`);
  }
  const authorIds = [...new Set(recs.map((r) => r.authorId).filter(Boolean))] as string[];
  if (authorIds.length) {
    console.log("\nUsers по authorId (из этих публикаций):");
    const users = await db.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, nickname: true, gender: true, email: true, createdAt: true },
    });
    for (const u of users) {
      console.log(`  id=${u.id}  nickname="${u.nickname}"  gender=${u.gender}  email=${u.email}`);
    }
  } else {
    console.log("\n⚠️ У всех публикаций с authorName='Админ' — authorId = null!");
    console.log("   authorGender в API возвращается через JOIN User.gender, но authorId=null → p.author = null → 'unspecified'.");
    console.log("   Но API показывает male/female — значит, какой-то другой код подменяет gender.");
  }
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
