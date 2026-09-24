// Проба раунда remove-flatboard-home-2026-09-23: блоки Flat 2.0 («Знакомства»,
// «Объявления») сняты с Главной по прямому указанию заказчика («это удали» +
// скриншот); страницы /znakomstva и /obyavleniya работают, панели подсказок
// по-прежнему отсутствуют, сетка не тронута.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
let ok = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { ok++; console.log(`OK   ${name}${extra ? " — " + extra : ""}`); }
  else { fail++; console.log(`FAIL ${name}${extra ? " — " + extra : ""}`); }
}

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

// 1) Главная: FlatBoard нет
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
check("Ф1 блоки Flat 2.0 отсутствуют на Главной",
  (await page.locator("[data-flat-board]").count()) === 0);
check("Ф2 заголовка «Объявления — некоммерческая доска взаимопомощи» нет",
  (await page.getByText("некоммерческая доска взаимопомощи").count()) === 0);
check("Ф3 вкладок «Мужчина ищет женщину» (кнопки блока) нет",
  (await page.locator('[data-flat-tab="m4w"]').count()) === 0);

// 4) Регресс: панели подсказок по-прежнему отсутствуют
check("Ф4 «Быстрые подсказки» по-прежнему нет на Главной",
  (await page.locator("[data-wtb-hints], [data-cheap-hints]").count()) === 0 &&
  (await page.getByText("Быстрые подсказки").count()) === 0);

// 5) Сетка не тронута: навигационные карточки «Объявления» и «Знакомства»
check("Ф5 сетка: карточка «Знакомства» с 4 вкладками на месте",
  (await page.getByText("Мужчина ищет женщину").count()) >= 1);
check("Ф6 сетка: карточка «Объявления» с 3 рубриками на месте",
  (await page.getByText("Отдам даром / Поделюсь").count()) >= 1);

// 7) Низ центральной колонки — скриншот
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight - 1600));
await page.waitForTimeout(400);
await page.screenshot({ path: "/home/z/my-project/scripts/shots/removed-flatboard-2026-09-23-home.png" });

// 8) Страницы-разделы живы И содержат блоки Flat 2.0
for (const [u, name] of [["/znakomstva", "Ф7 /znakomstva"], ["/obyavleniya", "Ф8 /obyavleniya"]]) {
  const resp = await page.goto(BASE + u, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  check(`${name} → 200 и FlatBoard на странице`,
    resp?.status() === 200 && (await page.locator("[data-flat-board]").count()) >= 1,
    `status=${resp?.status()}`);
}

// 9) Мобайл 375: Главная без горскролла и без FlatBoard
const mpage = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage();
await mpage.goto(BASE + "/", { waitUntil: "networkidle" });
await mpage.waitForTimeout(1200);
check("Ф9 мобайл 375: FlatBoard нет на Главной",
  (await mpage.locator("[data-flat-board]").count()) === 0);
check("Ф10 мобайл 375: без горизонтального скролла",
  await mpage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
await mpage.screenshot({ path: "/home/z/my-project/scripts/shots/removed-flatboard-2026-09-23-mobile.png" });

await browser.close();
console.log(`ИТОГ: ${ok} OK / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
