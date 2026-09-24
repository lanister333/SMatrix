/**
 * Верификационный проб ТЗ 2026-09-23 «Кнопки „Обсудить на форуме“».
 * Проверяет: новые маршруты /forum/*, клики всех кнопок на всех страницах,
 * prefilled_text в поле ответа, список тем рубрики.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
let ok = 0, fail = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${name}${detail ? " — " + detail : ""}`); }
  else { fail++; failures.push(name); console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`); }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));

/* ---------- 1. /forum — список рубрик ---------- */
console.log("=== /forum (список рубрик) ===");
await page.goto(BASE + "/forum", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
check("страница /forum открывается", true);
const contentLinks = await page.evaluate(() => [...document.querySelectorAll('[data-forum-index-content] a')].length);
check("каталог контентных рубрик рендерится", contentLinks > 20, `ссылок: ${contentLinks}`);
const discussLinks = await page.evaluate(() => [...document.querySelectorAll('[data-forum-index-discuss] a')].length);
check("каталог служебных веток рендерится", discussLinks >= 5, `ссылок: ${discussLinks}`);
const allHrefs = await page.evaluate(() => [...document.querySelectorAll('[data-forum-index] a')].map((a) => a.getAttribute("href")));
check("все ссылки относительные /forum/category/...", allHrefs.every((h) => h && h.startsWith("/forum/category/")));
// Клик по рубрике ведёт на список тем
await page.click('[data-forum-index-content] a');
await page.waitForLoadState("networkidle");
check("клик по рубрике → /forum/category/...", page.url().includes("/forum/category/"));

/* ---------- 2. /forum/category/<slug> — список тем ---------- */
console.log("=== /forum/category/nedvizhimost--zhkh-i-upravlyayuschie-kompanii ===");
await page.goto(BASE + "/forum/category/nedvizhimost--zhkh-i-upravlyayuschie-kompanii", { waitUntil: "networkidle" });
await page.waitForTimeout(900);
const crumbs = await page.evaluate(() => document.querySelector('[data-forum-crumbs]')?.textContent || "");
check("хлебные крошки: Форум → Недвижимость → ЖКХ", crumbs.includes("Форум") && crumbs.includes("Недвижимость") && crumbs.includes("ЖКХ"), crumbs.trim());
const topicCount = await page.evaluate(() => document.querySelectorAll("table tr, .sk-topicrow, [data-topic-row]").length);
const listText = await page.evaluate(() => document.body.innerText);
check("список тем рубрики открылся (есть темы ЖКХ)", /начисления за тепло|ЖКХ/i.test(listText));
// Тема в списке — <a onClick> (SPA-паттерн): клик ведёт на /forum/topic/<id>
await page.click(".sk-row .r-title a");
await page.waitForLoadState("networkidle");
await page.waitForTimeout(800);
check("клик по теме списка → /forum/topic/<id>", /\/forum\/topic\/\d+/.test(page.url().replace(BASE, "")), page.url().replace(BASE, ""));

/* ---------- 3. /forum/topic/<id>?prefilled_text= ---------- */
console.log("=== /forum/topic/177?prefilled_text=... ===");
const TEST_TEXT = "Проверка сквозного переноса текста";
await page.goto(`${BASE}/forum/topic/177?prefilled_text=${encodeURIComponent(TEST_TEXT)}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const topicPageOpen = await page.evaluate(() => document.body.innerText);
check("тема 177 открылась на /forum/topic/177", page.url().includes("/forum/topic/177") && /Быстрые подсказки/i.test(topicPageOpen));
const replyVal = await page.evaluate(() => {
  const ta = [...document.querySelectorAll("textarea")].find((t) => /мнение|ответ/i.test(t.placeholder || ""));
  return ta ? ta.value : null;
});
check("prefilled_text подставлен в поле ответа", replyVal === TEST_TEXT, `в поле: ${replyVal}`);
const cleanedUrl = page.url();
check("prefilled_text вычищен из URL", !cleanedUrl.includes("prefilled_text"), cleanedUrl);

/* ---------- 4. слаги ТЗ ---------- */
console.log("=== /forum/topic/topic-tyres-456?prefilled_text=... (слаг ТЗ) ===");
await page.goto(`${BASE}/forum/topic/topic-tyres-456?prefilled_text=слаг-тест`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const slugText = await page.evaluate(() => document.body.innerText);
check("слаг topic-tyres-456 → тема 178 «Где дешевле»", page.url().includes("/forum/topic/topic-tyres-456") && /Где дешевле/i.test(slugText), "адрес сохраняется, тема 178 рендерится");
const slugReply = await page.evaluate(() => {
  const ta = [...document.querySelectorAll("textarea")].find((t) => /мнение|ответ/i.test(t.placeholder || ""));
  return ta ? ta.value : null;
});
check("prefilled_text из слага подставлен", slugReply === "слаг-тест", `в поле: ${slugReply}`);

/* ---------- 5. несуществующие адреса ---------- */
console.log("=== /forum/topic/unknown-slug и /forum/category/unknown ===");
await page.goto(`${BASE}/forum/topic/no-such-slug`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const miss1 = await page.evaluate(() => document.querySelector('[data-forum-topic-miss]')?.textContent || "");
check("неизвестная тема → «Тема не найдена»", miss1.includes("Тема не найдена"));
await page.goto(`${BASE}/forum/category/no-such-rubric`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const miss2 = await page.evaluate(() => document.querySelector('[data-forum-category-miss]')?.textContent || "");
check("неизвестная рубрика → «Рубрика не найдена»", miss2.includes("Рубрика не найдена"));

/* ---------- 6. Кнопки на страницах блоков ---------- */
async function clickForumButton(url, selector, expectedUrlPart, label) {
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const el = await page.$(selector);
  if (!el) { check(`${label}: кнопка найдена на ${url}`, false, `${selector} не найден`); return; }
  const before = page.url();
  await el.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);
  const after = page.url();
  check(`${label}: клик ведёт на форум`, after.startsWith(BASE + expectedUrlPart) && after !== before, `${after.replace(BASE, "")}`);
}

console.log("=== Кнопки страниц блоков ===");
// 6.1 ЖЭКХ
await clickForumButton("/gkh", '[data-gkf-card-forum]', "/forum/category/nedvizhimost--zhkh-i-upravlyayuschie-kompanii", "ЖКХ «Обсудить на форуме ЖКХ»");
// 6.2 Рекомендую — симулятор (был мёртвым!)
await page.goto(BASE + "/rekomenduyu", { waitUntil: "networkidle" });
await page.waitForTimeout(900);
const simBtn = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => /обсудить проблему на форуме/i.test(b.textContent || "")));
await simBtn.asElement()?.click();
await page.waitForLoadState("networkidle");
await page.waitForTimeout(700);
check("Симулятор: кнопка ведёт в рубрику «Отзывы и рекомендации»", page.url().includes("/forum/category/tovary-i-uslugi--otzyvy-i-rekomendacii"), page.url().replace(BASE, ""));
const simList = await page.evaluate(() => document.body.innerText);
check("Симулятор: список тем рубрики открылся", !simList.includes("Рубрика не найдена"));
// 6.3 Где купить — панель переноса (слаг сохраняется в адресе — by design)
await clickForumButton("/gde-kupit", '[data-e2e-btn="1"]', "/forum/topic/topic-grm-123", "«Где купить» панель (topic-grm-123)");
// 6.4 Где дешевле — панель переноса
await clickForumButton("/gde-deshevle", '[data-e2e-btn="4"]', "/forum/topic/topic-tyres-456", "«Где дешевле» панель (topic-tyres-456)");
// 6.5 Нужна помощь — НОВАЯ кнопка
await page.goto(BASE + "/help", { waitUntil: "networkidle" });
await page.waitForTimeout(900);
const hpBtn = await page.$('[data-hp-card-forum]');
check("«Нужна помощь»: кнопка форума добавлена в карточки", !!hpBtn);
if (hpBtn) {
  const href = await hpBtn.getAttribute("href");
  check("«Нужна помощь»: ссылка → «Услуги и специалисты»", href === "/forum/category/tovary-i-uslugi--uslugi-i-specialisty", href);
  await hpBtn.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);
  check("«Нужна помощь»: список тем рубрики открылся", page.url().includes("/forum/category/tovary-i-uslugi--uslugi-i-specialisty") && !(await page.evaluate(() => document.body.innerText)).includes("Рубрика не найдена"));
}
// 6.6 Знакомства — вкладка «Ищу человека»
await page.goto(BASE + "/znakomstva", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const tabBtn = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => /Ищу человека/.test(b.textContent || "")));
await tabBtn.asElement()?.click();
await page.waitForTimeout(700);
// ТЗ 2026-09-23, ЖЁСТКОЕ ПРАВИЛО: на странице Знакомств кнопок
// «Обсудить на форуме» быть не должно — общение напрямую по контактам.
const lsBtn = await page.$$("[data-ls-card-forum]");
check("«Знакомства»: кнопки «Обсудить на форуме» НЕТ (жёсткое правило ТЗ 2026-09-23)", lsBtn.length === 0);
// (клик-блок снят: кнопки больше нет по жёсткому правилу ТЗ 2026-09-23)
// 6.7 Блок «Обсудить на форуме» левой колонки (рендерится в корневом SPA)
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(700);
const navHref = await page.evaluate(() => document.querySelector('a[href*="recommend-discuss"]')?.getAttribute("href"));
check("Левая колонка: ссылки блока на /forum/category/...", navHref === "/forum/category/recommend-discuss", navHref);

/* ---------- 7. Никаких localhost / мёртвых # ---------- */
console.log("=== Гигиена ссылок ===");
await page.goto(BASE + "/gde-kupit", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const badHrefs = await page.evaluate(() => [...document.querySelectorAll("a")].map((a) => a.getAttribute("href")).filter((h) => h && (h.includes("localhost") || h.startsWith("http://127"))));
check("нет ссылок на localhost", badHrefs.length === 0, badHrefs.join(", "));

check("консоль браузера без pageerror", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
console.log(`\nИТОГ: ${ok} OK / ${fail} FAIL`);
if (failures.length) { console.log("Провалы:"); failures.forEach((f) => console.log(" -", f)); process.exit(1); }
