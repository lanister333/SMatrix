#!/usr/bin/env node
/* Замена секции 14 пробы под присланный компонент SakhMatrixReviewCard
   (раунд 2). Блок от комментария "// 14) ТЗ 2026-09-22" до "14i-2. сброс поиска"
   заменяется содержимым scripts/section14-snippet.part. */
const fs = require("node:fs");
const p = "/home/z/my-project/scripts/probe-review-card.mjs";
const snippetPath = "/home/z/my-project/scripts/section14-snippet.part";
const lines = fs.readFileSync(p, "utf8").split("\n");
const start = lines.findIndex((l) => l.includes("// 14) ТЗ 2026-09-22"));
const endIdx0 = lines.findIndex((l) => l.includes("14k-2. сброс поиска"));
if (start < 0 || endIdx0 < 0) { console.error("ANCHORS NOT FOUND", start, endIdx0); process.exit(1); }
// хвост вызова ok(...) может занимать несколько строк — едём до строки, заканчивающейся на ");"
let endIdx = endIdx0;
while (endIdx < lines.length && !lines[endIdx].trimEnd().endsWith(");")) endIdx++;
const snippet = fs.readFileSync(snippetPath, "utf8").replace(/\n$/, "").split("\n");
lines.splice(start, endIdx - start + 1, ...snippet);
fs.writeFileSync(p, lines.join("\n"));
console.log("SECTION 14 REPLACED: lines", start + 1, "..", endIdx + 1, "->", snippet.length, "lines");
