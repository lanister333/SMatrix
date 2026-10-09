/**
 * Служебный скрипт раунда Flat 2.0: публикует два объявления из примеров ТЗ
 * через API (с демо-СМС) и снимает скриншоты обеих лент с карточками.
 * Тестовые записи удаляет. Пользователь — временный, тоже удаляется.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const BASE = "http://127.0.0.1:3000";
for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/);
  if (m) {
    let v = m[1];
    if (v.startsWith("file:")) {
      const p = v.slice(5);
      v = "file:" + (path.isAbsolute(p) ? p : path.resolve(process.cwd(), p));
    }
    process.env.DATABASE_URL = v;
    break;
  }
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const stamp = Date.now();
const user = await prisma.user.create({
  data: {
    email: `flat-shot-${stamp}@test.local`,
    passwordHash: `${crypto.randomBytes(12).toString("hex")}:${crypto.scryptSync(crypto.randomBytes(8).toString("hex"), crypto.randomBytes(12).toString("hex"), 64).toString("hex")}`,
    nickname: `ФлэтСкрин${stamp}`,
    emailVerified: true,
  },
});
const token = crypto.randomBytes(24).toString("hex");
await prisma.session.create({ data: { token, userId: user.id } });

const post = async (api, payload) => {
  const r = await fetch(BASE + api, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, ...payload }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${api}: ${JSON.stringify(j)}`);
  return j;
};
const getCode = async (phone) => {
  const r = await fetch(BASE + "/api/sms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  return (await r.json()).devCode;
};

const c1 = await getCode("+79241112233");
const dResp = await post("/api/znakomstva", {
  category: "person",
  place: "Южно-Сахалинск",
  text: "Ищу парня на белом Сузуки Эскудо. Вчера вечером во время метели ты вытащил меня из кювета на Лесном переулке и оставил свой трос. Отзовись, добрый человек, хочу вернуть трос и отблагодарить! Мой WhatsApp: 8-924-111-22-33",
  smsPhone: "+79241112233",
  smsCode: c1,
});
console.log("dating post:", JSON.stringify(dResp));
const c2 = await getCode("+79245556677");
const aResp = await post("/api/obyavleniya", {
  rubric: "give",
  place: "Южно-Сахалинск",
  text: "Отдам бесплатно два мешка картошки и кабачки с дачи в Троицком. Самовывоз. Пишите в WhatsApp: 8-924-555-66-77",
  smsPhone: "+79245556677",
  smsCode: c2,
});
console.log("ads post:", JSON.stringify(aResp));
if (dResp.hidden) throw new Error("dating post hidden by AI: " + (dResp.note || ""));
if (aResp.hidden) throw new Error("ads post hidden by AI: " + (aResp.note || ""));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  // Лента по умолчанию открывает первую вкладку — переключаем на вкладки постов.
  await page.locator('[data-flat-board="dating"]').waitFor({ state: "visible", timeout: 30000 });
  await page.locator('[data-flat-board="dating"] [data-flat-tab="person"]').click();
  await page.locator('[data-flat-board="dating"] [data-flat-card]').first().waitFor({ state: "visible", timeout: 30000 });
  await page.locator('[data-flat-board="dating"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "scripts/shots/flat-dating-card.png", fullPage: false });
  await page.locator('[data-flat-board="ads"] [data-flat-tab="give"]').click();
  await page.locator('[data-flat-board="ads"] [data-flat-card]').first().waitFor({ state: "visible", timeout: 30000 });
  await page.locator('[data-flat-board="ads"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "scripts/shots/flat-ads-card.png", fullPage: false });
  console.log("shots done");
} finally {
  await prisma.datingPost.deleteMany({ where: { authorId: user.id } });
  await prisma.adListing.deleteMany({ where: { authorId: user.id } });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  await prisma.$disconnect();
  await browser.close();
}
