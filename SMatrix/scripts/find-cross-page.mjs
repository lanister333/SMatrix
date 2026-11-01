// Поиск ответов, чей родитель на другой странице (для пробы пометки «(стр. M)»)
import { Database } from "bun:sqlite";
const db = new Database("db/custom.db", { readonly: true });
const PER = 35;
const rows = db.prepare(`
  SELECT m.topicId AS topic_id, m.num AS child_num, p.num AS parent_num
  FROM Message m JOIN Message p ON p.id = m.parentId
  ORDER BY m.topicId, m.num
`).all();
const byTopic = new Map();
for (const r of rows) {
  const cp = Math.ceil(r.child_num / PER), pp = Math.ceil(r.parent_num / PER);
  if (cp !== pp) {
    if (!byTopic.has(r.topic_id)) byTopic.set(r.topic_id, []);
    byTopic.get(r.topic_id).push(`#${r.child_num}->#${r.parent_num} (стр.${cp})`);
  }
}
for (const [t, arr] of byTopic) console.log(`topic ${t}: ${arr.slice(0, 5).join("; ")}${arr.length > 5 ? ` … всего ${arr.length}` : ""}`);
db.close();
