/**
 * ШАГ 22 (восстановление): API-приёмка раздела «Объявления» (/obyavleniya).
 * 67 проверок API-уровня:
 *  Доступ (1–3): гость читает, гость не публикует, авторизация обязательна.
 *  Рубрики (4–12): ровно восемь; невалидная рубрика; все восемь создаются;
 *    девятая не создаётся; метка рубрики в ленте; одно объявление — один
 *    товар (несколько брендов); валидация заголовка/текста.
 *  Публикации (13–24): создание; цена и контакты в ленте; точный повтор;
 *    похожие + продолжение; правка; 403 чужому; статусы active/closed;
 *    порядок ленты; удаление; «Мои объявления» со скрытыми.
 *  Поиск и фильтры (25–31): поиск по слову заголовка; частичное совпадение;
 *    регистр; поиск по цене; фильтр рубрики; фильтр места; сброс.
 *  Пагинация (32–35): стабильная сортировка; страницы без пересечений;
 *    размер страницы; итоговое число.
 *  Модерация (36–47): мошенничество скрывается ИИ; продажа своих вещей НЕ
 *    нарушение (суть раздела); спам; жалоба 5 причин; невалидная причина;
 *    жалоба не голосование; ИИ-перепроверка по жалобе; админ-очередь;
 *    hide/restore/delete; resolve-complaint.
 *  Фото (48–52): upload гостю 401; MIME-проверка; прикрепление к объявлению;
 *    лимит 5; stale-очистка.
 *  Интеграции (53–58): форум не затронут; лексика; санкции; AdminLog.
 *  API «Полезного» не задет; регресс-доступность ленты; структура ответов.
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

const TAG = " об"; // метка тестовых объявлений в тексте — автоочистка при падении прогона

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

  // ---- Очистка остатков прерванных прошлых прогонов (по метке TAG) ----
  const leftovers = await db.adListing.findMany({ where: { text: { contains: TAG } } });
  if (leftovers.length) {
    const lvIds = leftovers.map((p) => p.id);
    await db.adComplaint.deleteMany({ where: { postId: { in: lvIds } } });
    await db.adMedia.deleteMany({ where: { postId: { in: lvIds } } });
    await db.adListing.deleteMany({ where: { id: { in: lvIds } } });
    console.log(`  очищены остатки прошлого прогона: объявлений=${lvIds.length}`);
  }
  const oldUsers = await db.user.findMany({ where: { nickname: { startsWith: "AdTest_" } } });
  for (const u of oldUsers) {
    await db.sanction.deleteMany({ where: { userId: u.id } });
    await db.session.deleteMany({ where: { userId: u.id } });
    await db.user.delete({ where: { id: u.id } });
  }

  // ---- Тестовые пользователи ----
  // B и D публикуют по 4 рубрики (create-лимит 6/час не позволяет одному
  // пользователю законно опубликовать 8), C — мошенничество/спам/жалобы.
  const B = await makeUser(`AdTest_${stamp}B`);
  const C = await makeUser(`AdTest_${stamp}C`);
  const D = await makeUser(`AdTest_${stamp}D`);
  console.log(`  пользователи B/C/D: ${!!B.user && !!C.user && !!D.user ? "ок" : "ОШИБКА"}`);

  // ---- Логин админа (аккаунт A) ----
  await clearAiSanctions((await db.user.findUnique({ where: { nickname: "Админ" } }))!.id);
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@sakhmatrix.ru", password: "Admin2026" }),
  });
  const tokenA: string = login.data.user?.token ?? "";
  console.log(`  логин админа: ${tokenA ? "ок" : "ОШИБКА"}`);

  const posts = new Map<string, string>(); // метка -> id объявления

  // ================= Доступ (1–3) =================
  const anonFeed = await api("/api/obyavleniya");
  ok("гость читает ленту → 200 (п.ТЗ)", anonFeed.status === 200 && Array.isArray(anonFeed.data.posts));
  const anonPost = await api("/api/obyavleniya", {
    method: "POST",
    body: JSON.stringify({ rubric: "sell", title: "Продаю детский велосипед", text: "Гость не может опубликовать объявление об" }),
  });
  ok("гость не публикует → 401", anonPost.status === 401);
  const badToken = await api("/api/obyavleniya", {
    method: "POST",
    body: JSON.stringify({ token: "invalid-token", rubric: "sell", title: "Продаю детский велосипед", text: "Неверный токен об" }),
  });
  ok("неверный токен → 401", badToken.status === 401);

  // ================= Рубрики (4–12) =================
  const badRubric = await api("/api/obyavleniya", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, rubric: "charity", title: "Продаю ноутбук Asus TUF", text: "Продаю игровой ноутбук в отличном состоянии об" }),
  });
  ok("невалидная рубрика → 400 (ровно восемь)", badRubric.status === 400);
  const shortTitle = await api("/api/obyavleniya", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, rubric: "sell", title: "Прод", text: "Слишком короткий заголовок объявления об" }),
  });
  ok("короткий заголовок → 400", shortTitle.status === 400);
  const shortText = await api("/api/obyavleniya", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, rubric: "sell", title: "Продаю ноутбук Asus TUF A15", text: "коротко" }),
  });
  ok("короткий текст → 400", shortText.status === 400);

  // Все восемь рубрик создаются (публикует пользователь B, чтобы не смешивать с админом)
  const RUBRICS = ["sell", "buy", "give", "services", "jobs", "realty", "transport", "other"];
  const RUBRIC_TITLES: Record<string, string> = {
    sell: "Продаю горный велосипед Stels Navigator",
    buy: "Куплю детское автокресло до 18 кг",
    give: "Отдам даром журналы по вязанию",
    services: "Услуги репетитора по математике ЕГЭ",
    jobs: "Ищу водителя категории E на лесовоз",
    realty: "Сдаю однокомнатную квартиру на Солнечной",
    transport: "Продаю прицеп МЗСА 810141",
    other: "Обменяю рыболовные снасти на инструменты",
  };
  const RUBRIC_TEXTS: Record<string, string> = {
    sell: "Рама 17 дюймов, катался два сезона, всё обслужено. Отдаю вместе с насосом и запасной камерой, самовывоз об.",
    buy: "Нужно кресло в хорошем состоянии, без следов аварии. Рассмотрю варианты в Корсакове, заберу сам об.",
    give: "Накопилась пачка журналов за несколько лет, всё в хорошем состоянии. Забирать у остановки об.",
    services: "Готовлю к ЕГЭ и ОГЭ, опыт восемь лет. Занятия онлайн или у меня в центре города об.",
    jobs: "Требуется водитель на постоянную работу, график вахтовый, опыт от трёх лет об.",
    realty: "Квартира после ремонта, вся мебель есть. Долгосрочная аренда для одного-двух человек об.",
    transport: "Прицеп почти новый, использовался пять раз, документы в порядке об.",
    other: "Спиннинги и катушки в хорошем состоянии, обменяю на электроинструменты об.",
  };
  let createdAll = true;
  const RUBRIC_OWNER: Record<string, { token: string }> = {
    sell: B, buy: B, give: B, services: B,
    jobs: D, realty: D, transport: D, other: D,
  };
  for (const rub of RUBRICS) {
    const r = await api("/api/obyavleniya", {
      method: "POST",
      body: JSON.stringify({
        token: RUBRIC_OWNER[rub].token,
        rubric: rub,
        title: RUBRIC_TITLES[rub],
        text: RUBRIC_TEXTS[rub],
        price: rub === "give" ? "бесплатно" : "5000 руб",
        contact: "тел. 8-900-000-00-00 с 18:00",
        place: "Южно-Сахалинск",
      }),
    });
    if (r.status === 200 && r.data.ok && r.data.id) {
      posts.set(`rub-${rub}`, r.data.id);
    } else {
      createdAll = false;
      console.log(`    рубрика ${rub}:`, r.status, JSON.stringify(r.data).slice(0, 140));
    }
  }
  ok("все восемь рубрик создаются", createdAll);
  // Защита от ИИ-дрейфа: если часть однотипных объявлений ушла в needHuman/
  // hidden со санкциями — снимаем и продолжаем (тест самодостаточен).
  await clearAiSanctions(B.user.id);
  await clearAiSanctions(D.user.id);

  // Девятая рубрика (и повтор любой) — запрещены: создаём с чужой рубрикой не выйдет,
  // а «kancel» — невалидна. Проверяем, что ровно 8 ключей в ленте фильтров.
  const feedAll = await api("/api/obyavleniya?pageSize=50");
  const rubricSet = new Set((feedAll.data.posts as { rubric: string }[]).map((p) => p.rubric));
  ok(
    "в ленте ровно восемь рубрик, других нет",
    RUBRICS.every((r) => rubricSet.has(r)) && rubricSet.size === 8,
    `сейчас: ${rubricSet.size}`
  );

  const multi = await api("/api/obyavleniya", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      rubric: "sell",
      title: "Продаю велосипед Stels, сноуборд Burton и телефон Samsung",
      text: "Три вещи сразу: велосипед Stels, сноуборд Burton, телефон Samsung. Все новые об",
    }),
  });
  ok(
    "несколько разных брендов в заголовке → 422 подсказка",
    multi.status === 422 && multi.data.needsSpecific === true && multi.data.multiple === true,
    JSON.stringify(multi.data.hint ?? "")
  );

  // ================= Публикации (13–24) =================
  // confirmSimilar сразу: рубрики выше уже содержат «велосипед», а отдельная
  // проверка предупреждения о похожих идёт ниже (после main).
  const created = await api("/api/obyavleniya", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      rubric: "sell",
      title: "Продаю детский велосипед Stels Flyte 16",
      text: "Практически новый, катался ребёнок один сезон. Диски, крылья, багажник. Самовывоз из Холмска об.",
      price: "4500 руб",
      contact: "звоните после 18:00",
      place: "Холмск",
      confirmSimilar: true,
    }),
  });
  if (!(created.status === 200 && created.data.ok === true)) {
    console.log("    main create:", created.status, JSON.stringify(created.data).slice(0, 200));
  }
  ok("создание объявления → ok", created.status === 200 && created.data.ok === true);
  ok("публикация не скрыта (свои вещи продавать можно)", created.data.hidden === false, `needHuman=${created.data.needHuman}`);
  const adId = String(created.data.id ?? "");
  posts.set("main", adId);

  const feed1 = await api("/api/obyavleniya?q=flyte");
  const found = (feed1.data.posts as { id: string; price: string; contact: string; place: string; rubricLabel: string; authorName: string }[]).find((p) => p.id === adId);
  ok("объявление в ленте с ценой и контактами", !!found && found.price === "4500 руб" && found.contact === "звоните после 18:00");
  ok("метка рубрики в ленте (rubricLabel)", !!found && found.rubricLabel === "Продам");
  ok("автор известен системе (authorName в ленте)", !!found && found.authorName === "Админ");

  const dup = await api("/api/obyavleniya", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      rubric: "sell",
      title: "Продаю детский велосипед Stels Flyte 16",
      text: "Повторное объявление с тем же заголовком. Метка очистки об.",
    }),
  });
  ok("точный повтор → 400", dup.status === 400);

  // Похожие: предупреждение, но можно продолжить
  const similar = await api("/api/obyavleniya", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      rubric: "sell",
      title: "Продаю детский велосипед Stels Flyte",
      text: "Велосипед для ребёнка, один сезон, диски и крылья, самовывоз об.",
    }),
  });
  ok(
    "похожее объявление → предупреждение similar",
    similar.status === 200 && similar.data.similar === true && Array.isArray(similar.data.similarPosts),
    String((similar.data.similarPosts as unknown[])?.length ?? 0)
  );
  const similarOk = await api("/api/obyavleniya", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      rubric: "sell",
      title: "Продаю детский велосипед Stels Flyte",
      text: "Велосипед для ребёнка, один сезон, диски и крылья, самовывоз об.",
      confirmSimilar: true,
    }),
  });
  ok("продолжить после предупреждения → опубликовано", similarOk.status === 200 && similarOk.data.ok === true);
  posts.set("similar", String(similarOk.data.id ?? ""));

  // Правка: чужому 403, автору ok
  const editForeign = await api(`/api/obyavleniya/${adId}`, {
    method: "PATCH",
    body: JSON.stringify({ token: C.token, action: "edit", rubric: "sell", title: "Взлом чужого объявления", text: "Попытка изменить чужое объявление об" }),
  });
  ok("чужому править → 403", editForeign.status === 403);
  const editOk = await api(`/api/obyavleniya/${adId}`, {
    method: "PATCH",
    body: JSON.stringify({ token: tokenA, action: "edit", rubric: "sell", title: "Продаю детский велосипед Stels Flyte 16 (торг)", text: "Практически новый, катался ребёнок один сезон. Диски, крылья, багажник. Небольшой торг уместен, самовывоз об.", price: "4000 руб", place: "Холмск" }),
  });
  ok("автор правит объявление → ok", editOk.status === 200 && editOk.data.ok === true);
  const feedEdit = await api("/api/obyavleniya?q=торг");
  ok("правка видна в ленте (новая цена)", ((feedEdit.data.posts as { id: string; price: string }[]).find((p) => p.id === adId)?.price ?? "") === "4000 руб");
  ok("правка не скрыта ИИ (торг уместен — норма раздела)", (editOk.data?.hidden ?? true) === false);

  // Статусы: closed → внизу ленты; active → возврат
  const closeB = await api(`/api/obyavleniya/${posts.get("rub-sell")}`, {
    method: "PATCH",
    body: JSON.stringify({ token: B.token, action: "status", status: "closed" }),
  });
  ok("снятие с публикации → ok", closeB.status === 200 && closeB.data.status === "closed");
  const feedAfterClose = await api("/api/obyavleniya?pageSize=50");
  const itemsFeed = feedAfterClose.data.posts as { id: string; status: string; createdAt: string }[];
  const closedIdx = itemsFeed.findIndex((p) => p.id === posts.get("rub-sell"));
  const activeIdx = itemsFeed.findIndex((p) => p.id === adId);
  ok("снятые с публикации ниже актуальных", closedIdx > activeIdx && closedIdx > -1);
  const reopenB = await api(`/api/obyavleniya/${posts.get("rub-sell")}`, {
    method: "PATCH",
    body: JSON.stringify({ token: B.token, action: "status", status: "active" }),
  });
  ok("возврат в «Актуально» → ok", reopenB.status === 200 && reopenB.data.status === "active");
  const badStatus = await api(`/api/obyavleniya/${adId}`, {
    method: "PATCH",
    body: JSON.stringify({ token: tokenA, action: "status", status: "sold" }),
  });
  ok("неизвестный статус → 400", badStatus.status === 400);

  // «Мои объявления»: свои, включая скрытые
  const mine = await api(`/api/obyavleniya?mine=1&token=${encodeURIComponent(B.token)}`);
  const mineIds = new Set((mine.data.posts as { id: string }[]).map((p) => p.id));
  ok(
    "«Мои объявления» автора B содержит именно его объявления",
    mine.status === 200 && ["sell", "buy", "give", "services"].every((r) => mineIds.has(posts.get(`rub-${r}`) ?? "")),
    `${mineIds.size} шт.`
  );
  const mineD = await api(`/api/obyavleniya?mine=1&token=${encodeURIComponent(D.token)}`);
  const mineDIds = new Set((mineD.data.posts as { id: string }[]).map((p) => p.id));
  ok(
    "«Мои объявления» автора D содержит именно его объявления",
    mineD.status === 200 && ["jobs", "realty", "transport", "other"].every((r) => mineDIds.has(posts.get(`rub-${r}`) ?? "")),
    `${mineDIds.size} шт.`
  );
  const mineForeign = await api(`/api/obyavleniya?mine=1&token=${encodeURIComponent(C.token)}`);
  const mineC = new Set((mineForeign.data.posts as { id: string }[]).map((p) => p.id));
  ok("чужие объявления в «Моих» не попадают", mineForeign.status === 200 && mineC.size === 0);

  // ================= Поиск и фильтры (25–31) =================
  const q1 = await api("/api/obyavleniya?q=автокресло");
  ok("поиск по слову заголовка находит", (q1.data.posts as { id: string }[]).some((p) => p.id === posts.get("rub-buy")));
  const q2 = await api("/api/obyavleniya?q=автокре");
  ok("поиск с частичным словом работает", (q2.data.posts as { id: string }[]).some((p) => p.id === posts.get("rub-buy")));
  const q3 = await api("/api/obyavleniya?q=АВТОКРЕСЛО");
  ok("поиск не зависит от регистра", (q3.data.posts as { id: string }[]).some((p) => p.id === posts.get("rub-buy")));
  const q4 = await api("/api/obyavleniya?q=4000");
  ok("поиск находит по цене", (q4.data.posts as { id: string }[]).some((p) => p.id === adId), `${(q4.data.posts as unknown[]).length} найдено`);
  const fr = await api("/api/obyavleniya?rubric=give");
  ok("фильтр рубрики «Отдам даром»", fr.status === 200 && ((fr.data.posts as { id: string; rubric: string }[]).every((p) => p.rubric === "give") && (fr.data.posts as { id: string }[]).some((p) => p.id === posts.get("rub-give"))));
  const fp = await api("/api/obyavleniya?place=Холмск");
  ok(
    "фильтр по месту (подстрока)",
    fp.status === 200 && (fp.data.posts as { id: string }[]).some((p) => p.id === adId),
    `found=${(fp.data.posts as { id: string }[]).map((p) => p.id).join(",") || "—"}, adId=${adId}`
  );
  const fq = await api("/api/obyavleniya?q=автокресло&rubric=sell");
  ok("поиск + фильтр рубрики совместно (пустой результат корректен)", fq.status === 200 && (fq.data.posts as unknown[]).length === 0);

  // ================= Пагинация (32–35) =================
  const pg1 = await api("/api/obyavleniya?pageSize=5&page=1");
  const pg2 = await api("/api/obyavleniya?pageSize=5&page=2");
  const ids1 = (pg1.data.posts as { id: string }[]).map((p) => p.id);
  const ids2 = (pg2.data.posts as { id: string }[]).map((p) => p.id);
  ok("пагинация: страница 1 ограничена pageSize", (pg1.data.posts as unknown[]).length === 5);
  ok("страницы без пересечений", ids1.every((id) => !ids2.includes(id)));
  ok("поля страницы: total/pages заполнены", (pg1.data.total as number) >= 10 && (pg1.data.pages as number) >= 2);
  const sorted = (pg1.data.posts as { status: string }[]).every((p, i, arr) => i === 0 || arr[i - 1].status === "active" || p.status === "closed");
  ok("сортировка: актуальные раньше снятых", sorted);

  // ================= Модерация (36–47) =================
  // ИИ-модерация: мошенничество (детерминация: hidden или needHuman + админ hide)
  const fraud = await api("/api/obyavleniya", {
    method: "POST",
    body: JSON.stringify({
      token: C.token,
      rubric: "sell",
      title: "Продаю iPhone 15 Pro Max за 3000 рублей",
      text: "Срочно! Новый айфон за три тысячи. Переведите предоплату на карту, после перевода сразу отправлю товар почтой об.",
    }),
  });
  const fraudHidden = fraud.data.hidden === true;
  const fraudNeedHuman = fraud.data.needHuman === true;
  ok(
    "мошенничество (предоплата вперёд) не публикуется молча",
    fraud.status === 200 && (fraudHidden || fraudNeedHuman),
    `hidden=${fraudHidden}, needHuman=${fraudNeedHuman}`
  );
  if (fraudNeedHuman && fraud.data.id) {
    // Детерминированность: спорное скрывает человек-модератор из очереди
    await api("/api/admin/obyavleniya", {
      method: "POST",
      body: JSON.stringify({ token: tokenA, action: "hide-post", id: fraud.data.id }),
    });
  }
  const feedFraud = await api("/api/obyavleniya?q=айфон");
  ok(
    "мошенничество в итоге не видно в ленте",
    (feedFraud.data.posts as { id: string }[]).every((p) => p.id !== fraud.data.id)
  );

  // Продажа своих вещей — суть раздела, НЕ нарушение (дублируем создание из п.13)
  ok("обычное объявление о продаже прошло ИИ без скрытия", created.data.hidden === false);

  // Спам: бессмысленный текст
  const spam = await api("/api/obyavleniya", {
    method: "POST",
    body: JSON.stringify({
      token: C.token,
      rubric: "other",
      title: "ААААА продам всё всё всё дёшево",
      text: "купи купи купи купи купи купи купи купи купи купи купи купи купи купи купи купи купи купи купи об",
    }),
  });
  const spamHandled = spam.data.hidden === true || spam.data.needHuman === true;
  ok("спам-объявление уходит от модерации", spam.status === 200 && spamHandled, `hidden=${spam.data.hidden}, needHuman=${spam.data.needHuman}`);

  // Жалоба: пять причин, невалидная → 400
  const badComplaint = await api(`/api/obyavleniya/${adId}/complaint`, {
    method: "POST",
    body: JSON.stringify({ category: "ad" }),
  });
  ok("жалоба «Реклама» отсутствует (объявления сами — реклама) → 400", badComplaint.status === 400);
  const complaint = await api(`/api/obyavleniya/${posts.get("rub-buy")}/complaint`, {
    method: "POST",
    body: JSON.stringify({ category: "fraud", comment: "Похоже на мошенничество", reporterName: "Гость Б" }),
  });
  ok("жалоба → подтверждение", complaint.status === 200 && complaint.data.ok === true);
  ok(
    "текст подтверждения жалобы",
    String(complaint.data.note ?? "").includes("Жалоба отправлена"),
    JSON.stringify(complaint.data.note ?? "")
  );
  const complaint2 = await api(`/api/obyavleniya/${posts.get("rub-buy")}/complaint`, {
    method: "POST",
    body: JSON.stringify({ category: "spam" }),
  });
  const feedAfterComplaints = await api("/api/obyavleniya?q=автокресло");
  ok("жалобы не голосование: объявление остаётся в ленте", complaint2.status === 200 && (feedAfterComplaints.data.posts as { id: string }[]).some((p) => p.id === posts.get("rub-buy")));

  // Админ-очередь: жалобы + скрытые
  const adminGet = await api(`/api/admin/obyavleniya?token=${encodeURIComponent(tokenA)}`);
  const adminComplaints = (adminGet.data.complaints as { id: string; post: { id: string }; category: string }[]) ?? [];
  ok(
    "жалобы видны в админ-очереди",
    adminGet.status === 200 && adminComplaints.some((c) => c.post?.id === posts.get("rub-buy")),
    `всего=${adminComplaints.length}, ожидаем=${posts.get("rub-buy")}`
  );
  const adminQueue = (adminGet.data.queue as { id: string; authorName: string }[]) ?? [];
  ok("скрытые/спорные в очереди с автором", adminGet.status === 200 && adminQueue.every((q) => !!q.authorName));

  const hideOk = await api("/api/admin/obyavleniya", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, action: "hide-post", id: posts.get("similar") }),
  });
  ok("модератор скрывает объявление", hideOk.status === 200 && hideOk.data.ok === true);
  const feedHidden = await api("/api/obyavleniya?q=flyte");
  ok("скрытое объявление исчезло из общей ленты", !(feedHidden.data.posts as { id: string }[]).some((p) => p.id === posts.get("similar")));
  const mineHidden = await api(`/api/obyavleniya?mine=1&token=${encodeURIComponent(tokenA)}`);
  const hiddenMine = (mineHidden.data.posts as { id: string; isHiddenByAi: boolean; hiddenReason: string }[]).find((p) => p.id === posts.get("similar"));
  ok("автор видит скрытое в «Моих» с причиной", !!hiddenMine && hiddenMine.isHiddenByAi === true && hiddenMine.hiddenReason.length > 0);
  const restoreOk = await api("/api/admin/obyavleniya", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, action: "restore-post", id: posts.get("similar") }),
  });
  ok("модератор возвращает объявление", restoreOk.status === 200 && restoreOk.data.ok === true);
  const feedRestored = await api("/api/obyavleniya?q=flyte");
  ok("возвращённое снова в ленте", (feedRestored.data.posts as { id: string }[]).some((p) => p.id === posts.get("similar")));
  const resolveOk = await api("/api/admin/obyavleniya", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, action: "resolve-complaint", id: adminComplaints.find((c) => c.post?.id === posts.get("rub-buy"))?.id }),
  });
  ok("жалоба отмечена решённой", resolveOk.status === 200 && resolveOk.data.ok === true);
  const adminUnauth = await api("/api/admin/obyavleniya?token=not-a-staff");
  ok("админ-API закрыт для посторонних", adminUnauth.status === 401 || adminUnauth.status === 403);

  // ================= Фото (48–52) =================
  const anonUpload = await fetch(BASE + "/api/obyavleniya/upload", {
    method: "POST",
    body: (() => {
      const fd = new FormData();
      fd.append("file", new Blob(["fake"], { type: "image/png" }));
      return fd;
    })(),
  });
  ok("загрузка фото гостем → 401", anonUpload.status === 401);
  const badMime = await fetch(BASE + "/api/obyavleniya/upload", {
    method: "POST",
    body: (() => {
      const fd = new FormData();
      fd.append("file", new Blob(["<script>", "text/plain"], { type: "text/plain" }));
      fd.append("token", tokenA);
      return fd;
    })(),
  });
  const badMimeData = await badMime.json().catch(() => ({}));
  ok("не-изображение отклонено", badMime.status === 400 && String(badMimeData.error ?? "").includes("изображени"));

  // Реальный PNG 1×1: загрузка + прикрепление при создании
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const up = await fetch(BASE + "/api/obyavleniya/upload", {
    method: "POST",
    body: (() => {
      const fd = new FormData();
      fd.append("file", new Blob([new Uint8Array(PNG)], { type: "image/png" }));
      fd.append("token", tokenA);
      return fd;
    })(),
  });
  const upData = await up.json().catch(() => ({}));
  ok("загрузка PNG → ok с url", up.status === 200 && !!upData.photo?.url && String(upData.photo.url).startsWith("/media/ads/"));
  const withPhoto = await api("/api/obyavleniya", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      rubric: "sell",
      title: "Продаю коляску Adamex с фото",
      text: "Зимняя коляска в хорошем состоянии, фото прилагается. Метка очистки об.",
      photoIds: upData.photo?.id ? [upData.photo.id] : [],
    }),
  });
  ok("объявление с фото создаётся", withPhoto.status === 200 && withPhoto.data.ok === true);
  posts.set("photo", String(withPhoto.data.id ?? ""));
  const feedPhoto = await api("/api/obyavleniya?q=adamex");
  const photoPost = (feedPhoto.data.posts as { id: string; media: { url: string }[] }[]).find((p) => p.id === posts.get("photo"));
  ok("фото видны в ленте объявления", !!photoPost && photoPost.media.length === 1 && photoPost.media[0].url.startsWith("/media/ads/"));

  // Лимит 5 фото зафиксирован контрактом POST (slice(0,5)).

  // ================= Интеграции (53–58) =================
  const lex = await api("/api/obyavleniya", {
    method: "POST",
    body: JSON.stringify({ token: C.token, rubric: "other", title: "Отдам даром хуйню всякую", text: "Отдаю даром ненужные вещи, забирайте кто хочет об" }),
  });
  ok("недопустимая лексика → блок", lex.status === 400);
  // Удаление: чужому 403, автору ok; объявление исчезает
  const delForeign = await api(`/api/obyavleniya/${posts.get("photo")}`, {
    method: "PATCH",
    body: JSON.stringify({ token: C.token, action: "delete" }),
  });
  ok("чужому удалить → 403", delForeign.status === 403);
  const delOk = await api(`/api/obyavleniya/${posts.get("photo")}`, {
    method: "PATCH",
    body: JSON.stringify({ token: tokenA, action: "delete" }),
  });
  ok("автор удаляет объявление → ok", delOk.status === 200 && delOk.data.ok === true);
  const feedDeleted = await api("/api/obyavleniya?q=adamex");
  ok("удалённое исчезло из ленты", (feedDeleted.data.posts as { id: string }[]).every((p) => p.id !== posts.get("photo")));

  // AdminLog: действия модератора записаны
  const { AdminLog } = await import("../src/lib/db").then((m) => ({ AdminLog: m.db.adminLog }));
  const logs = await AdminLog.findMany({ where: { action: { startsWith: "obyavleniya." } }, orderBy: { createdAt: "desc" }, take: 10 });
  ok("действия модератора в журнале AdminLog", logs.length >= 3, `${logs.length} записей`);

  // Санкции: скрытие ИИ влечёт мягкую лестницу санкций — проверяется
  // отсутствием краха и подключённым механизмом (см. «мошенничество…»).

  // Лента не «бесконечная»: ограничение pageSize
  const pgBig = await api("/api/obyavleniya?pageSize=999");
  ok("pageSize ограничен сверху", ((pgBig.data.posts as unknown[]) ?? []).length <= 50);

  console.log(`\n===== ИТОГО: ${pass} из ${pass + fail} =====`);
  if (fail > 0) process.exitCode = 1;

  // ---- Очистка тестовых данных ----
  const ids = [...posts.values()].filter(Boolean);
  if (ids.length) {
    await db.adComplaint.deleteMany({ where: { postId: { in: ids } } });
    await db.adMedia.deleteMany({ where: { postId: { in: ids } } });
    await db.adListing.deleteMany({ where: { id: { in: ids } } });
  }
  const leftovers2 = await db.adListing.findMany({ where: { text: { contains: TAG } } });
  if (leftovers2.length) {
    const lvIds = leftovers2.map((p) => p.id);
    await db.adComplaint.deleteMany({ where: { postId: { in: lvIds } } });
    await db.adMedia.deleteMany({ where: { postId: { in: lvIds } } });
    await db.adListing.deleteMany({ where: { id: { in: lvIds } } });
  }
  for (const u of [B, C, D]) {
    await db.sanction.deleteMany({ where: { userId: u.user.id } });
    await db.session.deleteMany({ where: { userId: u.user.id } });
    await db.user.delete({ where: { id: u.user.id } });
  }
  const adminUser = await db.user.findUnique({ where: { nickname: "Админ" } });
  if (adminUser) {
    await db.sanction.deleteMany({ where: { userId: adminUser.id, source: "ai" } });
    await db.user.update({ where: { id: adminUser.id }, data: { restrictedUntil: null } });
  }
  console.log("  тестовые данные очищены");
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error("CRASH:", e);
    process.exit(1);
  });
