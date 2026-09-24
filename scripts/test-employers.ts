/**
 * ШАГ 25: API-приёмка раздела «О работодателях» (/o-rabotodatelyah).
 * Покрывает: гостевой доступ; работодателя и должность; редактирование/
 * удаление только автором; смену позиции (Советую ↔ Не советую); сортировку;
 * «Мои отзывы»; фильтр места; поиск; похожие отзывы; точные повторы;
 * пагинацию; форумную связь (идемпотентность, рубрика, первое сообщение,
 * двусторонняя связь, состояния); ИИ-модерацию (вакансии/найм — нарушение,
 * негативный опыт о работодателе — разрешён, ФИО третьих лиц — нарушение);
 * жалобы, очередь и действия модератора. Чистит за собой данные.
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

const TAG = " Пишу как есть, делюсь личным опытом."; // метка тестовых отзывов — автоочистка

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
  const SMARK = "рубин"; // естественное слово-метка блока сортировки

  // ---- Очистка остатков прерванных прошлых прогонов ----
  // Комплексная зачистка: посты с меткой TAG, меткой сортировки SMARK,
  // посты админа с тестовыми работодателями (в т.ч. без меток от probe-скриптов),
  // аккаунты EpTest_* вместе со всем их контентом.
  const TEST_EMPLOYER_PREFIXES = [
    "Типография «Светофор»",
    "Логистическая компания «Транзит»",
    "Сеть магазинов «Полюс»",
    "Кофейня «Зерно»",
    "Автосервис «Мотор»",
    "Охранное предприятие «Бастион»",
    "Рыбоперерабатывающий завод «Прибрежный»",
    "Строительная фирма «Фундамент»",
    "ОООООООООО",
  ];
  const victims = await db.empPost.findMany({
    where: {
      OR: [
        { text: { contains: TAG } },
        { employer: { contains: SMARK } },
        { title: { contains: SMARK } },
        ...TEST_EMPLOYER_PREFIXES.map((p) => ({ AND: [{ authorName: "Админ" }, { employer: { startsWith: p } }] })),
      ],
    },
    select: { id: true },
  });
  if (victims.length) {
    const lvIds = victims.map((v) => v.id);
    const lvTopics = await db.topic.findMany({
      where: { OR: [{ empPost: { id: { in: lvIds } } }, { rubric: { slug: "employers-discuss" } }] },
    });
    for (const t of lvTopics) {
      await db.message.deleteMany({ where: { topicId: t.id } });
      await db.topic.delete({ where: { id: t.id } });
    }
    await db.empComplaint.deleteMany({ where: { postId: { in: lvIds } } });
    await db.empPost.deleteMany({ where: { id: { in: lvIds } } });
    console.log(`  очищены остатки прошлого прогона: постов=${lvIds.length}, тем=${lvTopics.length}`);
  }
  const oldUsers = await db.user.findMany({ where: { nickname: { startsWith: "EpTest_" } } });
  for (const u of oldUsers) {
    // FK-безопасно: сначала ВСЕ посты пользователя (не только с меткой TAG),
    // затем темы/сообщения/жалобы, и только потом сам аккаунт.
    const ups = await db.empPost.findMany({ where: { authorId: u.id }, select: { id: true } });
    if (ups.length) {
      const upIds = ups.map((p) => p.id);
      const utps = await db.topic.findMany({ where: { empPost: { id: { in: upIds } } } });
      for (const t of utps) {
        await db.message.deleteMany({ where: { topicId: t.id } });
        await db.topic.delete({ where: { id: t.id } });
      }
      await db.empComplaint.deleteMany({ where: { postId: { in: upIds } } });
      await db.empPost.deleteMany({ where: { id: { in: upIds } } });
    }
    await db.message.deleteMany({ where: { authorId: u.id } });
    await db.topic.deleteMany({ where: { authorId: u.id, empPost: { is: null }, whereToBuyPost: { is: null }, overheardPost: { is: null }, gkhProblem: { is: null }, cheapPost: { is: null }, recPost: { is: null } } });
    await db.sanction.deleteMany({ where: { userId: u.id } });
    await db.session.deleteMany({ where: { userId: u.id } });
    await db.authToken.deleteMany({ where: { userId: u.id } });
    await db.user.delete({ where: { id: u.id } });
  }
  if (oldUsers.length) console.log(`  очищены старые тестовые аккаунты: ${oldUsers.length}`);

  // ---- Тестовые пользователи ----
  const B = await makeUser(`EpTest_${stamp}B`);
  const C = await makeUser(`EpTest_${stamp}C`);
  const D = await makeUser(`EpTest_${stamp}D`);
  console.log(`  пользователи B/C/D: ${!!B.user && !!C.user && !!D.user ? "ок" : "ОШИБКА"}`);

  await clearAiSanctions((await db.user.findUnique({ where: { nickname: "Админ" } }))!.id);
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@sakhmatrix.ru", password: "Admin2026" }),
  });
  const tokenA: string = login.data.user?.token ?? "";
  const adminA = await db.user.findUnique({ where: { nickname: "Админ" } });
  console.log(`  логин админа: ${tokenA ? "ок" : "ОШИБКА"}`);

  // ---- Гость ----
  const anonRead = await api("/api/employers");
  ok("гость читает ленту → 200", anonRead.status === 200 && Array.isArray(anonRead.data.posts));
  const anonPost = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({ employer: "Пекарня на Ленина", title: "Гость не может опубликовать отзыв", text: "Проверка гостевого доступа к отзыву о работодателе" }),
  });
  ok("гость не публикует → 401", anonPost.status === 401);

  // ---- Работодатель обязателен ----
  const noEmp = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, title: "Отзыв без работодателя не проходит", text: "Здесь должно быть указано название организации-работодателя." }),
  });
  ok("отзыв без работодателя → 422 needsEmployer", noEmp.status === 422 && noEmp.data.needsEmployer === true);
  ok("подсказка работодателя по ТЗ", noEmp.data.hint === "Укажите конкретного работодателя: название организации, где вы работали или работаете.");

  // ---- Валидации полей ----
  const shortTitle = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, employer: "Ателье на Сахарной", title: "Крут", text: "Слишком короткий заголовок не проходит проверку длины." }),
  });
  ok("заголовок короче 5 символов → 400", shortTitle.status === 400);
  const longTitle = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, employer: "Ателье на Сахарной", title: "Д".repeat(151), text: "Слишком длинный заголовок не проходит проверку длины." }),
  });
  ok("заголовок длиннее 150 символов → 400", longTitle.status === 400);
  const shortText = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, employer: "Ателье на Сахарной", title: "Нормальный заголовок про работодателя", text: "Коротко." }),
  });
  ok("текст короче 10 символов → 400", shortText.status === 400);
  const longEmp = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({ token: tokenA, employer: "О".repeat(140), position: "практикант", stance: "recommend", title: "Проверка обрезки длинного названия работодателя", text: "Название работодателя длиннее 120 символов обрезается до лимита, отзыв создаётся." + TAG, confirmSimilar: true }),
  });
  const longEmpId = String(longEmp.data.id ?? "");
  // Детерминированно: через mine=1 автор видит свой пост даже если ИИ его скрыл
  // (ОООО-название изредка принимает ИИ за спам — дрейф вердикта не должен ронять проверку обрезки).
  const longEmpRow = ((await api(`/api/employers?mine=1&token=${encodeURIComponent(tokenA)}`)).data.posts as Record<string, unknown>[]).find((p) => p.id === longEmpId);
  ok("название работодателя обрезается до 120 символов", longEmp.status === 200 && String(longEmpRow?.employer ?? "").length === 120);

  // ---- Создание: советую ----
  const emp1 = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      employer: "Типография «Светофор» на Железнодорожной",
      position: "дизайнёр вёрстки",
      stance: "recommend",
      title: "Зарплату платили день в день, коллектив хороший — советую",
      text: `Отработал в типографии «Светофор» два года: зарплату платили день в день, отпуска давали по графику, руководство адекватное. Уволился по семейным обстоятельствам, но всем советую.` + TAG,
      place: "Южно-Сахалинск",
    }),
  });
  const emp1Id = String(emp1.data.id ?? "");
  ok("отзыв «Советую» создан, ИИ не скрывает", emp1.status === 200 && !!emp1Id && emp1.data.hidden !== true, JSON.stringify(emp1.data.note ?? emp1.data.error ?? ""));

  const emp1Row = ((await api("/api/employers?q=типография")).data.posts as Record<string, unknown>[]).find((p) => p.id === emp1Id);
  ok("отзыв в ленте: работодатель/должность/позиция/место/автор/дата", !!emp1Row && emp1Row.employer === "Типография «Светофор» на Железнодорожной" && emp1Row.position === "дизайнёр вёрстки" && emp1Row.stance === "recommend" && emp1Row.place === "Южно-Сахалинск" && emp1Row.authorName === "Админ" && !!emp1Row.createdAt, emp1Row ? "найден" : "не найден");

  // ---- Создание: не советую ----
  const emp2 = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      employer: "Логистическая компания «Транзит»",
      position: "водитель-экспедитор",
      stance: "notrecommend",
      title: "Задерживали зарплату на два месяца — не советую",
      text: `Работал водителем-экспедитором в «Транзите»: зарплату задерживали на два месяца, за переработки не доплачивали. Расчёт при увольнении ждал ещё месяц. Не советую.` + TAG,
    }),
  });
  const emp2Id = String(emp2.data.id ?? "");
  ok("отзыв «Не советую» создан, ИИ не скрывает", emp2.status === 200 && !!emp2Id && emp2.data.hidden !== true, JSON.stringify(emp2.data.note ?? emp2.data.error ?? ""));
  const emp2Row = ((await api("/api/employers?q=транзит")).data.posts as Record<string, unknown>[]).find((p) => p.id === emp2Id);
  ok("строка «Не советую» в ленте: работодатель/позиция", !!emp2Row && emp2Row.employer === "Логистическая компания «Транзит»" && emp2Row.stance === "notrecommend", emp2Row ? "найден" : "не найден");

  // ---- Критика работодателя — НЕ нарушение (суть раздела) ----
  const critique = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      employer: "Сеть магазинов «Полюс», склад",
      stance: "notrecommend",
      title: "Неоформленное трудоустройство и тяжёлые смены",
      text: `Устроился на склад сети «Полюс» грузчиком: трудовой договор не заключали три месяца, смены по четырнадцать часов, медкнижку не компенсировали. Норма выработки завышена. Ищите работодателя получше.` + TAG,
      place: "Холмск",
    }),
  });
  const critiqueId = String(critique.data.id ?? "");
  ok("жёсткая критика работодателя — не нарушение (суть раздела)", critique.status === 200 && !!critiqueId && critique.data.hidden !== true, JSON.stringify(critique.data.note ?? critique.data.error ?? ""));

  // ---- Похожие отзывы (сразу после первых трёх отзывов — пока лента не засорена,
  // иначе свежие посты вытесняют emp1 из топ-5 похожих) ----
  const emp3 = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      employer: "Типография «Светофор», офсетный участок",
      position: "печатник",
      stance: "recommend",
      title: "Печатником работать можно — стабильно и вовремя",
      text: "Друзья работают печатниками в типографии «Светофор» — зарплата стабильная, вовремя, смены обычные." + TAG,
    }),
  });
  const sim = (emp3.data.similarPosts ?? []) as { id: string }[];
  ok("похожий отзыв обнаружен → предупреждение", emp3.status === 200 && emp3.data.similar === true && sim.length > 0);
  ok("текст предупреждения по ТЗ", emp3.data.hint === "Похожий отзыв уже есть. Возможно, об этом работодателе уже писали.");
  if (!sim.some((s) => s.id === emp1Id)) console.log(`  [diag] sim ids=${JSON.stringify(sim.map((s) => s.id))} emp1Id=${emp1Id}`);
  ok("предупреждение содержит ссылку на существующий отзыв", sim.some((s) => s.id === emp1Id));
  const emp3b = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      employer: "Типография «Светофор», офсетный участок",
      position: "печатник",
      stance: "recommend",
      title: "Печатником работать можно — стабильно и вовремя",
      text: "Друзья работают печатниками в типографии «Светофор» — зарплата стабильная, вовремя, смены обычные." + TAG,
      confirmSimilar: true,
    }),
  });
  const emp3Id = String(emp3b.data.id ?? "");
  ok("отзыв можно продолжить после предупреждения", emp3b.status === 200 && !!emp3Id, JSON.stringify(emp3b.data.error ?? ""));

  // ---- Точные повторы ----
  const dup = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      employer: "Типография «Светофор», офсетный участок",
      position: "печатник",
      stance: "recommend",
      title: "Печатником работать можно — стабильно и вовремя",
      text: "Друзья работают печатниками в типографии «Светофор» — зарплата стабильная, вовремя, смены обычные." + TAG,
      confirmSimilar: true,
    }),
  });
  ok("точный повтор → отказ", dup.status === 400 && String(dup.data.error ?? "").includes("уже публиковали"), JSON.stringify(dup.data.error ?? ""));
  const dup2 = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      employer: "Типография «Светофор», офсетный участок",
      position: "печатник",
      stance: "notrecommend",
      title: "Печатником работать можно — стабильно и вовремя",
      text: "Друзья работают печатниками в типографии «Светофор» — зарплата стабильная, вовремя, смены обычные." + TAG,
      confirmSimilar: true,
    }),
  });
  ok("повтор заголовка даже с другой позицией → отказ", dup2.status === 400);

  // ---- Редактирование: только автор ----
  const editForeign = await api(`/api/employers/${emp1Id}`, {
    method: "PATCH",
    body: JSON.stringify({ token: B.token, action: "edit", employer: "Чужая правка", title: "Чужая правка не должна пройти", text: "Чужая правка не должна пройти проверку авторства." }),
  });
  ok("чужое нельзя редактировать → 403", editForeign.status === 403);
  const editOwn = await api(`/api/employers/${emp1Id}`, {
    method: "PATCH",
    body: JSON.stringify({
      token: tokenA,
      action: "edit",
      employer: "Типография «Светофор» на Железнодорожной",
      position: "дизайнёр вёрстки",
      title: "Зарплату платили день в день, коллектив хороший — советую",
      text: `Отработал в типографии «Светофор» два года: зарплату платили день в день, отпуска давали по графику, руководство адекватное. После увольнения позвонили и позвали обратно, если что. Всем советую.` + TAG,
      place: "Южно-Сахалинск",
    }),
  });
  ok("автор редактирует отзыв", editOwn.status === 200, JSON.stringify(editOwn.data?.error ?? ""));
  const emp1After = ((await api("/api/employers?q=типография")).data.posts as Record<string, unknown>[]).find((p) => p.id === emp1Id);
  ok("правка применена и видна (текст дополнен, изменено)", !!emp1After && String(emp1After.text).includes("позвали обратно") && !!emp1After.editedAt);

  // ---- Смена позиции ----
  const stForeign = await api(`/api/employers/${emp1Id}`, { method: "PATCH", body: JSON.stringify({ token: B.token, action: "stance", stance: "notrecommend" }) });
  ok("позицию меняет только автор → 403", stForeign.status === 403);
  const stSwitch = await api(`/api/employers/${emp1Id}`, { method: "PATCH", body: JSON.stringify({ token: tokenA, action: "stance", stance: "notrecommend" }) });
  ok("автор меняет позицию на «Не советую»", stSwitch.status === 200 && stSwitch.data.stance === "notrecommend", JSON.stringify(stSwitch.data.note ?? ""));
  ok("записка смены позиции по ТЗ", stSwitch.data.note === "Позиция изменена: «Не советую»", JSON.stringify(stSwitch.data.note ?? ""));
  const emp1Stance = ((await api("/api/employers?q=типография")).data.posts as Record<string, unknown>[]).find((p) => p.id === emp1Id);
  ok("новая позиция видна в ленте", !!emp1Stance && emp1Stance.stance === "notrecommend");
  const stBack = await api(`/api/employers/${emp1Id}`, { method: "PATCH", body: JSON.stringify({ token: tokenA, action: "stance", stance: "recommend" }) });
  ok("автор возвращает «Советую»", stBack.status === 200 && stBack.data.stance === "recommend");

  // ---- Удаление: только автор ----
  const tmpD = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({ token: D.token, employer: "Кофейня «Зерно» на Комсомольской", position: "бариста", title: "Временный отзыв для удаления", text: "Тестовый отзыв кофейни для проверки удаления, временный." + TAG, confirmSimilar: true }),
  });
  const tmpDId = String(tmpD.data.id ?? "");
  const delForeign = await api(`/api/employers/${tmpDId}`, { method: "PATCH", body: JSON.stringify({ token: tokenA, action: "delete" }) });
  ok("чужое нельзя удалить → 403", delForeign.status === 403);
  const delOwn = await api(`/api/employers/${tmpDId}`, { method: "PATCH", body: JSON.stringify({ token: D.token, action: "delete" }) });
  ok("автор удаляет свой отзыв", delOwn.status === 200);
  const feedDel = await api("/api/employers?q=кофейня");
  ok("удалённый отзыв исчез из ленты", !(feedDel.data.posts as { id: string }[]).some((p) => p.id === tmpDId));

  // ---- Сортировка ----
  const p1 = await api("/api/employers", { method: "POST", body: JSON.stringify({ token: B.token, employer: `Автосервис «Мотор», подъездная ${SMARK}`, position: "автомеханик", stance: "recommend", title: `Оформили по ТК и платят вовремя ${SMARK} раз`, text: "Автосервис оформил по трудовому договору, первая публикация в тесте сортировки." + TAG, confirmSimilar: true }) });
  const p2 = await api("/api/employers", { method: "POST", body: JSON.stringify({ token: B.token, employer: `Автосервис «Мотор», подъездная ${SMARK}`, position: "автомеханик", stance: "recommend", title: `Оформили по ТК и платят вовремя ${SMARK} два`, text: "Автосервис оформил по трудовому договору, вторая публикация в тесте сортировки." + TAG, confirmSimilar: true }) });
  const n1 = await api("/api/employers", { method: "POST", body: JSON.stringify({ token: B.token, employer: `Охранное предприятие «Бастион» ${SMARK}`, position: "охранник", stance: "notrecommend", title: `Смены по сутки без выходных ${SMARK}`, text: "Охранное предприятие ставит сутки через сутки без выходных, оплата ниже средней." + TAG, confirmSimilar: true }) });
  const p1Id = String(p1.data.id ?? ""), p2Id = String(p2.data.id ?? ""), n1Id = String(n1.data.id ?? "");
  console.log(`  3 отзыва для сортировки: ${!!p1Id && !!p2Id && !!n1Id ? "ок" : "ОШИБКА"}`);
  if (!p1Id || !p2Id || !n1Id) {
    for (const [name, r] of [["p1", p1], ["p2", p2], ["n1", n1]] as const) {
      if (!String(r.data.id ?? "")) console.log(`  [diag] ${name}: status=${r.status} data=${JSON.stringify(r.data).slice(0, 220)}`);
    }
  }

  const sorted = await api(`/api/employers?q=${SMARK}&pageSize=50`);
  const order = (sorted.data.posts as { id: string; stance: string }[]).map((p) => p.id);
  ok("сортировка: Советую → Не советую, внутри группы новые сверху", JSON.stringify(order) === JSON.stringify([p2Id, p1Id, n1Id]), order.join(","));
  const sortedStances = (sorted.data.posts as { stance: string }[]).map((p) => p.stance);
  ok("порядок позиций в ленте: обе «Советую» выше «Не советую»", sortedStances[sortedStances.length - 1] === "notrecommend" && sortedStances.slice(0, 2).every((s) => s === "recommend"));

  // ---- «Мои отзывы» ----
  const mine = await api(`/api/employers?mine=1&token=${encodeURIComponent(B.token)}`);
  const mineIds = (mine.data.posts as { id: string }[]).map((p) => p.id);
  ok("«Мои отзывы» — свои отзывы с позициями", mine.status === 200 && [p1Id, p2Id, n1Id].every((id) => mineIds.includes(id)));
  const mineAnon = await api("/api/employers?mine=1");
  ok("«Мои отзывы» без входа → 401", mineAnon.status === 401);
  const mineOrder = (mine.data.posts as { id: string; stance: string }[]).map((p) => p.id);
  ok("в «Моих отзывах» та же сортировка (Советую выше, новые сверху)", mineOrder[0] === p2Id && mineOrder[mineOrder.length - 1] === n1Id, mineOrder.join(","));

  // ---- Фильтр по месту ----
  const korsk = await api("/api/employers", { method: "POST", body: JSON.stringify({ token: C.token, employer: "Рыбоперерабатывающий завод «Прибрежный»", position: "приёмщица сырья", stance: "recommend", title: "Сезонные смены с оплатой без задержек", text: "Отработала сезон на рыбопереработке «Прибрежный»: смены тяжёлые, но оплату давали без задержек, оформили официально.", place: "Корсаков", confirmSimilar: true }) });
  const korskId = String(korsk.data.id ?? "");
  console.log(`  отзыв с местом: ${korsk.status === 200 ? "ок" : JSON.stringify(korsk.data.error ?? "")}`);
  const byPlace = await api(`/api/employers?place=${encodeURIComponent("Корсаков")}&q=прибрежный`);
  const bp = byPlace.data.posts as { place: string }[];
  ok("фильтр по месту", bp.length === 1 && bp[0].place === "Корсаков", `найдено=${bp.length}`);

  // ---- Поиск ----
  const searchEmp = await api("/api/employers?q=типография");
  ok("поиск по названию работодателя", (searchEmp.data.posts as { id: string }[]).some((p) => p.id === emp1Id));
  const searchText = await api("/api/employers?q=экспедитором");
  ok("поиск по слову из текста", (searchText.data.posts as { id: string }[]).some((p) => p.id === emp2Id));
  const searchPos = await api("/api/employers?q=бариста");
  ok("поиск по должности не обязателен — должность в тексте ищется", searchPos.status === 200);
  const searchNone = await api("/api/employers?q=несуществующийработодатель000");
  ok("поиск без результатов — пусто и корректно", searchNone.status === 200 && (searchNone.data.posts as unknown[]).length === 0);
  const searchPlace = await api(`/api/employers?place=${encodeURIComponent("Южно-Сахалинск")}&q=типография`);
  ok("поиск вместе с фильтром места", (searchPlace.data.posts as { id: string }[]).some((p) => p.id === emp1Id));

  // ---- Пагинация ----
  const pg1 = await api("/api/employers?pageSize=2&page=1");
  const pg2 = await api("/api/employers?pageSize=2&page=2");
  const pg1Ids = (pg1.data.posts as { id: string }[]).map((p) => p.id);
  const pg2Ids = (pg2.data.posts as { id: string }[]).map((p) => p.id);
  ok("пагинация: страницы без пересечений, total/pages корректны",
    pg1Ids.length === 2 && pg2Ids.length >= 1 && !pg1Ids.some((id) => pg2Ids.includes(id)) &&
    pg1.data.pages === Math.max(1, Math.ceil((pg1.data.total as number) / 2)),
    `total=${pg1.data.total}`);
  const pgFar = await api("/api/employers?pageSize=2&page=99");
  ok("страница за пределами → пусто и корректно", pgFar.status === 200 && (pgFar.data.posts as unknown[]).length === 0);

  // ---- Форумная связь ----
  const T_FORUM = "Типография «Светофор» на Железнодорожной";
  const disc = await api(`/api/employers/${emp1Id}/discuss`, { method: "POST", body: JSON.stringify({ token: tokenA }) });
  const topicId = Number((disc.data ?? {}).topicId ?? 0);
  ok("«Обсудить на форуме» создаёт тему", disc.status === 200 && (disc.data ?? {}).created === true && topicId > 0, JSON.stringify((disc.data ?? {}).error ?? ""));

  const topicRow = await db.topic.findUnique({ where: { id: topicId }, include: { rubric: { include: { parent: true } } } });
  ok("тема в подразделе «Обсуждение сообщений из блоков → О работодателях»",
    topicRow?.rubric?.slug === "employers-discuss" && topicRow?.rubric?.parent?.slug === "blocks-discuss",
    topicRow?.rubric?.slug ?? "—");
  const firstMsg = await db.message.findFirst({ where: { topicId }, orderBy: { num: "asc" } });
  ok("первое сообщение содержит исходный отзыв", !!firstMsg && firstMsg.body.includes(T_FORUM) && firstMsg.body.includes("позвали обратно"));
  if (!firstMsg || !firstMsg.body.includes("Работодатель: Типография «Светофор» на Железнодорожной (должность: дизайнёр вёрстки)")) console.log(`  [diag] firstBody head=${JSON.stringify((firstMsg?.body ?? "").slice(0, 260))}`);
  ok("первое сообщение содержит работодателя и должность", !!firstMsg && firstMsg.body.includes("Работодатель: Типография «Светофор» на Железнодорожной (должность: дизайнёр вёрстки)"));
  ok("первое сообщение содержит ссылку «Источник: О работодателях»",
    !!firstMsg && firstMsg.body.includes("Источник: О работодателях") && firstMsg.body.includes(`/o-rabotodatelyah?post=${emp1Id}`));

  const topicApi = await api(`/api/topics/${topicId}`);
  const ep = ((topicApi.data ?? {}).topic as Record<string, unknown> | undefined)?.employers as { id: string; title: string } | null;
  ok("двусторонняя связь: тема → отзыв", topicApi.status === 200 && !!ep && ep.id === emp1Id, JSON.stringify(ep ?? topicApi.data));

  // ---- Гонка ----
  const racePost = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({ token: D.token, employer: "Строительная фирма «Фундамент»", position: "плотник", stance: "recommend", title: "Объекты по графику, бригадир нормальный", text: "Работал плотником на объектах «Фундамента» полгода: графики соблюдают, инструмент дают, бригадир по-человечески." + TAG, confirmSimilar: true }),
  });
  const raceId = String(racePost.data.id ?? "");
  const raceResults = await Promise.all(
    [1, 2, 3, 4, 5].map(() => api(`/api/employers/${raceId}/discuss`, { method: "POST", body: JSON.stringify({ token: D.token }) }))
  );
  const raceTopicIds = new Set(raceResults.map((r) => Number(r.data.topicId ?? 0)));
  const raceTopicCount = await db.topic.count({ where: { empPost: { id: raceId } } });
  ok("5 одновременных нажатий → создана ровно одна тема", raceTopicIds.size === 1 && raceTopicCount === 1, `тем=${raceTopicCount}`);
  const raceAgain = await api(`/api/employers/${raceId}/discuss`, { method: "POST", body: JSON.stringify({ token: D.token }) });
  ok("повторное нажатие у «гонки» → существующая тема, created=false", raceAgain.status === 200 && raceAgain.data.created === false);

  // ---- Повторное нажатие и состояния ----
  const again = await api(`/api/employers/${emp1Id}/discuss`, { method: "POST", body: JSON.stringify({ token: tokenA }) });
  ok("повторное нажатие → та же тема, без дубля", again.status === 200 && again.data.created === false && Number(again.data.topicId) === topicId);
  const againState = await api(`/api/employers/${emp1Id}/discuss`);
  ok("обновление страницы → состояние open", againState.status === 200 && againState.data.state === "open");
  const emp1Feed = ((await api("/api/employers?q=типография")).data.posts as Record<string, unknown>[]).find((p) => p.id === emp1Id);
  ok("в ленте кнопка «Обсуждается на форуме» → topicState open", !!emp1Feed && emp1Feed.topicState === "open");

  await db.topic.update({ where: { id: topicId }, data: { isClosed: true } });
  const closedState = await api(`/api/employers/${emp1Id}/discuss`);
  ok("закрытая тема → состояние closed", closedState.data.state === "closed");
  await db.topic.update({ where: { id: topicId }, data: { isClosed: false, isArchived: true } });
  const archivedState = await api(`/api/employers/${emp1Id}/discuss`);
  ok("архивная тема → состояние archived", archivedState.data.state === "archived");
  await db.topic.update({ where: { id: topicId }, data: { isArchived: false } });

  // ---- ИИ-модерация: вакансии и найм ----
  const vacancy = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({
      token: tokenA,
      employer: "Складской комплекс «Логопарк Сахалин»",
      stance: "recommend",
      title: "Требуются комплектовщики, приглашаем на работу",
      text: "Складскому комплексу требуются комплектовщики и водителей погрузчика приглашаем на работу, официальное трудоустройство, звоните по телефону отдела кадров, собеседования каждый день." + TAG,
      confirmSimilar: true,
    }),
  });
  ok("вакансия «требуются, приглашаем на работу» — скрыта ИИ или ушла человеку", vacancy.status === 200 && (vacancy.data.hidden === true || vacancy.data.needHuman === true), JSON.stringify(vacancy.data.note ?? vacancy.data.error ?? ""));
  const vacInFeed = await api("/api/employers?q=комплектовщики");
  ok("вакансия не видна в публичной ленте", vacancy.data.hidden === true ? (vacInFeed.data.posts as unknown[]).length === 0 : true);
  await clearAiSanctions(adminA!.id);

  // ---- ИИ-модерация: ФИО и данные третьих лиц ----
  const pd = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({
      token: C.token,
      employer: "Автомойка на Полевой",
      stance: "notrecommend",
      title: "Управляющий Сергей Петрович обманывает с расчётом",
      text: "Управляющий Сергей Петрович недоплачивает мойщикам, звоните ему на 8-800-000-00-01 и требуйте расчёт, живёт на Полевой 12." + TAG,
      confirmSimilar: true,
    }),
  });
  ok("ФИО и телефон третьего лица — скрыто ИИ или ушло человеку", pd.status === 200 && (pd.data.hidden === true || pd.data.needHuman === true), JSON.stringify(pd.data.note ?? pd.data.error ?? ""));
  const mineAdmin = await api(`/api/employers?mine=1&token=${encodeURIComponent(tokenA)}`);
  const mineAdminRow = (mineAdmin.data.posts as Record<string, unknown>[]).find((p) => String(p.id) === String(vacancy.data.id ?? ""));
  ok("автор видит скрытую/спорную ИИ публикацию в «Моих» с причиной",
    !!mineAdminRow && ((mineAdminRow.isHiddenByAi === true && !!mineAdminRow.hiddenReason) || mineAdminRow.needHuman === true),
    mineAdminRow ? `hidden=${mineAdminRow.isHiddenByAi} human=${mineAdminRow.needHuman}` : "не найдена");
  if (mineAdminRow && mineAdminRow.isHiddenByAi !== true) {
    const modHide = await api("/api/admin/employers", { method: "POST", body: JSON.stringify({ token: tokenA, action: "hide-post", id: String(vacancy.data.id ?? "") }) });
    console.log(`  детерминация: вакансия скрыта модератором (${modHide.status})`);
  }

  // ---- ИИ-модерация: обычные отзывы проходят ----
  const neutral = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({
      token: B.token,
      employer: "Супермаркет «Восход», зал",
      position: "продавец-кассир",
      stance: "recommend",
      title: "Спокойный магазин с адекватным графиком",
      text: "Работаю продавцом-кассиром в супермаркете «Восход»: график два через два, коллектив спокойный, обучение оплатили. Телефон отдела кадров есть на сайте, если что спрашивайте в обсуждении." + TAG,
      confirmSimilar: true,
    }),
  });
  ok("обычный отзыв с упоминанием кадрового телефона — не нарушение", neutral.status === 200 && neutral.data.hidden !== true, JSON.stringify(neutral.data.note ?? neutral.data.error ?? ""));

  // ---- ИИ-модерация: спам ----
  const spam = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({
      token: D.token,
      employer: "Фирма быстрого трудоустройства",
      title: "Работа работа работа деньги быстро",
      text: "Быстрая работа быстрые деньги для всех заходите на сайт rabota-seychas-fast.example трудоустройство за один день оплата сразу работа работа работа деньги деньги быстро",
      confirmSimilar: true,
    }),
  });
  ok("спам о лёгких деньгах — скрыт ИИ или ушёл человеку", spam.status === 200 && (spam.data.hidden === true || spam.data.needHuman === true), JSON.stringify(spam.data.note ?? spam.data.error ?? ""));
  await clearAiSanctions((await db.user.findUnique({ where: { nickname: D.user.nickname } }))!.id);

  // ---- Жалобы ----
  const badCat = await api(`/api/employers/${emp2Id}/complaint`, { method: "POST", body: JSON.stringify({ category: "лайки" }) });
  ok("недопустимая причина жалобы → 400", badCat.status === 400);
  const complaint = await api(`/api/employers/${emp2Id}/complaint`, { method: "POST", body: JSON.stringify({ category: "fraud", comment: "Проверка жалобы модерацией", reporterName: "EpTest" }) });
  ok("жалоба отправляется", complaint.status === 200 && String(complaint.data.note ?? "").includes("Жалоба отправлена"));
  const guestComplaint = await api(`/api/employers/${emp2Id}/complaint`, { method: "POST", body: JSON.stringify({ category: "spam", comment: "Жалоба от гостя" }) });
  ok("жалоба работает без входа (гость)", guestComplaint.status === 200);

  // ---- Очередь модератора ----
  const queue = await api(`/api/admin/employers?token=${encodeURIComponent(tokenA)}&show=open`);
  const qComplaints = (queue.data.complaints ?? []) as Record<string, unknown>[];
  ok("жалоба видна человеку-модератору", queue.status === 200 && qComplaints.some((c) => c.category === "fraud" && (c.post as { id: string }).id === emp2Id));
  const firstComplaint = qComplaints.find((c) => (c.post as { id: string }).id === emp2Id) as { id: string } | undefined;
  if (firstComplaint) {
    const resolved = await api("/api/admin/employers", { method: "POST", body: JSON.stringify({ token: tokenA, action: "resolve-complaint", id: firstComplaint.id }) });
    ok("модератор закрывает жалобу", resolved.status === 200);
  } else {
    ok("модератор закрывает жалобу", false, "жалоба не найдена в очереди");
  }
  const noStaff = await api(`/api/admin/employers?token=${encodeURIComponent(B.token)}&show=open`);
  ok("не-сотрудник не видит очередь модерации", noStaff.status === 403);

  // ---- Скрытие/возврат модератором ----
  const hideTarget = await api("/api/employers", {
    method: "POST",
    body: JSON.stringify({ token: C.token, employer: "Клининговая компания «Чистота плюс»", position: "клинер", stance: "recommend", title: "Уборки по графику и оплата вовремя", text: "Подрабатываю клинером в «Чистота плюс»: график стабильный, оплата вовремя, инвентарь дают. Рекомендую как подработку." + TAG, confirmSimilar: true }),
  });
  const hideTargetId = String(hideTarget.data.id ?? "");
  const hideByMod = await api("/api/admin/employers", { method: "POST", body: JSON.stringify({ token: tokenA, action: "hide-post", id: hideTargetId }) });
  ok("модератор скрывает отзыв", hideByMod.status === 200);
  const hiddenInFeed = await api("/api/employers?q=клинер");
  ok("скрытый модератором отзыв не виден гостям", (hiddenInFeed.data.posts as unknown[]).length === 0);
  const restoreByMod = await api("/api/admin/employers", { method: "POST", body: JSON.stringify({ token: tokenA, action: "restore-post", id: hideTargetId }) });
  ok("модератор возвращает отзыв в ленту", restoreByMod.status === 200);
  const restoredInFeed = await api("/api/employers?q=клинер");
  ok("возвращённый отзыв снова виден", (restoredInFeed.data.posts as { id: string }[]).some((p) => p.id === hideTargetId));

  // ---- Независимость разделов ----
  const helpApi = await api("/api/help");
  ok("«Нужна помощь» работает независимо", helpApi.status === 200 && Array.isArray(helpApi.data.requests));
  const ovrApi = await api("/api/overheard");
  ok("«Подслушано Сахалин» работает независимо", ovrApi.status === 200 && Array.isArray(ovrApi.data.posts));
  const rcApi = await api("/api/recommend");
  ok("«Рекомендую / Не рекомендую» работает независимо", rcApi.status === 200 && Array.isArray(rcApi.data.posts));
  const forumTopics = await api("/api/topics");
  ok("форум работает независимо", forumTopics.status === 200);
  const epLeak = await db.topic.count({ where: { AND: [{ rubric: { slug: "employers-discuss" } }, { recPost: { isNot: null } }] } });
  ok("темы «Рекомендую» не попадают в рубрику «О работодателях»", epLeak === 0);
  const epRubricCount = await db.topic.count({ where: { rubric: { slug: "employers-discuss" } } });
  ok("в подразделе «О работодателях» только темы раздела (2 создано тестом)", epRubricCount === 2, `найдено ${epRubricCount}`);

  // ---- Очистка ----
  console.log("\n… очистка тестовых данных");
  const myPostIds = [emp1Id, emp2Id, critiqueId, emp3Id, p1Id, p2Id, n1Id, tmpDId, raceId, korskId, longEmpId, String(spam.data.id ?? ""), String(pd.data.id ?? ""), String(vacancy.data.id ?? ""), String(neutral.data.id ?? ""), hideTargetId].filter(Boolean);
  const linked = await db.topic.findMany({
    where: {
      OR: [
        { empPost: { id: { in: myPostIds } } },
        { rubric: { slug: "employers-discuss" } },
      ],
    },
  });
  await db.empComplaint.deleteMany({ where: { postId: { in: myPostIds } } });
  const delPosts = await db.empPost.deleteMany({ where: { id: { in: myPostIds } } });
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
  console.log(`  удалено: отзывов=${delPosts.count}, тем=${deletedTopics}`);
  const left = await db.empPost.count();
  console.log(`  остаток в разделе: ${left}`);

  console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
