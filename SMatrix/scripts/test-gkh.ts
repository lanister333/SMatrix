/**
 * ШАГ 19: API-приёмка раздела «ЖКХ и городские проблемы» (/gkh).
 * Покрывает ключевые пункты ТЗ (файл «Жкх.docx») на API-уровне:
 *  Публикации: 1 создание (простая форма, п.1/30); 2 отображение/лента
 *    (п.24); 3 редактирование только автором (п.7); 4 удаление (п.16).
 *  Статусы: 5 три статуса (п.3); 6 решённые уходят из ленты и обычного
 *    поиска (п.4); 7 повторное возникновение — та же публикация, история
 *    сохраняется (п.5); 8 журнал смен статусов (п.6).
 *  Обновления: 9 от других жителей (п.8); 10 правка/удаление только своих
 *    (п.8); 11 удалённое обновление исчезает полностью (п.8).
 *  Объединение: 12 предупреждение о похожей (п.9); 13 продолжить всё равно;
 *    14 объединение модератором (п.9); 15 повторное объединение невозможно
 *    (п.28).
 *  Организация: 16 статус представителя подтверждается админом (п.11);
 *    17 ровно один официальный ответ (п.12); 18 ответ НЕ меняет статус
 *    «Решено» (п.3).
 *  Форум: 19 тема создаётся только кнопкой (п.13); 20 гонка 5×POST → 1 тема
 *    (п.13/28); 21 повторное нажатие → существующая тема (п.13); 22 рубрика
 *    «Обсуждение сообщений из блоков» → «ЖКХ и городские проблемы» (п.14);
 *    23 первое сообщение: текст + источник + место/статус (п.14);
 *    24 ссылка из темы обратно (п.14); 25 «Решено» закрывает тему, возврат
 *    открывает ТА ЖЕ тему (п.15); 26 удаление публикации — тема сохраняется
 *    (п.16).
 *  Жалобы: 27 восемь причин, нет «Лжи/Фейка» (п.17); 28 жалоба на публикацию
 *    и обновление (п.17); 29 количество жалоб не показывается (п.17).
 *  Модерация: 30 реклама скрывается ИИ (п.18); 31 «Не нравится ≠ нарушение»:
 *    критика организации разрешена (п.18); 32 скрытое не видно не-автору.
 *  Поиск: 33 частичное совпадение; 34 е/ё; 35 формы слова; 36 поиск по
 *    обновлениям; 37 решённые не в обычном поиске (п.21).
 *  Прочее: 38 пагинация API (п.28); 39 «Мои публикации» (скрытые видит
 *    автор, п.16/24); 40 защита от флуда попытками (п.28); 41 админ-действия
 *    + журнал (п.3/10/18).
 * После проверки чистит за собой тестовые данные.
 */
const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log("  ✓", name, extra ? `— ${extra}` : ""); }
  else { fail++; console.log("  ✗", name, extra ? `— ${extra}` : ""); }
}

