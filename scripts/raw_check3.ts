import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const r1 = await p.$queryRaw`SELECT COUNT(*) as c FROM HelpPublication`;
  console.log("HelpPublication:", r1[0].c);
  const r2 = await p.$queryRaw`SELECT COUNT(*) as c FROM Topic`;
  console.log("Topic:", r2[0].c);
  const r3 = await p.$queryRaw`SELECT COUNT(*) as c FROM User`;
  console.log("User:", r3[0].c);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
