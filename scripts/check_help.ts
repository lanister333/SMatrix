import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const c = await p.helpPublication.count();
  console.log("count:", c);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
