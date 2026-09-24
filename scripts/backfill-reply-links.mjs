// ПЛАН МИГРАЦИИ ДАННЫХ (спека ReplyLines, п.6): проставить parent_id старым
// постам, если связь потеряна. РЕЖИМ ПО УМОЛЧАНИЮ — ТОЛЬКО ОТЧЁТ (dry-run):
// БД НЕ изменяется. НИЧЕГО НЕ ВЫДУМЫВАЕМ: в будущем связь можно ставить
// только по однозначному совпадению (номер поста в маркере «ответ … (№N)»
// либо точный ник автора родителя в теме).
//
// Запуск:  bun scripts/backfill-reply-links.mjs
// Идея apply-режима (не включён): парсить маркеры из тела и, если в теме
// ровно один кандидат-родитель, писать parentId транзакцией.
import { Database } from "bun:sqlite";

const db = new Database("/home/z/my-project/db/custom.db", { readonly: true });

const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%essage%'").all();
const table = tables[0]?.name ?? "Message";
console.log(`таблица сообщений: ${table}`);

const total = db.query(`SELECT COUNT(*) n FROM ${table}`).get().n;
const withParent = db.query(`SELECT COUNT(*) n FROM ${table} WHERE parentId IS NOT NULL`).get().n;
const byTopic = db
  .query(`SELECT topicId, COUNT(*) n, SUM(parentId IS NOT NULL) linked FROM ${table} GROUP BY topicId ORDER BY topicId`)
  .all();

// Посты без родителя: это либо корневые (первые посты тем), либо ответы,
// связь которых не сохранилась. Корни — минимальный num в теме.
const roots = db
  .query(`SELECT topicId, MIN(num) n FROM ${table} GROUP BY topicId`)
  .all()
  .reduce((m, r) => (m[r.topicId] = r.n, m), {});
const rows = db.query(`SELECT id, topicId, num, parentId, authorName, substr(body, 1, 120) head FROM ${table} ORDER BY topicId, num`).all();
let rootCount = 0;
let orphanReplies = [];
for (const r of rows) {
  if (r.parentId) continue;
  if (r.num === roots[r.topicId]) { rootCount += 1; continue; }
  orphanReplies.push(r);
}

// Проба парсера: маркер «ответ …» в начале тела (если когда-нибудь связи
// будут теряться, восстанавливать будем по таким маркерам + совпадению ника).
const markRe = /^\s*ответ\s+([^(\n]{1,40}?)(?:\s*\(?\s*№\s*(\d+)\s*\)?)?\s*[,.;:!?]?\s*$/im;
let parseable = 0;
for (const r of orphanReplies) {
  if (markRe.test(r.head ?? "")) parseable += 1;
}

console.log(`всего постов:            ${total}`);
console.log(`с parent_id:             ${withParent}`);
console.log(`корневых (без родителя): ${rootCount}`);
console.log(`ответов без связи:       ${orphanReplies.length}`);
console.log(`из них с парсимым маркером «ответ …»: ${parseable}`);
console.log("темы (topicId: связаны/всего):");
for (const t of byTopic) console.log(`  ${t.topicId}: ${t.linked}/${t.n}`);
if (orphanReplies.length) {
  console.log("примеры ответов без связи (до 10):");
  for (const r of orphanReplies.slice(0, 10)) console.log(`  тема ${r.topicId} №${r.num} (${r.authorName}): ${(r.head ?? "").replace(/\s+/g, " ").slice(0, 70)}`);
}
db.close();
