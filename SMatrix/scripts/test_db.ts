import { PrismaClient } from "@prisma/client";
async function main() {
  // No datasourceUrl — uses DATABASE_URL from .env
  const p = new PrismaClient();
  const c = await p.helpPublication.count();
  console.log("count:", c);
  await p.$disconnect();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e.message?.slice(0,100)); process.exit(1); });
