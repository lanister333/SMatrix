import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const lr = await ctx.request.post(BASE + "/api/auth/login", {
  data: { email: "u1_модератор@sakhmatrix.local", password: "Moderator2026" },
});
const login = await lr.json();
const page = await ctx.newPage();
await page.addInitScript(([k, v]) => localStorage.setItem(k, v), ["sm_auth", JSON.stringify({ token: login.user.token, user: login.user })]);
await page.goto(BASE + "/gde-kupit", { waitUntil: "networkidle" });
await page.waitForSelector('[data-wb-id]', { timeout: 30000 });
const hits = await page.$$eval("[data-wb-id]", (els) =>
  els.map((e) => ({ id: e.getAttribute("data-wb-id"), text: (e.textContent || "").slice(0, 120) }))
     .filter((c) => c.text.includes("Проба ТЗ"))
);
console.log("карточек с маркером:", hits.length);
console.log(JSON.stringify(hits, null, 1));
// также проверим сырой API
const api = await ctx.request.get(BASE + "/api/wheretobuy");
const data = await api.json();
const items = data.items ?? data.posts ?? [];
console.log("API карточек:", items.length, "с маркером:", items.filter((i) => JSON.stringify(i).includes("Проба ТЗ")).length);
console.log(JSON.stringify(items.filter((i) => JSON.stringify(i).includes("Проба ТЗ")).map((i) => ({ id: i.id, title: i.title, deleted: i.deletedAt })) , null, 1));
await browser.close();
