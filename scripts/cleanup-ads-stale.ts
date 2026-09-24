/**
 * Идемпотентная чистка файлов-сирот в public/media/ads.
 * Удаляет PNG/JPG, на которые не ссылается ни одна строка AdMedia.
 * Безопасна на пустой БД (удаляет все файлы каталога).
 * Запуск: bun scripts/cleanup-ads-stale.ts
 */
import { readdirSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

const DIR = join(process.cwd(), "public", "media", "ads");

async function main() {
  const { db } = await import("../src/lib/db");
  if (!existsSync(DIR)) {
    console.log("каталог public/media/ads отсутствует — чистить нечего");
    return;
  }
  const files = readdirSync(DIR).filter((f) => !f.startsWith("."));
  const linked = new Set(
    (await db.adMedia.findMany({ select: { url: true } })).map((m) => m.url.split("/").pop())
  );
  let removed = 0;
  for (const f of files) {
    if (!linked.has(f)) {
      unlinkSync(join(DIR, f));
      removed++;
    }
  }
  console.log(`media/ads: файлов=${files.length}, связанных=${files.length - removed}, удалено сирот=${removed}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error("CRASH:", e);
  process.exit(1);
});
