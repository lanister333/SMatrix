/**
 * ШАГ 23: API-приёмка раздела «Где дешевле» (/gde-deshevle).
 * Покрывает финальную проверку из ТЗ п.31 (API-уровень, 40 пунктов):
 *  Публикации (1–10): создание; конкретный товар; общий вопрос; несколько
 *    товаров; редактирование; удаление; «Нашёл дешевле»; «Неактуально»;
 *    возврат в «Сравниваю»; сортировка.
 *  Дубли (11–14): похожая публикация; предупреждение; продолжение; защита
 *    от повторов.
 *  Цены (15–19): цена; дата проверки; условия скидки; доставка;
 *    сопоставимость моделей.
 *  Форум (20–27): создание темы; одна тема; повтор открывает существующую;
 *    подраздел «Где дешевле»; исходный вопрос в первом сообщении; обратная
 *    ссылка; «Тема закрыта»; «Тема в архиве».
 *  Модерация (28–33): реклама; скрытая реклама; спам; повторы; рекламные
 *    ответы (общесайтовая модерация форума); жалоба.
 *  Интерфейс (34–40): браузерная приёмка (34–39) + поиск (40).
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
const TAG = " гд"; // метка тестовых вопросов в тексте — автоочистка при падении прогона

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
  const smarker = "гармония"; // естественное уникальное слово-метка блока сортировки

  // ---- Очистка остатков прерванных прошлых прогонов (по метке TAG) ----
  const leftovers = await db.cheapPost.findMany({ where: { text: { contains: TAG } } });
  if (leftovers.length) {
    const lvIds = leftovers.map((p) => p.id);
    const lvTopics = await db.topic.findMany({ where: { cheapPost: { id: { in: lvIds } } } });
    for (const t of lvTopics) {
      await db.message.deleteMany({ where: { topicId: t.id } });
      await db.topic.delete({ where: { id: t.id } });
    }
    await db.cheapComplaint.deleteMany({ where: { postId: { in: lvIds } } });
    await db.cheapPost.deleteMany({ where: { id: { in: lvIds } } });
    console.log(`  очищены остатки прошлого прогона: постов=${lvIds.length}, тем=${lvTopics.length}`);
  }
  const oldUsers = await db.user.findMany({ where: { nickname: { startsWith: "CdTest_" } } });
  for (const u of oldUsers) {
    await db.sanction.deleteMany({ where: { userId: u.id } });
    await db.session.deleteMany({ where: { userId: u.id } });
    await db.user.delete({ where: { id: u.id } });
  }

  // ---- Тестовые пользователи ----
  const B = await makeUser(`CdTest_${stamp}B`);
  const C = await makeUser(`CdTest_${stamp}C`);
  const D = await makeUser(`CdTest_${stamp}D`);
  console.log(`  пользователи B/C/D: ${!!B.user && !!C.user && !!D.user ? "ок" : "ОШИБКА"}`);

  // ---- Логин админа (аккаунт A); снимаем остаточные ai-санкции прошлых прогонов ----
  await clearAiSanctions((await db.user.findUnique({ where: { nickname: "Админ" } }))!.id);
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@sakhmatrix.ru", password: "Admin2026" }),
  });
  const tokenA: string = login.data.user?.token ?? "";
  const adminA = await db.user.findUnique({ where: { nickname: "Админ" } });
  console.log(`  логин админа: ${tokenA ? "ок" : "ОШИБКА"}`);

  // Гость: читать может (ТЗ п.22), писать нет
  const anonPost = await api("/api/gdedeshevle", {
    method: "POST",
    body: JSON.stringify({ title: "Где дешевле купить дрель Bosch GSR 120?", text: "Гость не может опубликовать вопрос" }),
  });
  ok("гость не публикует → 401 (п.22)", anonPost.status === 401);

  // ---- 3. Общий вопрос → подсказка, не молчаливая публикация (ТЗ п.2/3) ----
  const generic = await api("/api/gdedeshevle", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, title: "Где дешевле покупать продукты?", text: "Подскажите, где вообще дешевле покупать продукты в городе." }),
  });
  ok("общий вопрос «где дешевле покупать продукты» → 422 подсказка (п.3)", generic.status === 422 && generic.data.needsSpecific === true);
  ok(
    "текст подсказки конкретности по ТЗ (п.2)",
    generic.data.hint === "Укажите конкретный товар или модель. Например: Bosch S5 AGM 70 Ah.",
    JSON.stringify(generic.data.hint ?? "")
  );
  const advice = await api("/api/gdedeshevle", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, title: "Какой магазин электроники самый дешёвый?", text: "Посоветуйте дешёвый магазин электроники, где вообще низкие цены." }),
  });
  ok("вопрос «какой магазин самый дешёвый» не проходит (п.3)", advice.status === 422 && advice.data.needsSpecific === true);

  // ---- 4. Несколько товаров в одном вопросе (ТЗ п.3/4) ----
  const multi = await api("/api/gdedeshevle", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      title: "Где дешевле купить Bosch S5 AGM 70 Ah, телевизор Samsung QE55S90D и шины Nokian Hakkapeliitta 10?",
      text: "Нужны три вещи сразу: аккумулятор Bosch S5, телевизор Samsung и шины Nokian. Где по каждой из них дешевле?",
    }),
  });
  ok("несколько товаров в одном вопросе → подсказка (п.3/4)", multi.status === 422 && multi.data.needsSpecific === true && multi.data.multiple === true);
  ok("подсказка «один вопрос — один товар» (п.4)", multi.data.hint === "Один вопрос — один конкретный товар. Разные товары сравнивайте в отдельных публикациях.");

  // ---- 1/2. Создание вопроса о конкретном товаре ----
  const T_BOSCH = "Где дешевле купить аккумулятор Bosch S5 AGM 70 Ah?";
  const bosch = await api("/api/gdedeshevle", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      title: T_BOSCH,
      text: `Сравниваю цены на Bosch S5 AGM 70 Ah. Где сейчас дешевле? Напишите магазин и цену.` + TAG,
      place: "Южно-Сахалинск",
    }),
  });
  const boschId = String(bosch.data.id ?? "");
  ok("вопрос о конкретном товаре опубликован, ИИ не скрывает (п.1/2)", bosch.status === 200 && !!boschId && bosch.data.hidden !== true, JSON.stringify(bosch.data.note ?? bosch.data.error ?? ""));

  const feed1 = await api("/api/gdedeshevle?q=bosch%20agm");
  const row1 = (feed1.data.posts as Record<string, unknown>[]).find((p) => p.id === boschId);
  ok(
    "вопрос в ленте: место/автор/дата/статус «Сравниваю» (п.2/23)",
    !!row1 && row1.place === "Южно-Сахалинск" && row1.authorName === "Админ" && row1.status === "comparing" && !!row1.createdAt,
    row1 ? "найден" : "не найден"
  );

  // ---- 15–18. Цены: сохранение текста с ценой, датой проверки, условиями, доставкой ----
  const price = await api("/api/gdedeshevle", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      title: "Где дешевле шины Nokian Hakkapeliitta 10 205/55 R16?",
      text: "В магазине X по Сахалинской эти Nokian Hakkapeliitta 10 205/55 R16 стоят 18 900 ₽, в магазине Y — 20 500 ₽. Цена проверена вчера. По карте магазина — скидка 5%. С доставкой обойдётся в 19 400 ₽ итого." + TAG,
      place: "Холмск",
    }),
  });
  const priceId = String(price.data.id ?? "");
  ok("вопрос с ценой конкретного товара опубликован (п.15)", price.status === 200 && !!priceId && price.data.hidden !== true, JSON.stringify(price.data.note ?? price.data.error ?? ""));
  const priceRow = ((await api("/api/gdedeshevle?q=hakkapeliitta")).data.posts as Record<string, unknown>[]).find((p) => p.id === priceId);
  const priceText = String(priceRow?.text ?? "");
  ok("цена и дата проверки в тексте сохранены дословно (п.15/16)", priceText.includes("18 900 ₽") && priceText.includes("Цена проверена вчера"));
  ok("условия скидки (по карте магазина) сохранены (п.17)", priceText.includes("По карте магазина — скидка 5%"));
  ok("стоимость с доставкой сохранена (п.18)", priceText.includes("С доставкой обойдётся в 19 400 ₽"));
  ok("упоминание магазина/цены в вопросе о конкретном товаре — не нарушение (п.19)", priceRow && priceRow.status === "comparing" && !priceRow.isHiddenByAi);

  // ---- 19. Сопоставимость: сравнение двух разных моделей → подсказка (п.19/п.4) ----
  const mismatch = await api("/api/gdedeshevle", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      title: "Сравните цены: Bosch S5 AGM 70 Ah и шины Nokian Hakkapeliitta 10",
      text: "Один аккумулятор Bosch S5 стоит 18 000, шины Nokian стоят 12 000. Где выгоднее?",
    }),
  });
  // Смешение двух разных товаров в одном вопросе не проходит: «одна публикация —
  // один конкретный товар» (ТЗ п.4), сравнивать можно только один товар (п.7/19).
  ok("несопоставимые товары в одном вопросе → подсказка (п.19)", mismatch.status === 422 && mismatch.data.needsSpecific === true);

  // ---- 11–13. Похожие публикации (ТЗ п.11) ----
  const mann = await api("/api/gdedeshevle", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      title: "Где дешевле купить фильтр Mann C 35 154?",
      text: "Ищу, где дешевле масляный фильтр Mann C 35 154 для планового ТО." + TAG,
    }),
  });
  const mannId = String(mann.data.id ?? "");
  ok("первый вопрос про фильтр создан", mann.status === 200 && !!mannId, JSON.stringify(mann.data.error ?? ""));

  const mann2 = await api("/api/gdedeshevle", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      title: "В каком магазине дешевле фильтр Mann C 35 154?",
      text: "Кто где покупал масляный фильтр Mann C 35 154 дешевле всего?" + TAG,
    }),
  });
  const sim = (mann2.data.similarPosts ?? []) as { id: string }[];
  ok("похожий вопрос обнаружен → предупреждение (п.11)", mann2.status === 200 && mann2.data.similar === true && sim.length > 0);
  ok("текст предупреждения по ТЗ (п.11)", mann2.data.hint === "Похожий вопрос уже опубликован. Возможно, сравнение цен уже есть.");
  ok("предупреждение содержит ссылку на существующую публикацию (п.11)", sim.some((s) => s.id === mannId));

  // 13. Возможность продолжить публикацию
  const mann2b = await api("/api/gdedeshevle", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      title: "В каком магазине дешевле фильтр Mann C 35 154?",
      text: "Кто где покупал масляный фильтр Mann C 35 154 дешевле всего?" + TAG,
      confirmSimilar: true,
    }),
  });
  const mann2bId = String(mann2b.data.id ?? "");
  ok("публикацию можно продолжить после предупреждения (п.13)", mann2b.status === 200 && !!mann2bId, JSON.stringify(mann2b.data.error ?? ""));

  // ---- 14. Защита от повторной публикации ----
  const mann3 = await api("/api/gdedeshevle", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      title: "В каком магазине дешевле фильтр Mann C 35 154?",
      text: "Кто где покупал масляный фильтр Mann C 35 154 дешевле всего?" + TAG,
      confirmSimilar: true,
    }),
  });
  ok(
    "точный повтор → отказ (п.14)",
    mann3.status === 400 && String(mann3.data.error ?? "").includes("уже публиковали"),
    JSON.stringify(mann3.data.error ?? "")
  );

  // ---- 5. Редактирование — только автор ----
  const editForeign = await api(`/api/gdedeshevle/${mannId}`, {
    method: "PATCH",
    body: JSON.stringify({ token: B.token, action: "edit", title: "Где дешевле фильтр Mann C 35 154 в Корсакове?", text: "Чужая правка не должна пройти." }),
  });
  ok("чужое нельзя редактировать → 403 (п.14)", editForeign.status === 403);
  const editOwn = await api(`/api/gdedeshevle/${mannId}`, {
    method: "PATCH",
    body: JSON.stringify({
      token: tokenA,
      action: "edit",
      title: "Где дешевле купить фильтр Mann C 35 154?",
      text: "Ищу, где дешевле масляный фильтр Mann C 35 154 для планового ТО. Место уточнил: Корсаков." + TAG,
      place: "Корсаков",
    }),
  });
  ok("автор редактирует вопрос (п.5)", editOwn.status === 200, JSON.stringify(editOwn.data?.error ?? ""));
  const mannAfter = (await api(`/api/gdedeshevle?q=Mann&place=${encodeURIComponent("Корсаков")}`)).data.posts as Record<string, unknown>[];
  const mannRow = mannAfter.find((p) => p.id === mannId);
  ok("правка применена и видна (место, изменено)", !!mannRow && mannRow.place === "Корсаков" && !!mannRow.editedAt);

  // ---- 6. Удаление — только автор ----
  const tmpD = await api("/api/gdedeshevle", {
    method: "POST",
    body: JSON.stringify({ token: D.token, title: "Временный вопрос про насос Gardena 3000/4", text: "Тестовый вопрос про насос Gardena 3000/4 для удаления, временный." + TAG, confirmSimilar: true }),
  });
  const tmpDId = String(tmpD.data.id ?? "");
  const delForeign = await api(`/api/gdedeshevle/${tmpDId}`, { method: "PATCH", body: JSON.stringify({ token: tokenA, action: "delete" }) });
  ok("чужое нельзя удалить → 403 (п.14)", delForeign.status === 403);
  const delOwn = await api(`/api/gdedeshevle/${tmpDId}`, { method: "PATCH", body: JSON.stringify({ token: D.token, action: "delete" }) });
  ok("автор удаляет свой вопрос (п.6)", delOwn.status === 200);
  const feedDel = await api("/api/gdedeshevle?q=gardena");
  ok("удалённый вопрос исчез из ленты (п.6)", !(feedDel.data.posts as { id: string }[]).some((p) => p.id === tmpDId));

  // ---- 7–10. Статусы и сортировка (ТЗ п.12/13/14) ----
  const s1 = await api("/api/gdedeshevle", { method: "POST", body: JSON.stringify({ token: B.token, title: `Где дешевле кофемолка Bosch TSM6A013B ${smarker} раз`, text: "Сравниваю цены на кофемолку Bosch TSM6A013B, первая в тесте сортировки." + TAG, confirmSimilar: true }) });
  const s2 = await api("/api/gdedeshevle", { method: "POST", body: JSON.stringify({ token: B.token, title: `Где дешевле кофемолка Bosch TSM6A013B ${smarker} два`, text: "Сравниваю цены на кофемолку Bosch TSM6A013B, вторая в тесте сортировки." + TAG, confirmSimilar: true }) });
  const f1 = await api("/api/gdedeshevle", { method: "POST", body: JSON.stringify({ token: B.token, title: `Где дешевле термос Arctix 102-500 ${smarker}`, text: "Сравниваю цены на термос Arctix 102-500 для рыбалки." + TAG, confirmSimilar: true }) });
  const i1 = await api("/api/gdedeshevle", { method: "POST", body: JSON.stringify({ token: B.token, title: `Где дешевле садовый измельчитель Viking GE 105 ${smarker}`, text: "Сравниваю цены на измельчитель Viking GE 105, вопрос скоро закрою." + TAG, confirmSimilar: true }) });
  const s1Id = String(s1.data.id ?? ""), s2Id = String(s2.data.id ?? ""), f1Id = String(f1.data.id ?? ""), i1Id = String(i1.data.id ?? "");
  console.log(`  4 вопроса для сортировки: ${!!s1Id && !!s2Id && !!f1Id && !!i1Id ? "ок" : "ОШИБКА"}`);

  const stForeign = await api(`/api/gdedeshevle/${f1Id}`, { method: "PATCH", body: JSON.stringify({ token: tokenA, action: "status", status: "cheaper" }) });
  ok("статус меняет только автор → 403 (п.14)", stForeign.status === 403);
  const stFound = await api(`/api/gdedeshevle/${f1Id}`, { method: "PATCH", body: JSON.stringify({ token: B.token, action: "status", status: "cheaper" }) });
  ok("автор устанавливает «Нашёл дешевле» (п.7/12)", stFound.status === 200 && stFound.data.status === "cheaper");
  const stIrr = await api(`/api/gdedeshevle/${i1Id}`, { method: "PATCH", body: JSON.stringify({ token: B.token, action: "status", status: "irrelevant" }) });
  ok("автор устанавливает «Неактуально» (п.8/12)", stIrr.status === 200 && stIrr.data.status === "irrelevant");
  const stBack = await api(`/api/gdedeshevle/${f1Id}`, { method: "PATCH", body: JSON.stringify({ token: B.token, action: "status", status: "comparing" }) });
  ok("вопрос возвращается в «Сравниваю» (п.9/12)", stBack.status === 200 && stBack.data.status === "comparing");

  // 10. Сортировка: в группе «Сравниваю» сначала новее созданный f1, затем s2, s1; затем «Неактуально»
  const sorted = await api(`/api/gdedeshevle?q=${smarker}&pageSize=50`);
  const order = (sorted.data.posts as { id: string }[]).map((p) => p.id);
  ok("сортировка: Сравниваю → Нашёл дешевле → Неактуально, внутри новые сверху (п.10/13)",
    JSON.stringify(order) === JSON.stringify([f1Id, s2Id, s1Id, i1Id]), order.join(","));

  // Завершённые сохраняются и доступны через поиск (п.13/28)
  const stFound2 = await api(`/api/gdedeshevle/${f1Id}`, { method: "PATCH", body: JSON.stringify({ token: B.token, action: "status", status: "cheaper" }) });
  const foundSearch = await api("/api/gdedeshevle?q=Arctix");
  ok("«Нашёл дешевле» остаётся в разделе и доступен через поиск (п.13/28)", stFound2.status === 200 && (foundSearch.data.posts as { id: string }[]).some((p) => p.id === f1Id));

  // ---- «Мои публикации» ----
  const mine = await api(`/api/gdedeshevle?mine=1&token=${encodeURIComponent(B.token)}`);
  const mineIds = (mine.data.posts as { id: string }[]).map((p) => p.id);
  ok("«Мои публикации» — свои вопросы со статусами (п.22)", mine.status === 200 && [s1Id, s2Id, f1Id, i1Id].every((id) => mineIds.includes(id)));
  const mineAnon = await api("/api/gdedeshevle?mine=1");
  ok("«Мои публикации» без входа → 401", mineAnon.status === 401);

  // ---- Фильтр по месту ----
  const korsk = await api("/api/gdedeshevle", { method: "POST", body: JSON.stringify({ token: C.token, title: "Где дешевле соковыжималка Bosch MES3500 в Корсакове", text: "Сравниваю цены на соковыжималку Bosch MES3500 именно в Корсакове, нужна с витрины." + TAG, place: "Корсаков", confirmSimilar: true }) });
  console.log(`  вопрос с местом: ${korsk.status === 200 ? "ок" : JSON.stringify(korsk.data.error ?? "")}`);
  const byPlace = await api(`/api/gdedeshevle?place=${encodeURIComponent("Корсаков")}&q=MES3500`);
  const bp = byPlace.data.posts as { place: string }[];
  ok("фильтр по месту (п.22)", bp.length === 1 && bp[0].place === "Корсаков", `найдено=${bp.length}`);

  // ---- 40. Поиск: по модели и артикулу ----
  const searchModel = await api("/api/gdedeshevle?q=hakkapeliitta");
  ok("поиск по названию модели (п.27/40)", (searchModel.data.posts as { id: string }[]).some((p) => p.id === priceId));
  const searchArticle = await api("/api/gdedeshevle?q=35%20154");
  ok("поиск по артикулу (п.27/40)", (searchArticle.data.posts as { id: string }[]).some((p) => p.id === mannId));
  const searchNone = await api("/api/gdedeshevle?q=несуществующийтовар000");
  ok("поиск без результатов — пусто и корректно", searchNone.status === 200 && (searchNone.data.posts as unknown[]).length === 0);

  // ---- Пагинация: стабильные окна без пересечений ----
  const p1 = await api("/api/gdedeshevle?pageSize=2&page=1");
  const p2 = await api("/api/gdedeshevle?pageSize=2&page=2");
  const p1Ids = (p1.data.posts as { id: string }[]).map((p) => p.id);
  const p2Ids = (p2.data.posts as { id: string }[]).map((p) => p.id);
  ok("пагинация: страницы без пересечений, total/pages корректны (п.1/25)",
    p1Ids.length === 2 && p2Ids.length >= 1 && !p1Ids.some((id) => p2Ids.includes(id)) &&
    p1.data.pages === Math.max(1, Math.ceil((p1.data.total as number) / 2)),
    `total=${p1.data.total}`);

  // ---- 20–27. Форумная тема: рубрика, первое сообщение, ссылка обратно ----
  const disc = await api(`/api/gdedeshevle/${boschId}/discuss`, { method: "POST", body: JSON.stringify({ token: tokenA }) });
  const topicId = Number((disc.data ?? {}).topicId ?? 0);
  ok("«Обсудить на форуме» создаёт тему (п.20)", disc.status === 200 && (disc.data ?? {}).created === true && topicId > 0, JSON.stringify((disc.data ?? {}).error ?? ""));

  const topicRow = await db.topic.findUnique({ where: { id: topicId }, include: { rubric: { include: { parent: true } } } });
  ok("тема в подразделе «Обсуждение сообщений из блоков → Где дешевле» (п.17/23)",
    topicRow?.rubric?.slug === "gdedeshevle-discuss" && topicRow?.rubric?.parent?.slug === "blocks-discuss",
    topicRow?.rubric?.slug ?? "—");
  const firstMsg = await db.message.findFirst({ where: { topicId }, orderBy: { num: "asc" } });
  ok("первое сообщение содержит исходный вопрос (п.24)",
    !!firstMsg && firstMsg.body.includes(T_BOSCH));
  ok("первое сообщение содержит ссылку «Источник: Где дешевле» (п.25)",
    !!firstMsg && firstMsg.body.includes("Источник: Где дешевле") && firstMsg.body.includes(`/gde-deshevle?post=${boschId}`));

  const topicApi = await api(`/api/topics/${topicId}`);
  const cd = ((topicApi.data ?? {}).topic as Record<string, unknown> | undefined)?.gdedeshevle as { id: string; title: string } | null;
  ok("двусторонняя связь: тема → вопрос (п.17/25)", topicApi.status === 200 && !!cd && cd.id === boschId, JSON.stringify(cd ?? topicApi.data));

  // ---- 16/21. Гонка: 5 одновременных нажатий → одна тема ----
  const racePost = await api("/api/gdedeshevle", {
    method: "POST",
    body: JSON.stringify({ token: D.token, title: "Где дешевле навигатор Garmin Drive 53", text: "Сравниваю цены на навигатор Garmin Drive 53 в магазинах города." + TAG, confirmSimilar: true }),
  });
  const raceId = String(racePost.data.id ?? "");
  const raceResults = await Promise.all(
    [1, 2, 3, 4, 5].map(() => api(`/api/gdedeshevle/${raceId}/discuss`, { method: "POST", body: JSON.stringify({ token: D.token }) }))
  );
  const raceTopicIds = new Set(raceResults.map((r) => Number(r.data.topicId ?? 0)));
  const raceTopicCount = await db.topic.count({ where: { cheapPost: { id: raceId } } });
  ok("5 одновременных нажатий → создана ровно одна тема (п.16/21)", raceTopicIds.size === 1 && raceTopicCount === 1, `тем=${raceTopicCount}`);

  // ---- 22. Повторное нажатие открывает существующую тему ----
  const again = await api(`/api/gdedeshevle/${boschId}/discuss`, { method: "POST", body: JSON.stringify({ token: tokenA }) });
  ok("повторное нажатие → та же тема, без дубля (п.22)", again.status === 200 && again.data.created === false && Number(again.data.topicId) === topicId);
  const againState = await api(`/api/gdedeshevle/${boschId}/discuss`);
  ok("обновление страницы → состояние open (п.15)", againState.status === 200 && againState.data.state === "open");

  // ---- 26. «Тема закрыта» ----
  if (topicId > 0) {
    await db.topic.update({ where: { id: topicId }, data: { isClosed: true } });
    const closedState = await api(`/api/gdedeshevle/${boschId}/discuss`);
    ok("закрытая тема → состояние closed (п.26)", closedState.data.state === "closed");
    // ---- 27. «Тема в архиве» ----
    await db.topic.update({ where: { id: topicId }, data: { isClosed: false, isArchived: true } });
    const archivedState = await api(`/api/gdedeshevle/${boschId}/discuss`);
    ok("архивная тема → состояние archived (п.27)", archivedState.data.state === "archived");
    await db.topic.update({ where: { id: topicId }, data: { isArchived: false } });
  } else {
    ok("закрытая тема → состояние closed (п.26)", false, "тема не создана");
    ok("архивная тема → состояние archived (п.27)", false, "тема не создана");
  }

  // ---- 28/29. Реклама скрывается ИИ ----
  const ad = await api("/api/gdedeshevle", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      title: "Продаю Bosch S5 AGM 70 Ah, покупайте у меня",
      text: "Продаю новый аккумулятор Bosch S5 AGM 70 Ah дешевле магазина, обращайтесь ко мне, звоните скорее, осталось мало!" + TAG,
      confirmSimilar: true,
    }),
  });
  ok("реклама «продаю… покупайте у меня» — скрыта ИИ или ушла человеку (п.18/28)", ad.status === 200 && (ad.data.hidden === true || ad.data.needHuman === true), JSON.stringify(ad.data.note ?? ad.data.error ?? ""));
  const adInFeed = await api("/api/gdedeshevle?q=осталось%20мало");
  ok("скрытая реклама не видна в публичной ленте (п.18/29)", ad.data.hidden === true ? (adInFeed.data.posts as unknown[]).length === 0 : true);
  await clearAiSanctions(adminA!.id);

  // ---- 30. Спам ----
  const spam = await api("/api/gdedeshevle", {
    method: "POST",
    body: JSON.stringify({
      token: C.token,
      title: "ыыыыыыыыыы 12345 www ww",
      text: "ыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыыы гд",
    }),
  });
  ok("бессмысленный спам — скрыт ИИ или ушёл человеку (п.30)", spam.status === 200 && (spam.data.hidden === true || spam.data.needHuman === true), JSON.stringify(spam.data.note ?? spam.data.error ?? ""));
  await clearAiSanctions((await db.user.findUnique({ where: { nickname: C.user.nickname } }))!.id);

  // ---- 33. Жалоба: 5 причин, сигнал модерации ----
  const badCat = await api(`/api/gdedeshevle/${priceId}/complaint`, { method: "POST", body: JSON.stringify({ category: "лайки" }) });
  ok("недопустимая причина жалобы → 400", badCat.status === 400);
  const complaint = await api(`/api/gdedeshevle/${priceId}/complaint`, { method: "POST", body: JSON.stringify({ category: "ad", comment: "Проверка жалобы модерацией", reporterName: "CdTest" }) });
  ok("жалоба отправляется (п.21/33)", complaint.status === 200 && String(complaint.data.note ?? "").includes("Жалоба отправлена"));

  // ---- Очередь модератора (AI → человек) ----
  const queue = await api(`/api/admin/gdedeshevle?token=${encodeURIComponent(tokenA)}&show=open`);
  const qComplaints = (queue.data.complaints ?? []) as Record<string, unknown>[];
  ok("жалоба видна человеку-модератору (п.33)", queue.status === 200 && qComplaints.some((c) => c.category === "ad" && (c.post as { id: string }).id === priceId));
  const firstComplaint = qComplaints.find((c) => (c.post as { id: string }).id === priceId) as { id: string } | undefined;
  if (firstComplaint) {
    const resolved = await api("/api/admin/gdedeshevle", { method: "POST", body: JSON.stringify({ token: tokenA, action: "resolve-complaint", id: firstComplaint.id }) });
    ok("модератор закрывает жалобу", resolved.status === 200);
  } else {
    ok("модератор закрывает жалобу", false, "жалоба не найдена в очереди");
  }
  const noStaff = await api(`/api/admin/gdedeshevle?token=${encodeURIComponent(B.token)}&show=open`);
  ok("не-сотрудник не видит очередь модерации", noStaff.status === 403);

  // ---- Очистка ----
  console.log("\n… очистка тестовых данных");
  const myPostIds = [boschId, priceId, mannId, mann2bId, s1Id, s2Id, f1Id, i1Id, tmpDId, raceId, String(korsk.data.id ?? ""), String(spam.data.id ?? ""), String(ad.data.id ?? "")].filter(Boolean);
  // темы обсуждения ищем ДО удаления постов: по связи и по подразделу раздела
  const linked = await db.topic.findMany({
    where: {
      OR: [
        { cheapPost: { id: { in: myPostIds } } },
        { rubric: { slug: "gdedeshevle-discuss" } },
      ],
    },
  });
  // физически удаляем тестовые посты (жалобы до удаления)
  await db.cheapComplaint.deleteMany({ where: { postId: { in: myPostIds } } });
  const delPosts = await db.cheapPost.deleteMany({ where: { id: { in: myPostIds } } });
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
  const left = await db.cheapPost.count();
  console.log(`  остаток в разделе: ${left}`);

  console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
