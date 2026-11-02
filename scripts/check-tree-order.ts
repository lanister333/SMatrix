// Диагностика: в каком порядке идут сообщения и как связаны parentId
// Вопрос: совпадает ли порядок num с DFS-обходом дерева ответов?
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  for (const topicId of [1, 5]) {
    const msgs = await db.message.findMany({
      where: { topicId, isDeleted: false },
      select: { id: true, num: true, parentId: true, depth: true, createdAt: true, authorName: true },
      orderBy: { num: "asc" },
    });
    const byId = new Map(msgs.map((m) => [m.id, m]));
    // num родителя
    const parentNum = new Map<string, number | null>();
    for (const m of msgs) parentNum.set(m.id, m.parentId ? (byId.get(m.parentId)?.num ?? null) : null);
    // DFS-обход леса (корни = без родителя или родитель вне выборки)
    const children = new Map<string, string[]>();
    const roots: string[] = [];
    for (const m of msgs) {
      if (m.parentId && byId.has(m.parentId)) {
        const arr = children.get(m.parentId) ?? [];
        arr.push(m.id);
        children.set(m.parentId, arr);
      } else roots.push(m.id);
    }
    const dfs: string[] = [];
    const walk = (id: string) => {
      dfs.push(id);
      for (const c of children.get(id) ?? []) walk(c);
    };
    for (const r of roots) walk(r);

    // Совпадает ли порядок по num с DFS?
    let mismatches = 0;
    const dfsPos = new Map(dfs.map((id, i) => [id, i]));
    for (let i = 1; i < msgs.length; i++) {
      if (dfsPos.get(msgs[i].id)! < dfsPos.get(msgs[i - 1].id)!) mismatches++;
    }
    // Нарушение смежности: между ответом и его родителем стоят чужие карточки?
    let adjacencyBreaks = 0;
    const numPos = new Map(msgs.map((m, i) => [m.num, i]));
    for (const m of msgs) {
      const pn = parentNum.get(m.id);
      if (pn == null) continue;
      // в DFS-порядке первый ребёнок идёт сразу за родителем
      if (dfsPos.get(m.id)! - dfsPos.get(byId.get(m.parentId!)!.id)! === 1) continue;
      // не первый ребёнок — ок, но проверим: все ли дети идут ПОД родителем подряд (группа смежна)
      adjacencyBreaks++;
    }
    console.log(`\n=== topic ${topicId}: ${msgs.length} msgs ===`);
    console.log(`порядок num совпадает с DFS: ${mismatches === 0 ? "ДА" : `НЕТ (${mismatches} инверсий)`}`);
    console.log(`детей не-первым после родителя (группы всё равно смежны в DFS): ${adjacencyBreaks}`);
    console.log("num depth parentNum author  (первые 40):");
    for (const m of msgs.slice(0, 40)) {
      const pn = parentNum.get(m.id);
      const gap = pn != null ? ` (${m.num - pn - 1} чужих между)` : "";
      console.log(`  #${String(m.num).padStart(3)} L=${m.depth} parent=${pn == null ? "—" : "#" + pn}${gap}`);
    }
    // осиротевшие ответы (родитель вне темы — не бывает; родитель удалён/скрыт)
    const orphans = msgs.filter((m) => m.parentId && !byId.has(m.parentId));
    console.log(`осиротевших (parentId указывает на отсутствующее): ${orphans.length}`);
  }
}
main().finally(() => db.$disconnect());
