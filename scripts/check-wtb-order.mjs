// Проверка реального порядка публикаций в БД для «Где купить» и «Где дешевле».
// Запуск: `node scripts/check-wtb-order.mjs` (Dependencies: better-sqlite3 через prisma).

import { createRequire } from "module";
const require = createRequire(import.meta.url);

// ИспользуемDATABASE_URL из .env: file:/home/z/my-project/smatrix/db/custom.db
const Database = require("better-sqlite3");

const DB_PATH = "/home/z/my-project/smatrix/db/custom.db";
const db = new Database(DB_PATH, { readonly: true });

function inspectTable(name) {
  console.log(`\n=== ${name} ===`);
  const cols = db.prepare(`PRAGMA table_info(${name})`).all();
  console.log("Columns:", cols.map((c) => c.name).join(", "));

  // Распределение по статусам
  const counts = db.prepare(`SELECT status, COUNT(*) AS n FROM ${name} WHERE isDeleted=0 AND isHiddenByAi=0 GROUP BY status`).all();
  console.log("Status counts:", counts);

  // Реальный порядок, который вернёт API (после сортировки в JS)
  // Сначала загрузим все строки в том же порядке, что и Prisma: orderBy createdAt desc, id desc
  const rows = db.prepare(
    `SELECT id, status, createdAt, statusAt, title FROM ${name}
     WHERE isDeleted=0 AND isHiddenByAi=0
     ORDER BY datetime(createdAt) DESC, id DESC`
  ).all();
  console.log(`Total rows (filtered): ${rows.length}`);

  // Применим тот же feedOrder, что и в API:
  const RANK_WTB = { seeking: 0, found: 1, irrelevant: 2 };
  const RANK_CD = { comparing: 0, cheaper: 1, fixed: 1, irrelevant: 2 };
  const rank = name === "WhereToBuyPost" ? RANK_WTB : RANK_CD;

  const sorted = [...rows].sort((a, b) => {
    const ra = rank[a.status] ?? 0;
    const rb = rank[b.status] ?? 0;
    if (ra !== rb) return ra - rb;
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    if (ta !== tb) return tb - ta;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });

  // Покажем топ-30 и проверим, есть ли «обратные» переходы
  console.log("\nTop 30 (after feedOrder):");
  let prevRank = -1;
  let transitions = [];
  sorted.slice(0, 30).forEach((r, i) => {
    const rRk = rank[r.status] ?? 0;
    const flag = rRk !== prevRank ? `  <-- переход ранга ${prevRank}→${rRk}` : "";
    if (rRk !== prevRank && prevRank !== -1) {
      transitions.push({ at: i, from: prevRank, to: rRk });
    }
    console.log(`${i + 1}. [${r.status}] rank=${rRk} createdAt=${r.createdAt}${flag}  ${r.title.slice(0, 60)}`);
    prevRank = rRk;
  });

  console.log(`\nВсе переходы ранга (нестыковки между группами): ${transitions.length}`);
  transitions.slice(0, 30).forEach((t) => console.log(`  на позиции ${t.at + 1}: rank ${t.from} → ${t.to}`));

  if (transitions.length > 3) {
    console.log("⚠️ Слишком много переходов — порядок групп нарушен!");
  } else if (transitions.length > 0) {
    // Ожидаемое число переходов: 0 → 1 → 2 (max 2 для wheretobuy; для gdedeshevle тоже 2)
    console.log("✓ Переходы соответствуют ожидаемому порядку групп.");
  } else {
    console.log("✓ Все элементы в одной группе — переходов нет.");
  }
}

try {
  // Узнаем все таблицы
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
  console.log("Tables in DB:", tables.map((t) => t.name).join(", "));

  if (tables.some((t) => t.name === "WhereToBuyPost")) {
    inspectTable("WhereToBuyPost");
  }
  if (tables.some((t) => t.name === "CheapPost")) {
    inspectTable("CheapPost");
  }
} catch (e) {
  console.error("Error:", e.message);
} finally {
  db.close();
}
