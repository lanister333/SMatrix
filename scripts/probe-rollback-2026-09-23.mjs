// Проба раунда rollback-2026-09-23: откат последнего раунда clean-home-simulator
// (коммит fefb7b0) по указанию заказчика «откати назад» — git revert.
// Ожидаемое состояние = 285e773: на Главной нет панелей подсказок и FlatBoard,
// песочницы /test-simulator больше НЕТ (404), адаптер слагов продолжает работать.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
let ok = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { ok++; console.log(`OK   ${name}${extra ? " — " + extra : ""}`); }
  else { fail++; console.log(`FAIL ${name}${extra ? " — " + extra : ""}`); }
}

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

// 1) Главная: панели подсказок и FlatBoard отсутствуют
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
check("R1 «Быстрые подсказки» нет на Главной",
  (await page.locator("[data-wtb-hints], [data-cheap-hints]").count()) === 0 &&
  (await page.getByText("Быстрые подсказки").count()) === 0);
check("R2 блоки Flat 2.0 отсутствуют на Главной",
  (await page.locator("[data-flat-board]").count()) === 0 &&
  (await page.getByText("некоммерческая доска взаимопомощи").count()) === 0);

// 2) Главная: никаких следов тестового контента (примеры/кнопки песочницы)
const bodyText = await page.evaluate(() => document.body.innerText);
check("R3 нет тестовых кнопок «Симулировать ввод в блок»", !bodyText.includes("Симулировать ввод в блок"));
check("R4 нет карточек «Ввод пользователя (Ошибка)»", !bodyText.includes("Ввод пользователя"));
check("R5 нет тестовых примеров ТЗ (ГРМ/Пуркаева/ТЦ Рояль/блесны)",
  !bodyText.includes("ремкомплект") && !bodyText.includes("Пуркаева") &&
  !bodyText.includes("ТЦ Рояль") && !bodyText.includes("блесны"));

// 3) Сетка не тронута
check("R6 сетка: карточка «Знакомства» (4 вкладки) на месте",
  (await page.getByText("Мужчина ищет женщину").count()) >= 1);
check("R7 сетка: карточка «Объявления» (3 рубрики) на месте",
  (await page.getByText("Отдам даром / Поделюсь").count()) >= 1);

// 4) Скриншот низа центральной колонки
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight - 1600));
await page.waitForTimeout(400);
await page.screenshot({ path: "/home/z/my-project/scripts/shots/rollback-2026-09-23-home.png" });

// 5) Страницы-разделы живы с FlatBoard
for (const [u, name] of [["/znakomstva", "R8 /znakomstva"], ["/obyavleniya", "R9 /obyavleniya"]]) {
  const resp = await page.goto(BASE + u, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  check(`${name} → 200 и FlatBoard на странице`,
    resp?.status() === 200 && (await page.locator("[data-flat-board]").count()) >= 1,
    `status=${resp?.status()}`);
}

// 6) Песочница удалена откатом: /test-simulator → 404
const resp404 = await page.goto(BASE + "/test-simulator", { waitUntil: "domcontentloaded" });
check("R10 /test-simulator → 404 (песочница удалена откатом)", resp404?.status() === 404,
  `status=${resp404?.status()}`);

// 7) Адаптер слагов жив: слаг из примера → редирект на числовую тему
await page.goto(BASE + "/forum/topic/topic-grm-123", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
check("R11 слаг topic-grm-123 → редирект на /?topic=177 (страница темы)",
  page.url().includes("topic=177"), `url=${page.url()}`);

// 8) Мобайл 375
const mpage = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage();
await mpage.goto(BASE + "/", { waitUntil: "networkidle" });
await mpage.waitForTimeout(1200);
check("R12 мобайл 375: панелей и FlatBoard нет",
  (await mpage.locator("[data-flat-board], [data-wtb-hints], [data-cheap-hints]").count()) === 0);
check("R13 мобайл 375: без горизонтального скролла",
  await mpage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
await mpage.screenshot({ path: "/home/z/my-project/scripts/shots/rollback-2026-09-23-mobile.png" });

await browser.close();
console.log(`ИТОГ: ${ok} OK / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
