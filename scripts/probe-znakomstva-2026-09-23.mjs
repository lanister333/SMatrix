/**
 * ПРОБА ТЗ 2026-09-23 «Знакомства (Love Sakh)»:
 *  1) переход с главной по блоку «Знакомства» → /znakomstva;
 *  2) ровно 4 вкладки, переключаются;
 *  3) карточки: город + ник (или «Аноним») + дата/время + текст с
 *     ОТКРЫТЫМИ контактами; лента плоская, новые сверху;
 *  4) кнопка «Добавить объявление» — гостю показывается примечание
 *     о входе (форма не открывается);
 *  5) мобайл 375 без горскролла; консоль чистая.
 */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
let ok = 0, fail = 0;
const O = (name, cond, detail) => {
  if (cond) { ok++; console.log("  OK", name, detail ? "— " + detail : ""); }
  else { fail++; console.log("  FAIL", name, detail ? "— " + detail : ""); }
};
const b = await chromium.launch();

/* РАУНД 1: переход с главной */
{
  console.log("РАУНД 1: переход с главной");
  const pg = await b.newPage({ viewport: { width: 1920, height: 940 } });
  await pg.goto(BASE + "/", { waitUntil: "networkidle", timeout: 45000 });
  await pg.waitForTimeout(1000);
  const link = pg.locator('a[href="/znakomstva"]').first();
  const visible = await link.isVisible().catch(() => false);
  O("блок «Знакомства» на главной ссылается на /znakomstva", visible);
  await link.click().catch(() => {});
  await pg.waitForURL("**/znakomstva", { timeout: 15000 }).catch(() => {});
  O("клик ведёт на /znakomstva", pg.url().includes("/znakomstva"), pg.url());
  await pg.close();
}

/* РАУНД 2: страница /znakomstva */
{
  console.log("РАУНД 2: вкладки и лента");
  const pg = await b.newPage({ viewport: { width: 1920, height: 940 } });
  const errs = [];
  pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 80)); });
  await pg.goto(BASE + "/znakomstva", { waitUntil: "networkidle", timeout: 45000 });
  await pg.waitForTimeout(1500);
  const tabs = await pg.locator('[data-flat-tabs="1"] [role="tab"]').allInnerTexts();
  O("ровно 4 вкладки", tabs.length === 4, JSON.stringify(tabs));
  O("вкладка «Мужчина ищет женщину»", tabs.some((t) => t.includes("Мужчина ищет женщину")));
  O("вкладка «Ищу человека / Благодарность»", tabs.some((t) => t.includes("Ищу человека")));
  // переключение вкладок
  await pg.locator('[data-flat-tab="person"]').click();
  await pg.waitForTimeout(800);
  const personText = await pg.locator('[data-flat-card-text]').first().innerText().catch(() => "");
  O("вкладка «Ищу человека» показывает благодарность", personText.includes("трос"), personText.slice(0, 40));
  // карточка: город, ник, дата/время, контакты открыты
  const city = await pg.locator('[data-flat-card-city]').first().innerText().catch(() => "");
  const nick = await pg.locator('[data-flat-card-nick]').first().innerText().catch(() => "");
  const date = await pg.locator('[data-flat-card-date]').first().innerText().catch(() => "");
  O("город на карточке", city.trim().length > 2, city);
  O("ник на карточке", nick.trim().length > 1, nick);
  O("дата И время на карточке", /\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}/.test(date), date);
  O("контакт в тексте открыт", /vk\.com|@|WhatsApp|Telegram|\+7/.test(personText));
  O("нет аватаров", (await pg.locator('[data-flat-board="dating"] img').count()) === 0);
  // форма: гость → примечание о входе
  const addBtn = pg.locator('[data-flat-add="1"]').first();
  await addBtn.click().catch(() => {});
  await pg.waitForTimeout(400);
  const guestHint = await pg.locator('[data-flat-guest="1"]').first().isVisible().catch(() => false);
  const formOpen = await pg.locator('[data-flat-form="1"]').first().isVisible().catch(() => false);
  O("гостю — примечание о входе вместо формы", guestHint && !formOpen);
  O("консоль чистая", errs.length === 0, errs.join(" || "));
  await pg.screenshot({ path: "download/znakomstva-lovesakh-1920-2026-09-23.png" });
  await pg.close();
}

/* РАУНД 3: мобайл 375 */
{
  console.log("РАУНД 3: мобайл 375");
  const pg = await b.newPage({ viewport: { width: 375, height: 812 } });
  await pg.goto(BASE + "/znakomstva", { waitUntil: "networkidle", timeout: 45000 });
  await pg.waitForTimeout(1200);
  const diff = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  O("нет горизонтального скролла", diff <= 0, `diff=${diff}`);
  await pg.screenshot({ path: "download/znakomstva-lovesakh-375-2026-09-23.png" });
  await pg.close();
}

await b.close();
console.log(`\nИТОГ: ${ok} OK / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
