import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const result = await p.$queryRaw`SELECT name FROM sqlite_master WHERE type='table'`;
  console.log("Tables:", JSON.stringify(result));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
