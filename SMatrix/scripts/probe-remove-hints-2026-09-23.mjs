// Проба раунда remove-hint-panels-home-2026-09-23: обе панели «Быстрые
// подсказки» сняты с Главной по прямому указанию заказчика («все это
// удали» + скриншот); Flat 2.0 и подсистема не тронуты.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
let ok = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { ok++; console.log(`OK   ${name}${extra ? " — " + extra : ""}`); }
  else { fail++; console.log(`FAIL ${name}${extra ? " — " + extra : ""}`); }
}

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// 1) Панелей нет на Главной
check("П1 «Быстрые подсказки „Где купить“» отсутствует на Главной",
  (await page.locator("[data-wtb-hints]").count()) === 0);
check("П2 «Быстрые подсказки „Где дешевле“» отсутствует на Главной",
  (await page.locator("[data-cheap-hints]").count()) === 0);
check("П3 заголовков «Быстрые подсказки» нет в DOM",
  (await page.getByText("Быстрые подсказки").count()) === 0);

// 4) Flat 2.0 не тронут
check("П4 блок «Знакомства» (FlatBoard) на Главной",
  (await page.locator('[data-flat-board="dating"]').count()) === 1,
  `count=${await page.locator('[data-flat-board]').count()}`);
check("П5 блок «Объявления» (FlatBoard) на Главной",
  (await page.locator('[data-flat-board]').count()) === 2);
const tabs = await page.locator("[data-flat-tab]").allTextContents();
check("П6 4 вкладки Знакомств на месте",
  tabs.filter((t) => t.includes("Мужчина ищет женщину") || t.includes("Женщина ищет мужчину") || t.includes("Дружба / Общение") || t.includes("Ищу человека")).length >= 4);
check("П7 3 рубрики Объявлений на месте",
  tabs.filter((t) => t.includes("Отдам даром") || t.includes("Приму в дар") || t.includes("Бюро находок")).length >= 3);

// 8) Сетка центральной колонки не тронута
check("П8 сетка: рубрики «Объявления» без «Продам / Куплю»",
  (await page.getByText("Продам / Куплю").count()) === 0);

// 9) Низ центральной колонки — после FlatBoard панелей нет (скриншот-зона)
const lastBoard = page.locator("[data-flat-board]").last();
await lastBoard.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.evaluate(() => window.scrollBy(0, 120));
await page.waitForTimeout(300);
await page.screenshot({ path: "/home/z/my-project/scripts/shots/removed-hints-2026-09-23-home.png" });

// 10) Страницы-разделы живы
for (const [u, name] of [["/znakomstva", "П9 /znakomstva"], ["/obyavleniya", "П10 /obyavleniya"]]) {
  const resp = await page.goto(BASE + u, { waitUntil: "domcontentloaded" });
  check(`${name} → 200`, resp?.status() === 200, `status=${resp?.status()}`);
}

// 11) Мобайл 375: Главная без горскролла, панелей нет
const mpage = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage();
await mpage.goto(BASE + "/", { waitUntil: "networkidle" });
await mpage.waitForTimeout(1200);
check("П11 мобайл 375: панелей «Быстрые подсказки» нет",
  (await mpage.locator("[data-wtb-hints], [data-cheap-hints]").count()) === 0);
check("П12 мобайл 375: без горизонтального скролла",
  await mpage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
await mpage.screenshot({ path: "/home/z/my-project/scripts/shots/removed-hints-2026-09-23-mobile.png" });

await browser.close();
console.log(`ИТОГ: ${ok} OK / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
