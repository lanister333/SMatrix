/**
 * ТЗ 2026-09-23 «Ответить» — проба кнопки [📍 Ответить] на
 * панелях сценариев 1–7 страниц «Где купить» (/gde-kupit) и «Где дешевле»
 * (/gde-deshevle). Проверяет:
 *  1. Под КАЖДЫМ из 7 сценариев — ровно две кнопки: ответ + форум.
 *  2. Кнопки есть и у реальных карточек лент (если есть в БД).
 *  3. Клик «Ответить» → текстовое поле на странице (гость — примечание).
 *  4. ИИ-фильтр (телефон 89…): плашка bg #f4f4f5 / border #e4e4e7 с
 *     ДОСЛОВНЫМ текстом ТЗ, кнопка переноса с prefilled_text,
 *     ТЕКСТ В ПОЛЕ НЕ СТЁРТ, href относительный (/forum/topic/…), 0 localhost.
 *  5. Слово «мошенники» тоже блокируется.
 *  6. Чистый сухой факт → статус «Найдено»/«Цена зафиксирована» + is-dim
 *     (opacity .55) + факт закреплён на карточке с 📍.
 *  7. Форум-кнопка — относительный путь, ведёт в тему-приёмник.
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

/* Зарегистрированный пользователь (готовый модераторский аккаунт — как в
   probe-flat-tz-4pages): вход по email, AUTH_KEY="sm_auth" = {token, user}. */
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
  return { nickname: d.user.nickname ?? "Модератор" };
}

