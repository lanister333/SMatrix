/**
 * ШАГ 18: API-приёмка раздела «Где купить» (/gde-kupit).
 * Покрывает финальную проверку из ТЗ п.28 (API-уровень):
 *  Публикации: 1 создание; 2 конкретный товар; 3 слишком общий вопрос →
 *    подсказка; 4 редактирование; 5 удаление; 6 «Нашёл»; 7 «Неактуально»;
 *    8 возврат в «Ищу»; 9 сортировка (Ищу → Нашёл → Неактуально).
 *  Дубли: 10 похожий вопрос; 11 предупреждение о похожей публикации;
 *    12 возможность продолжить; 13 защита от повторной публикации;
 *    14 защита от двойного нажатия (гонка).
 *  Форум: 15 создание темы; 16 только одна тема; 17 повторное нажатие
 *    открывает существующую; 18 подраздел «Где купить»; 19 исходный вопрос
 *    в первом сообщении; 20 ссылка обратно; 21 «Тема закрыта»; 22 «Тема в архиве».
 *  Модерация: 23 реклама; 24 скрытая реклама/контекст ссылок (п.15);
 *    25 спам; 26 повторные публикации; 27 рекламные ответы — общесайтовая
 *    модерация форума (существует); 28 работа жалобы.
 *  Интерфейс: 29–34 — браузерная приёмка; 35 поиск (здесь API).
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

/** Создание тестового пользователя + сессии. */
const TAG = " wb"; // метка тестовых вопросов в тексте — автоочистка при падении прогона

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
  const marker = `wb${stamp}`; // латинский маркер тестовых вопросов (поиск)
  const smarker = `${marker}s`; // отдельный маркер блока сортировки

  // ---- Очистка остатков прерванных прошлых прогонов (по метке TAG) ----
  const leftovers = await db.whereToBuyPost.findMany({ where: { text: { contains: TAG } } });
  if (leftovers.length) {
    const lvIds = leftovers.map((p) => p.id);
    const lvTopics = await db.topic.findMany({ where: { whereToBuyPost: { id: { in: lvIds } } } });
    for (const t of lvTopics) {
      await db.message.deleteMany({ where: { topicId: t.id } });
      await db.topic.delete({ where: { id: t.id } });
    }
    await db.whereToBuyComplaint.deleteMany({ where: { postId: { in: lvIds } } });
    await db.whereToBuyPost.deleteMany({ where: { id: { in: lvIds } } });
    console.log(`  очищены остатки прошлого прогона: постов=${lvIds.length}, тем=${lvTopics.length}`);
  }
  const oldUsers = await db.user.findMany({ where: { nickname: { startsWith: "WhrTest_" } } });
  for (const u of oldUsers) {
    await db.sanction.deleteMany({ where: { userId: u.id } });
    await db.session.deleteMany({ where: { userId: u.id } });
    await db.user.delete({ where: { id: u.id } });
  }

  // ---- Тестовые пользователи ----
  const B = await makeUser(`WhrTest_${stamp}B`);
  const C = await makeUser(`WhrTest_${stamp}C`);
  const D = await makeUser(`WhrTest_${stamp}D`);
  ok("тестовые пользователи B/C/D созданы", !!B.user && !!C.user && !!D.user);

  // ---- Логин админа (аккаунт A); снимаем остаточные ai-санкции прошлых прогонов ----
  await clearAiSanctions((await db.user.findUnique({ where: { nickname: "Админ" } }))!.id);
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@sakhmatrix.ru", password: "Admin2026" }),
  });
  const tokenA: string = login.data.user?.token ?? "";
  const adminA = await db.user.findUnique({ where: { nickname: "Админ" } });
  ok("логин админа (аккаунт A)", !!tokenA);

  // ---- Гость: читать может, писать нет (ТЗ п.19) ----
  const anonRead = await api("/api/wheretobuy");
  ok("гость читает ленту → 200 (п.19)", anonRead.status === 200 && Array.isArray(anonRead.data.posts));
  const anonPost = await api("/api/wheretobuy", {
    method: "POST",
    body: JSON.stringify({ title: "Где купить дрель Bosch GSR 120?", text: "Гость не может опубликовать вопрос" }),
  });
  ok("гость не публикует → 401 (п.19)", anonPost.status === 401);

  // ---- 3. Слишком общий вопрос → подсказка, не молчаливая публикация (ТЗ п.4) ----
  const generic = await api("/api/wheretobuy", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, title: "Где купить аккумулятор?", text: "Подскажите, где купить обычный аккумулятор для машины." }),
  });
  ok("общий вопрос не публикуется молча (п.4)", generic.status === 422 && generic.data.needsSpecific === true);
  ok(
    "подсказка конкретности с примером (п.4)",
    generic.data.hint === "Укажите конкретный товар или модель. Например: Bosch S5 AGM 70 Ah.",
    JSON.stringify(generic.data.hint ?? "")
  );
  const advice = await api("/api/wheretobuy", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, title: "Посоветуйте хороший магазин электроники", text: "Какой магазин посоветуете?" }),
  });
  ok("вопрос «посоветуйте магазин» не подходит разделу (п.2)", advice.status === 422 && advice.data.needsSpecific === true);

  const T_BOSCH = "Где в Южно-Сахалинске купить аккумулятор Bosch S5 AGM 70 Ah?";
  const X_BOSCH = "Нужен именно Bosch S5 AGM 70 Ah, зелёный корпус. Если знаете, где есть в наличии, напишите, пожалуйста, в обсуждении на форуме." + TAG;

  // ---- 1/2. Создание вопроса о конкретном товаре ----
  const bosch = await api("/api/wheretobuy", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      title: T_BOSCH,
      text: X_BOSCH,
      place: "Южно-Сахалинск",
    }),
  });
  const boschId = String(bosch.data.id ?? "");
  ok("вопрос о конкретном товаре опубликован (п.1/2)", bosch.status === 200 && !!boschId, JSON.stringify(bosch.data.note ?? bosch.data.error ?? ""));
  ok("вопрос о конкретном товаре ИИ не скрывает (п.2/15)", bosch.data.hidden !== true);

  const feed1 = await api("/api/wheretobuy?q=bosch%20agm");
  const row1 = (feed1.data.posts as Record<string, unknown>[]).find((p) => p.id === boschId);
  ok(
    "вопрос в ленте: место/автор/дата/статус «Ищу» (п.2/20)",
    !!row1 && row1.place === "Южно-Сахалинск" && row1.authorName === "Админ" && row1.status === "seeking" && !!row1.createdAt,
    row1 ? "найден" : "не найден"
  );

  // ---- 6. Цена конкретного товара разрешена (ТЗ п.6) ----
  const price = await api("/api/wheretobuy", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      title: "Где купить зимние шины Nokian Hakkapeliitta 10 205/55 R16 и сколько стоят?",
      text: `Интересуют шины Nokian Hakkapeliitta 10 205/55 R16 и их цена сейчас в магазинах Сахалина ${marker}.` + TAG,
      place: "Холмск",
    }),
  });
  const priceId = String(price.data.id ?? "");
  ok("вопрос о цене конкретного товара разрешён (п.6)", price.status === 200 && price.data.hidden !== true, JSON.stringify(price.data.note ?? price.data.error ?? ""));

  // ---- 15. Ссылки/контакты в вопросе — контекст, не реклама (ТЗ п.15) ----
  const links = await api("/api/wheretobuy", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      title: "Где купить детское автокресло Cybex Solution T i-Fix?",
      text: "Нужно автокресло Cybex Solution T i-Fix, ростовая группа 2/3. Подскажите магазины или страницы товара на сайтах магазинов Сахалина." + TAG,
    }),
  });
  ok("ссылки/контакты в вопросе — не нарушение (п.15)", links.status === 200 && links.data.hidden !== true, JSON.stringify(links.data.note ?? links.data.error ?? ""));

  // ---- 10–12. Похожие публикации (ТЗ п.7) ----
  const mann = await api("/api/wheretobuy", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      title: "Где купить фильтр Mann C 35 154?",
      text: `Ищу масляный фильтр Mann C 35 154 на автомобиль, артикул ${marker}.` + TAG,
    }),
  });
  const mannId = String(mann.data.id ?? "");
  ok("первый вопрос про фильтр создан", mann.status === 200 && !!mannId, JSON.stringify(mann.data.error ?? ""));

  const mann2 = await api("/api/wheretobuy", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      title: "Где найти фильтр Mann C 35 154?",
      text: "Кто-нибудь видел в продаже масляный фильтр Mann C 35 154?" + TAG,
    }),
  });
  const sim = (mann2.data.similarPosts ?? []) as { id: string }[];
  ok("похожий вопрос обнаружен → предупреждение (п.7)", mann2.status === 200 && mann2.data.similar === true && sim.length > 0);
  ok("текст предупреждения по ТЗ (п.7)", mann2.data.hint === "Похожий вопрос уже опубликован. Возможно, ответ уже есть.");
  ok("предупреждение содержит ссылку на существующую публикацию (п.7)", sim.some((s) => s.id === mannId));

  // 12. Возможность продолжить публикацию
  const mann2b = await api("/api/wheretobuy", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      title: "Где найти фильтр Mann C 35 154?",
      text: "Кто-нибудь видел в продаже масляный фильтр Mann C 35 154?" + TAG,
      confirmSimilar: true,
    }),
  });
  const mann2bId = String(mann2b.data.id ?? "");
  ok("публикацию можно продолжить после предупреждения (п.7/28.12)", mann2b.status === 200 && !!mann2bId, JSON.stringify(mann2b.data.error ?? ""));

  // ---- 13. Защита от повторной публикации одного и того же (ТЗ п.17) ----
  const mann3 = await api("/api/wheretobuy", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      title: "Где найти фильтр Mann C 35 154?",
      text: "Кто-нибудь видел в продаже масляный фильтр Mann C 35 154?" + TAG,
      confirmSimilar: true,
    }),
  });
  ok(
    "точный повтор → отказ (п.17/28.13)",
    mann3.status === 400 && String(mann3.data.error ?? "").includes("уже публиковали"),
    JSON.stringify(mann3.data.error ?? "")
  );

  // ---- 4. Редактирование — только автор ----
  const editForeign = await api(`/api/wheretobuy/${mannId}`, {
    method: "PATCH",
    body: JSON.stringify({ token: B.token, action: "edit", title: "Где купить фильтр Mann C 35 154 в Корсакове?", text: "Чужая правка не должна пройти." }),
  });
  ok("чужое нельзя редактировать → 403 (п.9)", editForeign.status === 403);
  const editOwn = await api(`/api/wheretobuy/${mannId}`, {
    method: "PATCH",
    body: JSON.stringify({
      token: tokenA,
      action: "edit",
      title: "Где купить фильтр Mann C 35 154?",
      text: `Ищу масляный фильтр Mann C 35 154 на автомобиль, артикул ${marker}. Место уточнил: Корсаков.` + TAG,
      place: "Корсаков",
    }),
  });
  ok("автор редактирует вопрос (п.4)", editOwn.status === 200, JSON.stringify(editOwn.data?.error ?? ""));
  const mannAfter = (await api(`/api/wheretobuy?q=${marker}`)).data.posts as Record<string, unknown>[];
  const mannRow = mannAfter.find((p) => p.id === mannId);
  ok("правка применена и видна (место, изменено)", !!mannRow && mannRow.place === "Корсаков" && !!mannRow.editedAt);

  // ---- 5. Удаление — только автор ----
  const tmpD = await api("/api/wheretobuy", {
    method: "POST",
    body: JSON.stringify({ token: D.token, title: "Временный вопрос про насос Gardena 3000/4", text: `Тестовый вопрос про насос Gardena 3000/4 для удаления ${marker}.` + TAG, confirmSimilar: true }),
  });
  const tmpDId = String(tmpD.data.id ?? "");
  const delForeign = await api(`/api/wheretobuy/${tmpDId}`, { method: "PATCH", body: JSON.stringify({ token: tokenA, action: "delete" }) });
  ok("чужое нельзя удалить → 403 (п.9)", delForeign.status === 403);
  const delOwn = await api(`/api/wheretobuy/${tmpDId}`, { method: "PATCH", body: JSON.stringify({ token: D.token, action: "delete" }) });
  ok("автор удаляет свой вопрос (п.9)", delOwn.status === 200);
  const feedDel = await api("/api/wheretobuy?q=gardena");
  ok("удалённый вопрос исчез из ленты (п.9)", !(feedDel.data.posts as { id: string }[]).some((p) => p.id === tmpDId));

  // ---- 6–9. Статусы и сортировка (ТЗ п.8/9) ----
  const s1 = await api("/api/wheretobuy", { method: "POST", body: JSON.stringify({ token: B.token, title: `Где купить кофемолку Bosch TSM6A013B ${smarker} раз`, text: "Нужна кофемолка Bosch TSM6A013B, первая в тесте сортировки." + TAG, confirmSimilar: true }) });
  const s2 = await api("/api/wheretobuy", { method: "POST", body: JSON.stringify({ token: B.token, title: `Где купить кофемолку Bosch TSM6A013B ${smarker} два`, text: "Нужна кофемолка Bosch TSM6A013B, вторая в тесте сортировки." + TAG, confirmSimilar: true }) });
  const f1 = await api("/api/wheretobuy", { method: "POST", body: JSON.stringify({ token: B.token, title: `Где купить термос Arctix 102-500 ${smarker}`, text: "Ищу термос Arctix 102-500 для рыбалки." + TAG, confirmSimilar: true }) });
  const i1 = await api("/api/wheretobuy", { method: "POST", body: JSON.stringify({ token: B.token, title: `Где купить садовый измельчитель Viking GE 105 ${smarker}`, text: "Ищу измельчитель Viking GE 105, вопрос скоро закрою." + TAG, confirmSimilar: true }) });
  const s1Id = String(s1.data.id ?? ""), s2Id = String(s2.data.id ?? ""), f1Id = String(f1.data.id ?? ""), i1Id = String(i1.data.id ?? "");
  ok("4 вопроса для сортировки созданы", !!s1Id && !!s2Id && !!f1Id && !!i1Id);

  const stForeign = await api(`/api/wheretobuy/${f1Id}`, { method: "PATCH", body: JSON.stringify({ token: tokenA, action: "status", status: "found" }) });
  ok("статус меняет только автор → 403 (п.9)", stForeign.status === 403);
  const stFound = await api(`/api/wheretobuy/${f1Id}`, { method: "PATCH", body: JSON.stringify({ token: B.token, action: "status", status: "found" }) });
  ok("автор устанавливает «Нашёл» (п.9)", stFound.status === 200 && stFound.data.status === "found");
  const stIrr = await api(`/api/wheretobuy/${i1Id}`, { method: "PATCH", body: JSON.stringify({ token: B.token, action: "status", status: "irrelevant" }) });
  ok("автор устанавливает «Неактуально» (п.9)", stIrr.status === 200 && stIrr.data.status === "irrelevant");

  // 8. Возврат в «Ищу»
  const stBack = await api(`/api/wheretobuy/${f1Id}`, { method: "PATCH", body: JSON.stringify({ token: B.token, action: "status", status: "seeking" }) });
  ok("вопрос возвращается в «Ищу» (п.9)", stBack.status === 200 && stBack.data.status === "seeking");

  // Сортировка: в группе «Ищу» сначала новее созданный f1, затем s2, s1; затем «Неактуально»
  const sorted = await api(`/api/wheretobuy?q=${smarker}&pageSize=50`);
  const order = (sorted.data.posts as { id: string }[]).map((p) => p.id);
  ok("сортировка: Ищу → Нашёл → Неактуально, внутри группы новые сверху (п.8)",
    JSON.stringify(order) === JSON.stringify([f1Id, s2Id, s1Id, i1Id]), order.join(","));

  // 8б. Вопрос с «Нашёл»/«Неактуально» не удаляется и остаётся в поиске (п.25)
  const stFound2 = await api(`/api/wheretobuy/${f1Id}`, { method: "PATCH", body: JSON.stringify({ token: B.token, action: "status", status: "found" }) });
  const foundSearch = await api("/api/wheretobuy?q=Arctix");
  ok("«Нашёл» остаётся в разделе и доступен через поиск (п.25)", stFound2.status === 200 && (foundSearch.data.posts as { id: string }[]).some((p) => p.id === f1Id));

  // ---- Мои публикации ----
  const mine = await api(`/api/wheretobuy?mine=1&token=${encodeURIComponent(B.token)}`);
  const mineIds = (mine.data.posts as { id: string }[]).map((p) => p.id);
  ok("«Мои публикации» — свои вопросы со статусами (п.19)", mine.status === 200 && [s1Id, s2Id, f1Id, i1Id].every((id) => mineIds.includes(id)));
  const mineAnon = await api("/api/wheretobuy?mine=1");
  ok("«Мои публикации» без входа → 401", mineAnon.status === 401);

  // ---- Фильтр по месту ----
  const kmarker = `${marker}k`;
  const korsk = await api("/api/wheretobuy", { method: "POST", body: JSON.stringify({ token: C.token, title: "Где купить соковыжималку Bosch MES3500 в Корсакове", text: `Нужна соковыжималка Bosch MES3500 именно в Корсакове ${kmarker}.` + TAG, place: "Корсаков", confirmSimilar: true }) });
  ok("вопрос с местом создан", korsk.status === 200, JSON.stringify(korsk.data.error ?? ""));
  const byPlace = await api(`/api/wheretobuy?place=Корсаков&q=${kmarker}`);
  const bp = byPlace.data.posts as { place: string; title: string; isHiddenByAi?: boolean }[];
  ok("компактный фильтр по месту (п.19)", bp.length === 1 && bp[0].place === "Корсаков", `найдено=${bp.length} ${JSON.stringify(bp.map((x) => [x.title.slice(0, 30), x.place, x.isHiddenByAi]))}`);

  // ---- 35. Поиск: по модели и артикулу (п.24) ----
  const searchModel = await api("/api/wheretobuy?q=hakkapeliitta");
  ok("поиск по названию модели (п.24)", (searchModel.data.posts as { id: string }[]).some((p) => p.id === priceId));
  const searchArticle = await api("/api/wheretobuy?q=35%20154");
  ok("поиск по артикулу (п.24)", (searchArticle.data.posts as { id: string }[]).some((p) => p.id === mannId));
  const searchNone = await api("/api/wheretobuy?q=несуществующийтовар000");
  ok("поиск без результатов — пусто и корректно", searchNone.status === 200 && (searchNone.data.posts as unknown[]).length === 0);

  // ---- Пагинация: стабильные окна без пересечений (п.1/25) ----
  const p1 = await api("/api/wheretobuy?pageSize=2&page=1");
  const p2 = await api("/api/wheretobuy?pageSize=2&page=2");
  const p1Ids = (p1.data.posts as { id: string }[]).map((p) => p.id);
  const p2Ids = (p2.data.posts as { id: string }[]).map((p) => p.id);
  ok("пагинация: страницы без пересечений, total/pages корректны (п.1/25)",
    p1Ids.length === 2 && p2Ids.length >= 1 && !p1Ids.some((id) => p2Ids.includes(id)) &&
    p1.data.pages === Math.max(1, Math.ceil((p1.data.total as number) / 2)),
    `total=${p1.data.total}`);

  // ---- 15/18/19/20. Форумная тема: рубрика, первое сообщение, ссылка обратно ----
  const disc = await api(`/api/wheretobuy/${boschId}/discuss`, { method: "POST", body: JSON.stringify({ token: tokenA }) });
  const topicId = Number((disc.data ?? {}).topicId ?? 0);
  ok("«Обсудить на форуме» создаёт тему (п.15)", disc.status === 200 && (disc.data ?? {}).created === true && topicId > 0, JSON.stringify((disc.data ?? {}).error ?? ""));

  const topicRow = await db.topic.findUnique({ where: { id: topicId }, include: { rubric: { include: { parent: true } } } });
  ok("тема в подразделе «Обсуждение сообщений из блоков → Где купить» (п.18)",
    topicRow?.rubric?.slug === "wheretobuy-discuss" && topicRow?.rubric?.parent?.slug === "blocks-discuss",
    topicRow?.rubric?.slug ?? "—");
  const firstMsg = await db.message.findFirst({ where: { topicId }, orderBy: { num: "asc" } });
  ok("первое сообщение содержит исходный вопрос (п.19)",
    !!firstMsg && firstMsg.body.includes(T_BOSCH) && firstMsg.body.includes("именно Bosch S5 AGM 70 Ah"));
  ok("первое сообщение содержит ссылку «Источник: Где купить» (п.20)",
    !!firstMsg && firstMsg.body.includes("Источник: Где купить") && firstMsg.body.includes(`/gde-kupit?post=${boschId}`));

  const topicApi = await api(`/api/topics/${topicId}`);
  const wt = ((topicApi.data ?? {}).topic as Record<string, unknown> | undefined)?.wheretobuy as { id: string; title: string } | null;
  ok("двусторонняя связь: тема → вопрос (п.12/20)", topicApi.status === 200 && !!wt && wt.id === boschId, JSON.stringify(wt ?? topicApi.data));

  // ---- 16. Гонка: 5 одновременных нажатий → одна тема (п.11/16) ----
  const racePost = await api("/api/wheretobuy", {
    method: "POST",
    body: JSON.stringify({ token: D.token, title: "Где купить навигатор Garmin Drive 53", text: "Ищу навигатор Garmin Drive 53 в магазинах города." + TAG, confirmSimilar: true }),
  });
  const raceId = String(racePost.data.id ?? "");
  const raceResults = await Promise.all(
    [1, 2, 3, 4, 5].map(() => api(`/api/wheretobuy/${raceId}/discuss`, { method: "POST", body: JSON.stringify({ token: D.token }) }))
  );
  const raceTopicIds = new Set(raceResults.map((r) => Number(r.data.topicId ?? 0)));
  const raceTopicCount = await db.topic.count({ where: { whereToBuyPost: { id: raceId } } });
  ok("5 одновременных нажатий → создана ровно одна тема (п.11/16)", raceTopicIds.size === 1 && raceTopicCount === 1, `тем=${raceTopicCount}`);

  // ---- 17. Повторное нажатие открывает существующую тему ----
  const again = await api(`/api/wheretobuy/${boschId}/discuss`, { method: "POST", body: JSON.stringify({ token: tokenA }) });
  ok("повторное нажатие → та же тема, без дубля (п.11/17)", again.status === 200 && again.data.created === false && Number(again.data.topicId) === topicId);
  const againState = await api(`/api/wheretobuy/${boschId}/discuss`);
  ok("обновление страницы → состояние open (п.10)", againState.status === 200 && againState.data.state === "open");
  const boschFeed = await api("/api/wheretobuy?q=bosch%20agm");
  const boschRow = (boschFeed.data.posts as Record<string, unknown>[]).find((p) => p.id === boschId);
  ok("в ленте кнопка «Обсуждается на форуме» → topicState open (п.10)", !!boschRow && boschRow.topicState === "open");

  // ---- 21. «Тема закрыта» ----
  await db.topic.update({ where: { id: topicId }, data: { isClosed: true } });
  const closedState = await api(`/api/wheretobuy/${boschId}/discuss`);
  ok("закрытая тема → состояние closed (п.10)", closedState.data.state === "closed");
  // ---- 22. «Тема в архиве» ----
  await db.topic.update({ where: { id: topicId }, data: { isClosed: false, isArchived: true } });
  const archivedState = await api(`/api/wheretobuy/${boschId}/discuss`);
  ok("архивная тема → состояние archived (п.10)", archivedState.data.state === "archived");
  await db.topic.update({ where: { id: topicId }, data: { isArchived: false } });

  // ---- 23/24. Реклама скрывается ИИ; скрытая реклама/спам ----
  const ad = await api("/api/wheretobuy", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      title: "Продаю Bosch S5 AGM 70 Ah, покупайте у меня",
      text: "Продаю новый аккумулятор Bosch S5 AGM 70 Ah дешевле магазина, обращайтесь ко мне, звоните скорее, осталось мало!" + TAG,
      confirmSimilar: true,
    }),
  });
  ok("реклама «продаю… покупайте у меня» не проходит незамеченной — скрыта ИИ или ушла человеку (п.14/16/23)", ad.status === 200 && (ad.data.hidden === true || ad.data.needHuman === true), JSON.stringify(ad.data.note ?? ad.data.error ?? ""));
  const adInFeed = await api("/api/wheretobuy?q=осталось%20мало");
  ok("скрытая реклама не видна в публичной ленте (п.14)", ad.data.hidden === true ? (adInFeed.data.posts as unknown[]).length === 0 : true);
  await clearAiSanctions(adminA!.id);

  const spam = await api("/api/wheretobuy", {
    method: "POST",
    body: JSON.stringify({
      token: C.token,
      title: "ыыыыыыыыыы 12345 www ww",
      text: "ыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыы wb",
    }),
  });
  ok("бессмысленный спам не проходит незамеченной — скрыт ИИ или ушёл человеку (п.16/25)", spam.status === 200 && (spam.data.hidden === true || spam.data.needHuman === true), JSON.stringify(spam.data.note ?? spam.data.error ?? ""));
  await clearAiSanctions((await db.user.findUnique({ where: { nickname: C.user.nickname } }))!.id);

  // ---- 26. Повторяющиеся публикации — покрыто защитой точного повтора (п.17) ----

  // ---- 17б. Rate limit: разумное ограничение частоты (п.17) ----
  // У D уже 2 публикации (tmpD, racePost): строгий лимит = 6 публикаций/час,
  // поэтому седьмая реальная попытка (с confirmSimilar) получает 429.
  let rateLimited = false;
  let usedCount = 0;
  const fillerIds: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const rr = await api("/api/wheretobuy", {
      method: "POST",
      body: JSON.stringify({
        token: D.token,
        title: [
          "Где купить фен Dyson Supersonic HD08",
          "Где купить блендер Philips HR2220",
          "Где купить шуруповёрт Makita DF333DW",
          "Где купить роутер Keenetic Start KN-1112",
          "Где купить электрогриль Tefal GC242D",
        ][i - 1],
        text: [
          "Ищу фен Dyson Supersonic HD08, проверяю разумное ограничение частоты.",
          "Ищу блендер Philips HR2220, проверяю разумное ограничение частоты.",
          "Ищу шуруповёрт Makita DF333DW, проверяю разумное ограничение частоты.",
          "Ищу роутер Keenetic Start KN-1112, проверяю разумное ограничение частоты.",
          "Ищу электрогриль Tefal GC242D, проверяю разумное ограничение частоты.",
        ][i - 1] + TAG,
        confirmSimilar: true,
      }),
    });
    usedCount++;
    if (rr.data && typeof rr.data.id === "string") fillerIds.push(rr.data.id);
    if (rr.status === 429) { rateLimited = true; break; }
  }
  ok("частая публикация ограничена (п.17/28.26)", rateLimited, `попыток до лимита: ${usedCount}`);

  // ---- 28. Жалоба: 5 причин, сигнал модерации ----
  const badCat = await api(`/api/wheretobuy/${priceId}/complaint`, { method: "POST", body: JSON.stringify({ category: "лайки" }) });
  ok("недопустимая причина жалобы → 400", badCat.status === 400);
  const complaint = await api(`/api/wheretobuy/${priceId}/complaint`, { method: "POST", body: JSON.stringify({ category: "ad", comment: "Проверка жалобы модерацией", reporterName: "WhrTest" }) });
  ok("жалоба отправляется (п.18/28.28)", complaint.status === 200 && String(complaint.data.note ?? "").includes("Жалоба отправлена"));

  // ---- Очередь модератора (AI → человек) ----
  const queue = await api(`/api/admin/wheretobuy?token=${encodeURIComponent(tokenA)}&show=open`);
  const qComplaints = (queue.data.complaints ?? []) as Record<string, unknown>[];
  ok("жалоба видна человеку-модератору (п.16/28.28)", queue.status === 200 && qComplaints.some((c) => c.category === "ad" && (c.post as { id: string }).id === priceId));
  const firstComplaint = qComplaints.find((c) => (c.post as { id: string }).id === priceId) as { id: string } | undefined;
  if (firstComplaint) {
    const resolved = await api("/api/admin/wheretobuy", { method: "POST", body: JSON.stringify({ token: tokenA, action: "resolve-complaint", id: firstComplaint.id }) });
    ok("модератор закрывает жалобу", resolved.status === 200);
  }
  const noStaff = await api(`/api/admin/wheretobuy?token=${encodeURIComponent(B.token)}&show=open`);
  ok("не-сотрудник не видит очередь модерации", noStaff.status === 403);

  // ---- Независимость разделов (п.27) ----
  const helpApi = await api("/api/help");
  ok("«Нужна помощь» работает независимо (п.27)", helpApi.status === 200 && Array.isArray(helpApi.data.requests));
  const ovrApi = await api("/api/overheard");
  ok("«Подслушано Сахалин» работает независимо (п.27)", ovrApi.status === 200 && Array.isArray(ovrApi.data.posts));
  const forumTopics = await api("/api/topics");
  ok("форум работает независимо (п.27)", forumTopics.status === 200);
  const wtbRubricTopics = await db.topic.count({ where: { rubric: { slug: "wheretobuy-discuss" } } });
  ok("в подразделе «Где купить» только темы раздела (2 создано тестом)", wtbRubricTopics === 2, `найдено ${wtbRubricTopics}`);
  const ovrLeak = await db.topic.count({ where: { AND: [{ rubric: { slug: "podslyshano-discuss" } }, { whereToBuyPost: { isNot: null } }] } });
  ok("темы «Где купить» не попадают в рубрику «Подслушано» (п.27)", ovrLeak === 0);

  // ---- Очистка ----
  console.log("\n… очистка тестовых данных");
  const myPostIds = [boschId, priceId, mannId, mann2bId, s1Id, s2Id, f1Id, i1Id, tmpDId, raceId, String(korsk.data.id ?? ""), String(spam.data.id ?? ""), String(ad.data.id ?? ""), ...fillerIds].filter(Boolean);
  // темы обсуждения ищем ДО удаления постов: по связи и по подразделу раздела
  const linked = await db.topic.findMany({
    where: {
      OR: [
        { whereToBuyPost: { id: { in: myPostIds } } },
        { rubric: { slug: "wheretobuy-discuss" } },
      ],
    },
  });
  // физически удаляем тестовые посты (жалобы до удаления)
  await db.whereToBuyComplaint.deleteMany({ where: { postId: { in: myPostIds } } });
  const delPosts = await db.whereToBuyPost.deleteMany({ where: { id: { in: myPostIds } } });
  const topicIds = new Set<number>([...linked.map((t) => t.id), topicId, ...raceResults.map((r) => Number(r.data.topicId ?? 0))]);
  let deletedTopics = 0;
  for (const tid of topicIds) {
    if (!tid) continue;
    const t = await db.topic.findUnique({ where: { id: tid } });
    if (!t) continue;
    await db.message.deleteMany({ where: { topicId: tid } });
    await db.topic.delete({ where: { id: tid } });
    deletedTopics++;
  }
  for (const u of [B, C, D]) {
    await db.sanction.deleteMany({ where: { userId: u.user.id } });
    await db.session.deleteMany({ where: { userId: u.user.id } });
    await db.user.delete({ where: { id: u.user.id } });
  }
  await db.sanction.deleteMany({ where: { userId: adminA!.id, source: "ai" } });
  console.log(`  удалено: вопросов=${delPosts.count}, тем=${deletedTopics}`);
  const left = await db.whereToBuyPost.count();
  console.log(`  остаток в разделе: ${left}`);

  console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
