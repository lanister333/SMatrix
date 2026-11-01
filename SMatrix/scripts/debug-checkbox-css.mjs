import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

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
import crypto from "node:crypto";

const stamp = Date.now();
const email = `chk-dbg-${stamp}@test.local`;
const salt = crypto.randomBytes(12).toString("hex");
const user = await prisma.user.create({
  data: { email, passwordHash: `${salt}:${crypto.scryptSync("x", salt, 64).toString("hex")}`, nickname: `ДебагЧек${stamp}`, emailVerified: true },
});
const token = crypto.randomBytes(24).toString("hex");
await prisma.session.create({ data: { token, userId: user.id } });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(
    ([key, val]) => localStorage.setItem(key, val),
    ["sm_auth", JSON.stringify({ token, user: { id: user.id, nickname: user.nickname, email, gender: "unspecified", role: "user", emailVerified: true, orgRep: false, orgName: "" } })]
  );
  await page.goto(BASE + "/rekomenduyu", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1200);
  await page.locator(".rc-addbtn").first().click();
  await page.waitForSelector("#review-manifest-agree", { timeout: 15000 });
  const info = await page.evaluate(() => {
    const i = document.querySelector("#review-manifest-agree");
    const before = i.getBoundingClientRect().width;
    // инлайн-стиль бьёт любой авторский правило без !important
    i.style.setProperty("width", "16px");
    const afterInline = i.getBoundingClientRect().width;
    i.style.removeProperty("width");
    // гипотеза flex: чекбокс — флекс-айтем
    i.style.setProperty("flex", "none");
    const afterFlexNone = i.getBoundingClientRect().width;
    i.style.removeProperty("flex");
    return { before, afterInline, afterFlexNone };
  });
  console.log(JSON.stringify(info, null, 2));
} finally {
  await browser.close();
  await prisma.session.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  await prisma.$disconnect();
}
