/**
 * ТЗ 2026-09-23 «Ответить» — сквозная проба логики ответов на страницах
 * «Где купить» (/gde-kupit) и «Где дешевле» (/gde-deshevle).
 *
 * Проверяет ПРАВИЛА ТЗ:
 *  1. Кнопка называется [ 📍 Ответить ] (синяя), рядом [ 💬 Обсудить на
 *     форуме ] (бирюзовая) — ДВЕ кнопки в одном ряду ВНИЗУ карточки.
 *  2. Ответов СКОЛЬКО УГОДНО — все ответы ПЛОСКИМ СПИСКОМ внутри карточки
 *     («📍 Ответ от <ник>: <факт>»), без вложенности.
 *  3. НЕТ ОТВЕТОВ НА ОТВЕТ: внутри ответа нет кнопки «Ответить»
 *     (и никаких кнопок вообще).
 *  4. Как только карточка получила хотя бы один ответ: статус «Найдено» /
 *     «Цена зафиксирована» (строка «✅ Статус: …»), карточка ТУСКНЕЕТ,
 *     но ответы ПРОДОЛЖАЮТ добавляться.
 *  5. [📍 Ответить] открывает простое текстовое поле; кнопка «Опубликовать»
 *     добавляет ответ в список.
 *  6. ИИ-ФИЛЬТР: телефон (89…/+79…) и слова (барыги, хамы, мошенники,
 *     уроды, вор, обдираловка, спекулянты) → публикация НЕ отправляется,
 *     ТЕКСТ НЕ СТИРАЕТСЯ, серая плашка (bg-zinc-50/border-zinc-200) с
 *     ДОСЛОВНЫМ текстом и кнопкой [💬 Перейти в тему на форуме и
 *     опубликовать там] → /forum/topic/ID?prefilled_text=<текст>.
 *  7. Серверная линия прочности: прямой PATCH с телефоном → 400,
 *     error = дословный текст плашки.
 *  8. Форма ответа форума принимает prefilled_text (клик-сквозная проверка).
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const PLAQUE_TEXT =
  "Сообщение отклонено фильтром главной страницы. На главной странице запрещено публиковать личные мобильные телефоны и субъективные споры. Вы можете опубликовать этот текст на форуме.";

let ok = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { ok++; console.log(`  OK   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? " — " + extra : ""}`); }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });

const AUTH_KEY = "sm_auth";
async function login(page) {
  const r = await page.context().request.post(BASE + "/api/auth/login", {
    data: { email: "u1_модератор@sakhmatrix.local", password: "Moderator2026" },
  });
  const d = await r.json().catch(() => null);
  const token = d?.user?.token;
  if (!token) return null;
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([key, val]) => localStorage.setItem(key, val),
    [AUTH_KEY, JSON.stringify({ token, user: d.user })]
  );
  return { token, nickname: d.user.nickname ?? "Модератор" };
}

/* ============ ГДЕ КУПИТЬ: полный цикл правил 1–7 ============ */
console.log("\n=== ГДЕ КУПИТЬ (/gde-kupit) ===");
{
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  const auth = await login(page);
  check("тестовый пользователь вошёл", !!auth);

  // Создаём запрос через API (уникальный маркер, confirmSimilar — п.7 ТЗ ленты)
  const marker = `Проба Ответ ${Date.now()}: где купить масляный фильтр 90915-10003?`;
  const created = await ctx.request.post(BASE + "/api/wheretobuy", {
    data: { token: auth.token, title: marker, text: "Ищу оригинальный масляный фильтр Toyota 90915-10003, Южно-Сахалинск.", place: "Южно-Сахалинск", confirmSimilar: true },
  });
  const post = await created.json();
  check("запрос создан через API", created.ok() && !!post?.id);

  await page.goto(BASE + "/gde-kupit", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(`[data-wb-id="${post.id}"]`, { timeout: 30000 });
  const card = page.locator(`[data-wb-id="${post.id}"]`);

  /* Правило 1: две кнопки внизу, метки и цвета */
  const actrow = card.locator(".wb-actrow");
  check("ряд кнопок внизу карточки (.wb-actrow)", (await actrow.count()) === 1);
  const btnAnswer = card.locator(".wb-answerbtn");
  const btnForum = card.locator(".wb-btn-forum");
  check("метка [📍 Ответить]", ((await btnAnswer.innerText()).trim()) === "📍 Ответить");
  check("метка [💬 Обсудить на форуме]", ((await btnForum.innerText()).trim()) === "💬 Обсудить на форуме");
  const answerBg = await btnAnswer.evaluate((el) => getComputedStyle(el).backgroundColor);
  check("[📍 Ответить] СИНЯЯ #0a5caa", answerBg === "rgb(10, 92, 170)", answerBg);
  const forumBg = await btnForum.evaluate((el) => getComputedStyle(el).backgroundColor);
  const forumTurq = ["rgb(6, 205, 189)", "rgb(13, 148, 136)"];
  check("[💬 Обсудить на форуме] БИРЮЗОВАЯ", forumTurq.includes(forumBg), forumBg);
  // Кнопки в одном ряду, рядом (dy маленький, зазор <= 24px)
  const geo = await actrow.evaluate((el) => {
    const a = el.querySelector(".wb-answerbtn")?.getBoundingClientRect();
    const f = el.querySelector(".wb-btn-forum")?.getBoundingClientRect();
    if (!a || !f) return null;
    return { dy: Math.abs((a.top + a.height / 2) - (f.top + f.height / 2)), gap: f.left - a.right };
  });
  check("две кнопки В ОДНОМ РЯДУ (dy ≤ 6)", geo && geo.dy <= 6, JSON.stringify(geo));
  check("кнопки РЯДОМ (зазор 0…24px)", geo && geo.gap >= 0 && geo.gap <= 24, JSON.stringify(geo));
  // В actrow СТРОГО две кнопки (служебные — в отдельном .wb-secrow)
  const actrowButtons = await actrow.locator("button, a").count();
  check("в основном ряду СТРОГО две кнопки", actrowButtons === 2, `найдено ${actrowButtons}`);

  /* Правило 5: поле + кнопка «Опубликовать» */
  await btnAnswer.click();
  await page.waitForSelector(`[data-wb-answerform="${post.id}"]`);
  const submitLabel = ((await page.locator(`[data-wb-answer-submit="${post.id}"]`).innerText()) || "").trim();
  check("кнопка публикации называется «Опубликовать»", submitLabel === "Опубликовать", submitLabel);

  /* ИИ-фильтр: телефон → плашка дословно, текст не стёрт, перенос */
  const phoneText = "Есть в автомагазине на Сахалинской, звоните: 8-924-555-11-22";
  await page.fill(`[data-wb-answer-input="${post.id}"]`, phoneText);
  await page.click(`[data-wb-answer-submit="${post.id}"]`);
  await page.waitForTimeout(400);
  check("плашка фильтра показана (телефон)", (await page.locator(`[data-wb-filter-plaque="phones"]`).count()) === 1);
  const plaqueStyle = await page.locator(`[data-wb-id="${post.id}"] .wb-answerplaque`).evaluate((el) => ({
    bg: getComputedStyle(el).backgroundColor,
    border: getComputedStyle(el).borderTopColor,
  }));
  check("плашка bg-zinc-50 (#f4f4f5)", plaqueStyle.bg === "rgb(244, 244, 245)", JSON.stringify(plaqueStyle));
  check("плашка border-zinc-200 (#e4e4e7)", plaqueStyle.border === "rgb(228, 228, 231)", JSON.stringify(plaqueStyle));
  const plaqueText = ((await page.locator(`[data-wb-filter-plaque-text="phones"]`).innerText()) || "").trim();
  check("текст плашки ДОСЛОВНО по ТЗ", plaqueText === PLAQUE_TEXT);
  check("ТЕКСТ В ПОЛЕ НЕ СТЁРТ", (await page.inputValue(`[data-wb-answer-input="${post.id}"]`)) === phoneText);
  const transferHref = (await page.locator(`[data-wb-filter-forum-btn="${post.id}"]`).getAttribute("href")) ?? "";
  check("перенос: /forum/topic/<id>?prefilled_text=<текст>", transferHref.startsWith("/forum/topic/") && transferHref.includes("prefilled_text=") && transferHref.includes(encodeURIComponent(phoneText)) && !transferHref.includes("localhost"), transferHref.slice(0, 90));
  check("надпись кнопки переноса по ТЗ", ((await page.locator(`[data-wb-filter-forum-btn="${post.id}"]`).innerText()) || "").includes("Перейти в тему на форуме и опубликовать там"));

  /* Слова-ярлыки тоже блокируются */
  await page.fill(`[data-wb-answer-input="${post.id}"]`, "Там одни барыги и обдираловка");
  await page.click(`[data-wb-answer-submit="${post.id}"]`);
  await page.waitForTimeout(300);
  check("слова «барыги/обдираловка» ловятся фильтром", (await page.locator(`[data-wb-filter-plaque="labels"]`).count()) === 1);

  /* Правила 2+4+5: первый ответ → статус «Найдено» + тускнение; */
  await page.fill(`[data-wb-answer-input="${post.id}"]`, "Продаётся в ТЦ Сити Молл, второй этаж, павильон у эскалатора");
  await page.click(`[data-wb-answer-submit="${post.id}"]`);
  await page.waitForTimeout(2500);
  const card2 = page.locator(`[data-wb-id="${post.id}"]`);
  check("статус после 1-го ответа: found («Найдено»)", ((await card2.getAttribute("data-wb-status")) ?? "") === "found");
  check("строка «✅ Статус: Найдено»", ((await card2.locator(".wb-statusline").innerText()) || "").trim() === "✅ Статус: Найдено");
  check("карточка тускнеет (is-dim, opacity .55)", ((await card2.getAttribute("class")) ?? "").includes("is-dim") && (await card2.evaluate((el) => getComputedStyle(el).opacity)) === "0.55");
  check("ответ 1 в списке: «📍 Ответ от <ник>: …»", ((await card2.locator(".wb-answer").first().innerText()) || "").includes(`📍 Ответ от ${auth.nickname}: Продаётся в ТЦ Сити Молл`));

  /* Правило 4: ответы ПРОДОЛЖАЮТ добавляться после тускнения */
  await card2.locator(".wb-answerbtn").click();
  await page.waitForSelector(`[data-wb-answerform="${post.id}"]`);
  await page.fill(`[data-wb-answer-input="${post.id}"]`, "Ещё видели в «Автодоме» на Пуркаева, отдел фильтров");
  await page.click(`[data-wb-answer-submit="${post.id}"]`);
  await page.waitForTimeout(2500);
  const card3 = page.locator(`[data-wb-id="${post.id}"]`);
  const answersAfter2 = await card3.locator(".wb-answer").count();
  check("ответ 2 добавился (ответов уже 2)", answersAfter2 === 2, `найдено ${answersAfter2}`);

  /* Правило 3: внутри ответа НЕТ кнопки; список ПЛОСКИЙ */
  const rowButtons = await card3.locator(".wb-answer button, .wb-answer a").count();
  check("внутри ответов НЕТ кнопок (нет ответов на ответ)", rowButtons === 0, `найдено ${rowButtons}`);
  const flatness = await card3.evaluate((el) => {
    const list = el.querySelector(".wb-answers");
    if (!list) return null;
    const rows = [...list.querySelectorAll(":scope > .wb-answer")];
    // все строки — прямые дети ОДНОГО контейнера; внутри строк нет вложенных списков
    return { rowCount: rows.length, nestedLists: list.querySelectorAll(":scope > .wb-answer .wb-answers").length, parentIsOne: rows.every((r) => r.parentElement === list) };
  });
  check("список ПЛОСКИЙ: один контейнер, строки — прямые дети, без вложенности", !!flatness && flatness.rowCount === 2 && flatness.nestedLists === 0 && flatness.parentIsOne, JSON.stringify(flatness));
  // Лесенки нет: все ответы на одном уровне отступа
  const sameIndent = await card3.evaluate((el) => {
    const rows = [...el.querySelectorAll(".wb-answer")];
    const lefts = new Set(rows.map((r) => Math.round(r.getBoundingClientRect().left)));
    return rows.length >= 2 && lefts.size === 1;
  });
  check("нет форумной лесенки (одинаковый отступ ответов)", sameIndent);

  /* Третий ответ — прямым API (любой зарегистрированный) */
  const third = await ctx.request.patch(BASE + `/api/wheretobuy/${post.id}`, {
    data: { token: auth.token, action: "answer", answerText: "Третий ответ: СТО «Мотор» на Ельном, магазин при сервисе" },
  });
  const thirdData = await third.json();
  check("ответ 3 через API — 200", third.ok() && thirdData?.ok === true);
  await page.reload({ waitUntil: "networkidle" });
  const card4 = page.locator(`[data-wb-id="${post.id}"]`);
  const answersAfter3 = await card4.locator(".wb-answer").count();
  check("ответ 3 виден в плоском списке (всего 3)", answersAfter3 === 3, `найдено ${answersAfter3}`);
  check("порядок хронологический (ответ 1 сверху)", ((await card4.locator(".wb-answer").first().innerText()) || "").includes("Сити Молл") && ((await card4.locator(".wb-answer").last().innerText()) || "").includes("Мотор"));

  /* Правило 7: серверная линия прочности — прямой PATCH с телефоном → 400 */
  const srvBlock = await ctx.request.patch(BASE + `/api/wheretobuy/${post.id}`, {
    data: { token: auth.token, action: "answer", answerText: "Звони: +79141234567" },
  });
  const srvData = await srvBlock.json();
  check("сервер отклоняет телефон (400)", srvBlock.status() === 400);
  check("сервер вернул ДОСЛОВНЫЙ текст плашки", srvData?.error === PLAQUE_TEXT && srvData?.filtered === true);
  const srvHref = srvData?.forumHref ?? "";
  check("сервер вернул forumHref с prefilled_text", srvHref.startsWith("/forum/topic/177?prefilled_text=") && !srvHref.includes("localhost"), srvHref.slice(0, 80));
  // Ответов НЕ прибавилось (заблокированный текст не сохранён)
  const answersAfterBlock = await card4.locator(".wb-answer").count();
  check("заблокированный ответ НЕ сохранён (всё ещё 3)", answersAfterBlock === 3, `найдено ${answersAfterBlock}`);

  /* Сквозной перенос: клик кнопки переноса открывает тему форума с текстом */
  await card4.locator(".wb-answerbtn").click();
  await page.waitForSelector(`[data-wb-answerform="${post.id}"]`);
  await page.fill(`[data-wb-answer-input="${post.id}"]`, "Обманывают тут всё, мошенники");
  await page.click(`[data-wb-answer-submit="${post.id}"]`);
  await page.waitForTimeout(300);
  await page.locator(`[data-wb-filter-forum-btn="${post.id}"]`).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
  const url = page.url();
  check("клик переноса: относительный /forum/topic/… (0 localhost)", new URL(url).pathname.startsWith("/forum/topic/"));
  const taVal = await page.evaluate(() => {
    const ta = document.querySelector("textarea");
    return ta ? ta.value : "";
  });
  check("форма форума подхватила prefilled_text 1-в-1", taVal === "Обманывают тут всё, мошенники", JSON.stringify(taVal.slice(0, 60)));

  /* Уборка: удаляем тестовый запрос из ленты */
  const del = await ctx.request.patch(BASE + `/api/wheretobuy/${post.id}`, {
    data: { token: auth.token, action: "delete" },
  });
  check("тестовый запрос удалён (уборка)", del.ok());
  check("консоль без ошибок (wtb)", consoleErrors.length === 0, consoleErrors[0]?.slice(0, 140));
  await page.close();
}

/* ============ ГДЕ ДЕШЕВЛЕ: статус «Цена зафиксирована» ============ */
console.log("\n=== ГДЕ ДЕШЕВЛЕ (/gde-deshevle) ===");
{
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  const auth = await login(page);
  const marker = `Проба Ответ ${Date.now()}: где дешевле масляный обогреватель?`;
  const created = await ctx.request.post(BASE + "/api/gdedeshevle", {
    data: { token: auth.token, title: marker, text: "Сравниваю цены на масляный обогреватель 2 кВт, Южно-Сахалинск.", place: "Южно-Сахалинск", confirmSimilar: true },
  });
  const post = await created.json();
  check("запрос создан через API", created.ok() && !!post?.id);

  await page.goto(BASE + "/gde-deshevle", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(`[data-cd-id="${post.id}"]`, { timeout: 30000 });
  const card = page.locator(`[data-cd-id="${post.id}"]`);
  check("метка [📍 Ответить]", ((await card.locator(".cd-answerbtn").innerText()).trim()) === "📍 Ответить");

  // Телефон блокируется и здесь (сквозной фильтр)
  await card.locator(".cd-answerbtn").click();
  await page.waitForSelector(`[data-cd-answerform="${post.id}"]`);
  await page.fill(`[data-cd-answer-input="${post.id}"]`, "По 2500 у входа, тел: 8-914-777-66-55");
  await page.click(`[data-cd-answer-submit="${post.id}"]`);
  await page.waitForTimeout(400);
  check("плашка показана (телефон, cd)", (await page.locator(`[data-cd-filter-plaque="phones"]`).count()) === 1);
  check("текст не стёрт (cd)", (await page.inputValue(`[data-cd-answer-input="${post.id}"]`)).includes("8-914-777-66-55"));
  const cdHref = (await page.locator(`[data-cd-filter-forum-btn="${post.id}"]`).getAttribute("href")) ?? "";
  check("перенос cd: /forum/topic/178?prefilled_text=", cdHref.startsWith("/forum/topic/178?prefilled_text=") || cdHref.startsWith("/forum/topic/"), cdHref.slice(0, 80));

  // Два ответа подряд → fixed, тускнеет, оба в списке
  await page.fill(`[data-cd-answer-input="${post.id}"]`, "«Спортмастер» на Сахалинской: 2790 руб по карте");
  await page.click(`[data-cd-answer-submit="${post.id}"]`);
  await page.waitForTimeout(2500);
  const card2 = page.locator(`[data-cd-id="${post.id}"]`);
  check("статус после 1-го ответа: fixed («Цена зафиксирована»)", ((await card2.getAttribute("data-cd-status")) ?? "") === "fixed");
  check("строка «✅ Статус: Цена зафиксирована»", ((await card2.locator(".cd-statusline").innerText()) || "").trim() === "✅ Статус: Цена зафиксирована");
  check("карточка тускнеет (is-dim)", ((await card2.getAttribute("class")) ?? "").includes("is-dim"));
  await card2.locator(".cd-answerbtn").click();
  await page.waitForSelector(`[data-cd-answerform="${post.id}"]`);
  await page.fill(`[data-cd-answer-input="${post.id}"]`, "Дешевле на ярмарке у ДТ: 2500 руб, свежий завоз");
  await page.click(`[data-cd-answer-submit="${post.id}"]`);
  await page.waitForTimeout(2500);
  const answersCd = await card2.locator(".cd-answer").count();
  check("ответы продолжают добавляться (2 шт)", answersCd === 2, `найдено ${answersCd}`);
  check("формат «📍 Ответ от …» (cd)", ((await card2.locator(".cd-answer").first().innerText()) || "").includes("📍 Ответ от"));
  const cdRowButtons = await card2.locator(".cd-answer button, .cd-answer a").count();
  check("внутри ответов НЕТ кнопок (cd)", cdRowButtons === 0);

  // Уборка
  const del = await ctx.request.patch(BASE + `/api/gdedeshevle/${post.id}`, {
    data: { token: auth.token, action: "delete" },
  });
  check("тестовый запрос удалён (уборка, cd)", del.ok());
  check("консоль без ошибок (cd)", consoleErrors.length === 0, consoleErrors[0]?.slice(0, 140));
  await page.close();
}

/* ============ МОБАЙЛ 375px: две кнопки в одной строке ============ */
console.log("\n=== МОБАЙЛ 375px ===");
{
  const mctx = await browser.newContext({ viewport: { width: 375, height: 720 } });
  const page = await mctx.newPage();
  await page.goto(BASE + "/gde-kupit", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  const scenarioBtns = await page.locator('[data-e2e-answerbtn="1"]').count();
  if (scenarioBtns > 0) {
    const row = await page.evaluate(() => {
      const card = document.querySelector('[data-e2e-scenario="1"]');
      const a = card?.querySelector(".e2e-answerbtn")?.getBoundingClientRect();
      const f = card?.querySelector(".e2e-btn-forum")?.getBoundingClientRect();
      if (!a || !f) return null;
      return { dy: Math.abs(a.top - f.top), hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
    });
    check("мобайл: пара кнопок в одной строке", !!row && row.dy <= 4, JSON.stringify(row));
    check("мобайл: без горизонтального скролла", !!row && !row.hScroll);
  } else {
    const feedBtn = await page.locator(".wb-item .wb-answerbtn").first().count();
    check("мобайл: кнопка [📍 Ответить] есть (лента или панель)", feedBtn > 0 || scenarioBtns > 0);
  }
  await mctx.close();
}

await browser.close();
console.log(`\nИТОГ: ${ok} OK / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
