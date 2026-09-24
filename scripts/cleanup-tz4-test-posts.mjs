// Уборка тестовых данных пробы ТЗ: удаляем вопросы с маркерами «Проба ТЗ»/«Отладка ТЗ».
const BASE = "http://127.0.0.1:3000";

const login = await (await fetch(BASE + "/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "u1_модератор@sakhmatrix.local", password: "Moderator2026" }),
})).json();
if (!login?.user?.token) { console.log("LOGIN FAILED"); process.exit(1); }
const token = login.user.token;

async function cleanup(path) {
  const r = await fetch(`${BASE}${path}?mine=1&token=${encodeURIComponent(token)}&pageSize=300`);
  const d = await r.json();
  let n = 0;
  for (const p of d.posts ?? []) {
    if (/Проба ТЗ|Отладка ТЗ/.test(p.title || "")) {
      const res = await fetch(`${BASE}${path}/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "delete" }),
      });
      if (res.ok) n++;
    }
  }
  return n;
}

const a = await cleanup("/api/wheretobuy");
const b = await cleanup("/api/gdedeshevle");
console.log(`Удалено: где купить — ${a}, где дешевле — ${b}`);
