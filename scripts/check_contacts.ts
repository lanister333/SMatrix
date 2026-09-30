import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  // === Знакомства ===
  const z = await p.datingPost.findMany({ select: { id: true, body: true, place: true, category: true }, take: 30 });
  console.log("=== Знакомства ===  total:", z.length);
  z.forEach((x) => {
    const hasPhone = /\+?\d[\d\s\-()]{6,}\d/.test(x.body || "");
    const hasTg = /@[a-zA-Z0-9_]{3,}|t\.me\//.test(x.body || "");
    const hasUrl = /https?:\/\//.test(x.body || "");
    const ok = hasPhone || hasTg || hasUrl;
    console.log(ok ? "  [OK]   " : "  [NO]   ", x.id.slice(-6), x.place, x.category, "| body:", (x.body || "").substring(0, 100));
  });

  // === Объявления ===
  const a = await p.adListing.findMany({ select: { id: true, title: true, contact: true, text: true }, take: 30 });
  console.log("\n=== Объявления ===  total:", a.length);
  a.forEach((x) => {
    const c = (x.contact || "") + " " + (x.text || "");
    const hasPhone = /\+?\d[\d\s\-()]{6,}\d/.test(c);
    const hasTg = /@[a-zA-Z0-9_]{3,}|t\.me\//.test(c);
    const hasUrl = /https?:\/\//.test(c);
    const ok = hasPhone || hasTg || hasUrl;
    console.log(ok ? "  [OK]   " : "  [NO]   ", x.id.slice(-6), (x.title || "").substring(0, 50), "| contact:", (x.contact || "(пусто)"));
  });

  // === Нужна помощь ===
  const h = await p.helpPublication.findMany({ select: { id: true, title: true, contactData: true, text: true }, take: 30 });
  console.log("\n=== Нужна помощь ===  total:", h.length);
  h.forEach((x) => {
    const c = (x.contactData || "") + " " + (x.text || "");
    const hasPhone = /\+?\d[\d\s\-()]{6,}\d/.test(c);
    const hasTg = /@[a-zA-Z0-9_]{3,}|t\.me\//.test(c);
    const hasUrl = /https?:\/\//.test(c);
    const ok = hasPhone || hasTg || hasUrl;
    console.log(ok ? "  [OK]   " : "  [NO]   ", x.id.slice(-6), (x.title || "").substring(0, 50), "| contact:", (x.contactData || "(пусто)"));
  });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
