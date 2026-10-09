/**
 * Проверка поведения ИИ-модератора (ШАГ 10):
 * 1. Очевидное нарушение БЕЗ мата (угроза) → ИИ скрывает сообщение
 * 2. Критика/отрицательное мнение → ИИ НЕ блокирует (защита мнений)
 */
const BASE = "http://localhost:3000";

async function api(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

async function main() {
  let failed = 0;
  const check = (name: string, ok: boolean, extra = "") => {
    console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
    if (!ok) failed++;
  };

  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@sakhmatrix.ru", password: "Admin2026" }),
  });
  const token = login.data.user.token;
  const list = await api("/api/topics?page=1&perPage=1");
  const topicId = list.data.topics[0].id;
  const stamp = Date.now();

  // 1. Угроза без мата → ИИ должен скрыть
  const threat = await api(`/api/topics/${topicId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      body: `Тест (${stamp}): Узнал где ты живёшь, приеду и сломаю тебе ноги, пойдёшь теперь по улицам с палкой.`,
      token,
    }),
  });
  check(
    "угроза скрыта ИИ",
    threat.status === 200 && threat.data.message?.isHiddenByAi === true,
    `hidden=${threat.data.message?.isHiddenByAi}, reason=${threat.data.message?.hiddenReason?.slice(0, 70)}`
  );

  // 2. Критика (защита мнений) → ИИ публикует
  const crit = await api(`/api/topics/${topicId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      body: `Тест (${stamp}): Считаю, что новая развязка — пустая трата денег. Проект сырой, сроки сорвут, а пробок меньше не станет.`,
      token,
    }),
  });
  check(
    "критика не блокируется",
    crit.status === 200 && crit.data.message?.isHiddenByAi === false,
    `hidden=${crit.data.message?.isHiddenByAi}, note=${crit.data.message?.aiNote?.slice(0, 60)}`
  );

  // 3. Жалоба на сообщение с нарушением (спам-реклама) → ИИ должен скрыть по жалобе
  const spam = await api(`/api/topics/${topicId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      body: `Тест (${stamp}): ЗАРАБОТОК от 5000 рублей в день! Схема на https://example-money.ru — пишите в телеграм @fastcash, места ограничены!`,
      token,
    }),
  });
  const spamMsgId = spam.data.message?.id;
  const spamHiddenDirect = spam.status === 200 && spam.data.message?.isHiddenByAi === true;
  console.log(`  спам: direct hidden=${spamHiddenDirect}, reason=${spam.data.message?.hiddenReason?.slice(0, 60)}`);
  if (spamMsgId && !spamHiddenDirect) {
    const comp = await api(`/api/messages/${spamMsgId}/complaint`, {
      method: "POST",
      body: JSON.stringify({ category: "spam", comment: "реклама" }),
    });
    check("жалоба на спам принята", comp.status === 200 && comp.data.note === "Жалоба отправлена. Спасибо. Модерация рассмотрит сообщение.");
    console.log("  … ожидание ИИ-проверки по жалобе");
    await new Promise((r) => setTimeout(r, 35000));
    const detail = await api(`/api/topics/${topicId}?page=1`);
    const msg = detail.data.messages?.find((m: { id: string }) => m.id === spamMsgId);
    check("спам скрыт ИИ по жалобе", msg?.isHiddenByAi === true, `hidden=${msg?.isHiddenByAi}, reason=${msg?.hiddenReason?.slice(0, 70)}`);
  } else {
    check("спам скрыт ИИ сразу", spamHiddenDirect, `reason=${spam.data.message?.hiddenReason?.slice(0, 70)}`);
  }

  // 4. Очистка тестовых сообщений (удаляем как автор)
  for (const id of [threat.data.message?.id, crit.data.message?.id, spamMsgId].filter(Boolean)) {
    await api(`/api/messages/${id}`, { method: "DELETE", body: JSON.stringify({ token }) });
  }

  console.log(failed === 0 ? "\nИИ-ПОВЕДЕНИЕ КОРРЕКТНО ✓" : `\nПРОВАЛЕНО: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
