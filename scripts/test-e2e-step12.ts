/**
 * ШАГ 12. E2E-тесты административной панели (API-уровень).
 * Запуск: bun scripts/test-e2e-step12.ts
 *
 * Покрывает:
 *  — роли: owner (полный доступ), moderator (ограниченные права), user (нет доступа);
 *  — обзор: дела, спорные AI-решения, последние действия, состояние сайта;
 *  — пользователи: поиск по нику/email, профиль, предупреждение/ограничение/блокировка/снятие;
 *  — темы: открыть/закрыть, заголовок, закрепить, перенести (ссылки и обсуждение сохраняются),
 *    удалить/восстановить, история действий;
 *  — жалобы: список, отметка рассмотренной;
 *  — настройки сайта (только владелец): слоган, регистрация, создание тем;
 *  — разделы: объявления/информация/справочник (только владелец) + публичный показ;
 *  — журнал действий: записи, фильтры.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE = "http://localhost:3000";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(`${name} ${extra}`);
    console.log(`  ✗ ${name} ${extra}`);
  }
}

interface Login {
  token: string;
  role: string;
  nickname: string;
}

async function api(path: string, opts: RequestInit = {}): Promise<{ status: number; data: any }> {
  const r = await fetch(`${BASE}${path}`, opts);
  let data: any = null;
  try {
    data = await r.json();
  } catch {}
  return { status: r.status, data };
}

async function login(email: string, password: string): Promise<Login> {
  const { status, data } = await api("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (status !== 200 || !data.user?.token) throw new Error(`login failed for ${email}: ${JSON.stringify(data)}`);
  return { token: data.user.token, role: data.user.role, nickname: data.user.nickname };
}

async function main() {
  console.log("== ШАГ 12: E2E административной панели ==");

  /* A. Роли и доступ */
  console.log("-- A. Роли и доступ");
  const owner = await login("admin@sakhmatrix.ru", "Admin2026");
  check("владелец вошёл, role=owner", owner.role === "owner" && owner.nickname === "Админ");
  const mod = await login("u1_модератор@sakhmatrix.local", "Moderator2026");
  check("модератор вошёл, role=moderator", mod.role === "moderator");

  // Найдём любого обычного пользователя (emailVerified, известный ник) — берём автора темы.
  const anyUser = await db.user.findFirst({ where: { role: "user", emailVerified: true }, select: { nickname: true, email: true, id: true } });
  check("есть обычный пользователь для тестов", !!anyUser);
  // Обычный пользователь не имеет доступа в админ-раздел (без логина проверяем 401/403)
  const anonOverview = await api("/api/admin/overview?token=nope");
  check("аноним не входит в админку (401)", anonOverview.status === 401);

  const modOverview = await api(`/api/admin/overview?token=${mod.token}`);
  check("модератор видит обзор", modOverview.status === 200 && !!modOverview.data.site);
  const ownerOverview = await api(`/api/admin/overview?token=${owner.token}`);
  check("владелец видит обзор", ownerOverview.status === 200 && ownerOverview.data.site.users > 0);
  check("обзор содержит базовое состояние сайта", typeof ownerOverview.data.site.topics === "number" && typeof ownerOverview.data.site.messages === "number");
  check("обзор: дела, требующие внимания", Array.isArray(ownerOverview.data.attention.items));
  check("обзор: спорные AI-решения", Array.isArray(ownerOverview.data.disputed.appeals) && Array.isArray(ownerOverview.data.disputed.aiSanctions));
  check("обзор: последние действия модерации", Array.isArray(ownerOverview.data.recentActions));

  /* B. Пользователи */
  console.log("-- B. Пользователи");
  const found = await api(`/api/admin/users?token=${owner.token}&q=${encodeURIComponent("адм")}`);
  check("поиск по нику (регистр/кириллица)", found.status === 200 && found.data.users.some((u: any) => u.nickname === "Админ"));
  const byEmail = await api(`/api/admin/users?token=${owner.token}&q=${encodeURIComponent("модератор@sakhmatrix.local")}`);
  check("поиск по email", byEmail.status === 200 && byEmail.data.users.some((u: any) => u.nickname === "Модератор"));
  const all = await api(`/api/admin/users?token=${owner.token}`);
  check("список пользователей с датой регистрации и счётчиками", all.data.users.every((u: any) => "createdAt" in u && "topicsCount" in u && "messagesCount" in u));

  const target = anyUser!;
  const profile = await api(`/api/admin/user/${encodeURIComponent(target.nickname)}?token=${owner.token}`);
  check("профиль: данные и санкции", profile.status === 200 && profile.data.user.nickname === target.nickname && Array.isArray(profile.data.sanctions));
  check("профиль: темы и сообщения", Array.isArray(profile.data.topics) && Array.isArray(profile.data.messages));

  // Санкции: предупреждение → не ограничивает
  const warn = await api("/api/admin/sanction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "apply", nick: target.nickname, kind: "warning", reason: "тест: предупреждение ШАГ12", token: owner.token }),
  });
  check("владелец вынес предупреждение", warn.status === 200);
  const prof1 = await api(`/api/admin/user/${encodeURIComponent(target.nickname)}?token=${owner.token}`);
  check("предупреждение не ограничивает аккаунт", prof1.data.user.restrictedNow === false);

  // Ограничение 1 час
  const lim = await api("/api/admin/sanction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "apply", nick: target.nickname, kind: "limit_1h", reason: "тест: ограничение ШАГ12", token: owner.token }),
  });
  check("владелец применил ограничение на 1 час", lim.status === 200);
  const prof2 = await api(`/api/admin/user/${encodeURIComponent(target.nickname)}?token=${owner.token}`);
  check("ограничение видно в профиле", prof2.data.user.restrictedNow === true);

  // Модератор НЕ может применять санкции (ограниченные права)
  const modApply = await api("/api/admin/sanction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "apply", nick: target.nickname, kind: "ban", reason: "модератор пытается забанить", token: mod.token }),
  });
  check("модератор не может применять санкции (403)", modApply.status === 403);

  // Санкция на владельца запрещена
  const selfApply = await api("/api/admin/sanction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "apply", nick: "Админ", kind: "ban", reason: "нельзя на владельца", token: owner.token }),
  });
  check("санкция на владельца запрещена (400)", selfApply.status === 400);

  // Снятие ограничения
  const unblock = await api("/api/admin/sanction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "unblock", nick: target.nickname, token: owner.token }),
  });
  check("владелец снял ограничения", unblock.status === 200 && unblock.data.revoked >= 1);
  const prof3 = await api(`/api/admin/user/${encodeURIComponent(target.nickname)}?token=${owner.token}`);
  check("после снятия ограничений нет", prof3.data.user.restrictedNow === false && prof3.data.sanctions.every((s: any) => s.revoked || s.kind === "warning"));

  /* C. Темы форума */
  console.log("-- C. Темы форума");
  // Создаём тестовую тему через API
  const rubrics = await api("/api/bootstrap");
  const targetRubric = rubrics.data.rubrics.find((r: any) => r.name === "Животные");
  const createTopic = await api("/api/topics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: owner.token,
      rubricId: targetRubric.id,
      title: "Тестовая тема ШАГ12 — перенос",
      body: "Проверяем действия администратора над темой: перенос, заголовок, закрепление.",
    }),
  });
  check("тестовая тема создана", createTopic.status === 200, JSON.stringify(createTopic.data).slice(0, 120));
  const topicId = createTopic.data.id as number;

  // Ответ в тему, чтобы проверить сохранность обсуждения при переносе
  const msgResp = await api(`/api/topics/${topicId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: owner.token, body: "Ответ для проверки сохранности обсуждения." }),
  });
  check("ответ в тестовую тему создан", msgResp.status === 200);

  const before = await api(`/api/topics/${topicId}`);
  const beforeMsgIds = before.data.messages.map((m: any) => m.id);

  // Переименование
  const rename = await api(`/api/admin/topics/${topicId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "rename", title: "Тестовая тема ШАГ12 — новый заголовок", token: mod.token }),
  });
  check("модератор изменил заголовок", rename.status === 200);
  const afterRename = await api(`/api/topics/${topicId}`);
  check("заголовок изменился", afterRename.data.topic.title === "Тестовая тема ШАГ12 — новый заголовок");

  // Закрепить/открепить (модератор)
  const pin = await api(`/api/admin/topics/${topicId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "pin", token: mod.token }),
  });
  const unpin = await api(`/api/admin/topics/${topicId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "unpin", token: mod.token }),
  });
  check("модератор закрепил/открепил тему", pin.status === 200 && unpin.status === 200);

  // Закрыть/открыть (модератор)
  const close = await api(`/api/admin/topics/${topicId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "close", token: mod.token }),
  });
  const open = await api(`/api/admin/topics/${topicId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "open", token: mod.token }),
  });
  check("модератор закрыл/открыл тему", close.status === 200 && open.status === 200);

  // Перенос: только владелец
  const modMove = await api(`/api/admin/topics/${topicId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "move", rubricId: 31, token: mod.token }),
  });
  check("модератор не может переносить темы (403)", modMove.status === 403);

  const autoRubric = rubrics.data.rubrics.find((r: any) => r.name === "Авто, Мото");
  const move = await api(`/api/admin/topics/${topicId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "move", rubricId: autoRubric.id, token: owner.token }),
  });
  check("владелец перенёс тему", move.status === 200);

  const after = await api(`/api/topics/${topicId}`);
  check("перенос: id и номер темы сохранены", after.data.topic.id === topicId && after.data.topic.number === before.data.topic.number);
  check("перенос: обсуждение сохранено (id сообщений не изменились)", JSON.stringify(after.data.messages.map((m: any) => m.id)) === JSON.stringify(beforeMsgIds));
  check("перенос: раздел изменился", after.data.topic.rubricSlug === autoRubric.slug);

  // История действий по теме
  const history = await api(`/api/admin/topics/${topicId}?token=${owner.token}`);
  const actions = history.data.history.map((h: any) => h.action);
  check("история: rename и move записаны", actions.includes("topic.rename") && actions.includes("topic.move"));

  // Удаление: только владелец; восстановление
  const modDelete = await api(`/api/admin/topics/${topicId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", token: mod.token }),
  });
  check("модератор не может удалять темы (403)", modDelete.status === 403);
  const del = await api(`/api/admin/topics/${topicId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", token: owner.token }),
  });
  const listDeleted = await api(`/api/admin/topics?token=${owner.token}&filter=deleted`);
  check("владелец удалил тему, она в фильтре удалённых", del.status === 200 && listDeleted.data.topics.some((t: any) => t.id === topicId));
  const restore = await api(`/api/admin/topics/${topicId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "restore", token: owner.token }),
  });
  check("владелец восстановил тему", restore.status === 200);

  /* D. Жалобы */
  console.log("-- D. Жалобы");
  // Вставляем тестовую жалобу напрямую (без отправки через форум)
  const testMsg = await db.message.findFirst({ where: { isDeleted: false }, select: { id: true } });
  const complaint = await db.complaint.create({
    data: { messageId: testMsg!.id, category: "spam", comment: "Тестовая жалоба ШАГ12", reporterName: "tester", resolved: false },
  });
  const listOpen = await api(`/api/admin/complaints?token=${mod.token}&show=open`);
  check("модератор видит нерешённые жалобы", listOpen.status === 200 && listOpen.data.complaints.some((c: any) => c.id === complaint.id));
  const resolveC = await api("/api/admin/complaints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: complaint.id, token: mod.token }),
  });
  check("жалоба отмечена рассмотренной", resolveC.status === 200);
  const resolvedRow = await db.complaint.findUnique({ where: { id: complaint.id } });
  check("жалоба resolved=true в БД", resolvedRow?.resolved === true);
  await db.complaint.delete({ where: { id: complaint.id } });

  /* E. Настройки сайта */
  console.log("-- E. Настройки сайта");
  const modSettings = await api(`/api/admin/settings?token=${mod.token}`);
  check("модератор не видит настройки (403)", modSettings.status === 403);
  const ownerSettings = await api(`/api/admin/settings?token=${owner.token}`);
  check("владелец видит настройки", ownerSettings.status === 200 && "siteSlogan" in ownerSettings.data.settings);

  const saveSettings = await api("/api/admin/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: owner.token, settings: { ...ownerSettings.data.settings, siteSlogan: "Спроси у города — город ответит!", footerNote: "Город отвечает. Всегда." } }),
  });
  check("владелец сохранил настройки", saveSettings.status === 200);
  const boot = await api("/api/bootstrap");
  check("шапка получила новый слоган", boot.data.settings.siteSlogan === "Спроси у города — город ответит!" && boot.data.settings.footerNote === "Город отвечает. Всегда.");

  // Регистрация выключена → POST /api/auth/register 403
  await api("/api/admin/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: owner.token, settings: { registrationEnabled: "0" } }),
  });
  const regOff = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname: "запреттест", email: "ban-reg@test.local", password: "Пароль12345", password2: "Пароль12345", question: "вопрос", answer: "ответ" }),
  });
  check("регистрация приостановлена (403)", regOff.status === 403);
  await api("/api/admin/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: owner.token, settings: { registrationEnabled: "1" } }),
  });

  // Обычный пользователь не может создать тему при выключенной опции
  // (логин обычного пользователя неизвестен — проверяем через настройки + гарантию, что владелец может всегда)
  await api("/api/admin/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: owner.token, settings: { newTopicsEnabled: "0" } }),
  });
  const ownerTopicWhenOff = await api("/api/topics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: owner.token, rubricId: targetRubric.id, title: "Тема владельца при закрытых темах", body: "Проверка: сотрудники могут создавать темы всегда." }),
  });
  check("владелец создаёт тему даже при newTopicsEnabled=0", ownerTopicWhenOff.status === 200);
  const ownerTopicOffId = ownerTopicWhenOff.data?.id as number | undefined;
  await api("/api/admin/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: owner.token, settings: { newTopicsEnabled: "1" } }),
  });

  /* F. Разделы */
  console.log("-- F. Разделы (объявления/информация/справочник)");
  const modSections = await api(`/api/admin/sections?section=ads&token=${mod.token}`);
  check("модератор не управляет разделами (403)", modSections.status === 403);

  const createAd = await api("/api/admin/sections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: owner.token, section: "ads", action: "create", title: "Продам зимнюю резину", body: "R16, состояние отличное", contact: "8-000-000-00-00" }),
  });
  check("владелец добавил объявление", createAd.status === 200);
  const adId = createAd.data.item.id as string;
  const publicAds = await api("/api/sections?section=ads");
  check("объявление видно публично", publicAds.data.items.some((i: any) => i.id === adId));

  const hideAd = await api("/api/admin/sections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: owner.token, section: "ads", action: "toggle", id: adId }),
  });
  const publicAds2 = await api("/api/sections?section=ads");
  check("скрытое объявление не видно публично", hideAd.status === 200 && !publicAds2.data.items.some((i: any) => i.id === adId));

  const delAd = await api("/api/admin/sections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: owner.token, section: "ads", action: "delete", id: adId }),
  });
  check("объявление удалено", delAd.status === 200);

  /* G. Журнал действий */
  console.log("-- G. Журнал действий");
  const logAll = await api(`/api/admin/log?token=${owner.token}`);
  const logActions = logAll.data.entries.map((e: any) => e.action);
  check("журнал содержит записи всех действий", logAll.status === 200 && logActions.includes("sanction.apply") && logActions.includes("topic.move") && logActions.includes("settings.save") && logActions.includes("section.create"));
  const logFiltered = await api(`/api/admin/log?token=${owner.token}&type=sanctions`);
  check("фильтр журнала работает", logFiltered.data.entries.every((e: any) => e.action.startsWith("sanction.")));
  const modLog = await api(`/api/admin/log?token=${mod.token}`);
  check("модератор видит журнал", modLog.status === 200);

  /* Уборка */
  console.log("-- Уборка тестовых данных");
  // Тестовые темы текущего и прошлых запусков
  const stale = await db.topic.findMany({ where: { title: { contains: "ШАГ12" } }, select: { id: true } });
  for (const t of [...stale, ...([topicId, ownerTopicOffId].filter((x): x is number => typeof x === "number").map((id) => ({ id })))]) {
    await db.message.deleteMany({ where: { topicId: t.id } });
    await db.topic.deleteMany({ where: { id: t.id } });
  }
  // Тестовые санкции и журнал ШАГ12
  const staleSanctions = await db.sanction.findMany({ where: { OR: [{ reason: { contains: "ШАГ12" } }, { reason: { contains: "тест" } }] }, select: { id: true, userId: true } });
  await db.sanction.deleteMany({ where: { id: { in: staleSanctions.map((s) => s.id) } } });
  const touchedIds = [...new Set(staleSanctions.map((s) => s.userId).filter((x): x is string => !!x))];
  for (const uid of touchedIds) {
    await db.user.update({ where: { id: uid }, data: { restrictedUntil: null } });
  }
  const logCountBefore = await db.adminLog.count();
  console.log(`  журнал сохранён: ${logCountBefore} записей (внутренний, не чистим)`);

  // Восстановить исходный слоган
  await api("/api/admin/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: owner.token,
      settings: { siteSlogan: "Спроси у города — город ответит.", footerNote: "Спроси у города — город ответит." },
    }),
  });

  console.log(`\n== ИТОГ: ${passed} прошли, ${failed} упали ==`);
  if (failures.length) {
    console.log("Падения:");
    for (const f of failures) console.log("  -", f);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error("FATAL:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
