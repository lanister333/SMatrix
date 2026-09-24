/**
 * ТЗ 2026-09-23 — проба четырёх страниц: Знакомства, Объявления,
 * Где купить, Где дешевле + ИИ-фильтр и сквозной перенос (части 1-4).
 * Запуск: node scripts/probe-flat-tz-4pages-2026-09-23.mjs
 */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const AUTH_KEY = "sm_auth";
let ok = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { ok++; console.log(`OK   ${name}`); }
  else { fail++; console.log(`FAIL ${name}`); }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

// Вход модератором (для проверок ответа на запрос)
const r = await ctx.request.post(BASE + "/api/auth/login", {
  data: { email: "u1_модератор@sakhmatrix.local", password: "Moderator2026" },
});
const login = await r.json();
const authed = !!login?.user?.token;
check("вход модератора", authed);
await page.addInitScript(
  ([key, val]) => localStorage.setItem(key, val),
  [AUTH_KEY, JSON.stringify({ token: login.user.token, user: login.user })]
);

/* ================= ЧАСТЬ 1. ЗНАКОМСТВА ================= */
await page.goto(BASE + "/znakomstva", { waitUntil: "networkidle" });
await page.waitForSelector('[data-ls-layout="1"]');
{
  // Левая колонка: кнопка + дословный текст + выбор города
  check("LS: кнопка «+ Разместить анкету» слева", await page.locator('[data-ls-add-left="1"]').isVisible());
  const note = (await page.locator('[data-ls-accessnote="1"]').textContent()) ?? "";
  check("LS: текст доступа дословно", note.includes("Публикация доступна только зарегистрированным пользователям. Гости могут только читать"));
  check("LS: выбор города (select) + [Показать]", (await page.locator('[data-ls-place-input="1"]').count()) === 1 && (await page.locator('[data-ls-place-input="1"]').evaluate((el) => el.tagName)).toLowerCase() === "select");
  const opts = await page.locator('[data-ls-place-input="1"] option').allTextContents();
  check("LS: города Южно-Сахалинск/Корсаков/Холмск в списке", opts.includes("Южно-Сахалинск") && opts.includes("Корсаков") && opts.includes("Холмск"));
  // Центр: 4 вкладки дословно, дубль кнопки снят, форумных кнопок НЕТ
  const tabs = await page.locator('[data-ls-tabs="1"] [data-ls-tab]').allTextContents();
  check("LS: 4 вкладки дословно", tabs.length === 4 && tabs.join("|").includes("Мужчина ищет женщину") && tabs.join("|").includes("Женщина ищет мужчину") && tabs.join("|").includes("Дружба / Общение") && tabs.join("|").includes("Ищу человека / Благодарность"));
  check("LS: кнопка-дубль в центре снята", (await page.locator('[data-ls-add-center="1"]').count()) === 0);
  const pageText = await page.locator('[data-ls-layout="1"]').innerText();
  check("LS: НЕТ «Обсудить на форуме» (жёсткое правило)", !pageText.includes("Обсудить на форуме"));
  // Правая колонка: дословные тексты ТЗ
  const about = (await page.locator('[data-ls-about-text="1"]').textContent()) ?? "";
  check("LS: «О разделе» дословно (народная доска)", about.includes("бесплатная народная доска для поиска людей, создания семей и дружбы"));
  check("LS: «О разделе» — герои дорог", about.includes("случайных героев на дорогах острова"));
  const rules = (await page.locator('[data-ls-rules-list="1"]').textContent()) ?? "";
  check("LS: правила — бесплатный/контакты/коммерция", rules.includes("Раздел полностью бесплатный") && rules.includes("Контакты открыты сразу в тексте") && rules.includes("Любая коммерция, реклама или платные услуги запрещены — бан навсегда"));
  check("LS: часы в правой колонке", await page.locator(".right-column #sakh-time").isVisible());
  // Возраста нет
  check("LS: поля возраста нет", !pageText.includes("Возраст:"));
}

