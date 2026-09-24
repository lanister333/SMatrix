/**
 * Уборка тестовых постов «Проба …» из лент /api/wheretobuy и /api/gdedeshevle
 * (мягкое удаление PATCH action=delete от имени их автора).
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const r = await ctx.request.post(BASE + "/api/auth/login", {
    data: { email: "u1_модератор@sakhmatrix.local", password: "Moderator2026" },
  });
  const d = await r.json();
  const token = d?.user?.token;
  if (!token) { console.log("нет токена"); process.exit(1); }

  for (const feed of ["wheretobuy", "gdedeshevle"]) {
    const res = await ctx.request.get(`${BASE}/api/${feed}?pageSize=50`);
    const data = await res.json();
    for (const p of data.posts ?? []) {
      if (p.title.startsWith("Проба")) {
        const del = await ctx.request.patch(`${BASE}/api/${feed}/${p.id}`, {
          data: { token, action: "delete" },
        });
        console.log(`${feed}: удалён ${p.id} (${p.title.slice(0, 50)}) → ${del.status()}`);
      }
    }
  }
  await browser.close();
  console.log("готово");
})().catch((e) => { console.error(e); process.exit(1); });
