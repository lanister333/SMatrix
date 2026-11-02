/**
 * ШАГ 20: API-приёмка раздела «Рекомендую / Не рекомендую» (/rekomenduyu).
 * Покрывает: гостевой доступ; субъект и позицию; редактирование/удаление
 * только автором; смену позиции; сортировку Рекомендую → Не рекомендую;
 * «Мои публикации»; фильтр места; поиск; похожие публикации; точные повторы;
 * пагинацию; форумную связь (идемпотентность, рубрика, первое сообщение,
 * двусторонняя связь, состояния); ИИ-модерацию (заказная реклама, негативный
 * опыт разрешён, спам, вакансии в разделе работодателей — отдельно);
 * жалобы и очередь модератора. После проверки чистит за собой данные.
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
  try {
    const parsed = await r.json();
    if (parsed && typeof parsed === "object") data = parsed;
  } catch {}
  return { status: r.status, data };
}

const TAG = " Пишу как есть, делюсь личным опытом."; // естественная метка тестовых публикаций — автоочистка при падении прогона

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

async function clearAiSanctions(userId: string) {
  const { db } = await import("../src/lib/db");
  await db.sanction.deleteMany({ where: { userId, source: "ai" } });
  await db.user.update({ where: { id: userId }, data: { restrictedUntil: null } });
}

async function main() {
  const { db } = await import("../src/lib/db");
  const stamp = Date.now().toString(36);
  const SMARK = "сапфир"; // естественное слово-метка блока сортировки

  // ---- Очистка остатков прерванных прошлых прогонов ----
  const leftovers = await db.recPost.findMany({ where: { text: { contains: TAG } } });
  if (leftovers.length) {
    const lvIds = leftovers.map((p) => p.id);
    const lvTopics = await db.topic.findMany({ where: { recPost: { id: { in: lvIds } } } });
    if (lvTopics.length) {
      await db.message.deleteMany({ where: { topicId: { in: lvTopics.map((t) => t.id) } } });
      await db.topic.deleteMany({ where: { id: { in: lvTopics.map((t) => t.id) } } });
    }
    await db.recComplaint.deleteMany({ where: { postId: { in: lvIds } } });
    await db.recPost.deleteMany({ where: { id: { in: lvIds } } });
    console.log(`  очищены остатки прошлого прогона: постов=${lvIds.length}, тем=${lvTopics.length}`);
  }
  const oldUsers = await db.user.findMany({ where: { nickname: { startsWith: "RcTest_" } } });
  for (const u of oldUsers) {
    // FK-безопасная зачистка контента старых аккаунтов (RecPost.author —
    // required + NoAction, блокирует удаление пользователя).
    const uPosts = await db.recPost.findMany({ where: { authorId: u.id } });
    const uPostIds = uPosts.map((p) => p.id);
    const uTopicIds = uPosts.map((p) => p.topicId).filter((v): v is number => v != null);
    if (uTopicIds.length) {
      await db.message.deleteMany({ where: { topicId: { in: uTopicIds } } });
      await db.topic.deleteMany({ where: { id: { in: uTopicIds } } });
    }
    await db.recUsefulVote.deleteMany({ where: { postId: { in: uPostIds } } });
    await db.recComplaint.deleteMany({ where: { postId: { in: uPostIds } } });
    await db.recPost.deleteMany({ where: { authorId: u.id } });
    await db.sanction.deleteMany({ where: { userId: u.id } });
    await db.session.deleteMany({ where: { userId: u.id } });
    await db.user.delete({ where: { id: u.id } }).catch(() => {
      console.log(`  (не удалось удалить старый аккаунт ${u.nickname} — пропущен)`);
    });
  }

  // ---- Тестовые пользователи ----
  const B = await makeUser(`RcTest_${stamp}B`);
  const C = await makeUser(`RcTest_${stamp}C`);
  const D = await makeUser(`RcTest_${stamp}D`);
  console.log(`  пользователи B/C/D: ${!!B.user && !!C.user && !!D.user ? "ок" : "ОШИБКА"}`);

  await clearAiSanctions((await db.user.findUnique({ where: { nickname: "Админ" } }))!.id);
  // Сессия админа создаётся прямо в БД: тест не должен зависеть от пароля
  // админа в dev-окружении (пароль мог быть изменён вне теста).
  const adminA0 = await db.user.findUnique({ where: { nickname: "Админ" } });
  const { newToken } = await import("../src/lib/auth");
  const tokenA: string = adminA0 ? newToken() : "";
  if (adminA0 && tokenA) await db.session.create({ data: { token: tokenA, userId: adminA0.id } });
  const adminA = adminA0;
  console.log(`  сессия админа: ${tokenA ? "ок" : "ОШИБКА"}`);

  // Публичная лента видна без входа — проверим ниже после создания публикаций.
  // ---- Гость: читать может, писать нет ----
  const anonRead = await api("/api/recommend");
  ok("гость читает ленту → 200", anonRead.status === 200 && Array.isArray(anonRead.data.posts));
  const anonPost = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({ subject: "Кофейня на Ленина", title: "Гость не может опубликовать отзыв", text: "Проверка гостевого доступа к публикации" }),
  });
  ok("гость не публикует → 401", anonPost.status === 401);

  // ---- Субъект обязателен ----
  const noSubject = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, title: "Публикация без субъекта не проходит", text: "Здесь должен быть указан субъект публикации." }),
  });
  ok("публикация без субъекта → 422 needsSubject", noSubject.status === 422 && noSubject.data.needsSubject === true);
  ok("подсказка субъекта по ТЗ", noSubject.data.hint === "Укажите, кого вы рекомендуете или не рекомендуете: конкретную организацию, компанию, сервис или место.");

  // ---- Валидации полей ----
  const shortTitle = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, subject: "Ателье на Сахарной", title: "Крут", text: "Слишком короткий заголовок не проходит проверку длины." }),
  });
  ok("заголовок короче 5 символов → 400", shortTitle.status === 400);
  const longTitle = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, subject: "Ателье на Сахарной", title: "Д".repeat(151), text: "Слишком длинный заголовок не проходит проверку длины." }),
  });
  ok("заголовок длиннее 150 символов → 400", longTitle.status === 400);
  const shortText = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, subject: "Ателье на Сахарной", title: "Нормальный заголовок про ателье", text: "Коротко." }),
  });
  ok("текст короче 10 символов → 400", shortText.status === 400);
  const longSubject = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, subject: "О".repeat(140), stance: "recommend", title: "Проверка обрезки длинного названия субъекта", text: "Субъект длиннее 120 символов обрезается до лимита, публикация создаётся." + TAG, confirmSimilar: true }),
  });
  const longSubjectId = String(longSubject.data.id ?? "");
  const longSubjectRow = ((await api("/api/recommend?q=обрезки")).data.posts as Record<string, unknown>[]).find((p) => p.id === longSubjectId);
  ok("субъект обрезается до 120 символов", longSubject.status === 200 && String(longSubjectRow?.subject ?? "").length === 120);

  // ---- Создание: рекомендую ----
  const rec1 = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      subject: "Химчистка «Чистый берег» на Сахалинской",
      stance: "recommend",
      title: "Привели в порядок диван после кота — рекомендую",
      text: `Обратились в химчистку «Чистый берег»: приехали вовремя, диван после кота спасли, запаха нет. Цена как договаривались. Рекомендую.` + TAG,
      place: "Южно-Сахалинск",
    }),
  });
  const rec1Id = String(rec1.data.id ?? "");
  ok("публикация «Рекомендую» создана, ИИ не скрывает", rec1.status === 200 && !!rec1Id && rec1.data.hidden !== true, JSON.stringify(rec1.data.note ?? rec1.data.error ?? ""));

  const rec1Row = ((await api("/api/recommend?q=химчистка")).data.posts as Record<string, unknown>[]).find((p) => p.id === rec1Id);
  ok("публикация в ленте: субъект/позиция/место/автор/дата", !!rec1Row && rec1Row.subject === "Химчистка «Чистый берег» на Сахалинской" && rec1Row.stance === "recommend" && rec1Row.place === "Южно-Сахалинск" && rec1Row.authorName === "Админ" && !!rec1Row.createdAt, rec1Row ? "найдена" : "не найдена");

  // ---- Создание: не рекомендую ----
  const rec2 = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      subject: "Такси «Быстрое» городское",
      stance: "notrecommend",
      title: "Ждали машину сорок минут, приложение сломалось — не рекомендую",
      text: `Заказывали такси «Быстрое» на вокзал: машина не приехала сорок минут, диспетчеры грубят, приложение показывает машину на другом конце города. Не рекомендую.` + TAG,
    }),
  });
  const rec2Id = String(rec2.data.id ?? "");
  ok("публикация «Не рекомендую» создана, ИИ не скрывает", rec2.status === 200 && !!rec2Id && rec2.data.hidden !== true, JSON.stringify(rec2.data.note ?? rec2.data.error ?? ""));
  const rec2Row = ((await api("/api/recommend?q=такси")).data.posts as Record<string, unknown>[]).find((p) => p.id === rec2Id);
  ok("строка «Не рекомендую» в ленте: субъект/позиция", !!rec2Row && rec2Row.subject === "Такси «Быстрое» городское" && rec2Row.stance === "notrecommend", rec2Row ? "найдена" : "не найдена");

  // ---- Критика организации — НЕ нарушение (суть раздела) ----
  const critique = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      subject: "Управляющая компания «Подгорная», участок Холмска",
      stance: "notrecommend",
      title: "Крышу не чинят третий год, отписки — не советую эту УК",
      text: `Три года пишем заявки о протекающей крыше — отписки и «нет финансирования». При этом взносы собирают исправно. Не рекомендую связываться с этой УК, ищите другую.` + TAG,
      place: "Холмск",
    }),
  });
  const critiqueId = String(critique.data.id ?? "");
  ok("жёсткая критика организации — не нарушение (суть раздела)", critique.status === 200 && !!critiqueId && critique.data.hidden !== true, JSON.stringify(critique.data.note ?? critique.data.error ?? ""));

  // ---- Редактирование: только автор ----
  const editForeign = await api(`/api/recommend/${rec1Id}`, {
    method: "PATCH",
    body: JSON.stringify({ token: B.token, action: "edit", subject: "Чужая правка", title: "Чужая правка не должна пройти", text: "Чужая правка не должна пройти проверку авторства." }),
  });
  ok("чужое нельзя редактировать → 403", editForeign.status === 403);
  const editOwn = await api(`/api/recommend/${rec1Id}`, {
    method: "PATCH",
    body: JSON.stringify({
      token: tokenA,
      action: "edit",
      subject: "Химчистка «Чистый берег» на Сахалинской",
      title: "Привели в порядок диван после кота — рекомендую",
      text: `Обратились в химчистку «Чистый берег»: приехали вовремя, диван после кота спасли, запаха нет. Цена как договаривались. Через месяц позвонили, уточнили, всё ли в порядке. Рекомендую.` + TAG,
      place: "Южно-Сахалинск",
    }),
  });
  ok("автор редактирует публикацию", editOwn.status === 200, JSON.stringify(editOwn.data?.error ?? ""));
  const rec1After = ((await api("/api/recommend?q=химчистка")).data.posts as Record<string, unknown>[]).find((p) => p.id === rec1Id);
  ok("правка применена и видна (текст дополнен, изменено)", !!rec1After && String(rec1After.text).includes("Через месяц позвонили") && !!rec1After.editedAt);

  // ---- Смена позиции ----
  const stForeign = await api(`/api/recommend/${rec1Id}`, { method: "PATCH", body: JSON.stringify({ token: B.token, action: "stance", stance: "notrecommend" }) });
  ok("позицию меняет только автор → 403", stForeign.status === 403);
  const stSwitch = await api(`/api/recommend/${rec1Id}`, { method: "PATCH", body: JSON.stringify({ token: tokenA, action: "stance", stance: "notrecommend" }) });
  ok("автор меняет позицию на «Не рекомендую»", stSwitch.status === 200 && stSwitch.data.stance === "notrecommend", JSON.stringify(stSwitch.data.note ?? ""));
  ok("записка смены позиции по ТЗ", stSwitch.data.note === "Позиция изменена: «Не рекомендую»", JSON.stringify(stSwitch.data.note ?? ""));
  const rec1Stance = ((await api("/api/recommend?q=химчистка")).data.posts as Record<string, unknown>[]).find((p) => p.id === rec1Id);
  ok("новая позиция видна в ленте", !!rec1Stance && rec1Stance.stance === "notrecommend");
  const stBack = await api(`/api/recommend/${rec1Id}`, { method: "PATCH", body: JSON.stringify({ token: tokenA, action: "stance", stance: "recommend" }) });
  ok("автор возвращает «Рекомендую»", stBack.status === 200 && stBack.data.stance === "recommend");

  // ---- Удаление: только автор ----
  const tmpD = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({ token: D.token, subject: "Ателье «Игла» на Пионерской", title: "Временная публикация для удаления", text: "Тестовая публикация ателье для проверки удаления, временная." + TAG, confirmSimilar: true }),
  });
  const tmpDId = String(tmpD.data.id ?? "");
  const delForeign = await api(`/api/recommend/${tmpDId}`, { method: "PATCH", body: JSON.stringify({ token: tokenA, action: "delete" }) });
  ok("чужое нельзя удалить → 403", delForeign.status === 403);
  const delOwn = await api(`/api/recommend/${tmpDId}`, { method: "PATCH", body: JSON.stringify({ token: D.token, action: "delete" }) });
  ok("автор удаляет свою публикацию", delOwn.status === 200);
  const feedDel = await api("/api/recommend?q=ателье");
  ok("удалённая публикация исчезла из ленты", !(feedDel.data.posts as { id: string }[]).some((p) => p.id === tmpDId));

  // ---- Сортировка: Рекомендую → Не рекомендую, внутри новые сверху ----
  const p1 = await api("/api/recommend", { method: "POST", body: JSON.stringify({ token: B.token, subject: `Пекарня «Колосок», проспект Мира ${SMARK}`, stance: "recommend", title: `Свежие булочки к семи утра ${SMARK} раз`, text: "Пекарня печёт свежие булочки к открытию, первая публикация в тесте сортировки." + TAG, confirmSimilar: true }) });
  const p2 = await api("/api/recommend", { method: "POST", body: JSON.stringify({ token: B.token, subject: `Пекарня «Колосок», проспект Мира ${SMARK}`, stance: "recommend", title: `Свежие булочки к семи утра ${SMARK} два`, text: "Пекарня печёт свежие булочки к открытию, вторая публикация в тесте сортировки." + TAG, confirmSimilar: true }) });
  const n1 = await api("/api/recommend", { method: "POST", body: JSON.stringify({ token: B.token, subject: `Шиномонтаж «Колесо», объездная ${SMARK}`, stance: "notrecommend", title: `Сорвали колесо при монтаже ${SMARK}`, text: "Шиномонтаж повредил диск при монтаже, цену за замену не признают." + TAG, confirmSimilar: true }) });
  const p1Id = String(p1.data.id ?? ""), p2Id = String(p2.data.id ?? ""), n1Id = String(n1.data.id ?? "");
  console.log(`  3 публикации для сортировки: ${!!p1Id && !!p2Id && !!n1Id ? "ок" : "ОШИБКА"}`);
  if (!p1Id || !p2Id || !n1Id) {
    for (const [name, r] of [["p1", p1], ["p2", p2], ["n1", n1]] as const) {
      if (!String(r.data.id ?? "")) console.log(`  [diag] ${name}: status=${r.status} data=${JSON.stringify(r.data).slice(0, 220)}`);
    }
  }

  const sorted = await api(`/api/recommend?q=${SMARK}&pageSize=50`);
  const order = (sorted.data.posts as { id: string; stance: string }[]).map((p) => p.id);
  ok("сортировка: Рекомендую → Не рекомендую, внутри группы новые сверху", JSON.stringify(order) === JSON.stringify([p2Id, p1Id, n1Id]), order.join(","));
  const sortedStances = (sorted.data.posts as { stance: string }[]).map((p) => p.stance);
  ok("порядок позиций в ленте: обе «Рекомендую» выше «Не рекомендую»", sortedStances[sortedStances.length - 1] === "notrecommend" && sortedStances.slice(0, 2).every((s) => s === "recommend"));

  // ---- «Мои публикации» ----
  const mine = await api(`/api/recommend?mine=1&token=${encodeURIComponent(B.token)}`);
  const mineIds = (mine.data.posts as { id: string }[]).map((p) => p.id);
  ok("«Мои публикации» — свои публикации с позициями", mine.status === 200 && [p1Id, p2Id, n1Id].every((id) => mineIds.includes(id)));
  const mineAnon = await api("/api/recommend?mine=1");
  ok("«Мои публикации» без входа → 401", mineAnon.status === 401);
  const mineOrder = (mine.data.posts as { id: string; stance: string }[]).map((p) => p.id);
  ok("в «Моих публикациях» та же сортировка (Рекомендую выше, новые сверху)", mineOrder[0] === p2Id && mineOrder[mineOrder.length - 1] === n1Id, mineOrder.join(","));

  // ---- Фильтр по месту ----
  const korsk = await api("/api/recommend", { method: "POST", body: JSON.stringify({ token: C.token, subject: "Фитнес-зал «Атлант» в Корсакове", stance: "recommend", title: "Зал чистый, тренер внимательный — рекомендую", text: "Хожу в фитнес-зал «Атлант» полгода: чисто, тренер составляет программу, душ работает. Рекомендую корсаковцам.", place: "Корсаков", confirmSimilar: true }) });
  const korskId = String(korsk.data.id ?? "");
  console.log(`  публикация с местом: ${korsk.status === 200 ? "ок" : JSON.stringify(korsk.data.error ?? "")}`);
  const byPlace = await api(`/api/recommend?place=${encodeURIComponent("Корсаков")}&q=атлант`);
  const bp = byPlace.data.posts as { place: string }[];
  ok("фильтр по месту", bp.length === 1 && bp[0].place === "Корсаков", `найдено=${bp.length}`);

  // ---- Поиск ----
  const searchSubject = await api("/api/recommend?q=химчистка");
  ok("поиск по названию организации", (searchSubject.data.posts as { id: string }[]).some((p) => p.id === rec1Id));
  const searchText = await api("/api/recommend?q=диспетчеры");
  ok("поиск по слову из текста", (searchText.data.posts as { id: string }[]).some((p) => p.id === rec2Id));
  const searchNone = await api("/api/recommend?q=несуществующаяорганизация000");
  ok("поиск без результатов — пусто и корректно", searchNone.status === 200 && (searchNone.data.posts as unknown[]).length === 0);
  const searchPlace = await api(`/api/recommend?place=${encodeURIComponent("Южно-Сахалинск")}&q=химчистка`);
  ok("поиск вместе с фильтром места", (searchPlace.data.posts as { id: string }[]).some((p) => p.id === rec1Id));

  // ---- Похожие публикации ----
  const rec3 = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      subject: "Химчистка «Чистый берег», приёмный пункт на Сахалинской",
      stance: "recommend",
      title: "Почистили ковёр быстро, рекомендую химчистку",
      text: "Сдали в химчистку «Чистый берег» большой ковёр — забрали в тот же день, пятна ушли." + TAG,
    }),
  });
  const sim = (rec3.data.similarPosts ?? []) as { id: string }[];
  ok("похожая публикация обнаружена → предупреждение", rec3.status === 200 && rec3.data.similar === true && sim.length > 0);
  ok("текст предупреждения по ТЗ", rec3.data.hint === "Похожая публикация уже есть. Возможно, о вас уже писали.");
  ok("предупреждение содержит ссылку на существующую публикацию", sim.some((s) => s.id === rec1Id));
  const rec3b = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      subject: "Химчистка «Чистый берег», приёмный пункт на Сахалинской",
      stance: "recommend",
      title: "Почистили ковёр быстро, рекомендую химчистку",
      text: "Сдали в химчистку «Чистый берег» большой ковёр — забрали в тот же день, пятна ушли." + TAG,
      confirmSimilar: true,
    }),
  });
  const rec3Id = String(rec3b.data.id ?? "");
  ok("публикацию можно продолжить после предупреждения", rec3b.status === 200 && !!rec3Id, JSON.stringify(rec3b.data.error ?? ""));

  // ---- Точный повтор ----
  const dup = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      subject: "Химчистка «Чистый берег», приёмный пункт на Сахалинской",
      stance: "recommend",
      title: "Почистили ковёр быстро, рекомендую химчистку",
      text: "Сдали в химчистку «Чистый берег» большой ковёр — забрали в тот же день, пятна ушли." + TAG,
      confirmSimilar: true,
    }),
  });
  ok("точный повтор → отказ", dup.status === 400 && String(dup.data.error ?? "").includes("уже публиковали"), JSON.stringify(dup.data.error ?? ""));
  const dup2 = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      subject: "Химчистка «Чистый берег», приёмный пункт на Сахалинской",
      stance: "notrecommend",
      title: "Почистили ковёр быстро, рекомендую химчистку",
      text: "Сдали в химчистку «Чистый берег» большой ковёр — забрали в тот же день, пятна ушли." + TAG,
      confirmSimilar: true,
    }),
  });
  ok("повтор заголовка даже с другой позицией → отказ", dup2.status === 400);

  // ---- Пагинация ----
  const pg1 = await api("/api/recommend?pageSize=2&page=1");
  const pg2 = await api("/api/recommend?pageSize=2&page=2");
  const pg1Ids = (pg1.data.posts as { id: string }[]).map((p) => p.id);
  const pg2Ids = (pg2.data.posts as { id: string }[]).map((p) => p.id);
  ok("пагинация: страницы без пересечений, total/pages корректны",
    pg1Ids.length === 2 && pg2Ids.length >= 1 && !pg1Ids.some((id) => pg2Ids.includes(id)) &&
    pg1.data.pages === Math.max(1, Math.ceil((pg1.data.total as number) / 2)),
    `total=${pg1.data.total}`);
  const pgFar = await api("/api/recommend?pageSize=2&page=99");
  ok("страница за пределами → пусто и корректно", pgFar.status === 200 && (pgFar.data.posts as unknown[]).length === 0);

  // ---- Форумная связь ----
  const T_FORUM = "Химчистка «Чистый берег» на Сахалинской";
  const disc = await api(`/api/recommend/${rec1Id}/discuss`, { method: "POST", body: JSON.stringify({ token: tokenA }) });
  const topicId = Number((disc.data ?? {}).topicId ?? 0);
  ok("«Обсудить на форуме» создаёт тему", disc.status === 200 && (disc.data ?? {}).created === true && topicId > 0, JSON.stringify((disc.data ?? {}).error ?? ""));

  const topicRow = await db.topic.findUnique({ where: { id: topicId }, include: { rubric: { include: { parent: true } } } });
  ok("тема в подразделе «Обсуждение сообщений из блоков → Рекомендую / Не рекомендую»",
    topicRow?.rubric?.slug === "recommend-discuss" && topicRow?.rubric?.parent?.slug === "blocks-discuss",
    topicRow?.rubric?.slug ?? "—");
  const firstMsg = await db.message.findFirst({ where: { topicId }, orderBy: { num: "asc" } });
  ok("первое сообщение содержит исходную публикацию", !!firstMsg && firstMsg.body.includes(T_FORUM) && firstMsg.body.includes("Через месяц позвонили"));
  ok("первое сообщение содержит ссылку «Источник: Рекомендую / Не рекомендую»",
    !!firstMsg && firstMsg.body.includes("Источник: Рекомендую / Не рекомендую") && firstMsg.body.includes(`/rekomenduyu?post=${rec1Id}`));
  ok("первое сообщение содержит позицию автора", !!firstMsg && firstMsg.body.includes("Рекомендую)"));

  const topicApi = await api(`/api/topics/${topicId}`);
  const rc = ((topicApi.data ?? {}).topic as Record<string, unknown> | undefined)?.recommend as { id: string; title: string } | null;
  ok("двусторонняя связь: тема → публикация", topicApi.status === 200 && !!rc && rc.id === rec1Id, JSON.stringify(rc ?? topicApi.data));

  // ---- Гонка: 5 одновременных нажатий → одна тема ----
  const racePost = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({ token: D.token, subject: "Мебельный цех «Сосна» на Ельничной", stance: "recommend", title: "Кухню сделали точно в срок", text: "Заказывали кухню в мебельном цехе «Сосна» — сделали точно в срок, фурнитура как договаривались." + TAG, confirmSimilar: true }),
  });
  const raceId = String(racePost.data.id ?? "");
  const raceResults = await Promise.all(
    [1, 2, 3, 4, 5].map(() => api(`/api/recommend/${raceId}/discuss`, { method: "POST", body: JSON.stringify({ token: D.token }) }))
  );
  const raceTopicIds = new Set(raceResults.map((r) => Number(r.data.topicId ?? 0)));
  const raceTopicCount = await db.topic.count({ where: { recPost: { id: raceId } } });
  ok("5 одновременных нажатий → создана ровно одна тема", raceTopicIds.size === 1 && raceTopicCount === 1, `тем=${raceTopicCount}`);
  const raceAgain = await api(`/api/recommend/${raceId}/discuss`, { method: "POST", body: JSON.stringify({ token: D.token }) });
  ok("повторное нажатие у «гонки» → существующая тема, created=false", raceAgain.status === 200 && raceAgain.data.created === false);

  // ---- Повторное нажатие ----
  const again = await api(`/api/recommend/${rec1Id}/discuss`, { method: "POST", body: JSON.stringify({ token: tokenA }) });
  ok("повторное нажатие → та же тема, без дубля", again.status === 200 && again.data.created === false && Number(again.data.topicId) === topicId);
  const againState = await api(`/api/recommend/${rec1Id}/discuss`);
  ok("обновление страницы → состояние open", againState.status === 200 && againState.data.state === "open");
  const rec1Feed = ((await api("/api/recommend?q=химчистка")).data.posts as Record<string, unknown>[]).find((p) => p.id === rec1Id);
  ok("в ленте кнопка «Обсуждается на форуме» → topicState open", !!rec1Feed && rec1Feed.topicState === "open");

  // ---- Состояния темы ----
  await db.topic.update({ where: { id: topicId }, data: { isClosed: true } });
  const closedState = await api(`/api/recommend/${rec1Id}/discuss`);
  ok("закрытая тема → состояние closed", closedState.data.state === "closed");
  await db.topic.update({ where: { id: topicId }, data: { isClosed: false, isArchived: true } });
  const archivedState = await api(`/api/recommend/${rec1Id}/discuss`);
  ok("архивная тема → состояние archived", archivedState.data.state === "archived");
  await db.topic.update({ where: { id: topicId }, data: { isArchived: false } });

  // ---- ИИ-модерация: заказная реклама ----
  const ad = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      subject: "Студия маникюра от мастера Надежды",
      stance: "recommend",
      title: "Лучший маникюр только у нас, спешите записаться",
      text: "Девочки, лучший маникюр в городе делает моя студия! Записывайтесь скорее по телефону, мест на этой неделе почти нет, только для своих!" + TAG,
      confirmSimilar: true,
    }),
  });
  ok("заказная реклама «только у нас, записывайтесь» — скрыта ИИ или ушла человеку", ad.status === 200 && (ad.data.hidden === true || ad.data.needHuman === true), JSON.stringify(ad.data.note ?? ad.data.error ?? ""));
  const adInFeed = await api("/api/recommend?q=маникюр");
  ok("скрытая реклама не видна в публичной ленте", ad.data.hidden === true ? (adInFeed.data.posts as unknown[]).length === 0 : true);
  const queueAi = await api(`/api/admin/recommend?token=${encodeURIComponent(tokenA)}&show=open`);
  const qQueue = (queueAi.data.queue ?? []) as Record<string, unknown>[];
  ok("скрытая ИИ публикация в очереди модератора", queueAi.status === 200 && qQueue.some((q) => q.isHiddenByAi === true));
  await clearAiSanctions(adminA!.id);

  // ---- ИИ-модерация: личные данные третьих лиц ----
  const pd = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({
      token: C.token,
      subject: "Продуктовый магазин у рынка",
      stance: "notrecommend",
      title: "Продавец Ирина Петровна хамит покупателям",
      text: "Продавец Ирина Петровна постоянно грубит, звоните ей на номер 8-800-000-00-00 и жалуйтесь, вот её адрес: улица Полевая, 7." + TAG,
      confirmSimilar: true,
    }),
  });
  ok("ФИО и телефон третьего лица — скрыто ИИ или ушло человеку", pd.status === 200 && (pd.data.hidden === true || pd.data.needHuman === true), JSON.stringify(pd.data.note ?? pd.data.error ?? ""));
  const mineAdmin = await api(`/api/recommend?mine=1&token=${encodeURIComponent(tokenA)}`);
  const mineAdminRow = (mineAdmin.data.posts as Record<string, unknown>[]).find((p) => String(p.id) === String(ad.data.id ?? ""));
  ok("автор видит скрытую/спорную ИИ публикацию в «Моих» с причиной",
    !!mineAdminRow && ((mineAdminRow.isHiddenByAi === true && !!mineAdminRow.hiddenReason) || mineAdminRow.needHuman === true),
    mineAdminRow ? `hidden=${mineAdminRow.isHiddenByAi} human=${mineAdminRow.needHuman}` : "не найдена");
  // Детерминация ИИ-дрейфа: если реклама не скрыта, прячет человек-модератор
  if (mineAdminRow && mineAdminRow.isHiddenByAi !== true) {
    const modHide = await api("/api/admin/recommend", { method: "POST", body: JSON.stringify({ token: tokenA, action: "hide-post", id: String(ad.data.id ?? "") }) });
    console.log(`  детерминация: реклама скрыта модератором (${modHide.status})`);
  }
  await clearAiSanctions((await db.user.findUnique({ where: { nickname: C.user.nickname } }))!.id);

  // ---- ИИ-модерация: обычные публикации проходят ----
  const neutral = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({
      token: B.token,
      subject: "Столовая на Комсомольской, бизнес-ланч",
      stance: "recommend",
      title: "Бизнес-ланч за триста рублей — рекомендую столовую",
      text: "Обедаю в столовой на Комсомольской уже месяц: бизнес-ланч за триста рублей, салаты свежие, официанты быстрые. Телефон и сайт есть на вывеске, находится в двух шагах от остановки. Рекомендую." + TAG,
      confirmSimilar: true,
    }),
  });
  ok("обычная рекомендация с упоминанием телефона организации — не нарушение", neutral.status === 200 && neutral.data.hidden !== true, JSON.stringify(neutral.data.note ?? neutral.data.error ?? ""));

  // ---- ИИ-модерация: спам ----
  const spam = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({
      token: D.token,
      subject: "Магазин всего дёшево",
      title: "Распродажа распродажа распродажа всё дёшево",
      text: "Только сегодня только сейчас супер распродажа всего дёшево заходите на сайт primershop-today.example покупайте всё дёшево только сегодня только сейчас супер цены скидки скидки скидки спешите дёшево всё по низкой цене",
      confirmSimilar: true,
    }),
  });
  ok("бессмысленный спам — скрыт ИИ или ушёл человеку", spam.status === 200 && (spam.data.hidden === true || spam.data.needHuman === true), JSON.stringify(spam.data.note ?? spam.data.error ?? ""));
  await clearAiSanctions((await db.user.findUnique({ where: { nickname: D.user.nickname } }))!.id);

  // ---- Жалобы ----
  const badCat = await api(`/api/recommend/${rec2Id}/complaint`, { method: "POST", body: JSON.stringify({ category: "лайки" }) });
  ok("недопустимая причина жалобы → 400", badCat.status === 400);
  const complaint = await api(`/api/recommend/${rec2Id}/complaint`, { method: "POST", body: JSON.stringify({ category: "ad", comment: "Проверка жалобы модерацией", reporterName: "RcTest" }) });
  ok("жалоба отправляется", complaint.status === 200 && String(complaint.data.note ?? "").includes("Жалоба отправлена"));
  const guestComplaint = await api(`/api/recommend/${rec2Id}/complaint`, { method: "POST", body: JSON.stringify({ category: "spam", comment: "Жалоба от гостя" }) });
  ok("жалоба работает без входа (гость)", guestComplaint.status === 200);

  // ---- Очередь модератора ----
  const queue = await api(`/api/admin/recommend?token=${encodeURIComponent(tokenA)}&show=open`);
  const qComplaints = (queue.data.complaints ?? []) as Record<string, unknown>[];
  ok("жалоба видна человеку-модератору", queue.status === 200 && qComplaints.some((c) => c.category === "ad" && (c.post as { id: string }).id === rec2Id));
  const firstComplaint = qComplaints.find((c) => (c.post as { id: string }).id === rec2Id) as { id: string } | undefined;
  if (firstComplaint) {
    const resolved = await api("/api/admin/recommend", { method: "POST", body: JSON.stringify({ token: tokenA, action: "resolve-complaint", id: firstComplaint.id }) });
    ok("модератор закрывает жалобу", resolved.status === 200);
  } else {
    ok("модератор закрывает жалобу", false, "жалоба не найдена в очереди");
  }
  const noStaff = await api(`/api/admin/recommend?token=${encodeURIComponent(B.token)}&show=open`);
  ok("не-сотрудник не видит очередь модерации", noStaff.status === 403);

  // ---- Скрытие/возврат модератором ----
  const hideTarget = await api("/api/recommend", {
    method: "POST",
    body: JSON.stringify({ token: C.token, subject: "Клининговая компания «Чистота плюс»", stance: "recommend", title: "Уборка после ремонта на пять с плюсом", text: "Заказывали уборку после ремонта в «Чистота плюс» — отмыли всё, включая окна. Рекомендую за скорость." + TAG, confirmSimilar: true }),
  });
  const hideTargetId = String(hideTarget.data.id ?? "");
  const hideByMod = await api("/api/admin/recommend", { method: "POST", body: JSON.stringify({ token: tokenA, action: "hide-post", id: hideTargetId }) });
  ok("модератор скрывает публикацию", hideByMod.status === 200);
  const hiddenInFeed = await api("/api/recommend?q=клининг");
  ok("скрытая модератором публикация не видна гостям", (hiddenInFeed.data.posts as unknown[]).length === 0);
  const restoreByMod = await api("/api/admin/recommend", { method: "POST", body: JSON.stringify({ token: tokenA, action: "restore-post", id: hideTargetId }) });
  ok("модератор возвращает публикацию в ленту", restoreByMod.status === 200);
  const restoredInFeed = await api("/api/recommend?q=клининг");
  ok("возвращённая публикация снова видна", (restoredInFeed.data.posts as { id: string }[]).some((p) => p.id === hideTargetId));

  // ---- Независимость разделов ----
  const helpApi = await api("/api/help");
  ok("«Нужна помощь» работает независимо", helpApi.status === 200 && Array.isArray(helpApi.data.requests));
  const ovrApi = await api("/api/overheard");
  ok("«Подслушано Сахалин» работает независимо", ovrApi.status === 200 && Array.isArray(ovrApi.data.posts));
  const cdApi = await api("/api/gdedeshevle");
  ok("«Где дешевле» работает независимо", cdApi.status === 200 && Array.isArray(cdApi.data.posts));
  const rcLeak = await db.topic.count({ where: { AND: [{ rubric: { slug: "recommend-discuss" } }, { cheapPost: { isNot: null } }] } });
  ok("темы «Где дешевле» не попадают в рубрику «Рекомендую»", rcLeak === 0);
  const forumTopics = await api("/api/topics");
  ok("форум работает независимо", forumTopics.status === 200);
  const guestFeed = await api("/api/recommend?q=химчистка");
  ok("гость видит созданные публикации в ленте", guestFeed.status === 200 && (guestFeed.data.posts as { id: string }[]).some((p) => p.id === rec1Id));
  const rcRubricCount = await db.topic.count({ where: { rubric: { slug: "recommend-discuss" } } });
  ok("в подразделе «Рекомендую» только темы раздела (2 создано тестом)", rcRubricCount === 2, `найдено ${rcRubricCount}`);

  // ---- Очистка ----
  console.log("\n… очистка тестовых данных");
  const myPostIds = [rec1Id, rec2Id, critiqueId, rec3Id, p1Id, p2Id, n1Id, tmpDId, raceId, korskId, String(spam.data.id ?? ""), String(pd.data.id ?? ""), String(ad.data.id ?? ""), hideTargetId, longSubjectId, String(neutral.data.id ?? "")].filter(Boolean);
  const linked = await db.topic.findMany({
    where: {
      OR: [
        { recPost: { id: { in: myPostIds } } },
        { rubric: { slug: "recommend-discuss" } },
      ],
    },
  });
  await db.recComplaint.deleteMany({ where: { postId: { in: myPostIds } } });
  const delPosts = await db.recPost.deleteMany({ where: { id: { in: myPostIds } } });
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
  console.log(`  удалено: публикаций=${delPosts.count}, тем=${deletedTopics}`);
  const left = await db.recPost.count();
  console.log(`  остаток в разделе: ${left}`);

  console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
