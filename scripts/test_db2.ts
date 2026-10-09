import { PrismaClient } from "@prisma/client";
async function main() {
  const p = new PrismaClient();
  const c = await p.helpPublication.count();
  console.log("count:", c);
  const t = await p.topic.count();
  console.log("topics:", t);
  await p.$disconnect();
}
main().catch((e) => { console.error(e.message?.slice(0, 80)); process.exit(1); });
