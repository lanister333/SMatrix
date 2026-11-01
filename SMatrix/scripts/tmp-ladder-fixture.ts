/**
 * Временная фикстура для проверки «лесенки» ответов (Шаг 1, ≤480px).
 * Создаёт тему + ответы 1/2/3-го уровня глубины от админа.
 * Использование: bun scripts/tmp-ladder-fixture.ts create|clean
 */
const BASE = "http://localhost:3000";
const MARK = "[LADDER-FIXTURE]";

async function j(method: string, path: string, body?: unknown, token?: string) {
  const r = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Cookie: `sm_token=${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, data: d };
}

async function main() {
  const mode = process.argv[2] || "create";
  // логин админом
  const login = await j("POST", "/api/auth/login", { email: "admin@sakhmatrix.ru", password: "Admin2026" });
  if (login.status !== 200) { console.error("LOGIN FAIL", login.status, login.data); process.exit(1); }
  const token = (login.data.user ?? login.data).token ?? login.data.token;
  if (!token) { console.error("NO TOKEN", JSON.stringify(login.data).slice(0, 300)); process.exit(1); }

  if (mode === "create") {
    const t = await j("POST", "/api/topics", {
      title: `${MARK} Проверка лесенки ответов на мобильном`,
      body: `${MARK} Стартовое сообщение темы для проверки отступов ответов лесенкой.`,
      rubricId: 31,
      token,
    });
    console.log("topic:", t.status, JSON.stringify(t.data).slice(0, 200));
    const topicId = t.data.topic?.id ?? t.data.id;
    if (!topicId) process.exit(1);
    const m1 = await j("POST", `/api/topics/${topicId}/messages`, { body: `${MARK} Ответ 1-го уровня вложенности (глубина 1).`, parentId: null, token });
    const m1id = m1.data.message?.id ?? m1.data.id;
    const m2 = await j("POST", `/api/topics/${topicId}/messages`, { body: `${MARK} Ответ 2-го уровня вложенности (глубина 2).`, parentId: m1id, token });
    const m2id = m2.data.message?.id ?? m2.data.id;
    const m3 = await j("POST", `/api/topics/${topicId}/messages`, { body: `${MARK} Ответ 3-го уровня вложенности (глубина 3).`, parentId: m2id, token });
    const m3id = m3.data.message?.id ?? m3.data.id;
    const m4 = await j("POST", `/api/topics/${topicId}/messages`, { body: `${MARK} Ответ 4-го уровня вложенности (глубина 4).`, parentId: m3id, token });
    console.log("fixture:", JSON.stringify({ topicId, ids: [m1id, m2id, m3id, (m4.data.message ?? m4.data).id].filter(Boolean) }));
  } else {
    // clean: найти тему по маркеру и удалить все сообщения + тему
    const list = await j("GET", "/api/topics?page=1&perPage=50&q=" + encodeURIComponent("LADDER-FIXTURE"));
    const topics = list.data.topics ?? [];
    for (const t of topics) {
      const full = await j("GET", `/api/topics/${t.id}`);
      const msgs = full.data.messages ?? [];
      for (const m of msgs) await j("DELETE", `/api/messages/${m.id}`, { token });
      const del = await j("POST", `/api/admin/topics/${t.id}`, { action: "delete", token });
      console.log("deleted topic", t.id, del.status);
    }
  }
}
main();
