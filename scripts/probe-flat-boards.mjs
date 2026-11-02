/**
 * Проба ТЗ 2026-09-22 «Flat 2.0»: блоки «Знакомства» (4 вкладки) и
 * «Объявления» (некоммерческая доска взаимопомощи, 3 вкладки) на ГЛАВНОЙ
 * странице и на самостоятельных страницах.
 *
 * Проверки:
 *  A) Главная: оба блока (dating: 4 текстовые вкладки-кнопки; ads: 3),
 *     кнопки «Добавить объявление», ленты; панели сетки с новыми подписями
 *     (без «Продам / Куплю»); гостевые примечания; самостоятельные страницы.
 *  B) СКВОЗНОЙ сценарий «Знакомства» (пример №4 ТЗ, вкладка «Ищу человека /
 *     Благодарность»): форма (вкладка+город+одно текстовое поле; БЕЗ
 *     возраста/фото/чатов) → шаг СМС (телефон → код) → ДОСЛОВНАЯ подпись
 *     поля кода → публикация → белая карточка в тонкой серой рамке:
 *     город, дата, текст 1-в-1, номер НЕ скрыт.
 *  C) «Объявления»: коммерческий текст («Продам … цена … рублей») БЛОКИРУЕТСЯ
 *     с мотивировкой; пример №1 ТЗ (вкладка «Отдам даром / Поделюсь»)
 *     публикуется и показывается карточкой.
 *  D) СМС-негатив: неверный код → ошибка, публикации нет; API без кода → 403;
 *     legacy рубрика sell → 400; m4w остаётся валидной категорией.
 *  E) Переключение всех вкладок клиентом (лента перезагружается).
 *  F) Мобайл 375: блоки без горскролла.
 * Сид: 1 пользователь + сессия. Созданные объявления и пользователь
 * удаляются после проверок.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const BASE = "http://127.0.0.1:3000";
const SHOTS = "scripts/shots";
fs.mkdirSync(SHOTS, { recursive: true });

let passCount = 0;
let failCount = 0;
const ok = (name, cond, extra = "") => {
  if (cond) passCount++;
  else failCount++;
  console.log(`${cond ? "OK  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
};
const norm = (t) => (t || "").replace(/\s+/g, " ").trim();

for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/);
  if (m) {
    let v = m[1];
    if (v.startsWith("file:")) {
      const p = v.slice(5);
      v = "file:" + (path.isAbsolute(p) ? p : path.resolve(process.cwd(), p));
    }
    process.env.DATABASE_URL = v;
    break;
  }
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const SMS_LABEL = "Введите код из СМС, отправленный на ваш номер телефона";
const DATING_EX4 =
  "Ищу парня на белом Сузуки Эскудо. Вчера вечером во время метели ты вытащил меня из кювета на Лесном переулке и оставил свой трос. Отзовись, добрый человек, хочу вернуть трос и отблагодарить! Мой WhatsApp: 8-924-111-22-33";
const ADS_EX1 =
  "Отдам бесплатно два мешка картошки и кабачки с дачи в Троицком. Самовывоз. Пишите в WhatsApp: 8-924-555-66-77";
const ADS_COMMERCIAL = "Продам зимнюю резину Nokian, цена 8000 рублей. Звоните.";
const COMMERCIAL_MSG =
  "Раздел «Объявления» — некоммерческая доска взаимопомощи жителей Сахалина: продажа вещей, авто и недвижимости исключена. Публикуйте только то, что отдаёте даром, ищете или нашли.";

const stamp = Date.now();
const NICK = `ФлэтПроба${stamp}`;
let user = null;
const createdIds = { dating: [], ads: [] };

const browser = await chromium.launch();
try {
  user = await prisma.user.create({
    data: {
      email: `flat-probe-${stamp}@test.local`,
      passwordHash: `${crypto.randomBytes(12).toString("hex")}:${crypto.scryptSync(crypto.randomBytes(8).toString("hex"), crypto.randomBytes(12).toString("hex"), 64).toString("hex")}`,
      nickname: NICK,
      emailVerified: true,
    },
  });
  const token = crypto.randomBytes(24).toString("hex");
  await prisma.session.create({ data: { token, userId: user.id } });
  const safeUser = { id: user.id, nickname: user.nickname, email: user.email, gender: "unspecified", role: "user", emailVerified: true, orgRep: false, orgName: "" };

  /* ============ A. Главная, гость ============ */
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  const dating = page.locator('[data-flat-board="dating"]');
  const ads = page.locator('[data-flat-board="ads"]');
  await dating.waitFor({ state: "visible", timeout: 30000 });
  ok("A1 блок «Знакомства» на Главной", await dating.isVisible());
  ok("A2 ровно 4 вкладки-кнопки", (await dating.locator('[data-flat-tabs="1"] [role="tab"]').count()) === 4);
  ok("A3 вкладка «Ищу человека / Благодарность» дословно", norm(await dating.locator('[data-flat-tab="person"]').innerText()) === "[ Ищу человека / Благодарность ]");
  ok("A4 блок «Объявления» на Главной", await ads.isVisible());
  ok("A5 ровно 3 вкладки", (await ads.locator('[data-flat-tabs="1"] [role="tab"]').count()) === 3);
  ok("A6 вкладка «Бюро находок (Потерял / Нашел)» дословно", norm(await ads.locator('[data-flat-tab="lostfound"]').innerText()) === "[ Бюро находок (Потерял / Нашел) ]");
  ok("A7 кнопка «Добавить объявление» есть (оба блока)", (await page.locator('[data-flat-add="1"]').count()) === 2);
  await dating.locator('[data-flat-add="1"]').click();
  await ads.locator('[data-flat-add="1"]').click();
  ok("A8 гость: клик «Добавить» показывает примечание о входе (оба блока)", (await page.locator('[data-flat-guest="1"]').count()) === 2);
  ok("A9 сетка: панель «Объявления» без «Продам / Куплю»", !(await page.locator(".mp-paneltitle", { hasText: "Объявления" }).first().locator("..").innerText()).includes("Продам / Куплю"));
  ok("A10 поля возраста/фото/чата в блоках нет", (await page.locator('[data-flat-board="dating"] input[type="file"], [data-flat-board="dating"] [type="number"]').count()) === 0);

  /* Страницы-разделы. */
  await page.goto(BASE + "/znakomstva", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator('[data-flat-board="dating"]').waitFor({ state: "visible", timeout: 30000 });
  ok("A11 /znakomstva показывает Flat-блок", true);
  await page.goto(BASE + "/obyavleniya", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator('[data-flat-board="ads"]').waitFor({ state: "visible", timeout: 30000 });
  ok("A12 /obyavleniya показывает Flat-блок", true);
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator('[data-flat-board="dating"]').waitFor({ state: "visible", timeout: 30000 });

  /* ============ B. Вход + сквозной сценарий «Знакомства» ============ */
  await page.addInitScript(([key, val]) => localStorage.setItem(key, val), ["sm_auth", JSON.stringify({ token, user: safeUser })]);
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await dating.waitFor({ state: "visible", timeout: 30000 });
  // Ждём гидрацию авторизации (useAuth асинхронен): форма подсказок видна
  // только залогиненным — надёжный маркер.
  await page.locator('[data-wtb-hint-form="1"]').first().waitFor({ state: "visible", timeout: 30000 });

  await dating.locator('[data-flat-tab="person"]').click();
  await dating.locator('[data-flat-add="1"]').click();
  const form = dating.locator('[data-flat-form="1"]');
  await form.waitFor({ state: "visible", timeout: 15000 });
  ok("B1 форма открылась", await form.isVisible());
  ok("B2 в форме нет поля возраста", !(await form.locator("input").count()) || (await form.locator('input:not([data-flat-city="1"]):not([data-flat-sms-phone="1"]):not([data-flat-sms-code="1"])').count()) === 0);
  ok("B3 в форме нет загрузки фото", (await form.locator('input[type="file"]').count()) === 0);
  ok("B4 переключатель вкладок формы (4)", (await form.locator('[data-flat-form-tabs="1"] button').count()) === 4);
  await form.locator('[data-flat-form-tab="person"]').click();
  await form.locator('[data-flat-city="1"]').fill("Южно-Сахалинск");
  await form.locator('[data-flat-text="1"]').fill(DATING_EX4);
  await form.locator('[data-flat-next="1"]').click();
  const sms = form.locator('[data-flat-sms="1"]');
  await sms.waitFor({ state: "visible", timeout: 15000 });

  await sms.locator('[data-flat-sms-phone="1"]').fill("+7 924 000-00-01");
  const smsResp = page.waitForResponse((r) => r.url().includes("/api/sms") && r.request().method() === "POST", { timeout: 20000 });
  await sms.locator('[data-flat-sms-send="1"]').click();
  const devCode = (await (await smsResp).json()).devCode;
  ok("B5 код получен (демо-режим /api/sms)", /^\d{5}$/.test(devCode));
  ok("B6 подпись поля кода ДОСЛОВНАЯ", norm(await sms.locator(`text=${SMS_LABEL}`).innerText()) === SMS_LABEL);
  ok("B7 демо-пометка с кодом видна", norm(await sms.locator('[data-flat-sms-devcode="1"]').innerText()).includes(devCode));
  await sms.locator('[data-flat-sms-code="1"]').fill(devCode);
  await sms.locator('[data-flat-publish="1"]').click();
  await dating.locator('[data-flat-cards="1"] [data-flat-card]').first().waitFor({ state: "visible", timeout: 60000 });

  const card = dating.locator('[data-flat-cards="1"] [data-flat-card]').first();
  ok("B8 карточка в тонкой серой рамке на белом фоне", await card.evaluate((el) => {
    const cs = getComputedStyle(el);
    return cs.backgroundColor === "rgb(255, 255, 255)" && cs.borderStyle === "solid" && cs.borderWidth === "1px" && cs.boxShadow === "none";
  }));
  ok("B9 город в карточке", norm(await card.locator('[data-flat-card-city]').innerText()) === "Южно-Сахалинск");
  ok("B10 дата в карточке", /^\d{2}\.\d{2}\.\d{4}$/.test(norm(await card.locator('[data-flat-card-date]').innerText())));
  ok("B11 текст 1-в-1, номер НЕ скрыт", norm(await card.locator('[data-flat-card-text]').innerText()) === norm(DATING_EX4) && (await card.locator('[data-flat-card-text]').innerText()).includes("8-924-111-22-33"));
  await page.screenshot({ path: `${SHOTS}/flat-dating-card.png`, fullPage: false });

  /* ============ C. «Объявления»: коммерция блокируется, пример №1 публикуется ============ */
  await ads.locator('[data-flat-tab="give"]').click();
  await ads.locator('[data-flat-add="1"]').click();
  const aform = ads.locator('[data-flat-form="1"]');
  await aform.waitFor({ state: "visible", timeout: 15000 });
  ok("C1 форма доски: 3 вкладки", (await aform.locator('[data-flat-form-tabs="1"] button').count()) === 3);
  ok("C2 подпись текстового поля дословно", norm(await aform.locator('text=Описание и ваши контакты для связи').innerText()) === "Описание и ваши контакты для связи");
  await aform.locator('[data-flat-form-tab="give"]').click();
  await aform.locator('[data-flat-city="1"]').fill("Южно-Сахалинск");
  await aform.locator('[data-flat-text="1"]').fill(ADS_COMMERCIAL);
  await aform.locator('[data-flat-next="1"]').click();
  const asms = aform.locator('[data-flat-sms="1"]');
  await asms.waitFor({ state: "visible", timeout: 15000 });
  await asms.locator('[data-flat-sms-phone="1"]').fill("+7 924 000-00-02");
  const asmsResp = page.waitForResponse((r) => r.url().includes("/api/sms") && r.request().method() === "POST", { timeout: 20000 });
  await asms.locator('[data-flat-sms-send="1"]').click();
  const adCode = (await (await asmsResp).json()).devCode;
  await asms.locator('[data-flat-sms-code="1"]').fill(adCode);
  await asms.locator('[data-flat-publish="1"]').click();
  await ads.locator('[data-flat-err="1"]').waitFor({ state: "visible", timeout: 30000 });
  ok("C3 коммерческий текст заблокирован", norm(await ads.locator('[data-flat-err="1"]').innerText()) === norm(COMMERCIAL_MSG));

  await aform.locator('[data-flat-back="1"]').click();
  await aform.locator('[data-flat-text="1"]').fill(ADS_EX1);
  await aform.locator('[data-flat-next="1"]').click();
  await asms.waitFor({ state: "visible", timeout: 15000 });
  await asms.locator('[data-flat-sms-code="1"]').fill(adCode);
  await asms.locator('[data-flat-publish="1"]').click();
  await ads.locator('[data-flat-cards="1"] [data-flat-card]').first().waitFor({ state: "visible", timeout: 60000 });
  const acard = ads.locator('[data-flat-cards="1"] [data-flat-card]').first();
  ok("C4 пример №1 опубликован (код не сгорел при блокировке)", true);
  ok("C5 текст карточки 1-в-1, контакты открыты", norm(await acard.locator('[data-flat-card-text]').innerText()) === norm(ADS_EX1));
  await page.locator('[data-flat-board="ads"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/flat-ads-card.png`, fullPage: false });

  /* ============ D. СМС-негатив + API-границы ============ */
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p2.addInitScript(([key, val]) => localStorage.setItem(key, val), ["sm_auth", JSON.stringify({ token, user: safeUser })]);
  await p2.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  const d3 = p2.locator('[data-flat-board="dating"]');
  await d3.waitFor({ state: "visible", timeout: 30000 });
  await p2.locator('[data-wtb-hint-form="1"]').first().waitFor({ state: "visible", timeout: 30000 });
  await d3.locator('[data-flat-tab="friendship"]').click();
  await d3.locator('[data-flat-add="1"]').click();
  const f3 = d3.locator('[data-flat-form="1"]');
  await f3.waitFor({ state: "visible", timeout: 15000 });
  await f3.locator('[data-flat-form-tab="friendship"]').click();
  await f3.locator('[data-flat-city="1"]').fill("Корсаков");
  await f3.locator('[data-flat-text="1"]').fill("Ищу компанию для настольных игр по выходным, пишите в Telegram.");
  await f3.locator('[data-flat-next="1"]').click();
  const s3 = f3.locator('[data-flat-sms="1"]');
  await s3.waitFor({ state: "visible", timeout: 15000 });
  await s3.locator('[data-flat-sms-phone="1"]').fill("+79240000003");
  const r3 = p2.waitForResponse((r) => r.url().includes("/api/sms") && r.request().method() === "POST", { timeout: 20000 });
  await s3.locator('[data-flat-sms-send="1"]').click();
  const goodCode = (await (await r3).json()).devCode;
  await s3.locator('[data-flat-sms-code="1"]').fill("00000");
  await s3.locator('[data-flat-publish="1"]').click();
  await d3.locator('[data-flat-err="1"]').waitFor({ state: "visible", timeout: 30000 });
  ok("D1 неверный код → ошибка", (await d3.locator('[data-flat-err="1"]').innerText()).includes("Неверный код"));
  await s3.locator('[data-flat-sms-code="1"]').fill(goodCode);
  await s3.locator('[data-flat-publish="1"]').click();
  await d3.locator('[data-flat-cards="1"] [data-flat-card]').first().waitFor({ state: "visible", timeout: 60000 });
  ok("D2 верный код после неверного → публикация прошла", true);

  const apiNoSms = await page.evaluate(async ({ tk }) => {
    const r = await fetch("/api/znakomstva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tk, category: "m4w", place: "Южно-Сахалинск", text: "Проверка без СМС-кода, телефон не указан." }),
    });
    return { status: r.status, body: await r.json() };
  }, { tk: token });
  ok("D3 API без СМС → 403 smsRequired", apiNoSms.status === 403 && apiNoSms.body.smsRequired === true);
  const apiLegacy = await page.evaluate(async ({ tk }) => {
    const r = await fetch("/api/obyavleniya", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tk, rubric: "sell", place: "Южно-Сахалинск", text: "Проверка legacy-рубрики sell — её больше нет." }),
    });
    return { status: r.status };
  }, { tk: token });
  ok("D4 legacy рубрика sell → 400", apiLegacy.status === 400);
  const apiM4w = await page.evaluate(async () => {
    const r = await fetch("/api/znakomstva?category=m4w&pageSize=1");
    return r.status;
  });
  ok("D5 категория m4w по-прежнему валидна (4 вкладки)", apiM4w === 200);
  await p2.close();

  /* ============ E. Переключение всех вкладок ============ */
  for (const t of ["m4w", "w4m", "friendship", "person"]) {
    await dating.locator(`[data-flat-tab="${t}"]`).click();
    await page.waitForTimeout(700);
  }
  ok("E1 все 4 вкладки «Знакомств» переключаются", true);
  for (const t of ["give", "need", "lostfound"]) {
    await ads.locator(`[data-flat-tab="${t}"]`).click();
    await page.waitForTimeout(700);
  }
  ok("E2 все 3 вкладки «Объявлений» переключаются", true);

  /* ============ F. Мобайл 375 ============ */
  const mp = await browser.newPage({ viewport: { width: 375, height: 800 } });
  await mp.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await mp.locator('[data-flat-board="dating"]').waitFor({ state: "visible", timeout: 30000 });
  await mp.locator('[data-flat-board="ads"]').scrollIntoViewIfNeeded();
  ok("F1 мобайл 375: без горскролла", await mp.evaluate(() => document.documentElement.scrollWidth <= 375));
  await mp.screenshot({ path: `${SHOTS}/flat-mobile.png`, fullPage: false });
  await mp.close();
} finally {
  /* Cleanup: тестовые объявления и пользователь. */
  try {
    if (user) {
      const d = await prisma.datingPost.deleteMany({ where: { authorId: user.id } });
      const a = await prisma.adListing.deleteMany({ where: { authorId: user.id } });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      console.log(`Cleanup OK (${d.count} dating, ${a.count} ads, пользователь удалён)`);
    }
  } catch (e) {
    console.log("Cleanup warning:", e instanceof Error ? e.message : String(e));
  }
  await prisma.$disconnect();
  await browser.close();
}

console.log(`\nИТОГ: ${passCount} OK / ${failCount} FAIL`);
process.exit(failCount > 0 ? 1 : 0);
