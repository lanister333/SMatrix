import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 200)));
const r = await ctx.request.post(BASE + "/api/auth/login", {
  data: { email: "u1_модератор@sakhmatrix.local", password: "Moderator2026" },
});
const d = await r.json();
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.evaluate(([k, v]) => localStorage.setItem(k, v), ["sm_auth", JSON.stringify({ token: d.user.token, user: d.user })]);
await page.goto(BASE + "/gde-kupit", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.locator('[data-e2e-answerbtn="1"]').click();
await page.waitForTimeout(800);
const formHtml = await page.evaluate(() => {
  const f = document.querySelector('[data-e2e-answerform="1"]');
  return f ? f.innerHTML.slice(0, 300) : "ФОРМЫ НЕТ";
});
console.log("FORM HTML:", formHtml);
const guest = await page.locator('[data-e2e-answer-guest="1"]').count();
console.log("guest-ветка:", guest, "| textarea:", await page.locator('[data-e2e-answer-input="1"]').count());
await browser.close();
