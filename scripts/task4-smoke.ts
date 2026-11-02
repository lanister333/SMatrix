/**
 * ЗАДАЧА №4 — смок-тест парсеров отключений на фикстурах + живой прогон.
 * Запуск: bun scripts/task4-smoke.ts
 */
import { readFileSync } from "fs";
import path from "path";
import {
  parseSakhalinEnergoHtml,
  parseSkkPosts,
  parseVodokanalNewsList,
  parseVodokanalArticleHtml,
  runOutagesParse,
  readOutages,
} from "../src/lib/outages-parser";
import { outageOrgBadge, outageWhenLabel } from "../src/lib/outages-taxonomy";

const f = (n: string) => readFileSync(path.join(__dirname, "fixtures", n), "utf8");

const frs = parseSakhalinEnergoHtml(f("frs-outages.html"));
console.log("=== ФРС:", frs.length, "записей");
for (const it of frs.slice(0, 3)) {
  console.log(" ", it.source, "|", it.type, "|", it.short, "|", it.when, "|", it.publishedAt);
  console.log("   addr:", it.addresses.slice(0, 2).join(" ; "));
}

const skk = parseSkkPosts(f("skk-wp.json"));
console.log("=== СКК:", skk.length, "записей");
for (const it of skk) {
  console.log(" ", it.source, "|", it.type, "|", it.short, "|", it.when, "|", it.publishedAt);
  console.log("   addr:", it.addresses.slice(0, 2).join(" ; "));
}

const cards = parseVodokanalNewsList(f("rvc-news.html"));
console.log("=== РВК карточки:", cards.length, JSON.stringify(cards));
const art = parseVodokanalArticleHtml(f("rvc-article.html"));
console.log("=== РВК статья:", JSON.stringify(art));

console.log("=== бейджи:", [outageOrgBadge("Сахалинэнерго"), outageOrgBadge("СКК"), outageOrgBadge("Водоканал")].map((b) => b.icon + b.name).join(" / "));
console.log("=== время:", outageWhenLabel("2026-09-16T00:52:00.000Z"), "|", outageWhenLabel("2020-05-06T23:24:00.000Z"), "|", outageWhenLabel(new Date().toISOString()));

console.log("=== ЖИВОЙ СБОР (три ведомства) ===");
const res = await runOutagesParse();
console.log("ok:", res.ok, "count:", res.count);
const of = await readOutages();
for (const it of (of?.items ?? []).slice(0, 5)) {
  console.log(" ", it.source, "|", it.short, "|", it.publishedAt, "|", outageWhenLabel(it.publishedAt));
}
console.log("errors:", JSON.stringify(of?.errors));
