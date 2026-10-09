/**
 * ТЗ 2026-09-22. Сид темы-приёмника быстрых ценовых подсказок «Где дешевле»
 * в рубрике форума «Товары и услуги ▸ Цены» (slug tovary-i-uslugi--ceny,
 * seed БД id 120). Идемпотентно: ищет тему по метке
 * source="cheap-hints-transfer" и создаёт только при отсутствии
 * (тот же механизм, что и в /api/gdedeshevle-hints — self-healing).
 */
import fs from "node:fs";
import path from "node:path";

for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/);
  if (m) {
    let v = m[1];
    if (v.startsWith("file:")) {
      const p = v.slice(5);
      v = "file:" + (path.isAbsolute(p) ? p : path.resolve(process.cwd(), p));
    }
    process.env.DATABASE_URL = v;
    break;
  }
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const SOURCE = "cheap-hints-transfer";
const TITLE = "Быстрые подсказки: Где дешевле — перенесено с Главной";

const existing = await prisma.topic.findFirst({ where: { source: SOURCE, deletedAt: null }, select: { id: true, title: true, rubricId: true } });
if (existing) {
  console.log(`EXISTS topic #${existing.id} «${existing.title}» rubric=${existing.rubricId}`);
} else {
  const rubric = await prisma.rubric.findFirst({ where: { slug: "tovary-i-uslugi--ceny" } });
  if (!rubric) {
    console.error("NO RUBRIC tovary-i-uslugi--ceny");
    process.exit(1);
  }
  const last = await prisma.topic.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  const topic = await prisma.topic.create({
    data: {
      number: (last?.number ?? 0) + 1,
      title: TITLE,
      source: SOURCE,
      authorName: "SakhMatrix",
      rubricId: rubric.id,
      isPinned: true,
      lastAuthorName: "SakhMatrix",
    },
  });
  await prisma.message.create({
    data: {
      topicId: topic.id,
      num: 1,
      authorName: "SakhMatrix",
      body:
        "Приёмник ценовых подсказок с Главной страницы (ТЗ 2026-09-22). Здесь обсуждаются сообщения, которые первая линия пре-модерации не пропустила в витрину сухих цен: телефоны физлиц и эмоциональная критика ценообразования. Текст сообщения автора переносится в форму быстрого ответа этой темы автоматически — ничего не стирается и не теряется.",
    },
  });
  console.log(`CREATED topic #${topic.id} «${TITLE}» rubric=${rubric.id}`);
}

await prisma.$disconnect();
