/**
 * Проба ТЗ 2026-09-22: «Кабинет представителя организации» (/kabinet,
 * .matrix-business-cabinet) — присланная разметка заказчика; CSS раунд 2
 * (прислан): рейки #f59e0b/#cbd5e1, answered #f8fafc, бейджи — цветной
 * текст без плашек, отзыв italic, зона формы без оформления.
 *
 * Проверки:
 *  1) точка входа: кнопка «🛡️ Кабинет представителя» в сайдбаре /rekomenduyu
 *     видна только orgRep;
 *  2) гварды: гость /kabinet — заглушка; не-orgRep — заглушка;
 *     API org-feed: без токена 401, не-orgRep 403;
 *  3) шапка кабинета: h3 + .brand-title-accent (orgName), статус
 *     «🛡️ Верифицирован»;
 *  4) лента: только отзывы о своей организации (чужой субъект отфильтрован),
 *     pending первым, answered вторым;
 *  5) pending 1-в-1: .status-pending, .item-user-meta (ник, .badge-no
 *     «👎 Не рекомендует», дата «D месяца YYYY»), .item-review-text в кавычках,
 *     #response-zone-{id} → form.matrix-response-submit-form[data-review-id],
 *     label, textarea.textarea-flat.response-input[required] с placeholder,
 *     .response-hint, .btn-flat-submit-response;
 *  6) answered 1-в-1: .status-answered, .badge-yes «👍 Рекомендует»,
 *     .cabinet-already-answered-block («Ваш ответ (опубликован DD.MM.YYYY):»,
 *     текст, .response-locked-notice «🔒 Ответ зафиксирован…»);
 *  7) сабмит: заполнение → «Проверка ИИ…» → перезагрузка ленты → форма
 *     исчезла, блок answered появился; повторный ответ API → 409;
 *  8) CSS: рейки #f59e0b/#10b981, badge-no #fef2f2, форма-зона #f8fafc dashed,
 *     кнопка #0f766e, answered-блок #f1f5f9;
 *  9) мобайл 375: без горскролла.
 * Сид: автор + orgRep; 3 отзыва (2 о «Сервисный центр «Цифра»» — без ответа и
 * с ответом, 1 о другой организации). Ответ в сиде — прямо в БД; сабмит —
 * через UI (реальный POST с ИИ-модерацией). После проверок данные удаляются.
 * Скриншоты: scripts/shots/org-cabinet*.png
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3000";
const SHOTS = "scripts/shots";
fs.mkdirSync(SHOTS, { recursive: true });

const ok = (name, cond, extra = "") =>
  console.log(`${cond ? "OK  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
const norm = (t) => (t || "").replace(/\s+/g, " ").trim();

/* --- .env-lite: DATABASE_URL для Prisma --- */
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
import crypto from "node:crypto";

const stamp = Date.now();
const mkUser = async (nick, extra = {}) => {
  const email = `cab-probe-${nick}-${stamp}@test.local`;
  const salt = crypto.randomBytes(12).toString("hex");
  const passwordHash = `${salt}:${crypto.scryptSync(crypto.randomBytes(8).toString("hex"), salt, 64).toString("hex")}`;
  return prisma.user.create({
    data: { email, passwordHash, nickname: nick, emailVerified: true, ...extra },
  });
};

const NICK_AUTHOR = `ЖилецПроба${stamp}`;
const NICK_ORG = `КабинетчикПроба${stamp}`;
const ORG_NAME = "Сервисный центр «Цифра»";

const PENDING_POST = {
  subject: ORG_NAME,
  stance: "notrecommend",
  title: "Экран меняли дольше обещанного",
  text: "20 сентября обратилась для замены экрана. Обещали за 2 часа, вернули на следующий день. Менеджер на приемке не предупредил о сроках.",
  place: "г. Южно-Сахалинск",
  humanHighlight: "",
};
const ANSWERED_POST = {
  subject: ORG_NAME,
  stance: "recommend",
  title: "Отличный сервис",
  text: "Отличный сервис, починили ноутбук за пару часов, цена адекватная.",
  place: "",
  humanHighlight: "",
};
const FOREIGN_POST = {
  subject: "Кофейня у Площади Победы",
  stance: "recommend",
  title: "Хороший кофе",
  text: "Быстро, вкусно, уютно. Персонал приветливый, кофе всегда свежий. Однозначно рекомендую.",
  place: "",
  humanHighlight: "",
};

const safeUser = (u) => ({ id: u.id, nickname: u.nickname, email: u.email, gender: "unspecified", role: "user", emailVerified: true, orgRep: u.orgRep, orgName: u.orgName });

