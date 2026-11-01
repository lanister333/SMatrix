import fs from "node:fs";
import path from "node:path";
for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/);
  if (m) { let v = m[1]; if (v.startsWith("file:")) { const p = v.slice(5); v = "file:" + (path.isAbsolute(p) ? p : path.resolve(process.cwd(), p)); } process.env.DATABASE_URL = v; break; }
}
const { PrismaClient } = await import("@prisma/client");
const p = new PrismaClient();
const rs = await p.rubric.findMany({ where: { OR: [{ name: { contains: "Цен" } }, { parentId: 117 }] }, select: { id: true, name: true, slug: true, parentId: true } });
console.log("RUBRICS:", JSON.stringify(rs, null, 1));
const cheap = await p.cheapPost.findMany({ take: 2, select: { id: true, title: true } });
console.log("CheapPost sample:", JSON.stringify(cheap));
await p.$disconnect();