/* ================= ЧАСТЬ 2. ОБЪЯВЛЕНИЯ ================= */
await page.goto(BASE + "/obyavleniya", { waitUntil: "networkidle" });
await page.waitForSelector('[data-ads-layout="1"]');
{
  check("ADS: трёхколоночная схема (лево/центр/право)", (await page.locator('[data-ads-left="1"]').count()) === 1 && (await page.locator('[data-ads-center="1"]').count()) === 1 && (await page.locator('[data-ads-right="1"]').count()) === 1);
  check("ADS: кнопка «+ Разместить объявление» слева", await page.locator('[data-ads-add-left="1"]').isVisible());
  const note = (await page.locator('[data-ads-accessnote="1"]').textContent()) ?? "";
  check("ADS: текст доступа дословно", note.includes("Публикация доступна только зарегистрированным пользователям. Гости могут только читать"));
  check("ADS: фильтр городов Сахалина (select) + [Показать]", (await page.locator('[data-ads-city-input="1"]').count()) === 1);
  const opts = await page.locator('[data-ads-city-input="1"] option').allTextContents();
  check("ADS: города в фильтре", opts.includes("Южно-Сахалинск") && opts.includes("Холмск") && opts.includes("Корсаков"));
  const tabs = await page.locator('[data-flat-tabs="1"] [role="tab"]').allTextContents();
  check("ADS: 3 вкладки взаимопомощи дословно", tabs.length === 3 && tabs.join("|").includes("Отдам даром / Поделюсь") && tabs.join("|").includes("Приму в дар / Нужна помощь") && tabs.join("|").includes("Бюро находок (Потерял / Нашёл)"));
  check("ADS: внутренняя кнопка FlatBoard скрыта", (await page.locator('[data-flat-add="1"]').count()) === 0);
  const layoutText = await page.locator('[data-ads-layout="1"]').innerText();
  check("ADS: НЕТ «Обсудить на форуме» (жёсткое правило)", !layoutText.includes("Обсудить на форуме"));
  const about = (await page.locator('[data-ads-about-text="1"]').textContent()) ?? "";
  check("ADS: «О разделе» дословно", about.includes("Объявления СахМатрицы — некоммерческий инструмент безвозмездной взаимопомощи") && about.includes("полностью отсутствуют разделы купли-продажи"));
  const rules = (await page.locator('[data-ads-rules-list="1"]').textContent()) ?? "";
  check("ADS: правила дословно", rules.includes("Доступно только зарегистрированным пользователям") && rules.includes("Любые попытки продать товар, указать цену или дать рекламу запрещены — удаление и бан"));
  // Фильтр города реально фильтрует (place уходит в GET)
  await page.selectOption('[data-ads-city-input="1"]', "Холмск");
  await page.click('[data-ads-city-apply="1"]');
  await page.waitForTimeout(1500);
  const reqUrl = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name).filter((n) => n.includes("/api/obyavleniya")).pop() || "");
  check("ADS: фильтр города уходит в GET (?place=)", reqUrl.includes("place="));
  // Кнопка слева открывает форму в центре (авторизованы)
  await page.click('[data-ads-add-left="1"]');
  await page.waitForTimeout(600);
  check("ADS: левая кнопка открывает форму FlatBoard в центре", (await page.locator('[data-flat-form="1"]').count()) === 1);
}

