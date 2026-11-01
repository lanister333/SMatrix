// Отладка потока ответа на /gde-kupit
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const AUTH_KEY = "sm_auth";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const r = await ctx.request.post(BASE + "/api/auth/login", {
  data: { email: "u1_модератор@sakhmatrix.local", password: "Moderator2026" },
});
const login = await r.json();

const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 400)));
page.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 400)); });

await page.addInitScript(
  ([k, v]) => localStorage.setItem(k, v),
  [AUTH_KEY, JSON.stringify({ token: login.user.token, user: login.user })]
);

// создаём вопрос
const create = await ctx.request.post(BASE + "/api/wheretobuy", {
  data: { token: login.user.token, title: "Отладка ТЗ " + Date.now() + ": купить свечи зажигания NGK?", text: "Конкретно NGK BKR6E-11, Южно-Сахалинск.", place: "Южно-Сахалинск" },
});
const post = await create.json();
console.log("create:", create.status(), JSON.stringify(post).slice(0, 160));

await page.goto(BASE + "/gde-kupit", { waitUntil: "networkidle" });
await page.waitForSelector('[data-wb-id]');
const id = post.id;
const card = page.locator(`[data-wb-id="${id}"]`);
console.log("card found:", (await card.count()) === 1);
await card.locator(".wb-answerbtn").click();
await page.waitForSelector(`[data-wb-answerform="${id}"]`);
console.log("form open");
await page.fill(`[data-wb-answer-input="${id}"]`, "Продается мастер Вова на Железнодорожной, звони ему: 8-924-111-22-33");
console.log("filled");
await page.click(`[data-wb-answer-submit="${id}"]`);
await page.waitForTimeout(1200);
const plaque = await page.locator(`[data-wb-filter-plaque="${id}"]`).count();
const err = await page.locator(`[data-wb-answer-err="${id}"]`).textContent().catch(() => "");
const val = await page.inputValue(`[data-wb-answer-input="${id}"]`).catch(() => "");
console.log("plaque:", plaque, "| err:", err, "| value kept:", val.includes("8-924"));
console.log("errors:", errs.length ? errs.join("\n") : "нет");
await browser.close();