for (const cfg of [
  { url: "/gde-kupit", variant: "wtb", nums: [1, 2, 3, 7], status: "Найдено", pageName: "ГДЕ КУПИТЬ" },
  { url: "/gde-deshevle", variant: "cheap", nums: [4, 5, 6], status: "Цена зафиксирована", pageName: "ГДЕ ДЕШЕВЛЕ" },
]) {
  console.log(`\n=== ${cfg.pageName} (${cfg.url}) ===`);
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  const auth = await login(page);
  check("тестовый пользователь создан/вошёл", !!auth);

  await page.goto(BASE + cfg.url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1200);

  // 1. Под каждым сценарием ровно две кнопки
  for (const n of cfg.nums) {
    const card = page.locator(`[data-e2e-scenario="${n}"]`);
    const ansBtn = card.locator(`[data-e2e-answerbtn="${n}"]`);
    const forumBtn = card.locator(`[data-e2e-btn="${n}"]`);
    const a = await ansBtn.count(), f = await forumBtn.count();
    const ansVisible = a ? await ansBtn.isVisible().catch(() => false) : false;
    const ansText = a ? (await ansBtn.innerText().catch(() => "")).trim() : "";
    check(`сценарий ${n}: кнопка «📍 Ответить» видима (метка ТЗ, без «на запрос»)`, a === 1 && ansVisible && ansText === "📍 Ответить", `count=${a} text="${ansText}"`);
    check(`сценарий ${n}: кнопка «Обсудить на форуме» на месте`, f === 1);
    const href = f ? await forumBtn.getAttribute("href") : "";
    check(`сценарий ${n}: форум-кнопка относительный путь /forum/topic/`, !!href && href.startsWith("/forum/topic/") && !href.includes("localhost"), href ?? "");
  }

  // 2. Реальные карточки ленты (если есть) тоже с двумя кнопками
  const rowSel = cfg.variant === "wtb" ? ".wb-item" : ".cd-item";
  const rows = await page.locator(rowSel).count();
  if (rows > 0) {
    const rowAns = await page.locator(cfg.variant === "wtb" ? ".wb-item .wb-answerbtn" : ".cd-item .cd-answerbtn").count();
    const rowForum = await page.locator(cfg.variant === "wtb" ? ".wb-item .wb-btn-forum" : ".cd-item .cd-btn-forum").count();
    check(`лента: у всех ${rows} карточек кнопка «Ответить»`, rowAns === rows, `${rowAns}/${rows}`);
    check(`лента: у всех карточек форум-кнопка`, rowForum === rows, `${rowForum}/${rows}`);
  } else {
    console.log(`  (лента пуста: 0 реальных карточек — панели сценариев ниже проверяются полностью)`);
  }

  // 3. Гость: клик → примечание, формы нет
  const guestCtx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const gpage = await guestCtx.newPage();
  await gpage.goto(BASE + cfg.url, { waitUntil: "networkidle", timeout: 60000 });
  await gpage.locator(`[data-e2e-answerbtn="${cfg.nums[0]}"]`).first().click();
  await gpage.waitForTimeout(300);
  const guestNote = await gpage.locator(`[data-e2e-answer-guest="${cfg.nums[0]}"]`).count();
  const guestForm = await gpage.locator(`[data-e2e-answer-input="${cfg.nums[0]}"]`).count();
  check("гость: примечание о входе, поля ввода нет", guestNote === 1 && guestForm === 0, `note=${guestNote} input=${guestForm}`);
  await guestCtx.close();

  // 4. Телефон → плашка дословно, текст не стёрт, перенос с prefilled_text
  const n1 = cfg.nums[0];
  // Гидратация useAuth асинхронна: если форма открылась веткой гостя —
  // закрываем, ждём и пробуем снова (до 3 раз).
  let opened = false;
  for (let attempt = 0; attempt < 3 && !opened; attempt++) {
    await page.locator(`[data-e2e-answerbtn="${n1}"]`).click();
    await page.waitForTimeout(attempt === 0 ? 400 : 900);
    opened = (await page.locator(`[data-e2e-answer-input="${n1}"]`).count()) === 1;
    if (!opened) {
      await page.locator(`[data-e2e-answerbtn="${n1}"]`).click(); // закрыть
      await page.waitForTimeout(200);
    }
  }
  check("клик «Ответить» открывает поле на странице (залогинен)", opened);
  // Диагностика: если ветка гостя — показать localStorage
  const dbgGuest = await page.locator(`[data-e2e-answer-guest="${n1}"]`).count();
  if (dbgGuest) {
    const stored = await page.evaluate(() => localStorage.getItem("sm_auth"));
    console.log(`  !! ДИАГНОСТИКА: форма в ветке ГОСТЯ; sm_auth = ${stored ? "есть" : "ПУСТО"}`);
  }
  const phoneText = "Звоните: 8-924-111-22-33, павильон за рынком";
  await page.locator(`[data-e2e-answer-input="${n1}"]`).fill(phoneText);
  await page.locator(`[data-e2e-answer-submit="${n1}"]`).click();
  await page.waitForTimeout(350);
  const plaque = page.locator(`[data-e2e-filter-plaque="phones"]`);
  const plaqueCount = await plaque.count();
  check("серая плашка фильтра показана (телефон)", plaqueCount === 1);
  if (plaqueCount) {
    // Плашка красится классом .e2e-answerplaque (globals.css):
    // bg-zinc-50 #f4f4f5 = rgb(244,244,245), border-zinc-200 #e4e4e7 = rgb(228,228,231)
    const colors = await plaque.evaluate((el) => ({
      bg: getComputedStyle(el).backgroundColor,
      border: getComputedStyle(el).borderTopColor,
    }));
    check("плашка bg-zinc-50 (#f4f4f5)", colors.bg === "rgb(244, 244, 245)", JSON.stringify(colors));
    check("плашка border-zinc-200 (#e4e4e7)", colors.border === "rgb(228, 228, 231)", JSON.stringify(colors));
    const plaqueText = (await page.locator(`[data-e2e-filter-plaque-text="phones"]`).innerText()).trim();
    check("текст плашки ДОСЛОВНО по ТЗ", plaqueText === PLAQUE_TEXT, plaqueText.slice(0, 60));
    const kept = await page.locator(`[data-e2e-answer-input="${n1}"]`).inputValue();
    check("ТЕКСТ В ПОЛЕ НЕ СТЁРТ", kept === phoneText);
    const transferHref = await page.locator(`[data-e2e-filter-forum-btn="${n1}"]`).getAttribute("href");
    const expected = `/forum/topic/${cfg.variant === "wtb" ? "topic-grm-123" : "topic-tyres-456"}?prefilled_text=${encodeURIComponent(phoneText)}`;
    check("кнопка переноса: /forum/topic/СЛАГ?prefilled_text=<текст>", transferHref === expected, transferHref ?? "нет");
  }
  await page.locator(`[data-e2e-answerbtn="${n1}"]`).click(); // закрыть форму
  await page.waitForTimeout(200);

  // 5. Слово «мошенники» блокируется
  const n2 = cfg.nums[1];
  await page.locator(`[data-e2e-answerbtn="${n2}"]`).click();
  await page.waitForTimeout(200);
  await page.locator(`[data-e2e-answer-input="${n2}"]`).fill("Там мошенники кругом, цены конские");
  await page.locator(`[data-e2e-answer-submit="${n2}"]`).click();
  await page.waitForTimeout(300);
  check("слово «мошенники» блокируется плашкой", (await page.locator(`[data-e2e-filter-plaque="labels"]`).count()) === 1);
  const keptLabels = await page.locator(`[data-e2e-answer-input="${n2}"]`).inputValue();
  check("текст с ярлыком не стёрт", keptLabels === "Там мошенники кругом, цены конские");
  await page.locator(`[data-e2e-answerbtn="${n2}"]`).click();
  await page.waitForTimeout(200);

  // 6. Чистый сухой факт → статус + тускнение + закрепление
  const n3 = cfg.nums[cfg.nums.length - 1];
  const card3 = page.locator(`[data-e2e-scenario="${n3}"]`);
  const opacityBefore = await card3.evaluate((el) => getComputedStyle(el).opacity);
  await page.locator(`[data-e2e-answerbtn="${n3}"]`).click();
  await page.waitForTimeout(200);
  await page.locator(`[data-e2e-answer-input="${n3}"]`).fill("Продаётся в ТЦ Сити Молл, второй этаж, павильон у эскалатора");
  await page.locator(`[data-e2e-answer-submit="${n3}"]`).click();
  await page.waitForTimeout(500);
  const chip = page.locator(`[data-e2e-statuschip="${n3}"]`);
  const chipCount = await chip.count();
  const chipText = chipCount ? (await chip.innerText()).trim() : "";
  check(`строка статуса «✅ Статус: ${cfg.status}»`, chipCount === 1 && chipText === `✅ Статус: ${cfg.status}`, `count=${chipCount} text="${chipText}"`);
  const dimClass = await card3.getAttribute("class");
  check("карточка тускнеет (is-dim, opacity .55)", (dimClass || "").includes("is-dim") && parseFloat(opacityBefore) === 1 && (await card3.evaluate((el) => getComputedStyle(el).opacity)) === "0.55", `class="${dimClass}"`);
  const factLine = await page.locator(`[data-e2e-answer="${n3}"]`).count();
  const factText = factLine ? (await page.locator(`[data-e2e-answer="${n3}"]`).innerText()).trim() : "";
  check("ответ в ПЛОСКОМ списке «📍 Ответ от <ник>: <факт>»", factLine === 1 && factText.includes("📍 Ответ от") && factText.includes("Продаётся в ТЦ Сити Молл") && factText.includes(auth?.nickname ?? ""), factText.slice(0, 70));
  // ТЗ: внутри ответа НЕТ кнопки «Ответить» (ответов на ответ нет)
  const ansRowBtn = await page.locator(`[data-e2e-answer="${n3}"] button`).count();
  check("внутри ответа НЕТ кнопки «Ответить»", ansRowBtn === 0);

  // 7. Консоль
  check("консоль без ошибок", consoleErrors.length === 0, consoleErrors[0]?.slice(0, 120));
  await page.close();
}

await browser.close();
console.log(`\nИТОГ: ${ok} OK / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