let author = null;
let org = null;
const browser = await chromium.launch();
try {
  author = await mkUser(NICK_AUTHOR);
  org = await mkUser(NICK_ORG, { orgRep: true, orgName: ORG_NAME });
  const mkSession = (userId) => crypto.randomBytes(24).toString("hex");
  const tokenAuthor = mkSession();
  const tokenOrg = mkSession();
  await prisma.session.createMany({
    data: [
      { token: tokenAuthor, userId: author.id },
      { token: tokenOrg, userId: org.id },
    ],
  });

  const respAt = new Date(); // ответ на «сегодня» — формат «опубликован DD.MM.YYYY»
  const created = await prisma.$transaction([
    prisma.recPost.create({ data: { ...PENDING_POST, authorId: author.id, authorName: NICK_AUTHOR } }),
    prisma.recPost.create({
      data: {
        ...ANSWERED_POST, authorId: author.id, authorName: NICK_AUTHOR,
        orgResponseText: "Здравствуйте! Спасибо за ваш отзыв и доверие к нашей команде. Будем рады видеть вас снова!",
        orgResponseAt: respAt, orgResponseByName: ORG_NAME,
      },
    }),
    prisma.recPost.create({ data: { ...FOREIGN_POST, authorId: author.id, authorName: NICK_AUTHOR } }),
  ]);
  const pendingId = created[0].id;
  const answeredId = created[1].id;

  /* 1) точка входа в сайдбаре /rekomenduyu — только orgRep */
  const pageAuthor = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await pageAuthor.addInitScript(
    ([key, val]) => localStorage.setItem(key, val),
    ["sm_auth", JSON.stringify({ token: tokenAuthor, user: safeUser(author) })]
  );
  await pageAuthor.goto(BASE + "/rekomenduyu", { waitUntil: "domcontentloaded", timeout: 45000 });
  await pageAuthor.waitForSelector(".matrix-review-card", { timeout: 60000 });
  await pageAuthor.waitForTimeout(900);
  ok("1. не-orgRep: кнопки «Кабинет представителя» в сайдбаре нет",
    (await pageAuthor.locator(".rc-sideblock", { hasText: "Кабинет представителя" }).count()) === 0);

  const pageOrg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await pageOrg.addInitScript(
    ([key, val]) => localStorage.setItem(key, val),
    ["sm_auth", JSON.stringify({ token: tokenOrg, user: safeUser(org) })]
  );
  await pageOrg.goto(BASE + "/rekomenduyu", { waitUntil: "domcontentloaded", timeout: 45000 });
  await pageOrg.waitForSelector(".matrix-review-card", { timeout: 60000 });
  await pageOrg.waitForTimeout(900);
  const cabBtn = pageOrg.locator(".rc-sideblock button", { hasText: "Кабинет представителя" });
  ok("1a. orgRep: кнопка «🛡️ Кабинет представителя» есть, клик ведёт на /kabinet",
    (await cabBtn.count()) === 1);
  await cabBtn.first().click();
  await pageOrg.waitForURL("**/kabinet", { timeout: 20000 });
  ok("1b. URL /kabinet открыт", pageOrg.url().endsWith("/kabinet"));

  /* 2) гварды */
  const guest = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await guest.goto(BASE + "/kabinet", { waitUntil: "domcontentloaded", timeout: 45000 });
  await guest.waitForTimeout(1200);
  ok("2. гость: заглушка «Войдите в аккаунт представителя…»",
    norm(await guest.locator(".matrix-business-cabinet .cabinet-empty").textContent()).includes("Войдите в аккаунт представителя"));
  ok("2a. гость: ленты отзывов нет", (await guest.locator(".cabinet-review-item").count()) === 0);
  const apiGuest = await guest.evaluate(async () => (await fetch("/api/recommend/org-feed")).status);
  ok("2b. API без токена → 401", apiGuest === 401, String(apiGuest));
  const apiNotRep = await pageAuthor.evaluate(async (tok) => (await fetch(`/api/recommend/org-feed?token=${tok}`)).status, tokenAuthor);
  ok("2c. API не-orgRep → 403", apiNotRep === 403, String(apiNotRep));

  /* 3) шапка кабинета */
  await pageOrg.waitForSelector(".matrix-business-cabinet", { timeout: 30000 });
  await pageOrg.waitForTimeout(900);
  const cab = pageOrg.locator(".matrix-business-cabinet");
  ok("3. шапка: .cabinet-header-flat > .cabinet-brand-info > h3 + .brand-title-accent",
    (await cab.locator("header.cabinet-header-flat .cabinet-brand-info h3").count()) === 1 &&
    norm(await cab.locator(".brand-title-accent").textContent()) === ORG_NAME);
  const statusTxt = norm(await cab.locator(".cabinet-brand-info p").textContent());
  ok("3a. статус «📍 Южно-Сахалинск • Статус: 🛡️ Верифицирован»",
    statusTxt.includes("📍 Южно-Сахалинск") && statusTxt.includes("Статус:") &&
    norm(await cab.locator(".status-verified").textContent()) === "🛡️ Верифицирован", statusTxt);

  /* 4) лента: только свои, pending первым */
  const h5 = norm(await cab.locator(".cabinet-reviews-feed > h5").textContent());
  ok("4. h5 «Отзывы жителей города о вашей организации»", h5 === "Отзывы жителей города о вашей организации");
  const items = cab.locator(".cabinet-review-item");
  ok("4a. два отзыва (чужой субъект отфильтрован)", (await items.count()) === 2);
  ok("4b. pending первым, answered вторым",
    (await items.nth(0).getAttribute("class"))?.includes("status-pending") &&
    (await items.nth(1).getAttribute("class"))?.includes("status-answered"));

  /* 5) pending 1-в-1 */
  const pend = items.nth(0);
  const metaP = norm(await pend.locator(".item-user-meta").textContent());
  ok("5. .item-user-meta: ник + .badge-no «👎 Не рекомендует» + дата «D месяца YYYY»",
    metaP.startsWith(NICK_AUTHOR) &&
    norm(await pend.locator(".badge-no").textContent()) === "👎 Не рекомендует" &&
    /^\d{1,2} (января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря) \d{4}$/.test(norm(await pend.locator(".date-text").textContent())), metaP);
  ok("5a. .item-review-text в кавычках «…»",
    norm(await pend.locator(".item-review-text").textContent()).startsWith("«20 сентября обратилась"));
  const zone = pend.locator(`#response-zone-${pendingId}`);
  const form = pend.locator("form.matrix-response-submit-form");
  ok("5b. #response-zone-{id} + form[data-review-id] 1-в-1",
    (await zone.count()) === 1 &&
    (await form.getAttribute("data-review-id")) === pendingId);
  ok("5c. label «Ваш официальный ответ (Допускается только один ответ, без дальнейших дискуссий):»",
    norm(await form.locator("label").textContent()) === "Ваш официальный ответ (Допускается только один ответ, без дальнейших дискуссий):");
  const ta = form.locator("textarea.textarea-flat.response-input");
  ok("5d. textarea .textarea-flat.response-input[required] + placeholder из ТЗ",
    (await ta.count()) === 1 &&
    (await ta.getAttribute("required")) === "" &&
    (await ta.getAttribute("placeholder"))?.startsWith("Поприветствуйте клиента"));
  ok("5e. .response-hint «💡 Пишите человеческим языком…» + кнопка «Отправить официальный ответ»",
    norm(await form.locator(".response-hint").textContent()) === "💡 Пишите человеческим языком, избегайте казенных формулировок." &&
    norm(await form.locator(".btn-flat-submit-response").textContent()) === "Отправить официальный ответ");

  /* 6) answered 1-в-1 */
  const ans = items.nth(1);
  ok("6. answered: .badge-yes «👍 Рекомендует» + .cabinet-already-answered-block",
    norm(await ans.locator(".badge-yes").textContent()) === "👍 Рекомендует" &&
    (await ans.locator(".cabinet-already-answered-block").count()) === 1 &&
    (await ans.locator("form.matrix-response-submit-form").count()) === 0);
  const ansHead = norm(await ans.locator(".cabinet-already-answered-block strong").textContent());
  ok("6a. «Ваш ответ (опубликован DD.MM.YYYY):»",
    new RegExp(`^Ваш ответ \\(опубликован \\d{2}\\.\\d{2}\\.\\d{4}\\):$`).test(ansHead), ansHead);
  ok("6b. текст ответа + .response-locked-notice «🔒 Ответ зафиксирован…»",
    norm(await ans.locator(".cabinet-already-answered-block p").textContent()).includes("Будем рады видеть вас снова") &&
    norm(await ans.locator(".response-locked-notice").textContent()) === "🔒 Ответ зафиксирован. Редактирование или повторный ответ невозможны согласно правилам SakhMatrix.");
  await pageOrg.screenshot({ path: `${SHOTS}/org-cabinet.png` });

  /* 8) CSS раунд 2 (прислан) */
  const st = async (loc, prop) => loc.evaluate((el, p) => getComputedStyle(el)[p], prop);
  ok("8. CSS: рейки pending #f59e0b / answered #cbd5e1 + фон answered #f8fafc",
    (await st(pend, "borderLeftColor")) === "rgb(245, 158, 11)" &&
    (await st(ans, "borderLeftColor")) === "rgb(203, 213, 225)" &&
    (await st(ans, "backgroundColor")) === "rgb(248, 250, 252)");
  ok("8a. CSS: badge-no текст #dc2626 без плашки, отзыв italic Arial, зона без оформления, кнопка #0f766e, answered-блок #f1f5f9",
    (await st(pend.locator(".badge-no"), "color")) === "rgb(220, 38, 38)" &&
    (await st(pend.locator(".badge-no"), "backgroundColor")) === "rgba(0, 0, 0, 0)" &&
    (await st(pend.locator(".item-review-text"), "fontStyle")) === "italic" &&
    (await st(pend.locator(".item-review-text"), "fontFamily")).startsWith("Arial") &&
    (await st(pend.locator(".cabinet-response-form-zone"), "backgroundColor")) === "rgba(0, 0, 0, 0)" &&
    (await st(pend.locator(".btn-flat-submit-response"), "backgroundColor")) === "rgb(15, 118, 110)" &&
    (await st(ans.locator(".cabinet-already-answered-block"), "backgroundColor")) === "rgb(241, 245, 249)");

  /* 7) сабмит: ответ через UI (ИИ-модерация) */
  await ta.fill("Здравствуйте! Приносим извинения за задержку и за то, что менеджер приёмки не предупредил вас о сроках. Свяжитесь с нами в WhatsApp — подготовили компенсацию на следующее обслуживание.");
  await pend.locator(".btn-flat-submit-response").click();
  ok("7. busy: кнопка «Проверка ИИ…» disabled",
    (await pageOrg.locator(".btn-flat-submit-response", { hasText: "Проверка ИИ…" }).count()) === 1 &&
    await pageOrg.locator(".btn-flat-submit-response").first().isDisabled());
  await pageOrg.waitForTimeout(9000); // ИИ-модерация + перезагрузка ленты
  const pendAfter = pageOrg.locator(".cabinet-review-item.status-pending");
  ok("7a. после сабмита: pending нет, у отзыва answered-блок",
    (await pendAfter.count()) === 0 &&
    (await pageOrg.locator(`.cabinet-review-item .cabinet-already-answered-block`).count()) === 2);
  const dbResp = await prisma.recPost.findUnique({ where: { id: pendingId } });
  ok("7b. БД: orgResponseText записан", !!dbResp?.orgResponseAt && (dbResp.orgResponseText ?? "").includes("Приносим извинения за задержку"));
  const apiDup = await pageOrg.evaluate(async ({ id, tok }) => {
    const r = await fetch(`/api/recommend/${id}/org-response`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: tok, text: "Попытка второго официального ответа на тот же отзыв" }) });
    return { status: r.status };
  }, { id: pendingId, tok: tokenOrg });
  ok("7c. повторный ответ API → 409", apiDup.status === 409, JSON.stringify(apiDup));
  await pageOrg.screenshot({ path: `${SHOTS}/org-cabinet-after.png` });

  /* 9) мобайл 375 */
  const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mob.addInitScript(
    ([key, val]) => localStorage.setItem(key, val),
    ["sm_auth", JSON.stringify({ token: tokenOrg, user: safeUser(org) })]
  );
  await mob.goto(BASE + "/kabinet", { waitUntil: "domcontentloaded", timeout: 45000 });
  await mob.waitForSelector(".matrix-business-cabinet", { timeout: 60000 });
  await mob.waitForTimeout(1000);
  const sw = await mob.evaluate(() => document.documentElement.scrollWidth);
  ok("9. мобайл 375: без горскролла", sw <= 375, `sw=${sw}`);
  await mob.screenshot({ path: `${SHOTS}/org-cabinet-mobile.png` });

  console.log("PROBE DONE");
} finally {
  await browser.close();
  try {
    const nicks = [NICK_AUTHOR, NICK_ORG];
    const users = await prisma.user.findMany({ where: { nickname: { in: nicks } } });
    for (const u of users) {
      await prisma.recUsefulVote.deleteMany({ where: { userId: u.id } });
      await prisma.recComplaint.deleteMany({ where: { post: { authorId: u.id } } });
      await prisma.recPost.deleteMany({ where: { authorId: u.id } });
      await prisma.session.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
    console.log(`CLEANUP OK (${users.length} users)`);
  } catch (e) {
    console.log("CLEANUP FAIL:", e instanceof Error ? e.message : String(e));
  }
  await prisma.$disconnect();
}
