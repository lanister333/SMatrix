/**
 * ШАГ 17: API-приёмка раздела «Подслушано Сахалин» (/podslyshano).
 * Покрывает финальную проверку из ТЗ п.25 (API-уровень):
 *  1 создание; 2 отображение; 3 редактирование; 4 удаление; 5 поиск;
 *  6 хронологический порядок; 7 пагинация/накопление; 8 кнопка «Обсудить»;
 *  9 одна тема на публикацию; 10 повторное нажатие без дубля;
 * 11 обновление страницы без дубля; 12 состояние «Обсуждается»;
 * 13 «Тема закрыта»; 14 «Тема в архиве»; 15 ссылка из темы к публикации;
 * 20 нет комментариев/социальных механик (в API их не существует);
 * 21 независимость от «Нужна помощь».
 * Пункты 16–19 (мобильная вёрстка) проверяются отдельно браузером.
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

async function main() {
  const { db } = await import("../src/lib/db");
  const { hashPassword, newToken } = await import("../src/lib/auth");

  // ---- Тестовый пользователь B ----
  const stamp = Date.now().toString(36);
  const nickB = `OvrTest_${stamp}`;
  const emailB = `${nickB.toLowerCase()}@test.local`;
  await db.user.create({
    data: { email: emailB, passwordHash: hashPassword("Test12345!"), nickname: nickB, emailVerified: true },
  });
  const userB = await db.user.findUnique({ where: { nickname: nickB } });
  const tokenB = newToken();
  await db.session.create({ data: { token: tokenB, userId: userB!.id } });
  ok("тестовый пользователь B создан", !!userB);

  // ---- Логин админа (аккаунт A) ----
  // Тест самодостаточен: снимаем с админа остаточные ИИ-ограничения от прошлых
  // прогонов (ИИ-лестница срабатывает на тестовой рекламе; причина в Sanction —
  // текст нарушения без слова «Подслушано»). Человеческие решения не трогаем
  // (source: ai only) — иначе повторный прогон невозможен до истечения лимита.
  await db.sanction.deleteMany({ where: { user: { nickname: "Админ" }, source: "ai" } });
  await db.user.update({ where: { nickname: "Админ" }, data: { restrictedUntil: null } });
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@sakhmatrix.ru", password: "Admin2026" }),
  });
  const tokenA: string = login.data.user?.token ?? "";
  ok("логин админа (аккаунт A)", !!tokenA);

  // ---- Гость: читать может, писать нет (ТЗ п.12) ----
  const anonRead = await api("/api/overheard");
  ok("гость читает ленту → 200 (п.12)", anonRead.status === 200 && Array.isArray(anonRead.data.posts));
  const anonPost = await api("/api/overheard", {
    method: "POST",
    body: JSON.stringify({ title: "Анонимное сообщение города", text: "Никто не сможет это опубликовать без входа" }),
  });
  ok("гость не публикует → 401 (п.12)", anonPost.status === 401);

  // ---- 1. Создание: слух с местом (п.1/11/12; слух — не нарушение, п.15) ----
  const rumor = await api("/api/overheard", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      title: "Говорят, что на улице скоро изменят движение",
      text: "Слышал от водителей, что движение на перекрёстке развернут в другую сторону. Кто-нибудь знает подробности?",
      place: "Южно-Сахалинск",
    }),
  });
  ok("слух опубликован (ИИ не блокирует слух — п.15/16)", rumor.status === 200 && rumor.data.hidden !== true, JSON.stringify(rumor.data.note ?? rumor.data.error ?? ""));
  const postId1 = String(rumor.data.id ?? "");

  // ---- Отображение (п.2/11): поля сообщения в ленте ----
  const feed1 = await api("/api/overheard");
  const f1 = (feed1.data.posts as Record<string, unknown>[]).find((p) => p.id === postId1);
  ok("сообщение в ленте с полями", !!f1 && f1.title === "Говорят, что на улице скоро изменят движение" && !!f1.text && f1.place === "Южно-Сахалинск" && f1.authorName === "Админ" && !!f1.createdAt);
  ok("новое сообщение сверху ленты (п.10)", (feed1.data.posts as Record<string, unknown>[])[0]?.id === postId1);
  ok("у нового сообщения нет темы, state=none (п.5)", f1?.topicId === null && f1?.topicState === "none");

  // ---- Место необязательно (п.12) ----
  const noplace = await api("/api/overheard", {
    method: "POST",
    body: JSON.stringify({ token: tokenB, title: "Вопрос про новый сквер", text: "Говорят, в новом сквере поставят сцену. Это правда или снова слухи по городу?" }),
  });
  ok("сообщение без места создаётся (п.12)", noplace.status === 200);
  const postId2 = String(noplace.data.id ?? "");
  const feed2 = await api("/api/overheard");
  const f2 = (feed2.data.posts as Record<string, unknown>[]).find((p) => p.id === postId2);
  ok("место пустое, когда не указано", f2?.place === "");

  // ---- Поиск (п.14): слова из заголовка, частичное совпадение, русский регистр ----
  const s1 = await api("/api/overheard?q=" + encodeURIComponent("движение"));
  ok("поиск находит по заголовку (п.14)", (s1.data.posts as Record<string, unknown>[]).some((p) => p.id === postId1));
  const s2 = await api("/api/overheard?q=" + encodeURIComponent("сквере"));
  ok("поиск находит по тексту (п.14)", (s2.data.posts as Record<string, unknown>[]).some((p) => p.id === postId2));
  const s3 = await api("/api/overheard?q=" + encodeURIComponent("говор"));
  ok("частичное совпадение и регистр (п.14)", (s3.data.posts as Record<string, unknown>[]).some((p) => p.id === postId1));
  const s4 = await api("/api/overheard?q=" + encodeURIComponent("нигданебудеттакогослова"));
  ok("поиск без совпадений → пусто (п.14)", (s4.data.posts as Record<string, unknown>[]).length === 0);

  // ---- Фильтр по месту (п.8, компактный) ----
  const pf = await api("/api/overheard?place=" + encodeURIComponent("Южно"));
  ok("фильтр по месту (п.8)", (pf.data.posts as Record<string, unknown>[]).some((p) => p.id === postId1) && !(pf.data.posts as Record<string, unknown>[]).some((p) => p.id === postId2));

  // ---- 3. Редактирование: только автор (п.21) ----
  const editForeign = await api(`/api/overheard/${postId2}`, {
    method: "PATCH",
    body: JSON.stringify({ token: tokenA, action: "edit", title: "Попытка чужой правки сквера", text: "Кто-то пытается отредактировать чужое сообщение без права" }),
  });
  ok("чужое сообщение нельзя редактировать → 403 (п.21)", editForeign.status === 403);
  const editOwn = await api(`/api/overheard/${postId2}`, {
    method: "PATCH",
    body: JSON.stringify({ token: tokenB, action: "edit", title: "Вопрос про новый сквер и фонтан", text: "Говорят, в новом сквере поставят сцену и фонтан. Это правда или снова слухи?" }),
  });
  ok("автор редактирует своё (п.21)", editOwn.status === 200 && editOwn.data.hidden !== true);

  // ---- Хронология и стабильность (п.6/10/20) ----
  const c1 = await api("/api/overheard", { method: "POST", body: JSON.stringify({ token: tokenB, title: "Наблюдение первое про автобус", text: "Заметил, что утренний автобус стал ездить по новому маршруту мимо рынка." }) });
  const c2 = await api("/api/overheard", { method: "POST", body: JSON.stringify({ token: tokenA, title: "Наблюдение второе про ярмарку", text: "На площади снова работает ярмарка по выходным, слышал, что до конца месяца." }) });
  const c3 = await api("/api/overheard", { method: "POST", body: JSON.stringify({ token: tokenB, title: "Наблюдение третье про фонари", text: "На Набережной зажгли новые фонари, говорят, их поставили вчера к празднику." }) });
  ok("три сообщения созданы", c1.status === 200 && c2.status === 200 && c3.status === 200);
  const ch1 = await api("/api/overheard?pageSize=50");
  const ch2 = await api("/api/overheard?pageSize=50");
  const order1 = (ch1.data.posts as { id: string }[]).map((p) => p.id);
  const order2 = (ch2.data.posts as { id: string }[]).map((p) => p.id);
  ok("хронология: новые сверху (п.6/10)", order1[0] === String(c3.data.id) && order1[1] === String(c2.data.id) && order1[2] === String(c1.data.id));
  ok("положение стабильно между запросами (п.20)", JSON.stringify(order1) === JSON.stringify(order2));

  // ---- Пагинация (п.7/10/20) ----
  const p1 = await api("/api/overheard?page=1&pageSize=2");
  const p2 = await api("/api/overheard?page=2&pageSize=2");
  const ids1 = (p1.data.posts as { id: string }[]).map((p) => p.id);
  const ids2 = (p2.data.posts as { id: string }[]).map((p) => p.id);
  ok("пагинация: 2 на странице, страницы не пересекаются (п.7)", ids1.length === 2 && ids2.length >= 2 && !ids1.some((i) => ids2.includes(i)));
  ok("продолжение порядка на второй странице (п.10)", ids2[0] === order1[2]);
  ok("метаданные пагинации", Number(p1.data.pages) >= 3 && Number(p1.data.total) >= 5, `total=${p1.data.total}, pages=${p1.data.pages}`);

  // ---- 8/9. «Обсудить на форуме»: создание ровно одной темы ----
  const guestDiscuss = await api(`/api/overheard/${postId1}/discuss`, { method: "POST", body: JSON.stringify({}) });
  ok("гость не создаёт тему → 401 (п.2)", guestDiscuss.status === 401);

  const d1 = await api(`/api/overheard/${postId1}/discuss`, { method: "POST", body: JSON.stringify({ token: tokenB }) });
  const topicId = Number(d1.data.topicId);
  ok("кнопка создаёт тему (п.8)", d1.status === 200 && d1.data.created === true && Number.isFinite(topicId) && topicId > 0, `topicId=${topicId}`);

  const topicRow = await db.topic.findUnique({
    where: { id: topicId },
    include: { rubric: { select: { name: true, slug: true } }, _count: { select: { messages: true } } },
  });
  ok("тема в рубрике «Обсуждение сообщений из «Подслушано»» (п.2)", topicRow?.rubric?.name === "Обсуждение сообщений из «Подслушано»", topicRow?.rubric?.name ?? "—");
  ok("заголовок темы от публикации", !!topicRow && topicRow.title.includes("изменят движение"));

  // ---- 15. Ссылка из темы обратно на публикацию (п.4/25.15) ----
  const firstMsg = await db.message.findFirst({ where: { topicId, num: 1 } });
  ok("первое сообщение содержит оригинальный текст (п.4)", !!firstMsg && firstMsg.body.includes("изменят движение") && firstMsg.body.includes("Кто-нибудь знает подробности?"));
  ok("первое сообщение содержит «Источник: Подслушано Сахалин» (п.4)", !!firstMsg && firstMsg.body.includes("Источник: Подслушано Сахалин"));
  ok("первое сообщение содержит ссылку на публикацию (п.4)", !!firstMsg && firstMsg.body.includes(`/podslyshano?post=${postId1}`));

  // ---- API темы отдаёт источник (п.15) ----
  const topicApi = await api(`/api/topics/${topicId}`);
  ok("API темы содержит ссылку на источник (п.15)", topicApi.status === 200 && (topicApi.data.topic?.overheard as { id?: string } | null)?.id === postId1);

  // ---- 10/11. Повторное нажатие и «обновление страницы» не создают дубль ----
  const d2 = await api(`/api/overheard/${postId1}/discuss`, { method: "POST", body: JSON.stringify({ token: tokenA }) });
  ok("повторное нажатие — та же тема (п.10)", d2.status === 200 && d2.data.created === false && Number(d2.data.topicId) === topicId);
  const d3 = await api(`/api/overheard/${postId1}/discuss`);
  ok("обновление страницы (GET) — та же тема (п.11)", d3.status === 200 && Number(d3.data.topicId) === topicId);

  // ---- 9/12. Гонка: 5 одновременных нажатий — одна тема ----
  const racePost = await api("/api/overheard", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, title: "Слух про новый торговый центр", text: "Говорят, на месте старой автозаправки построят торговый центр с кинотеатром." }),
  });
  const raceId = String(racePost.data.id);
  const results = await Promise.all(
    [tokenA, tokenB, tokenA, tokenB, tokenA].map((t) =>
      api(`/api/overheard/${raceId}/discuss`, { method: "POST", body: JSON.stringify({ token: t }) })
    )
  );
  const uniqTopics = [...new Set(results.map((r) => Number(r.data.topicId)))];
  const createdCount = results.filter((r) => r.data.created === true).length;
  ok("5 одновременных нажатий → одна тема на всех (п.9/12)", results.every((r) => r.status === 200) && uniqTopics.length === 1 && createdCount === 1, `topics=${uniqTopics.join(",")}, created=${createdCount}`);
  const linkedCount = await db.overheardPost.count({ where: { id: raceId, topicId: { not: null } } });
  ok("у публикации ровно одна связанная тема в БД (п.3)", linkedCount === 1);
  const raceTopicId = Number.isFinite(uniqTopics[0]) ? uniqTopics[0] : -1;
  const dupCount = await db.topic.count({ where: { overheardPost: { id: raceId } } });
  ok("тем с этой публикацией в БД: 1 (п.3)", dupCount === 1);

  // ---- 12. Состояние «Обсуждается на форуме» ----
  const feedD = await api("/api/overheard?pageSize=50");
  const fd = (feedD.data.posts as Record<string, unknown>[]).find((p) => p.id === postId1);
  ok("в ленте состояние open → «Обсуждается на форуме» (п.12)", fd?.topicId === topicId && fd?.topicState === "open");

  // ---- 13. Состояние «Тема закрыта» ----
  await db.topic.update({ where: { id: topicId }, data: { isClosed: true } });
  const feedC = await api("/api/overheard?pageSize=50");
  const fc = (feedC.data.posts as Record<string, unknown>[]).find((p) => p.id === postId1);
  ok("закрытая тема → «Тема закрыта» (п.13)", fc?.topicState === "closed");
  const dClosed = await api(`/api/overheard/${postId1}/discuss`, { method: "POST", body: JSON.stringify({ token: tokenB }) });
  ok("нажатие при закрытой теме не создаёт новую (п.3)", dClosed.status === 200 && Number(dClosed.data.topicId) === topicId && dClosed.data.state === "closed");
  await db.topic.update({ where: { id: topicId }, data: { isClosed: false } });

  // ---- 14. Состояние «Тема в архиве» + кнопка не возвращается к «Обсудить» ----
  await db.topic.update({ where: { id: topicId }, data: { isArchived: true } });
  const feedA = await api("/api/overheard?pageSize=50");
  const fa = (feedA.data.posts as Record<string, unknown>[]).find((p) => p.id === postId1);
  ok("архивная тема → «Тема в архиве» (п.14)", fa?.topicState === "archived");
  await db.topic.update({ where: { id: topicId }, data: { isArchived: false, deletedAt: new Date() } });
  const feedDel = await api("/api/overheard?pageSize=50");
  const fdel = (feedDel.data.posts as Record<string, unknown>[]).find((p) => p.id === postId1);
  const dDel = await api(`/api/overheard/${postId1}/discuss`, { method: "POST", body: JSON.stringify({ token: tokenB }) });
  ok("удалённая тема → «Тема в архиве», новая тема НЕ создаётся (п.5/14)", fdel?.topicState === "archived" && dDel.status === 200 && Number(dDel.data.topicId) === topicId && dDel.data.created === false);

  // ---- 22. Жалоба: причины, точное подтверждение, не голосование ----
  const badComplaint = await api(`/api/overheard/${postId2}/complaint`, { method: "POST", body: JSON.stringify({ category: "like_me_not" }) });
  ok("неверная причина жалобы → 400 (п.22)", badComplaint.status === 400);
  const complaint = await api(`/api/overheard/${postId2}/complaint`, { method: "POST", body: JSON.stringify({ category: "fraud", comment: "Проверка жалобы" }) });
  ok("жалоба отправлена с точным подтверждением (п.22)", complaint.status === 200 && complaint.data.note === "Жалоба отправлена. Спасибо. Модерация рассмотрит сообщение.");
  const adminQueue = await api(`/api/admin/overheard?token=${encodeURIComponent(tokenA)}&show=open`);
  const qHas = (adminQueue.data.complaints as { postId?: string }[] | undefined)?.some((c) => c.postId === postId2) ||
    (adminQueue.data.complaints as { post?: { id?: string } }[] | undefined)?.some((c) => c.post?.id === postId2);
  ok("жалоба видна человеку-модератору (п.16/22)", adminQueue.status === 200 && !!qHas);
  const firstComplaint = (adminQueue.data.complaints as { id: string }[])[0];
  const resolved = await api("/api/admin/overheard", { method: "POST", body: JSON.stringify({ token: tokenA, action: "resolve-complaint", id: firstComplaint?.id }) });
  ok("модератор закрывает жалобу (п.16)", resolved.status === 200);

  // ---- 16. Модерация: реклама скрывается, слух не скрывается ----
  const ad = await api("/api/overheard", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, title: "Продаю отличный телефон недорого", text: "Продаю новый телефон дешевле магазина, пишите в личку, обсудим цену и доставку по городу." }),
  });
  ok("реклама скрыта или на проверке человеку (п.16)", ad.status === 200 && (ad.data.hidden === true || ad.data.note?.toString().includes("проверку")), JSON.stringify(ad.data.note ?? ""));
  const feedAd = await api("/api/overheard?pageSize=50");
  const adInFeed = (feedAd.data.posts as Record<string, unknown>[]).some((p) => p.id === ad.data.id);
  ok("скрытая ИИ реклама не видна в публичной ленте (п.16)", ad.data.hidden === true ? !adInFeed : true, ad.data.hidden === true ? "скрыта" : "спорная — у человека");

  // ---- Лексика: блокировка с точным текстом (общий механизм сайта) ----
  const prof = await api("/api/overheard", {
    method: "POST",
    body: JSON.stringify({ token: tokenB, title: "Ты полный мудак", text: "Проверка блокировки оскорбительной лексики в разделе Подслушано." }),
  });
  ok("нецензурная лексика блокируется с точным текстом", prof.status === 400 && prof.data.error === "Сообщение содержит нецензурную или оскорбительную лексику. Пожалуйста, отредактируйте текст и попробуйте снова.");

  // ---- Мои публикации (п.8) ----
  const mine = await api(`/api/overheard?mine=1&token=${encodeURIComponent(tokenB)}`);
  const mineIds = (mine.data.posts as { id: string }[]).map((p) => p.id);
  ok("«Мои публикации» — только свои (п.8)", mine.status === 200 && mineIds.includes(postId2) && mineIds.includes(String(c1.data.id)) && !mineIds.includes(String(c2.data.id)));
  const mineAnon = await api("/api/overheard?mine=1");
  ok("«Мои публикации» без входа → 401", mineAnon.status === 401);

  // ---- 4. Удаление: только автор ----
  const delForeign = await api(`/api/overheard/${String(c1.data.id)}`, { method: "PATCH", body: JSON.stringify({ token: tokenA, action: "delete" }) });
  ok("чужое нельзя удалить → 403 (п.21)", delForeign.status === 403);
  const delOwn = await api(`/api/overheard/${String(c1.data.id)}`, { method: "PATCH", body: JSON.stringify({ token: tokenB, action: "delete" }) });
  ok("автор удаляет своё (п.21)", delOwn.status === 200);
  const feedAfterDel = await api("/api/overheard?pageSize=50");
  ok("удалённое исчезло из ленты (п.21)", !(feedAfterDel.data.posts as Record<string, unknown>[]).some((p) => p.id === c1.data.id));

  // ---- 21. Независимость от «Нужна помощи» и форума (п.23/24) ----
  const helpApi = await api("/api/help");
  ok("«Нужна помощь» работает независимо (п.21)", helpApi.status === 200 && Array.isArray(helpApi.data.requests));
  const forumTopics = await api("/api/topics");
  ok("форум работает независимо (п.24)", forumTopics.status === 200);
  const ovrTopics = await db.topic.count({ where: { rubric: { slug: "podslyshano-discuss" } } });
  ok("в специальной рубрике только темы раздела (2 создано тестом)", ovrTopics === 2, `найдено ${ovrTopics}`);

  // ---- Очистка ----
  console.log("\n… очистка тестовых данных");
  const myPostIds = [postId1, postId2, raceId, String(c1.data.id), String(c2.data.id), String(c3.data.id), String(ad.data.id)].filter(Boolean);
  const delPosts = await db.overheardPost.deleteMany({ where: { id: { in: myPostIds } } });
  // темы обсуждения удаляем по id (сообщения каскадом), включая тему из гонки
  const linked = await db.topic.findMany({ where: { OR: [{ id: topicId }, { id: raceTopicId }] } });
  for (const t of linked) {
    await db.message.deleteMany({ where: { topicId: t.id } });
    await db.topic.delete({ where: { id: t.id } });
  }
  const delComplaints = await db.overheardComplaint.deleteMany({ where: { postId: { in: myPostIds } } });
  const sanctions = await db.sanction.deleteMany({ where: { userId: userB!.id } });
  await db.session.deleteMany({ where: { userId: userB!.id } });
  await db.user.delete({ where: { id: userB!.id } });
  console.log(`  удалено: сообщений=${delPosts.count}, тем=${linked.length}, жалоб=${delComplaints.count}, санкций=${sanctions.count}`);
  const left = await db.overheardPost.count();
  console.log(`  остаток в разделе: ${left}`);

  console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
