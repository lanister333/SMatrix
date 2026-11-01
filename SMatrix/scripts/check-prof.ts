import { checkProfanity } from "../src/lib/moderation/profanity";
const samples = [
  "Иди сюда нахуй",
  "Иди сюда нахуй\nПроверка блокировки нецензурной лексики в разделе помощи\n\nx",
  "Да ты полный мудак, извини.",
  "Пошёл нахуй отсюда",
];
for (const s of samples) {
  const r = checkProfanity(s);
  console.log(JSON.stringify(s.slice(0, 40)), "→ blocked:", r.blocked, r.hits?.map(h => h.word));
}
