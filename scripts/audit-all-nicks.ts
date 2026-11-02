import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

// Текущая эвристика (копия из src/lib/nick-gender.ts guessNickGender)
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
  // 1. Все ники из User (с gender)
  const users = await db.user.findMany({
    select: { nickname: true, gender: true },
    orderBy: { nickname: "asc" },
  });
  console.log(`=== ${users.length} User records ===\n`);

  // 2. Найти расхождения: User.gender vs guessNickGender
  // (т.к. resolveNickGender приоритизирует profileGender, это не вызовет проблему,
  //  но может быть полезно для аудита — какие ники «противоречивые»)
  const conflicts: Array<{ nick: string; userGender: string; heuristic: string }> = [];
  for (const u of users) {
    if (u.gender !== "male" && u.gender !== "female") continue;
    const h = guessNickGender(u.nickname);
    if (h !== u.gender) {
      conflicts.push({ nick: u.nickname, userGender: u.gender, heuristic: h });
    }
  }
  console.log(`Conflicts (User.gender vs heuristic): ${conflicts.length}`);
  for (const c of conflicts.slice(0, 30)) {
    console.log(`  "${c.nick}"  User.gender=${c.userGender}  heuristic=${c.heuristic}`);
  }

  // 3. Все уникальные authorName из Message (т.к. там бывают ники без User)
  const msgs = await db.message.findMany({
    where: {},
    select: { authorName: true, authorId: true },
    distinct: ["authorName"],
  });
  console.log(`\n=== ${msgs.length} unique Message.authorName ===`);
  // Для каждого authorName — проверить, есть ли User
  const orphanNicks: Array<{ nick: string; heuristic: string }> = [];
  for (const m of msgs) {
    if (!m.authorName) continue;
    const user = await db.user.findFirst({
      where: { nickname: m.authorName },
      select: { gender: true },
    });
    if (!user) {
      orphanNicks.push({ nick: m.authorName, heuristic: guessNickGender(m.authorName) });
    }
  }
  console.log(`Orphan nicks (no User): ${orphanNicks.length}`);
  for (const o of orphanNicks) {
    console.log(`  "${o.nick}"  → heuristic=${o.heuristic}`);
  }

  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