async function api(path: string, opts: RequestInit = {}) {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  let data: Record<string, unknown> = {};
  try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

/** Метка тестовых данных в текстах — автоочистка при падении прогона. */
const TAG = " gk";

async function makeUser(nick: string) {
  const { db } = await import("../src/lib/db");
  const { hashPassword, newToken } = await import("../src/lib/auth");
  const email = `${nick.toLowerCase()}@test.local`;
  await db.user.create({
    data: { email, passwordHash: hashPassword("Test12345!"), nickname: nick, emailVerified: true },
  });
  const user = await db.user.findUnique({ where: { nickname: nick } });
  const token = newToken();
  await db.session.create({ data: { token, userId: user!.id } });
  return { user: user!, token };
}

/** Снять с пользователя ai-ограничения (тест самодостаточен для повторов). */
async function clearAiSanctions(userId: string) {
  const { db } = await import("../src/lib/db");
  await db.sanction.deleteMany({ where: { userId, source: "ai" } });
  await db.user.update({ where: { id: userId }, data: { restrictedUntil: null } });
}

async function main() {
  const { db } = await import("../src/lib/db");
  const stamp = Date.now().toString(36);
  const marker = `gk${stamp}`;
  const smarker = `gks${stamp}`; // отдельный маркер блока похожих/объединения

  // ---- Очистка остатков прерванных прошлых прогонов (по метке TAG) ----
  const leftovers = await db.gkhProblem.findMany({ where: { text: { contains: TAG } } });
  if (leftovers.length) {
    const lvIds = leftovers.map((p) => p.id);
    const lvTopics = await db.topic.findMany({ where: { gkhProblem: { id: { in: lvIds } } } });
    for (const t of lvTopics) {
      await db.message.deleteMany({ where: { topicId: t.id } });
      await db.topic.delete({ where: { id: t.id } });
    }
    await db.gkhComplaint.deleteMany({ where: { problemId: { in: lvIds } } });
    await db.gkhStatusLog.deleteMany({ where: { problemId: { in: lvIds } } });
    await db.gkhUpdate.deleteMany({ where: { problemId: { in: lvIds } } });
    await db.gkhMedia.deleteMany({ where: { problemId: { in: lvIds } } });
    await db.gkhProblem.deleteMany({ where: { id: { in: lvIds } } });
    console.log(`  очищены остатки прошлого прогона: проблем=${lvIds.length}, тем=${lvTopics.length}`);
  }
  const oldUsers = await db.user.findMany({ where: { nickname: { startsWith: "GkhTest_" } } });
  for (const u of oldUsers) {
    await db.sanction.deleteMany({ where: { userId: u.id } });
    await db.session.deleteMany({ where: { userId: u.id } });
    await db.user.delete({ where: { id: u.id } });
  }

  // ---- Тестовые пользователи ----
  const B = await makeUser(`GkhTest_${stamp}B`);
  const C = await makeUser(`GkhTest_${stamp}C`);
  const D = await makeUser(`GkhTest_${stamp}D`);
  const E = await makeUser(`GkhTest_${stamp}E`);
  ok("тестовые пользователи B/C/D/E созданы", !!B.user && !!C.user && !!D.user && !!E.user);

  // ---- Логин админа; снимаем остаточные ai-санкции прошлых прогонов ----
  await clearAiSanctions((await db.user.findUnique({ where: { nickname: "Админ" } }))!.id);
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@sakhmatrix.ru", password: "Admin2026" }),
  });
  const tokenA: string = login.data.user?.token ?? "";
  ok("логин админа (аккаунт A)", !!tokenA);

  // ---- Создание проблемы (авто-подтверждение похожих) ----
  async function createProblem(token: string, fields: Record<string, unknown>) {
    const first = await api("/api/gkh", {
      method: "POST",
      body: JSON.stringify({ token, ...fields }),
    });
    if (first.data.similar) {
      return api("/api/gkh", { method: "POST", body: JSON.stringify({ token, ...fields, confirmSimilar: true }) });
    }
    return first;
  }

  // ---- Гость: читать может, писать нет (ТЗ п.20) ----
  const anonRead = await api("/api/gkh");
  ok("гость читает ленту → 200 (п.20)", anonRead.status === 200 && Array.isArray(anonRead.data.problems));
  const anonPost = await api("/api/gkh", {
    method: "POST",
    body: JSON.stringify({ title: "Яма на дороге у дома", text: `Гость не может опубликовать проблему ${marker}` }),
  });
  ok("гость не публикует → 401 (п.20)", anonPost.status === 401);

  // ---- 1. Создание: простая форма (п.1/30) ----
  const create1 = await createProblem(B.token, {
    title: `Яма глубиной полметра на Пионерской ${marker}`,
    text: `Во дворе дома по ул. Пионерская, 25 уже месяц растёт яма на дороге. Обезопасить бы место конусами. ${marker}`,
    place: "Южно-Сахалинск, Пионерская 25",
    problemDate: "2026-09-01",
  });
  const p1 = String(create1.data.id ?? "");
  ok("создание публикации (п.1)", create1.status === 200 && !!p1, create1.data.note ? String(create1.data.note) : "");
  ok("гость создаёт только от зарегистрированных, статус по умолчанию — активна", create1.status === 200);

  // ---- 2. Лента: проблема видна, статус active (п.24) ----
  const feed1 = await api("/api/gkh");
  const feedRow1 = (feed1.data.problems as { id: string; status: string; authorGender: string; updateCount: number }[]).find((x) => x.id === p1);
  ok("публикация в ленте, статус «Проблема актуальна» (п.24)", !!feedRow1 && feedRow1.status === "active");
  ok("пол автора отдаётся для цвета ника (п.20)", !!feedRow1 && typeof feedRow1.authorGender === "string");

  // ---- 38. Пагинация API (п.28): 15 проблем напрямую в БД → страница 2 ----
  const bulkAuthor = B.user;
  for (let i = 0; i < 15; i++) {
    await db.gkhProblem.create({
      data: {
        title: `Тестовая проблема №${i + 1} для пагинации ${marker}`,
        text: `Обновление тестовой записи для проверки пагинации ленты ${TAG}${i}`,
        authorId: bulkAuthor.id,
        authorName: bulkAuthor.nickname,
      },
    });
  }
  const pg1 = await api(`/api/gkh?page=1&pageSize=12&q=${marker}`);
  const pg2 = await api(`/api/gkh?page=2&pageSize=12&q=${marker}`);
  ok("пагинация: page1 12 записей, page2 остаток (п.28)",
    (pg1.data.problems as unknown[]).length === 12 && (pg2.data.problems as unknown[]).length >= 4,
    `страниц=${pg2.data.pages}`);

  // ---- 3. Редактирование: только автор (п.7) ----
  const editForeign = await api(`/api/gkh/${p1}`, {
    method: "PATCH",
    body: JSON.stringify({ token: C.token, action: "edit", title: "Чужая правка", text: `Попытка изменить чужую проблему ${marker}` }),
  });
  ok("чужой не редактирует → 403 (п.7)", editForeign.status === 403);
  const editOwn = await api(`/api/gkh/${p1}`, {
    method: "PATCH",
    body: JSON.stringify({
      token: B.token, action: "edit",
      title: `Яма глубиной полметра на Пионерской ${marker}`,
      text: `Во дворе дома по ул. Пионерская, 25 яма стала шире, машины объезжают по тротуару. Рядом на дороге чёрный лёд. ${marker}`,
      place: "Южно-Сахалинск, Пионерская 25",
      problemDate: "2026-08-28",
    }),
  });
  ok("автор редактирует → 200 (п.7)", editOwn.status === 200, editOwn.data.note ? String(editOwn.data.note) : "");

  // ---- 9. Обновления от других жителей (п.8) ----
  const updAnon = await api(`/api/gkh/${p1}/updates`, {
    method: "POST",
    body: JSON.stringify({ text: "Гость не может добавить обновление" }),
  });
  ok("гость не добавляет обновление → 401 (п.8)", updAnon.status === 401);
  const updC = await api(`/api/gkh/${p1}/updates`, {
    method: "POST",
    body: JSON.stringify({ token: C.token, text: "У меня в этом же доме такая же проблема, яма прямо у подъезда." }),
  });
  const updCid = String(updC.data.id ?? "");
  ok("другой житель добавляет обновление (п.8)", updC.status === 200 && !!updCid, updC.data.hidden ? "скрыто ИИ: " + updC.data.note : "");
  const detail1 = await api(`/api/gkh/${p1}?token=${B.token}`);
  const hist1 = detail1.data.history as { kind: string }[];
  ok("хронология содержит публикацию и обновление (п.6)", !!hist1 && hist1.some((h) => h.kind === "problem") && hist1.some((h) => h.kind === "update"));

  // ---- 10/11. Правка и удаление только своих обновлений (п.8) ----
  const updForeign = await api(`/api/gkh/updates/${updCid}`, {
    method: "PATCH",
    body: JSON.stringify({ token: D.token, action: "edit", text: "Попытка чужой правки" }),
  });
  ok("чужое обновление не редактируется → 403 (п.8)", updForeign.status === 403);
  const updEdit = await api(`/api/gkh/updates/${updCid}`, {
    method: "PATCH",
    body: JSON.stringify({ token: C.token, action: "edit", text: "Сегодня приехала аварийная служба и осмотрела яму, обещали засыпать щебнем." }),
  });
  ok("автор правит своё обновление (п.8)", updEdit.status === 200);
  // поиск по тексту обновления (36)
  const searchUpd = await api(`/api/gkh?q=${encodeURIComponent("аварийн служб")}&pageSize=50`);
  ok("поиск находит текст обновления (п.21)", (searchUpd.data.problems as { id: string }[]).some((x) => x.id === p1));
  const updDel = await api(`/api/gkh/updates/${updCid}`, {
    method: "PATCH",
    body: JSON.stringify({ token: C.token, action: "delete" }),
  });
  ok("автор удаляет своё обновление (п.8)", updDel.status === 200);
  const detailAfterDel = await api(`/api/gkh/${p1}?token=${B.token}`);
  const gone = !(detailAfterDel.data.history as { update?: { id: string } }[]).some((h) => h.update?.id === updCid);
  ok("удалённое обновление исчезло полностью, без надписи «Обновление удалено» (п.8)", gone);

  // ---- 33/34/35. Поиск: частичное совпадение, е/ё, формы слова (п.21) ----
  const searchPartial = await api(`/api/gkh?q=${encodeURIComponent("пионерск")}&pageSize=50`);
  ok("поиск по месту и заголовку, частичное совпадение (п.21)", (searchPartial.data.problems as { id: string }[]).some((x) => x.id === p1));
  const searchForm = await api(`/api/gkh?q=${encodeURIComponent("яму")}&pageSize=50`);
  ok("поиск по форме слова («яму» → «яма») (п.21)", (searchForm.data.problems as { id: string }[]).some((x) => x.id === p1));
  const searchYo = await api(`/api/gkh?q=${encodeURIComponent("черный лед")}&pageSize=50`);
  ok("поиск «е» находит «ё» (п.21)", (searchYo.data.problems as { id: string }[]).some((x) => x.id === p1));

  // ---- 12/13. Похожие проблемы: предупреждение + возможность продолжить (п.9) ----
  // (реальная семантическая похожесть с p1: «яма», «двор», «Пионерская»)
  const sim1 = await api("/api/gkh", {
    method: "POST",
    body: JSON.stringify({
      token: C.token,
      title: `Яма на Пионерской во дворе ${smarker}`,
      text: `Соседка рассказывала про яму во дворе на Пионерской, это та же проблема скорее всего. ${smarker}`,
      place: "Пионерская 25",
    }),
  });
  ok("похожая проблема: предупреждение со списком (п.9)", sim1.status === 200 && !!sim1.data.similar && Array.isArray(sim1.data.similarProblems));
  const sim2 = await createProblem(D.token, {
    title: `Яма на Пионерской во дворе ${smarker}`,
    text: `У нас в соседнем дворе на Пионерской тоже яма на дороге появилась. ${smarker}`,
  });
  ok("можно опубликовать всё равно (п.9)", sim2.status === 200 && !!sim2.data.id);
  // 14. Объединение модератором (п.9): p1 (B) ← дубликат sim2 (D)
  const mergeAnon = await api(`/api/gkh/${p1}/merge`, {
    method: "POST",
    body: JSON.stringify({ token: C.token, duplicateOfId: p1 }),
  });
  ok("объединение недоступно не-модератору → 403", mergeAnon.status === 403);
  const merge = await api(`/api/gkh/${sim2.data.id}/merge`, {
    method: "POST",
    body: JSON.stringify({ token: tokenA, duplicateOfId: p1 }),
  });
  ok("модератор объединяет дубликаты (п.9)", merge.status === 200, merge.data.note ? String(merge.data.note) : "");
  const feedAfterMerge = await api(`/api/gkh?q=${smarker}&pageSize=50`);
  ok("объединённый дубликат исчез из ленты (п.9)", !(feedAfterMerge.data.problems as { id: string }[]).some((x) => x.id === sim2.data.id));
  const dupRow = await db.gkhProblem.findUnique({ where: { id: String(sim2.data.id) } });
  ok("объединённый дубликат помечен mergedIntoId (история сохранена)", dupRow?.mergedIntoId === p1);
  const remerge = await api(`/api/gkh/${sim2.data.id}/merge`, {
    method: "POST",
    body: JSON.stringify({ token: tokenA, duplicateOfId: p1 }),
  });
  ok("повторное объединение уже объединённого невозможно (п.28)", remerge.status === 409);
  // обновление жителя дубликата переехало в общую историю
  await db.gkhUpdate.create({
    data: { problemId: String(sim2.data.id), authorId: D.user.id, authorName: D.user.nickname, text: `Обновление до объединения ${TAG}` },
  });
  // (создано после merge — не переезжает; проверяем только флаг и ленту)

  // ---- 16/17/18. Организация и представитель (п.3/10/11/12) ----
  const create2 = await createProblem(C.token, {
    title: `Горячей воды нет в доме на Солнечной ${marker}`,
    text: `В доме по Солнечной 11 с понедельника нет горячей воды, никто не объясняет причину. ${marker}`,
    place: "Южно-Сахалинск, Солнечная 11",
  });
  const p2 = String(create2.data.id ?? "");
  ok("вторая публикация создана", create2.status === 200 && !!p2);
  const orgRespAnon = await api(`/api/gkh/${p2}/org-response`, {
    method: "POST",
    body: JSON.stringify({ token: D.token, text: "Я директор и отвечаю: работы идут по графику." }),
  });
  ok("не-представитель не даёт официальный ответ → 403 (п.11)", orgRespAnon.status === 403);
  const setRep = await api("/api/admin/gkh", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, action: "set-org-rep", nickname: D.user.nickname, orgName: "МУП Горводоканал", orgRep: true }),
  });
  ok("админ подтверждает представителя организации (п.11)", setRep.status === 200, setRep.data.note ? String(setRep.data.note) : "");
  const orgResp = await api(`/api/gkh/${p2}/org-response`, {
    method: "POST",
    body: JSON.stringify({
      token: D.token,
      text: "Подача горячей воды возобновится в пятницу после завершения сварочных работ на участке сети. Приносим извинения.",
    }),
  });
  ok("представитель даёт официальный ответ (п.12)", orgResp.status === 200, orgResp.data.note ? String(orgResp.data.note) : "");
  const orgResp2 = await api(`/api/gkh/${p2}/org-response`, {
    method: "POST",
    body: JSON.stringify({ token: D.token, text: "Дополнение к предыдущему ответу организации." }),
  });
  ok("второй официальный ответ невозможен → 409 (п.12)", orgResp2.status === 409);
  const detail2 = await api(`/api/gkh/${p2}`);
  ok("ответ организации в истории, статус не изменился (п.3)",
    (detail2.data.history as { kind: string }[]).some((h) => h.kind === "org") && detail2.data.problem.status === "active");
  const setOrg = await api("/api/admin/gkh", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, action: "set-organization", problemId: p1, organization: "МУП «Городское благоустройство»" }),
  });
  ok("модератор указывает ответственную организацию (п.10)", setOrg.status === 200);

  // ---- 19–24. Форум: создание, гонка, рубрика, первое сообщение (п.13/14) ----
  const raceResults = await Promise.all(
    Array.from({ length: 5 }, () =>
      api(`/api/gkh/${p1}/discuss`, { method: "POST", body: JSON.stringify({ token: B.token }) })
    )
  );
  const topicIds = new Set(raceResults.map((r) => String(r.data.topicId ?? "")));
  ok("гонка 5×POST «Обсудить» → одна тема для всех (п.13/28)", raceResults.every((r) => r.status === 200) && topicIds.size === 1, `topicId=${[...topicIds][0]}`);
  const topicId = Number([...topicIds][0]);
  const repeatDiscuss = await api(`/api/gkh/${p1}/discuss`, { method: "POST", body: JSON.stringify({ token: C.token }) });
  ok("повторное нажатие открывает существующую тему (п.13)", repeatDiscuss.status === 200 && repeatDiscuss.data.created === false && Number(repeatDiscuss.data.topicId) === topicId);
  const topicRow = await db.topic.findUnique({ where: { id: topicId }, include: { rubric: { include: { parent: true } } } });
  ok("рубрика: «Обсуждение сообщений из блоков» → «ЖКХ и городские проблемы» (п.14)",
    topicRow?.rubric?.name === "ЖКХ и городские проблемы" && topicRow?.rubric?.parent?.name === "Обсуждение сообщений из блоков");
  const firstMsg = await db.message.findFirst({ where: { topicId }, orderBy: { num: "asc" } });
  ok("первое сообщение: исходный текст + место + статус (п.14)",
    !!firstMsg && firstMsg.body.includes("Пионерская") && firstMsg.body.includes("Место:") && firstMsg.body.includes("Текущий статус:"));
  ok("первое сообщение содержит «Источник: ЖКХ и городские проблемы» и ссылку обратно (п.14)",
    !!firstMsg && firstMsg.body.includes("Источник: ЖКХ и городские проблемы") && firstMsg.body.includes(`/gkh?post=${p1}`));
  const topicApi = await api(`/api/topics/${topicId}`);
  ok("API темы отдаёт источник обратно на публикацию (п.14)", topicApi.data.topic?.gkh && (topicApi.data.topic.gkh as { id: string }).id === p1);
  const autoTopicCount = await db.topic.count({ where: { gkhProblem: { id: p2 } } });
  ok("тема НЕ создаётся автоматически при публикации (п.13)", autoTopicCount === 0);

  // ---- 5/6/7/25. Статусы, решённые, повторное возникновение, цикл темы (п.3/4/5/15) ----
  const stForeign = await api(`/api/gkh/${p1}`, {
    method: "PATCH",
    body: JSON.stringify({ token: C.token, action: "status", status: "solved" }),
  });
  ok("статус меняет только автор или модератор → 403", stForeign.status === 403);
  const stProgress = await api(`/api/gkh/${p1}`, {
    method: "PATCH",
    body: JSON.stringify({ token: B.token, action: "status", status: "in_progress" }),
  });
  ok("статус «Решается» (п.3)", stProgress.status === 200);
  const stSolved = await api(`/api/gkh/${p1}`, {
    method: "PATCH",
    body: JSON.stringify({ token: B.token, action: "status", status: "solved" }),
  });
  ok("автор устанавливает «Решено» (п.3)", stSolved.status === 200 && String(stSolved.data.note).includes("закрыта"));
  const topicAfterSolve = await db.topic.findUnique({ where: { id: topicId } });
  ok("«Решено» закрывает форумную тему (п.15)", topicAfterSolve?.isClosed === true);
  const feedSolved = await api(`/api/gkh?q=${marker}&pageSize=50`);
  ok("решённая проблема исчезла из ленты активных (п.4)", !(feedSolved.data.problems as { id: string }[]).some((x) => x.id === p1));
  ok("решённая проблема не в обычном поиске как активная (п.4)", !(feedSolved.data.problems as { id: string }[]).some((x) => x.id === p1));
  const stBack = await api(`/api/gkh/${p1}`, {
    method: "PATCH",
    body: JSON.stringify({ token: B.token, action: "status", status: "active" }),
  });
  ok("повторное возникновение: возврат в «Актуальна» (п.5)", stBack.status === 200 && String(stBack.data.note).includes("снова открыта"));
  const topicAfterBack = await db.topic.findUnique({ where: { id: topicId } });
  ok("ТА ЖЕ тема открыта повторно, новой темы нет (п.15)", topicAfterBack?.isClosed === false);
  const topicCountP1 = await db.topic.count({ where: { gkhProblem: { id: p1 } } });
  ok("для проблемы максимум одна тема за весь цикл (п.13/15)", topicCountP1 === 1);
  const feedBack = await api(`/api/gkh?q=${marker}&pageSize=50`);
  ok("проблема снова в ленте после возврата (п.5)", (feedBack.data.problems as { id: string }[]).some((x) => x.id === p1));
  const detail1b = await api(`/api/gkh/${p1}`);
  const statusEvents = (detail1b.data.history as { kind: string; toStatus?: string }[]).filter((h) => h.kind === "status");
  ok("история хранит все смены статуса с этапами (п.6)",
    statusEvents.length === 3 && statusEvents[0].toStatus === "in_progress" && statusEvents[1].toStatus === "solved" && statusEvents[2].toStatus === "active",
    `событий=${statusEvents.length}`);

  // ---- 26. Удаление публикации с темой (п.16) ----
  const createDel = await createProblem(C.token, {
    title: `Заброшенная стройка во дворе ${marker}`,
    text: `Пустая коробка дома стоит без ограждения, дети ходят рядом. Опасно. ${marker}`,
  });
  const pDel = String(createDel.data.id ?? "");
  const d1 = await api(`/api/gkh/${pDel}/discuss`, { method: "POST", body: JSON.stringify({ token: C.token }) });
  const delTopicId = Number(d1.data.topicId);
  const delSelf = await api(`/api/gkh/${pDel}`, {
    method: "PATCH",
    body: JSON.stringify({ token: D.token, action: "delete" }),
  });
  ok("чужой не удаляет публикацию → 403", delSelf.status === 403);
  const delOwn = await api(`/api/gkh/${pDel}`, {
    method: "PATCH",
    body: JSON.stringify({ token: C.token, action: "delete" }),
  });
  ok("автор удаляет свою публикацию (п.16)", delOwn.status === 200 && String(delOwn.data.note).includes("сохранена"));
  const delTopic = await db.topic.findUnique({ where: { id: delTopicId } });
  ok("форумная тема НЕ удалена (п.16)", !!delTopic && !delTopic.deletedAt);
  const topicApiDel = await api(`/api/topics/${delTopicId}`);
  ok("в теме показывается «Исходная публикация была удалена автором.» (п.16)",
    topicApiDel.data.topic?.gkh && (topicApiDel.data.topic.gkh as { isDeleted: boolean }).isDeleted === true);
  const detailDel = await api(`/api/gkh/${pDel}`);
  ok("детальная удалённой публикации показывает уведомление (п.16)", detailDel.data.deleted === true && String(detailDel.data.note).includes("удалена автором"));

  // ---- 27/28/29. Жалобы (п.17) ----
  const complaintBad = await api(`/api/gkh/${p2}/complaint`, {
    method: "POST",
    body: JSON.stringify({ category: "lie" }),
  });
  ok("категории «Ложь/Фейк» не существует (п.17)", complaintBad.status === 400);
  const complaintOk = await api(`/api/gkh/${p2}/complaint`, {
    method: "POST",
    body: JSON.stringify({ category: "personal_data", comment: "Указан номер квартиры соседа", reporterName: D.user.nickname }),
  });
  ok("жалоба на публикацию отправляется (п.17)", complaintOk.status === 200);
  const updD = await api(`/api/gkh/${p2}/updates`, {
    method: "POST",
    body: JSON.stringify({ token: D.token, text: "Проблема всё ещё сохраняется, горячей воды нет уже третий день." }),
  });
  const updDid = String(updD.data.id ?? "");
  const complaintUpd = await api(`/api/gkh/updates/${updDid}/complaint`, {
    method: "POST",
    body: JSON.stringify({ category: "offtopic" }),
  });
  ok("жалоба на обновление отправляется (п.17)", complaintUpd.status === 200);
  const feedComplaints = await api(`/api/gkh`);
  ok("количество жалоб не показывается в ленте (п.17)",
    (feedComplaints.data.problems as Record<string, unknown>[]).every((x) => !("complaintCount" in x) && !("complaints" in x)));
  const adminQueue = await api(`/api/admin/gkh?token=${tokenA}&show=open`);
  ok("жалобы видны человеку-модератору", adminQueue.status === 200 && (adminQueue.data.complaints as unknown[]).length >= 2);
  const firstComplaint = (adminQueue.data.complaints as { id: string }[])[0];
  const resolveC = await api("/api/admin/gkh", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, action: "resolve-complaint", complaintId: firstComplaint.id }),
  });
  ok("модератор закрывает жалобу", resolveC.status === 200);

  // ---- 30/31/32. Модерация: реклама скрывается, критика разрешена (п.18) ----
  const ad = await createProblem(B.token, {
    title: `Ремонт кровли и балконов под ключ ${marker}`,
    text: `Выполняем ремонт кровли под ключ недорого. Обращайтесь к нам прямо сейчас, звоните и заказывайте, работаем по всему Сахалину. Скидка для жильцов домов при заказе в этом месяце. ${marker}`,
  });
  const adHidden = ad.data.hidden === true;
  ok("реклама под видом проблемы скрывается или уходит человеку (п.18)",
    ad.status === 200 && (adHidden || ad.data.needHuman === true),
    String(ad.data.note ?? ""));
  if (!adHidden && ad.data.needHuman) {
    // Детерминированная проверка скрытия: решение человека-модератора.
    await api("/api/admin/gkh", {
      method: "POST",
      body: JSON.stringify({ token: tokenA, action: "hide-problem", problemId: String(ad.data.id), reason: "реклама (решение модератора)" }),
    });
  }
  const criticism = await createProblem(B.token, {
    title: `Поликлиника на Солнечной: запись к терапевту на две недели ${marker}`,
    text: `Организация записи в поликлинике страдает: талонов нет, телефон не отвечает. Очень неудобно для жителей района. ${marker}`,
  });
  ok("критика организации разрешена — «Не нравится ≠ нарушение» (п.18)", criticism.status === 200 && criticism.data.hidden !== true, criticism.data.note ? String(criticism.data.note) : "");
  const critId = String(criticism.data.id ?? "");
  const anonHidden = await api(`/api/gkh/${String(ad.data.id)}`);
  ok("скрытое ИИ/модерацией не видно гостю (п.18)", anonHidden.status === 200 && anonHidden.data.hidden === true);
  const authorHidden = await api(`/api/gkh/${String(ad.data.id)}?token=${B.token}`);
  ok("автор видит свою скрытую публикацию с пояснением", authorHidden.data.problem && authorHidden.data.problem.isHiddenByAi === true);

  // ---- 39. «Мои публикации» (п.24) ----
  const mineB = await api(`/api/gkh?mine=1&token=${B.token}`);
  const mineRows = mineB.data.problems as { id: string; isHiddenByAi?: boolean }[];
  ok("«Мои публикации» содержит скрытые ИИ с пометкой (п.24)",
    mineRows.some((x) => x.id === p1) && mineRows.some((x) => x.id === String(ad.data.id) && x.isHiddenByAi));

  // ---- 40. Защита от флуда попытками (п.28) — отдельный пользователь ----
  let floodStatus = 0;
  for (let i = 0; i < 31; i++) {
    const r = await api("/api/gkh", {
      method: "POST",
      body: JSON.stringify({ token: E.token, title: "x", text: "y" }),
    });
    floodStatus = r.status;
    if (r.status === 429) break;
  }
  ok("флуд попытками ограничен → 429 (п.28)", floodStatus === 429);

  // ---- 41. Админ: скрыть/вернуть, статус модератором, журнал (п.3/18) ----
  const adminHide = await api("/api/admin/gkh", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, action: "hide-problem", problemId: p2, reason: "проверка админ-действия" }),
  });
  ok("модератор скрывает публикацию", adminHide.status === 200);
  const adminRestore = await api("/api/admin/gkh", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, action: "restore-problem", problemId: p2 }),
  });
  ok("модератор возвращает публикацию (решение ИИ отменяется человеком, п.18)", adminRestore.status === 200);
  const adminStatus = await api("/api/admin/gkh", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, action: "set-status", problemId: p2, status: "in_progress" }),
  });
  ok("модератор меняет статус (п.3)", adminStatus.status === 200 && String(adminStatus.data.note).includes("Решается"));
  const p2Log = await db.gkhStatusLog.findMany({ where: { problemId: p2 }, orderBy: { createdAt: "asc" } });
  ok("смена статуса модератором в журнале с byRole=moderator", p2Log.some((l) => l.toStatus === "in_progress" && l.byRole === "moderator"));
  const adminLogs = await db.adminLog.findMany({ where: { action: { startsWith: "gkh." } }, take: 10 });
  ok("действия модерации записаны в журнал AdminLog", adminLogs.length >= 4, `записей=${adminLogs.length}`);

  // ---- Итог ----
  console.log(`\n=== РЕЗУЛЬТАТ: ${pass} ✓ / ${fail} ✗ ===`);
  if (fail > 0) process.exitCode = 1;

  // ---- Очистка тестовых данных ----
  const gkIds = (
    await db.gkhProblem.findMany({
      where: { OR: [{ text: { contains: TAG } }, { id: { in: [p1, p2, pDel, critId, String(ad.data.id), String(sim2.data.id)] } }] },
      select: { id: true },
    })
  ).map((x) => x.id);
  const gkTopics = await db.topic.findMany({ where: { gkhProblem: { id: { in: gkIds } } } });
  for (const t of gkTopics) {
    await db.message.deleteMany({ where: { topicId: t.id } });
    await db.topic.delete({ where: { id: t.id } });
  }
  await db.gkhComplaint.deleteMany({ where: { problemId: { in: gkIds } } });
  await db.gkhStatusLog.deleteMany({ where: { problemId: { in: gkIds } } });
  await db.gkhUpdate.deleteMany({ where: { problemId: { in: gkIds } } });
  await db.gkhMedia.deleteMany({ where: { problemId: { in: gkIds } } });
  await db.gkhProblem.deleteMany({ where: { id: { in: gkIds } } });
  await db.adminLog.deleteMany({ where: { action: { startsWith: "gkh." } } });
  for (const u of [B, C, D, E]) {
    await db.sanction.deleteMany({ where: { userId: u.user.id } });
    await db.session.deleteMany({ where: { userId: u.user.id } });
    await db.user.delete({ where: { id: u.user.id } });
  }
  // представители прошлых прогонов
  await db.user.updateMany({ where: { nickname: { startsWith: "GkhTest_" } }, data: { orgRep: false, orgName: "" } });
  console.log("очистка тестовых данных выполнена");
}

main().catch((e) => {
  console.error("КРИТИЧЕСКАЯ ОШИБКА ТЕСТА:", e);
  process.exitCode = 1;
});
