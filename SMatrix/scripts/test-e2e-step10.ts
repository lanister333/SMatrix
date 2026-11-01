/**
 * E2E-проверка ШАГА 10 через HTTP API работающего сервера.
 * 1. Логин админа и обычного пользователя
 * 2. Отправка сообщения с нецензурной лексикой → точное сообщение блокировки
 * 3. Отправка нормального сообщения → публикация
 * 4. Жалоба на сообщение → точное подтверждение
 * 5. Очередь модерации (жалобы видны админу)
 */
const BASE = "http://localhost:3000";

async function api(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

async function main() {
  let failed = 0;
  const check = (name: string, ok: boolean, extra = "") => {
    console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
    if (!ok) failed++;
  };

  // 1. Бутстрап
  const boot = await api("/api/bootstrap");
  check("bootstrap", boot.status === 200 && (boot.data.rubrics?.length ?? 0) > 0, `рубрик: ${boot.data.rubrics?.length}`);

  // 2. Список тем
  const list = await api("/api/topics?page=1&perPage=5");
  check("список тем", list.status === 200 && (list.data.topics?.length ?? 0) > 0, `тем: ${list.data.total}`);
  const topicId = list.data.topics?.[0]?.id;

  // 3. Логин админа
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@sakhmatrix.ru", password: "Admin2026" }),
  });
  check("логин админа", login.status === 200 && !!login.data.user?.token, login.data.error ?? "");
  const adminToken = login.data.user?.token;
  const adminNick = login.data.user?.nickname;

  // 4. CAPTCHA для регистрации нового пользователя
  const captcha = await api("/api/auth/captcha");
  check("captcha", captcha.status === 200 && !!captcha.data.id);

  // 5. Отправка сообщения с нецензурной лексикой → БЛОКИРОВКА с точным текстом
  const BLOCK_MSG =
    "Сообщение содержит нецензурную или оскорбительную лексику. Пожалуйста, отредактируйте текст и попробуйте снова.";
  const bad = await api(`/api/topics/${topicId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: "Да ты полный мудак, извини.", token: adminToken }),
  });
  check("блокировка лексики", bad.status === 400 && bad.data.error === BLOCK_MSG, bad.data.error ?? `status ${bad.status}`);

  // обход фильтра тоже блокируется
  const bad2 = await api(`/api/topics/${topicId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: "с.у.к.а", token: adminToken }),
  });
  check("блокировка обхода фильтра", bad2.status === 400 && bad2.data.error === BLOCK_MSG, bad2.data.error ?? `status ${bad2.status}`);

  // 6. Нормальное сообщение → публикация (ИИ может быть недоступен → needHuman, это тоже ОК)
  const stamp = new Date().toISOString().slice(11, 19);
  const good = await api(`/api/topics/${topicId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: `Тест ШАГ 10 (${stamp}): проверка публикации обычного сообщения без нарушений.`, token: adminToken }),
  });
  check(
    "публикация обычного сообщения",
    good.status === 200 && !!good.data.message?.num,
    `num=${good.data.message?.num} hidden=${good.data.message?.isHiddenByAi} note=${good.data.message?.aiNote?.slice(0, 60)}`
  );
  const goodMsgId = (await api(`/api/topics/${topicId}?page=1`)).data.messages?.slice(-1)[0]?.id;

  // 7. Жалоба → точное подтверждение
  const COMPLAINT_MSG = "Жалоба отправлена. Спасибо. Модерация рассмотрит сообщение.";
  const complaint = await api(`/api/messages/${goodMsgId}/complaint`, {
    method: "POST",
    body: JSON.stringify({ category: "insult", comment: "тестовая жалоба ШАГ 10" }),
  });
  check(
    "жалоба: точное подтверждение",
    complaint.status === 200 && complaint.data.note === COMPLAINT_MSG,
    complaint.data.note ?? complaint.data.error ?? `status ${complaint.status}`
  );

  // 8. Вторая жалоба (другая причина) — не должна авто-блокировать
  const complaint2 = await api(`/api/messages/${goodMsgId}/complaint`, {
    method: "POST",
    body: JSON.stringify({ category: "spam", comment: "" }),
  });
  check("вторая жалоба тоже принимается", complaint2.status === 200, complaint2.data.note ?? "");

  // 9. Ждём фоновую AI-проверку и смотрим очередь модерации
  console.log("… ожидание фоновой ИИ-проверки жалобы (до 40 сек)");
  await new Promise((r) => setTimeout(r, 30000));
  const queue = await api(`/api/moderation?token=${adminToken}&limit=60`);
  check("очередь модерации доступна админу", queue.status === 200 && Array.isArray(queue.data.entries));
  const entry = queue.data.entries?.find((e: { id: string }) => e.id === goodMsgId);
  check(
    "жалоба видна в очереди",
    !!entry,
    entry
      ? `жалоб: ${entry.complaintsCount}, needHuman=${entry.needHuman}, hidden=${entry.isHiddenByAi}, verdict=${entry.complaints?.[0]?.aiVerdict}`
      : ""
  );
  check(
    "жалобы НЕ авто-скрыли сообщение",
    !entry?.isHiddenByAi,
    entry?.isHiddenByAi ? `hiddenReason: ${entry.hiddenReason}` : "сообщение опубликовано"
  );

  // 10. Решение админа
  if (entry) {
    const decide = await api("/api/admin/decide", {
      method: "POST",
      body: JSON.stringify({ type: "message", id: goodMsgId, decision: "publish", token: adminToken }),
    });
    check("решение админа (publish)", decide.status === 200, decide.data.error ?? "");
    const queue2 = await api(`/api/moderation?token=${adminToken}&limit=60`);
    const still = queue2.data.entries?.find((e: { id: string }) => e.id === goodMsgId && e.complaintsCount > 0);
    check("жалобы помечены решёнными", !still);
  }

  console.log(failed === 0 ? "\nВСЕ E2E-ТЕСТЫ ПРОШЛИ ✓" : `\nПРОВАЛЕНО: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
