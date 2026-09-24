/** Очистка тестовых постов пробы «Вопрос решён» (после падений пробы):
 *  логин админом → /mine обеих лент → удалить посты с «проба решён» в заголовке. */
const BASE = "http://localhost:3000";
const ADMIN = { email: "u1_модератор@sakhmatrix.local", password: "Moderator2026" };
const MARK = "проба решён";

async function main() {
  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ADMIN),
  });
  const ld = await lr.json();
  if (!lr.ok || !ld.user?.token) throw new Error(`login failed ${lr.status}`);
  const token = ld.user.token;
  let removed = 0;
  for (const base of ["wheretobuy", "gdedeshevle"]) {
    const r = await fetch(`${BASE}/api/${base}?mine=1&token=${encodeURIComponent(token)}`);
    const d = await r.json();
    const posts = (d.posts || []).filter((p) => (p.title || "").includes(MARK) && !p.isDeleted);
    for (const p of posts) {
      const dr = await fetch(`${BASE}/api/${base}/${p.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "delete" }),
      });
      console.log(`${base} ${p.id} «${p.title.slice(0, 60)}» -> ${dr.ok ? "deleted" : dr.status}`);
      if (dr.ok) removed++;
    }
  }
  console.log(`Удалено: ${removed}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
