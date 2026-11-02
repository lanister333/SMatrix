/**
 * Чинит недописанный CSS-блок «О работодателях» (ШАГ 25):
 * под заголовком «ШАГ 25» лежит непереименованная копия cd-блока («Где дешевле»).
 * Скрипт переименовывает cd- → ep- внутри этой копии, вычищает неприменимые
 * правила статусов (в разделе «О работодателях» нет статусов Ищу/Нашёл/Неактуально)
 * и оставляет уже существующие ep-правила (subject/stance/entry) без дублей.
 */
import { readFileSync, writeFileSync } from "node:fs";

const CSS = "/home/z/my-project/src/app/globals.css";
let src = readFileSync(CSS, "utf8");
const lines = src.split("\n");

// Границы дубликата: от строки ".cd-layout{" под заголовком «ШАГ 25» до закрывающей "}" media-блока перед «Работодатель и позиция».
const headerIdx = lines.findIndex((l) => l.includes("ШАГ 25. «О работодателях»"));
if (headerIdx < 0) throw new Error("не найден заголовок ШАГ 25");
let start = -1;
for (let i = headerIdx; i < lines.length; i++) {
  if (lines[i].startsWith(".cd-layout{")) { start = i; break; }
}
if (start < 0) throw new Error("не найден .cd-layout под заголовком ШАГ 25");
let end = -1;
for (let i = start; i < lines.length; i++) {
  if (lines[i].startsWith("/* Работодатель и позиция")) { end = i - 1; break; }
}
if (end < 0) throw new Error("не найден конец дубликата");

console.log(`дубликат cd-блока: строки ${start + 1}..${end + 1} (${end - start + 1} строк)`);

let block = lines.slice(start, end + 1).join("\n");
block = block.replaceAll("cd-", "ep-");

// Убрать блок статусов (Ищу/Нашёл/Неактуально — в разделе «О работодателях» их нет)
block = block.replace(/\/\* Статусы вопроса [^\n]*\n(\.ep-status[^\n]*\n){4}/, "");
// Убрать hover статуса
block = block.replace(/\.ep-act\.ep-statusbtn:hover[^\n]*\n/, "");

const out = [...lines.slice(0, start), block, ...lines.slice(end + 1)].join("\n");
writeFileSync(CSS, out);
console.log("замена выполнена");

// Контроль: каждая ep-класс из компонентов должна иметь правило (кроме ep-f-* — это id)
const css = readFileSync(CSS, "utf8");
const need = (await import("node:fs")).readFileSync("/home/z/my-project/src/components/site/employers-publications.tsx", "utf8")
  + (await import("node:fs")).readFileSync("/home/z/my-project/src/components/site/employers-screen.tsx", "utf8")
  + (await import("node:fs")).readFileSync("/home/z/my-project/src/components/forum/topic-view.tsx", "utf8");
const used = new Set([...need.matchAll(/ep-[a-z0-9-]+/g)].map((m) => m[0]));
const missing = [...used].filter((c) => !css.includes(`.${c}`));
console.log("классов ep-* использовано:", used.size);
console.log("без CSS-правила:", missing.length ? missing.join(", ") : "нет");
