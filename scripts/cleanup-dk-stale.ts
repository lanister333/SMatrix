// Проверка и очистка сирот-файлов в public/media/dating (файлы без строк в DatingPhoto)
import { PrismaClient } from "@prisma/client";
import { readdirSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

const db = new PrismaClient();
const DIR = join(process.cwd(), "public/media/dating");

async function main() {
  const posts = await db.datingPost.count();
  const photos = await db.datingPhoto.count();
  const complaints = await db.datingComplaint.count();
  console.log(`БД: постов=${posts}, фото=${photos}, жалоб=${complaints}`);

  if (!existsSync(DIR)) { console.log("Каталога media/dating нет"); return; }
  const files = readdirSync(DIR);
  const linked = new Set((await db.datingPhoto.findMany({ select: { url: true } })).map(p => p.url.split("/").pop()));
  let removed = 0;
  for (const f of files) {
    if (!linked.has(f)) { unlinkSync(join(DIR, f)); removed++; }
  }
  console.log(`Сирот-файлов удалено: ${removed}, осталось: ${files.length - removed}`);
}
main().finally(() => db.$disconnect());
