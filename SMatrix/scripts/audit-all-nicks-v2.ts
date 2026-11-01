import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const CONSONANTS = "бвгджзйклмнпрстфхцчшщьbcdfghjklmnpqrstvwxyz";
function guessNickGender(name: string): "male" | "female" | "neutral" {
  const s = (name ?? "").trim();
  if (!s) return "neutral";
  const stripped = s.replace(/[^a-zA-Zа-яА-ЯёЁ]+$/, "");
  if (!stripped) return "neutral";
  const words = stripped.split(/[\s_]+/).filter((w) => w.length > 0);
  if (words.length === 0) return "neutral";
  for (const w of words) {
    const wl = w[w.length - 1].toLowerCase();
    if (wl === "а" || wl === "я" || wl === "a") return "female";
  }
  const lastWord = words[words.length - 1];
  const last = lastWord[lastWord.length - 1].toLowerCase();
  if (CONSONANTS.includes(last)) return "male";
  return "neutral";
}
async function main() {
  // Все уникальные authorName из всех таблиц
  const tables: Array<[string, any]> = [
    ["Topic.authorName", db.topic],
    ["Message.authorName", db.message],
    ["RecPost.authorName", db.recPost],
    ["WhereToBuyPost.authorName", db.whereToBuyPost],
    ["CheapPost.authorName", db.cheapPost],
    ["HelpPublication.authorName", db.helpPublication],
    ["EmpPost.authorName", db.empPost],
    ["GkhProblem.authorName", db.gkhProblem],
    ["GkhUpdate.authorName", db.gkhUpdate],
    ["OverheardPost.authorName", db.overheardPost],
    ["DatingPost.authorName", db.datingPost],
    ["AdListing.authorName", db.adListing],
  ];
  const allNicks = new Set<string>();
  for (const [name, model] of tables) {
    const rows: any[] = await model.findMany({ where: { authorName: { not: "" } }, select: { authorName: true } });
    for (const r of rows) {
      if (r.authorName) allNicks.add(r.authorName);
    }
  }
  console.log(`Total unique nicks across all tables: ${allNicks.size}\n`);
  const orphans: Array<{ nick: string; heuristic: string }> = [];
  for (const nick of allNicks) {
    const user = await db.user.findFirst({ where: { nickname: nick }, select: { gender: true } });
    if (!user) {
      orphans.push({ nick, heuristic: guessNickGender(nick) });
    }
  }
  console.log(`Orphan nicks (no User record): ${orphans.length}`);
  for (const o of orphans) {
    console.log(`  "${o.nick}"  → heuristic=${o.heuristic}`);
  }
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