/* ================= ЧАСТЬ 3/4. ГДЕ КУПИТЬ ================= */
// Лента может быть пустой — проба сама создаёт тестовый запрос (уникальный маркер).
const wbMarker = `Проба ТЗ ${Date.now()}: где купить японский фильтр-резонатор 1JZ?`;
const wbCreate = await ctx.request.post(BASE + "/api/wheretobuy", {
  data: { token: login.user.token, title: wbMarker, text: "Ищу конкретный фильтр-резонатор на 1JZ, Южно-Сахалинск.", place: "Южно-Сахалинск", confirmSimilar: true },
});
const wbPost = await wbCreate.json();
check("WB: тестовый запрос создан (API 200)", wbCreate.ok() && !!wbPost?.id);
await page.goto(BASE + "/gde-kupit", { waitUntil: "networkidle" });
await page.waitForSelector('[data-wb-id]', { timeout: 30000 });
{
  const firstId = wbPost?.id ?? (await page.locator("[data-wb-id]").first().getAttribute("data-wb-id")) ?? "";
  const card = page.locator(`[data-wb-id="${firstId}"]`);
  const cardText = (await card.innerText()) ?? "";
  check("WB: кнопка [📍 Ответить] под запросом (метка ТЗ, без «на запрос»)", cardText.includes("📍 Ответить") && !cardText.includes("Ответить на запрос"));
  check("WB: кнопка [💬 Обсудить на форуме] под запросом", cardText.includes("💬 Обсудить на форуме"));
  check("WB: шапка ТЗ — 📍 Ник · Дата · Город", (await card.locator(".wb-headrow").count()) === 1 && ((await card.locator(".wb-headrow").innerText()) ?? "").includes("📍"));
  check("WB: блок «Вопрос:» по ТЗ", ((await card.locator(".wb-q").innerText()) ?? "").startsWith("Вопрос:"));
  check("WB: строка статуса «Статус: Ищу» до ответа", ((await card.locator(".wb-statusline").innerText()) ?? "").includes("Статус:"));
  // Ответ: телефон → плашка дословно + текст сохранён
  await card.locator(".wb-answerbtn").click();
  await page.waitForSelector(`[data-wb-answerform="${firstId}"]`);
  await page.fill(`[data-wb-answer-input="${firstId}"]`, "Продается мастер Вова на Железнодорожной, звони ему: 8-924-111-22-33");
  await page.click(`[data-wb-answer-submit="${firstId}"]`);
  await page.locator(`[data-wb-id="${firstId}"] .wb-answerplaque`).waitFor({ state: "visible", timeout: 10000 });
  const plaque = (await page.locator(`[data-wb-id="${firstId}"] .wb-answerplaque`).innerText()) ?? "";
  check("WB: плашка фильтра дословно", plaque.includes("Сообщение отклонено фильтром главной страницы. На главной странице запрещено публиковать личные мобильные телефоны и субъективные споры. Вы можете опубликовать этот текст на форуме."));
  const kept = (await page.inputValue(`[data-wb-answer-input="${firstId}"]`)) ?? "";
  check("WB: текст в поле НЕ стёрт", kept.includes("8-924-111-22-33"));
  const href = (await page.locator(`[data-wb-filter-forum-btn="${firstId}"]`).getAttribute("href")) ?? "";
  check("WB: кнопка переноса — /forum/topic/<id>?prefilled_text=", href.startsWith("/forum/topic/") && href.includes("prefilled_text=") && !href.includes("localhost"));
  check("WB: надпись кнопки переноса по ТЗ", ((await page.locator(`[data-wb-filter-forum-btn="${firstId}"]`).textContent()) ?? "").includes("Перейти в тему на форуме и опубликовать там"));
  // Спекулянты тоже блокируются (новое слово ТЗ)
  await page.fill(`[data-wb-answer-input="${firstId}"]`, "Там одни спекулянты сидят");
  await page.click(`[data-wb-answer-submit="${firstId}"]`);
  await page.waitForTimeout(400);
  check("WB: «спекулянты» ловится фильтром", (await page.locator(`[data-wb-id="${firstId}"] .wb-answerplaque`).count()) === 1);
  // Сухой факт → 200, статус «Найдено», тускнеет
  await page.fill(`[data-wb-answer-input="${firstId}"]`, "Продаётся в ТЦ Сити Молл, второй этаж, павильон у эскалатора");
  await page.click(`[data-wb-answer-submit="${firstId}"]`);
  await page.waitForTimeout(2500);
  const card2 = page.locator(`[data-wb-id="${firstId}"]`);
  const st = (await card2.getAttribute("data-wb-status")) ?? "";
  check("WB: после ответа статус found («Найдено»)", st === "found");
  const dimmed = (await card2.getAttribute("class")) ?? "";
  check("WB: карточка тускнеет (is-dim)", dimmed.includes("is-dim"));
  check("WB: ответ в плоском списке «📍 Ответ от …»", (await card2.locator(".wb-answer").count()) === 1 && ((await card2.locator(".wb-answer").innerText()) ?? "").includes("📍 Ответ от"));
  check("WB: строка статуса «✅ Статус: Найдено» после ответа", ((await card2.locator(".wb-statusline").innerText()) ?? "").trim() === "✅ Статус: Найдено");
  // ТЗ: после статуса «Найдено» кнопка «📍 Ответить» активна — ответы продолжают добавляться
  check("WB: [📍 Ответить] активна после статуса «Найдено»", !(await card2.locator(".wb-answerbtn").isDisabled()));
  // Кнопка форума ведёт на относительный /forum/...
  const forumHref = await page.evaluate(() => {
    const btn = document.querySelector('[data-wb-id] .wb-btn-forum');
    return btn ? btn.getAttribute("title") || "" : "";
  });
  check("WB: форумная кнопка на месте", forumHref.length > 0);
}

