import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const r = await ctx.request.post(BASE + "/api/auth/login", {
  data: { email: "u1_модератор@sakhmatrix.local", password: "Moderator2026" },
});
const d = await r.json().catch(() => null);
console.log("login status:", r.status(), "| token есть:", !!d?.user?.token, "| ник:", d?.user?.nickname);
const me = await ctx.request.get(BASE + "/api/auth/me?token=" + encodeURIComponent(d.user.token));
console.log("me status:", me.status(), JSON.stringify(await me.json()).slice(0, 120));
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.evaluate(([k, v]) => localStorage.setItem(k, v), ["sm_auth", JSON.stringify({ token: d.user.token, user: d.user })]);
console.log("localStorage записан");
await page.goto(BASE + "/gde-kupit", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const stored = await page.evaluate(() => localStorage.getItem("sm_auth"));
console.log("sm_auth на /gde-kupit:", stored ? "ЕСТЬ (" + stored.slice(0, 60) + "...)" : "ПУСТО — кто-то стёр!");
await browser.close();
