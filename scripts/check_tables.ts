import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const tables = ["helpPublication", "recPost", "gkhProblem", "topic", "user", "empPost", "whereToBuyPost", "cheapPost", "overheardPost", "adListing", "datingPost", "message", "rubric", "session", "siteSetting"];
  for (const t of tables) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = await (p as any)[t].count();
      console.log(t, ":", c);
    } catch (e) {
      console.log(t, "error:", (e as Error).message?.slice(0,50));
    }
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
