import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const r1 = await p.$queryRaw`SELECT COUNT(*) as c FROM HelpPublication`;
  console.log("HelpPublication raw count:", JSON.stringify(r1));
  const r2 = await p.$queryRaw`SELECT COUNT(*) as c FROM Topic`;
  console.log("Topic raw count:", JSON.stringify(r2));
  const r3 = await p.$queryRaw`SELECT COUNT(*) as c FROM User`;
  console.log("User raw count:", JSON.stringify(r3));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
