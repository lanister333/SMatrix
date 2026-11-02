/** Изолированная отладка гонки discuss: что именно возвращают проигравшие запросы. */
const BASE = "http://localhost:3000";

async function api(path: string, opts: RequestInit = {}) {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  let data: Record<string, unknown> = {};
  try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

async function main() {
  const { db } = await import("../src/lib/db");
  const { hashPassword, newToken } = await import("../src/lib/auth");
  await db.sanction.deleteMany({ where: { user: { nickname: "Админ" }, source: "ai" } });
  await db.user.update({ where: { nickname: "Админ" }, data: { restrictedUntil: null } });
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@sakhmatrix.ru", password: "Admin2026" }),
  });
  const tokenA: string = login.data.user?.token ?? "";

  const post = await api("/api/overheard", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, title: "Отладка гонки обсуждения", text: "Проверяем одновременное создание темы обсуждения пятью запросами." }),
  });
  const postId = String(post.data.id);
  console.log("post:", postId, "hidden:", post.data.hidden);

  const results = await Promise.all(
    [tokenA, tokenA, tokenA, tokenA, tokenA].map((t, i) =>
      api(`/api/overheard/${postId}/discuss`, { method: "POST", body: JSON.stringify({ token: t }) }).then((r) => ({ i, ...r }))
    )
  );
  for (const r of results) {
    console.log(`#${r.i}`, r.status, JSON.stringify(r.data).slice(0, 220));
  }
  // Очистка
  const t = await db.overheardPost.findUnique({ where: { id: postId } });
  if (t?.topicId) {
    await db.message.deleteMany({ where: { topicId: t.topicId } });
    await db.topic.delete({ where: { id: t.topicId } });
  }
  await db.overheardPost.delete({ where: { id: postId } });
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