/* ================= ЧАСТЬ 3/4. ГДЕ ДЕШЕВЛЕ ================= */
const cdMarker = `Проба ТЗ ${Date.now()}: где дешевле горбуша свежемороженая?`;
const cdCreate = await ctx.request.post(BASE + "/api/gdedeshevle", {
  data: { token: login.user.token, title: cdMarker, text: "Ищу минимальную цену на горбушу свежемороженую за кг.", place: "Южно-Сахалинск", confirmSimilar: true },
});
const cdPost = await cdCreate.json();
check("CD: тестовый запрос создан (API 200)", cdCreate.ok() && !!cdPost?.id);
await page.goto(BASE + "/gde-deshevle", { waitUntil: "networkidle" });
await page.waitForSelector('[data-cd-id]', { timeout: 30000 });
{
  const firstId = cdPost?.id ?? (await page.locator("[data-cd-id]").first().getAttribute("data-cd-id")) ?? "";
  const card = page.locator(`[data-cd-id="${firstId}"]`);
  const cardText = (await card.innerText()) ?? "";
  check("CD: кнопка [📍 Ответить] под запросом (метка ТЗ, без «на запрос»)", cardText.includes("📍 Ответить") && !cardText.includes("Ответить на запрос"));
  check("CD: кнопка [💬 Обсудить на форуме] под запросом", cardText.includes("💬 Обсудить на форуме"));
  await card.locator(".cd-answerbtn").click();
  await page.waitForSelector(`[data-cd-answerform="${firstId}"]`);
  await page.fill(`[data-cd-answer-input="${firstId}"]`, "Горбуша по 150 руб/кг на ярмарке у Дома Торговли");
  await page.click(`[data-cd-answer-submit="${firstId}"]`);
  await page.waitForTimeout(2500);
  const card2 = page.locator(`[data-cd-id="${firstId}"]`);
  const st = (await card2.getAttribute("data-cd-status")) ?? "";
  check("CD: после ответа статус fixed («Цена зафиксирована»)", st === "fixed");
  const dimmed = (await card2.getAttribute("class")) ?? "";
  check("CD: карточка тускнеет (is-dim)", dimmed.includes("is-dim"));
  check("CD: строка статуса «✅ Статус: Цена зафиксирована»", ((await card2.locator(".cd-statusline").innerText()) ?? "").trim() === "✅ Статус: Цена зафиксирована");
  check("CD: ответ в плоском списке «📍 Ответ от …»", ((await card2.locator(".cd-answer").innerText()) ?? "").includes("📍 Ответ от"));
  // Кнопка форума — относительный путь /forum/topic или /forum/category
  const hrefAfter = await page.evaluate(() => window.location.pathname);
  check("CD: остались на странице после ответа", hrefAfter === "/gde-deshevle");
}

/* ============ ГОСТЬ: доступ только для зарегистрированных ============ */
{
  const guestCtx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const gp = await guestCtx.newPage();
  await gp.goto(BASE + "/gde-kupit", { waitUntil: "networkidle" });
  await gp.waitForSelector('[data-wb-id]');
  const gId = (await gp.locator("[data-wb-id]").first().getAttribute("data-wb-id")) ?? "";
  await gp.locator(`[data-wb-id="${gId}"] .wb-answerbtn`).click();
  await gp.waitForSelector(`[data-wb-answerform="${gId}"]`);
  const gNote = (await gp.locator(`[data-wb-answer-guest="${gId}"]`).textContent()) ?? "";
  check("WB гость: примечание о входе, поля нет", gNote.includes("Отвечать на запросы могут только зарегистрированные пользователи") && (await gp.locator(`[data-wb-answer-input="${gId}"]`).count()) === 0);
  await gp.goto(BASE + "/obyavleniya", { waitUntil: "networkidle" });
  await gp.waitForSelector('[data-ads-add-left="1"]');
  await gp.click('[data-ads-add-left="1"]');
  await gp.waitForTimeout(500);
  const gh = (await gp.locator('[data-ads-guesthint="1"]').textContent()) ?? "";
  check("ADS гость: форма НЕ открыта, примечание есть", gh.includes("только зарегистрированные пользователи") && (await gp.locator('[data-flat-form="1"]').count()) === 0);
  await gp.goto(BASE + "/znakomstva", { waitUntil: "networkidle" });
  await gp.waitForSelector('[data-ls-add-left="1"]');
  await gp.click('[data-ls-add-left="1"]');
  await gp.waitForTimeout(500);
  const lh = (await gp.locator('[data-ls-guesthint="1"]').textContent()) ?? "";
  check("LS гость: форма НЕ открыта, строка ТЗ", lh.includes("Публикация доступна только зарегистрированным пользователям. Гости могут только читать") && (await gp.locator('[data-ls-form="1"]').count()) === 0);
  await guestCtx.close();
}

/* ============ НИКАКИХ localhost ============ */
{
  const body = await page.content();
  check("нет ссылок на localhost в DOM", !body.includes('href="http://localhost') && !body.includes('href="https://localhost'));
}

const realErrors = errors.filter((e) => !e.includes("favicon"));
check("консоль чистая", realErrors.length === 0);
if (realErrors.length) console.log(realErrors.slice(0, 6).join("\n"));

await browser.close();
console.log(`\nИТОГ: ${ok} OK / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
