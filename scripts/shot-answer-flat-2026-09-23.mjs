/**
 * Скриншоты ТЗ 2026-09-23 «Ответить»: создаём демо-запрос + 2 ответа через
 * API, снимаем карточку (десктоп/мобайл), удаляем пост (уборка).
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/download";

const browser = await chromium.launch();

async function login(ctx) {
  const r = await ctx.request.post(BASE + "/api/auth/login", {
    data: { email: "u1_модератор@sakhmatrix.local", password: "Moderator2026" },
  });
  const d = await r.json();
  return d.user;
}

async function shot(feed, apiUrl, pagePath, tag, title, text, answers) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const user = await login(ctx);
  const created = await ctx.request.post(BASE + apiUrl, {
    data: { token: user.token, title, text, place: "Южно-Сахалинск", confirmSimilar: true },
  });
  const post = await created.json();
  let i = 0;
  for (const a of answers) {
    i += 1;
    await ctx.request.patch(`${BASE + apiUrl}/${post.id}`, {
      data: { token: user.token, action: "answer", answerText: a },
    });
    if (i === 1) continue; // второй ответ покажет «ответы продолжают добавляться»
  }
  const page = await ctx.newPage();
  await page.goto(BASE + pagePath, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  const sel = feed === "wb" ? "wb" : "cd";
  const card = page.locator(`[data-${sel}-id="${post.id}"]`);
  await card.screenshot({ path: `${OUT}/sm-answer-flat-${tag}-card-2026-09-23.png` });
  await page.screenshot({ path: `${OUT}/sm-answer-flat-${tag}-page-2026-09-23.png` });

  const mctx = await browser.newContext({ viewport: { width: 375, height: 760 } });
  const mpage = await mctx.newPage();
  await mpage.goto(BASE + pagePath, { waitUntil: "networkidle", timeout: 60000 });
  await mpage.waitForTimeout(800);
  const mcard = mpage.locator(`[data-${sel}-id="${post.id}"]`);
  await mcard.screenshot({ path: `${OUT}/sm-answer-flat-${tag}-mobile-2026-09-23.png` });
  await mctx.close();

  await ctx.request.patch(`${BASE + apiUrl}/${post.id}`, {
    data: { token: user.token, action: "delete" },
  });
  await ctx.close();
  console.log(`${tag}: снимки готовы, демо-пост удалён`);
}

await shot(
  "wb", "/api/wheretobuy", "/gde-kupit", "gde-kupit",
  `Демо ТЗ: где купить редкий аккумулятор Bosch S5 AGM 70 Ah?`,
  "Ищу оригинальный Bosch S5 AGM 70 Ah (для дизеля), Southern Сахалинск. Подскажите магазин с наличием.",
  [
    "Есть в «Автодоме» на Пуркаева, 42А — отдел аккумуляторов, 8 700 руб",
    "Видел сегодня в ТЦ Сити Молл, павильон у эскалатора — 8 950 руб",
  ]
);

await shot(
  "cd", "/api/gdedeshevle", "/gde-deshevle", "gde-deshevle",
  `Демо ТЗ: где сейчас дешевле зимняя резина Triangle R16?`,
  "Сравниваю цены на комплект Triangle TR777 205/55 R16, Южно-Сахалинск.",
  [
    "«Шинный двор» на Холмском шоссе: 21 400 руб за комплект",
    "На Сахалинской у рынка: 22 100 руб, но в наличии сегодня",
  ]
);

await browser.close();
console.log("все скриншоты готовы");
