/**
 * E2E-проверка ШАГА 11 «Ограничения и апелляции».
 *
 * A. Движок санкций (мягкая лестница):
 *    1-е нарушение → предупреждение (без блокировки);
 *    2-е → ограничение 1 час; 3-е → до 24 часов;
 *    серьёзное → решение за человеком (ИИ не ограничивает аккаунт);
 *    отмена санкции человеком снимает ограничение.
 * B. HTTP-API: ограничение блокирует отправку (403), /api/sanctions/me,
 *    апелляция «Оспорить решение», дубликат апелляции (409), очередь админа,
 *    удовлетворение апелляции человеком снимает санкцию, бан только человеком.
 *
 * Запуск: bun scripts/test-e2e-step11.ts
 */
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import {
  applySanction,
  getActiveRestriction,
  getRecentWarning,
  handleConfirmedViolation,
  revokeSanction,
} from "../src/lib/moderation/sanctions";

const BASE = "http://localhost:3000";

async function api(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");

async function makeUser(nick: string) {
  const u = await db.user.create({
    data: {
      email: `${nick}.${stamp}@test.local`,
      passwordHash: hashPassword("Test12345678"),
      nickname: nick,
      emailVerified: true,
    },
  });
  const token = "testtoken" + Math.random().toString(36).slice(2, 18);
  await db.session.create({ data: { token, userId: u.id } });
  return { user: u, token };
}

async function main() {
  let failed = 0;
  const check = (name: string, ok: boolean, extra = "") => {
    console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
    if (!ok) failed++;
  };

  // ===== Часть A. Движок санкций =====
  const ladder = await makeUser(`ladder${stamp}`);
  const uid = ladder.user.id;

  // 1-е небольшое нарушение → предупреждение, без блокировки
  const v1 = await handleConfirmedViolation({ userId: uid, category: "insult", reason: "оскорбление участника" });
  check("нарушение №1 → предупреждение", v1.sanction?.kind === "warning", v1.sanction?.kind ?? "null");
  check("предупреждение не ограничивает аккаунт", (await getActiveRestriction(uid)) === null);
  check("предупреждение видно в уведомлениях", (await getRecentWarning(uid))?.kind === "warning");

  // 2-е нарушение → ограничение на 1 час
  const v2 = await handleConfirmedViolation({ userId: uid, category: "spam", reason: "спам-реклама" });
  check("нарушение №2 → ограничение 1 час", v2.sanction?.kind === "limit_1h", v2.sanction?.kind ?? "null");
  const r2 = await getActiveRestriction(uid);
  check("аккаунт ограничен после повтора", r2?.kind === "limit_1h", r2?.kind ?? "null");
  check("срок ограничения ~1 час", !!r2?.expiresAt && new Date(r2.expiresAt).getTime() - Date.now() > 55 * 60 * 1000);

  // 3-е нарушение → ограничение до 24 часов
  const v3 = await handleConfirmedViolation({ userId: uid, category: "insult", reason: "повторное оскорбление" });
  check("нарушение №3 → ограничение 24 часа", v3.sanction?.kind === "limit_24h", v3.sanction?.kind ?? "null");
  check("продолжение нарушений требует внимания человека", v3.needsHumanDecision === true);

  // 4-е и далее — остаётся до 24 часов (никакой эскалации выше без человека)
  const v4 = await handleConfirmedViolation({ userId: uid, category: "bullying", reason: "травля участника" });
  check("нарушение №4 → всё ещё максимум 24 часа (ИИ осторожен)", v4.sanction?.kind === "limit_24h", v4.sanction?.kind ?? "null");

  // Серьёзное нарушение → ИИ НЕ ограничивает аккаунт, решение за человеком
  const seriousUser = await makeUser(`serious${stamp}`);
  const sv = await handleConfirmedViolation({
    userId: seriousUser.user.id,
    category: "threat",
    reason: "прямая угроза физической расправы",
  });
  check("серьёзное нарушение: ИИ не применяет санкцию сам", sv.sanction === null && sv.needsHumanDecision === true);
  check("серьёзное нарушение: аккаунт не ограничен автоматически", (await getActiveRestriction(seriousUser.user.id)) === null);

  // Человек отменяет решения ИИ → ограничения снимаются
  for (let i = 0; i < 5; i++) {
    const active = await getActiveRestriction(uid);
    if (!active) break;
    await revokeSanction(active.id, "Админ", "решение ИИ отменено человеком-модератором");
  }
  check("человек отменил санкции ИИ — ограничения сняты", (await getActiveRestriction(uid)) === null);

  // ===== Часть B. HTTP-API =====
  const list = await api("/api/topics?page=1&perPage=5");
  const topicId = list.data.topics?.[0]?.id;
  check("есть тема для тестов", !!topicId);

  const appealUser = await makeUser(`appeal${stamp}`);
  const adminLogin = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@sakhmatrix.ru", password: "Admin2026" }),
  });
  const adminToken = adminLogin.data.user?.token;
  check("логин админа", !!adminToken);

  // Человек (админ) применяет ограничение на 1 час
  const apply = await api("/api/admin/sanction", {
    method: "POST",
    body: JSON.stringify({
      action: "apply",
      nick: appealUser.user.nickname,
      kind: "limit_1h",
      reason: "повторное нарушение правил (тест ШАГ 11)",
      token: adminToken,
    }),
  });
  check("админ применил ограничение 1 час", apply.status === 200, apply.data.note ?? apply.data.error ?? "");

  // Отправка сообщения под ограничением → 403 с текстом об ограничении
  const blocked = await api(`/api/topics/${topicId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: `Тест ШАГ 11 (${stamp}): сообщение под ограничением.`, token: appealUser.token }),
  });
  check(
    "отправка заблокирована ограничением (403)",
    blocked.status === 403 && String(blocked.data.error || "").startsWith("Действует ограничение: Ограничение на 1 час"),
    blocked.data.error ?? `status ${blocked.status}`
  );
  check("в ответе есть подсказка об апелляции", String(blocked.data.error || "").includes("Оспорить решение"));
  check("создание темы тоже заблокировано", (
    await api("/api/topics", {
      method: "POST",
      body: JSON.stringify({ rubricId: 1, title: `Тест ограничения ${stamp}`, body: "текст", token: appealUser.token }),
    })
  ).status === 403);

  // /api/sanctions/me показывает активное ограничение
  const me = await api(`/api/sanctions/me?token=${encodeURIComponent(appealUser.token)}`);
  check("/api/sanctions/me: активное ограничение", me.data.restriction?.kind === "limit_1h", me.data.restriction?.kind ?? "null");
  const sanctionId = me.data.restriction?.id;

  // «Оспорить решение» — апелляция уходит человеку-модератору
  const appeal = await api("/api/appeals/decision", {
    method: "POST",
    body: JSON.stringify({
      token: appealUser.token,
      sanctionId,
      text: `Считаю ограничение ошибочным, нарушение не совершал (${stamp}).`,
    }),
  });
  check(
    "апелляция отправлена, человек-модератор рассмотрит",
    appeal.status === 200 && String(appeal.data.note || "").includes("рассмотрит человек-модератор") && String(appeal.data.note || "").includes("ИИ не участвует"),
    appeal.data.note ?? appeal.data.error ?? ""
  );

  // Повторная апелляция по той же санкции запрещена
  const dup = await api("/api/appeals/decision", {
    method: "POST",
    body: JSON.stringify({ token: appealUser.token, sanctionId, text: `дубликат апелляции ${stamp}` }),
  });
  check("дубликат апелляции отклонён (409)", dup.status === 409, dup.data.error ?? "");

  // Чужая санкция не оспаривается
  const foreign = await api("/api/appeals/decision", {
    method: "POST",
    body: JSON.stringify({ token: ladder.token, sanctionId, text: `чужая санкция ${stamp}` }),
  });
  check("чужое ограничение оспорить нельзя (403)", foreign.status === 403);

  // Админ видит санкцию с открытой апелляцией
  const sa = await api(`/api/admin/sanctions?token=${encodeURIComponent(adminToken)}`);
  const sRow = sa.data.sanctions?.find((s: { id: string }) => s.id === sanctionId);
  check("админ видит санкцию и открытую апелляцию", !!sRow && sRow.hasOpenAppeal === true, sRow ? `hasOpenAppeal=${sRow.hasOpenAppeal}` : "нет санкции");
  const aRow = sa.data.appeals?.find((a: { sanction?: { id: string | null } | null }) => a.sanction?.id === sanctionId);
  check("апелляция в очереди админа со статусом open", aRow?.status === "open", aRow?.status ?? "нет");

  // Человек удовлетворяет апелляцию → санкция снимается, отправка снова работает
  const resolve = await api("/api/admin/sanction", {
    method: "POST",
    body: JSON.stringify({ action: "resolveAppeal", appealId: aRow.id, decision: "accepted", token: adminToken }),
  });
  check("человек удовлетворил апелляцию", resolve.status === 200, resolve.data.note ?? resolve.data.error ?? "");

  const me2 = await api(`/api/sanctions/me?token=${encodeURIComponent(appealUser.token)}`);
  check("ограничение снято после апелляции", me2.data.restriction === null, me2.data.restriction?.kind ?? "null");

  const unblocked = await api(`/api/topics/${topicId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: `Тест ШАГ 11 (${stamp}): сообщение после отмены ограничения по апелляции.`, token: appealUser.token }),
  });
  check("после удовлетворения апелляции отправка работает", unblocked.status === 200, unblocked.data.error ?? `status ${unblocked.status}`);

  // Постоянная блокировка — только человеком
  const banUser = await makeUser(`ban${stamp}`);
  const ban = await api("/api/admin/sanction", {
    method: "POST",
    body: JSON.stringify({
      action: "apply",
      nick: banUser.user.nickname,
      kind: "ban",
      reason: "систематический обход ограничений (тест)",
      token: adminToken,
    }),
  });
  check("админ применил постоянную блокировку", ban.status === 200, ban.data.error ?? "");
  const bannedPost = await api(`/api/topics/${topicId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: `Тест ШАГ 11 (${stamp}): попытка писать под баном.`, token: banUser.token }),
  });
  check(
    "заблокированный не может писать (403, «заблокирован постоянно»)",
    bannedPost.status === 403 && String(bannedPost.data.error || "").includes("заблокирован постоянно"),
    bannedPost.data.error ?? `status ${bannedPost.status}`
  );

  // Запрет: бан не снимается автоматически по жалобам — только решением человека
  const banRow = (await api(`/api/admin/sanctions?token=${encodeURIComponent(adminToken)}`)).data.sanctions?.find(
    (s: { user: string; kind: string; revoked: boolean }) => s.user === banUser.user.nickname && s.kind === "ban" && !s.revoked
  );
  check("бан виден в списке санкций как бессрочный", !!banRow);

  // Отмена бана человеком
  const unban = await api("/api/admin/sanction", {
    method: "POST",
    body: JSON.stringify({ action: "revoke", sanctionId: banRow.id, token: adminToken }),
  });
  const unbannedPost = await api(`/api/topics/${topicId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: `Тест ШАГ 11 (${stamp}): после отмены бана человеком.`, token: banUser.token }),
  });
  check("человек отменил бан — отправка снова работает", unban.status === 200 && unbannedPost.status === 200, unbannedPost.data.error ?? "");

  // Апелляцию НЕ-автора нельзя создать; сообщение другого автора не оспаривается через этот эндпоинт
  const someoneMsgId = unblocked.data.message?.id as string | undefined;
  if (someoneMsgId) {
    const wrong = await api("/api/appeals/decision", {
      method: "POST",
      body: JSON.stringify({ token: ladder.token, messageId: someoneMsgId, text: `не моё сообщение ${stamp}` }),
    });
    check("оспорить можно только своё сообщение (403)", wrong.status === 403);
  }

  // ===== Очистка =====
  const ids = [ladder.user.id, seriousUser.user.id, appealUser.user.id, banUser.user.id];
  for (const id of ids) {
    await db.message.deleteMany({ where: { authorId: id } });
    await db.topic.deleteMany({ where: { authorId: id } });
    await db.user.delete({ where: { id } }).catch(() => {});
  }
  console.log("… тестовые пользователи и сообщения удалены");

  console.log(failed === 0 ? "\nВСЕ ТЕСТЫ ШАГА 11 ПРОШЛИ ✓" : `\nПРОВАЛЕНО: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(process.exitCode ?? 0));
