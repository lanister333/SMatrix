/**
 * Проба ТЗ 2026-09-21: flat-модалка «Новая публикация в ленту взаимопомощи»
 * (help-publications.tsx — HelpCreateModal по присланной разметке заказчика).
 * Проверки:
 *  1) /help: кнопки «＋ Создать публикацию» (.hp-addbtn, .hp-newbtn) открывают
 *     .matrix-modal-form#help-form-modal (id и классы 1-в-1 из ТЗ);
 *  2) тексты 1-в-1: h5, предупреждение по Манифесту, 3 метки, 3 плейсхолдера;
 *  3) атрибуты: required на всех полях, maxlength=100 у темы;
 *     form#matrix-help-submit-form, кнопки Отмена/Опубликовать;
 *  4) computed-styles CSS заказчика: оверлей fixed z-1000 + rgba(15,23,42,.4) +
 *     blur(4px), контент radius 12/max-width 550/padding 28/тень ТЗ,
 *     предупреждение янтарное #fffbeb/#713f12/#fef08a, submit #0f766e
 *     (hover #115e59), cancel #f1f5f9 (hover #e2e8f0), поля #cbd5e1/r6,
 *     textarea 100px/resize none, фокус поля #0f766e;
 *  5) «Отмена» закрывает модалку; повторное открытие через .hp-newbtn;
 *  5b) клиентский фильтр карт (сниппет ТЗ 2026-09-21): 16 цифр в описании →
 *      alert с точным текстом ТЗ, отправка жёстко заблокирована (0 POST-ов,
 *      модалка открыта, busy выключен, публикация не создана);
 *  5c) серверный фильтр через UI: 13 цифр (клиент пропускает) → POST 400,
 *      .sk-modal-err с точным текстом ТЗ «Ошибка модерации: …»;
 *  5d) серверный фильтр напрямую (fetch /api/help): 15 и 19 цифр → 400 +
 *      точный текст ТЗ; публикаций в БД — 0;
 *  6) отправка формы → модалка закрылась, публикация появилась в ленте
 *     (реальный POST /api/help, ИИ-модерация); после снятия реквизитов
 *     публикация проходит — recovery-сценарий;
 *  7) мобайл 375: docW === vw с открытой модалкой.
 * Авторизация: сидится тестовый пользователь + Session прямо в БД,
 * токен кладётся в localStorage (sm_auth) до загрузки страницы.
 * После проверок тестовая публикация удаляется API-методом автора,
 * сид-пользователь удаляется из БД.
 * Скриншоты: scripts/shots/help-modal-*.png
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3000";
const SHOTS = "scripts/shots";
fs.mkdirSync(SHOTS, { recursive: true });

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
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
const NICK = `ПомощникПроба${stamp}`;
const EMAIL = `help-probe-${stamp}@test.local`;
const PASSWORD = crypto.randomBytes(12).toString("hex");
const salt = crypto.randomBytes(12).toString("hex");
const hash = crypto.scryptSync(PASSWORD, salt, 64).toString("hex");
const passwordHash = `${salt}:${hash}`;

const TITLE = "Помочь довезти продукты пожилому человеку";
const DESC = "Завтра утром по пути в центр, продукты лёгкие. Расходов нет — бензин свой, помощь полностью бесплатная.";
const CONTACT = "WhatsApp +7 (9XX) XXX-XX-XX, Иван";

/* ТЗ 2026-09-21: точные тексты клиентского alert и серверной ошибки */
const CARD_ALERT_TZ = "Внимание: Публикация номеров банковских карт в разделе взаимопомощи запрещена правилами SakhMatrix. Пожалуйста, удалите платежные реквизиты. Помощь должна быть безвозмездной.";
const MONEY_BLOCK_TZ = "Ошибка модерации: Обнаружены запрещенные платежные реквизиты или призывы к сбору денежных средств. Раздел функционирует только на безвозмездной основе.";

let user = null;
const browser = await chromium.launch();
try {
  user = await prisma.user.create({
    data: { email: EMAIL, passwordHash, nickname: NICK, emailVerified: true },
  });
  const token = crypto.randomBytes(24).toString("hex");
  await prisma.session.create({ data: { token, userId: user.id } });
  const safeUser = { id: user.id, nickname: NICK, email: EMAIL, gender: "unspecified", role: "user", emailVerified: true, orgRep: false, orgName: "" };

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(
    ([key, val]) => localStorage.setItem(key, val),
    ["sm_auth", JSON.stringify({ token, user: safeUser })]
  );
  // слушатели диалогов (alert) и POST /api/help — для фильтра реквизитов
  const dialogs = [];
  page.on("dialog", async (d) => {
    dialogs.push(d.message());
    await d.dismiss();
  });
  let apiPosts = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/help") && r.method() === "POST") apiPosts++;
  });
  await page.goto(BASE + "/help", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector(".hp-head", { timeout: 45000 });
  await page.waitForTimeout(1200);

  // 1) кнопки и открытие модалки
  const btnLeft = page.locator(".hp-addbtn");
  const btnHead = page.locator(".hp-newbtn");
  ok("1. кнопки «＋ Создать публикацию» на странице (левая + шапка)",
    norm(await btnLeft.textContent()) === "＋ Создать публикацию" &&
    norm(await btnHead.textContent()) === "＋ Создать публикацию",
    `${await btnLeft.count()} + ${await btnHead.count()}`);
  await btnLeft.click();
  await page.waitForSelector("#help-form-modal", { timeout: 45000 });
  await page.waitForTimeout(400);
  ok("1a. клик открывает .matrix-modal-form#help-form-modal",
    (await page.locator("#help-form-modal.matrix-modal-form").count()) === 1);
  const ov = await page.locator("#help-form-modal").evaluate((el) => {
    const s = getComputedStyle(el);
    return { pos: s.position, z: s.zIndex, bg: s.backgroundColor, bf: s.backdropFilter };
  });
  ok("1b. оверлей: fixed, z-index 1000, rgba(15,23,42,0.4), blur(4px)",
    ov.pos === "fixed" && ov.z === "1000" && ov.bg === "rgba(15, 23, 42, 0.4)" &&
    (ov.bf || "").includes("blur(4px)"), JSON.stringify(ov));

  // 2) тексты 1-в-1
  const h5 = norm(await page.locator("#help-form-modal .modal-form-content h5").textContent());
  ok("2. h5 «Новая публикация в ленту взаимопомощи»",
    h5 === "Новая публикация в ленту взаимопомощи", h5);
  const notice = norm(await page.locator("#help-form-modal .modal-rules-notice").textContent());
  ok("2a. предупреждение по Манифесту 1-в-1",
    notice === "Помощь только БЕСПЛАТНАЯ. Сборы денег, переводы, реклама и вакансии запрещены. Вы несете ответственность за достоверность данных.",
    notice.slice(0, 50) + "…");
  const noticeSt = await page.locator("#help-form-modal .modal-rules-notice").evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, c: s.color, bd: s.borderColor };
  });
  ok("2b. предупреждение: янтарная гамма ТЗ #fffbeb/#713f12/#fef08a",
    noticeSt.bg === rgb("#fffbeb") && noticeSt.c === rgb("#713f12") && noticeSt.bd === rgb("#fef08a"),
    JSON.stringify(noticeSt));
  const labels = await page.locator("#matrix-help-submit-form .form-flat-group > label").allTextContents();
  ok("2c. метки 1-в-1",
    norm(labels[0]) === "Тема (Коротко: что случилось?)" &&
    norm(labels[1]) === "Описание ситуации и суть содействия" &&
    norm(labels[2]) === "Ваши контактные данные для прямой связи",
    labels.map(norm).join(" | "));
  const ph = await page.locator("#matrix-help-submit-form").evaluate((f) =>
    [...f.querySelectorAll("input,textarea")].map((el) => el.placeholder)
  );
  ok("2d. плейсхолдеры 1-в-1",
    ph[0] === "Например: Помочь довезти продукты пожилому человеку" &&
    ph[1] === "Опишите детали, место, время. Если помощь предполагает сопутствующие расходы — укажите их прямо здесь." &&
    ph[2] === "Например: WhatsApp +7 (9XX) XXX-XX-XX, Иван",
    ph.map((x) => x.slice(0, 28) + "…").join(" | "));

  // 3) атрибуты и структура
  const attrs = await page.locator("#matrix-help-submit-form").evaluate((f) => ({
    formId: f.id,
    fields: [...f.querySelectorAll("input,textarea")].map((el) => ({
      id: el.id,
      cls: el.className,
      req: el.required,
      ml: el.maxLength === -1 ? null : el.maxLength,
    })),
  }));
  ok("3. form#matrix-help-submit-form; поля input-flat/textarea-flat, все required",
    attrs.formId === "matrix-help-submit-form" &&
    attrs.fields.length === 3 &&
    attrs.fields.every((x) => x.req && x.cls) &&
    attrs.fields[0].cls === "input-flat" && attrs.fields[1].cls === "textarea-flat" && attrs.fields[2].cls === "input-flat",
    JSON.stringify(attrs.fields));
  ok("3a. maxlength=100 у темы", attrs.fields[0].ml === 100, `ml=${attrs.fields[0].ml}`);
  const btns = await page.locator("#matrix-help-submit-form button").allTextContents();
  const btnCls = await page.locator("#matrix-help-submit-form button").evaluateAll((els) => els.map((e) => e.className));
  ok("3b. кнопки: btn-flat-cancel «Отмена» + btn-flat-submit «Опубликовать»",
    norm(btns[0]) === "Отмена" && norm(btns[1]) === "Опубликовать" &&
    btnCls[0] === "btn-flat-cancel" && btnCls[1] === "btn-flat-submit",
    `${btns.map(norm).join(" / ")} [${btnCls.join(", ")}]`);

  // 4) стили контента и кнопок
  const cont = await page.locator("#help-form-modal .modal-form-content").evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, r: s.borderRadius, mw: s.maxWidth, pad: s.padding, sh: s.boxShadow };
  });
  ok("4. контент: белый, radius 12, max-width 550, padding 28, тень ТЗ",
    cont.bg === rgb("#ffffff") && cont.r === "12px" && cont.mw === "550px" &&
    cont.pad === "28px" && cont.sh.includes("20px 25px"), JSON.stringify(cont));
  const submitSt = await page.locator("#help-form-modal .btn-flat-submit").evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, c: s.color, r: s.borderRadius, fw: s.fontWeight };
  });
  ok("4a. submit: бирюза #0f766e/белый, radius 6, weight 600",
    submitSt.bg === rgb("#0f766e") && submitSt.c === rgb("#ffffff") && submitSt.r === "6px" &&
    submitSt.fw === "600", JSON.stringify(submitSt));
  const cancelSt = await page.locator("#help-form-modal .btn-flat-cancel").evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, bs: s.borderStyle };
  });
  ok("4b. cancel: #f1f5f9, без рамки", cancelSt.bg === rgb("#f1f5f9") && cancelSt.bs === "none", JSON.stringify(cancelSt));
  const inpSt = await page.locator("#help-title").evaluate((el) => {
    const s = getComputedStyle(el);
    return { bd: s.borderColor, r: s.borderRadius, pad: s.padding, bs: s.boxSizing };
  });
  ok("4c. input-flat: рамка #cbd5e1, radius 6, padding 10, border-box",
    inpSt.bd === rgb("#cbd5e1") && inpSt.r === "6px" && inpSt.pad === "10px" && inpSt.bs === "border-box",
    JSON.stringify(inpSt));
  const taSt = await page.locator("#help-desc").evaluate((el) => {
    const s = getComputedStyle(el);
    return { h: s.height, rs: s.resize };
  });
  ok("4d. textarea-flat: height 100px, resize none", taSt.h === "100px" && taSt.rs === "none", JSON.stringify(taSt));
  const labSt = await page.locator("#matrix-help-submit-form .form-flat-group > label").first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { fs: s.fontSize, fw: s.fontWeight, disp: s.display, mb: s.marginBottom };
  });
  ok("4e. label: 13px/600/block/mb 6",
    labSt.fs === "13px" && labSt.fw === "600" && labSt.disp === "block" && labSt.mb === "6px", JSON.stringify(labSt));
  const grpSt = await page.locator("#matrix-help-submit-form .form-flat-group").first().evaluate((el) => getComputedStyle(el).marginBottom);
  const actSt = await page.locator("#help-form-modal .modal-form-actions").evaluate((el) => {
    const s = getComputedStyle(el);
    return { gap: s.columnGap, mt: s.marginTop, jc: s.justifyContent };
  });
  ok("4f. group mb 16; actions: gap 12/mt 20/вправо",
    grpSt === "16px" && actSt.gap === "12px" && actSt.mt === "20px" && actSt.jc === "flex-end",
    JSON.stringify({ grpSt, actSt }));

  await page.locator("#help-form-modal .modal-form-content").screenshot({ path: `${SHOTS}/help-modal-open.png` });

  await page.locator("#help-form-modal .btn-flat-submit").hover();
  const submitHover = await page.locator("#help-form-modal .btn-flat-submit").evaluate((el) => getComputedStyle(el).backgroundColor);
  ok("4g. submit:hover → #115e59", submitHover === rgb("#115e59"), submitHover);
  await page.locator("#help-title").focus();
  const focusBd = await page.locator("#help-title").evaluate((el) => getComputedStyle(el).borderColor);
  ok("4h. фокус поля: рамка #0f766e", focusBd === rgb("#0f766e"), focusBd);

  // 5) «Отмена» закрывает; повторное открытие через шапку
  await page.locator("#help-form-modal .btn-flat-cancel").click();
  await page.waitForTimeout(300);
  ok("5. «Отмена» закрывает модалку", (await page.locator("#help-form-modal").count()) === 0);
  await btnHead.click();
  await page.waitForSelector("#help-form-modal", { timeout: 45000 });
  ok("5a. повторное открытие кнопкой шапки — модалка снова видна",
    await page.locator("#help-form-modal").isVisible());

  // 5b) клиентский фильтр карт (сниппет ТЗ 2026-09-21): 16 цифр в описании
  await page.fill("#help-title", "Нужны лекарства для бабушки");
  await page.fill("#help-desc", "Куплю и привезу, очень нужно. Переведите на карту 4400 1111 2222 3333");
  await page.fill("#help-contact", "WhatsApp +7 914 123 45 67");
  const postsBefore5b = apiPosts;
  await page.locator("#help-form-modal .btn-flat-submit").click();
  await page.waitForTimeout(800);
  ok("5b. клиентский фильтр: alert с точным текстом ТЗ",
    dialogs.length === 1 && dialogs[0] === CARD_ALERT_TZ,
    dialogs.length ? dialogs[0].slice(0, 60) + "…" : "alert не показан");
  ok("5b. отправка заблокирована: 0 POST /api/help, модалка открыта, busy выключен",
    apiPosts === postsBefore5b &&
    (await page.locator("#help-form-modal").count()) === 1 &&
    norm(await page.locator("#help-form-modal .btn-flat-submit").textContent()) === "Опубликовать");
  ok("5b. публикация НЕ создана (БД)",
    (await prisma.helpPublication.count({ where: { authorId: user.id } })) === 0);

  // 5c) серверный фильтр через UI: 13 цифр (клиентский 16-паттерн пропускает)
  await page.fill("#help-title", "Отдам детские вещи бесплатно");
  await page.fill("#help-desc", "Заберите сегодня до 18:00, перевод 4111111111111 для подтверждения серьёзности");
  await page.locator("#help-form-modal .btn-flat-submit").click();
  await page.waitForSelector("#matrix-help-submit-form .sk-modal-err", { timeout: 30000 });
  const errText = norm(await page.locator("#matrix-help-submit-form .sk-modal-err").textContent());
  ok("5c. серверный фильтр (13 цифр): .sk-modal-err с точным текстом ТЗ",
    errText === MONEY_BLOCK_TZ, errText.slice(0, 60) + "…");
  ok("5c. модалка открыта, публикация НЕ создана",
    (await page.locator("#help-form-modal").count()) === 1 &&
    (await prisma.helpPublication.count({ where: { authorId: user.id } })) === 0);

  // 5d) серверный фильтр напрямую: 15 и 19 цифр (fetch /api/help из браузера)
  const direct = await page.evaluate(async ({ tok, blockText }) => {
    const out = [];
    for (const text of [
      "Помогу с документами, номер карты 378282246310005",
      "Реквизиты для связи: 6331101999990016801",
    ]) {
      const r = await fetch("/api/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tok, title: "Помогу с продуктами бесплатно", text, contactData: "Telegram @ivan" }),
      });
      const d = await r.json().catch(() => ({}));
      out.push({ status: r.status, error: d.error ?? "" });
    }
    return out;
  }, { tok: token, blockText: MONEY_BLOCK_TZ });
  ok("5d. сервер: 15 цифр → 400 + точный текст ТЗ",
    direct[0]?.status === 400 && direct[0]?.error === MONEY_BLOCK_TZ, JSON.stringify(direct[0]));
  ok("5d. сервер: 19 цифр → 400 + точный текст ТЗ",
    direct[1]?.status === 400 && direct[1]?.error === MONEY_BLOCK_TZ, JSON.stringify(direct[1]));
  ok("5d. публикаций в БД по-прежнему 0",
    (await prisma.helpPublication.count({ where: { authorId: user.id } })) === 0);

  // 6) отправка формы → публикация в ленте
  await page.fill("#help-title", TITLE);
  await page.fill("#help-desc", DESC);
  await page.fill("#help-contact", CONTACT);
  await page.locator("#help-form-modal .btn-flat-submit").click();
  // ждём закрытия модалки (успех) — ИИ-модерация может занять время
  await page.waitForFunction(() => !document.querySelector("#help-form-modal"), null, { timeout: 90000 });
  ok("6. после отправки модалка закрылась (успех POST /api/help)", true);
  await page.waitForTimeout(1200);
  const cardCount = await page.locator(".help-item-card", { hasText: TITLE }).count();
  ok("6a. публикация появилась в ленте", cardCount >= 1, `cards=${cardCount}`);
  if (cardCount > 0) {
    await page.locator(".help-item-card", { hasText: TITLE }).first().screenshot({ path: `${SHOTS}/help-card-created.png` });
  }

  // 7) мобайл 375
  const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mob.addInitScript(
    ([key, val]) => localStorage.setItem(key, val),
    ["sm_auth", JSON.stringify({ token, user: safeUser })]
  );
  await mob.goto(BASE + "/help", { waitUntil: "domcontentloaded", timeout: 45000 });
  await mob.waitForSelector(".hp-head", { timeout: 45000 });
  await mob.waitForTimeout(1000);
  await mob.locator(".hp-addbtn").click();
  await mob.waitForSelector("#help-form-modal", { timeout: 45000 });
  await mob.waitForTimeout(400);
  const mobDocW = await mob.evaluate(() => document.documentElement.clientWidth);
  ok("7. мобайл 375 с открытой модалкой: docW === 375", mobDocW === 375, `docW=${mobDocW}`);
  const mobModal = await mob.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.querySelector(".modal-form-content")?.offsetWidth ?? 0,
  }));
  ok("7a. мобайл: контент 375 (full-bleed), без горскролла",
    mobModal.cw === 375 && mobModal.sw <= 375, JSON.stringify(mobModal));
  await mob.locator("#help-form-modal .modal-form-content").screenshot({ path: `${SHOTS}/help-modal-mobile.png` });

  console.log("PROBE DONE");
} finally {
  await browser.close();
  // очистка: тестовая публикация (API автора) → сессия → пользователь
  try {
    if (user) {
      const pubs = await prisma.helpPublication.findMany({ where: { authorId: user.id } });
      await prisma.helpPublication.deleteMany({ where: { id: { in: pubs.map((p) => p.id) } } });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
      console.log(`CLEANUP OK (user ${NICK}, pubs: ${pubs.length})`);
    }
  } catch (e) {
    console.log("CLEANUP FAIL:", e instanceof Error ? e.message : String(e));
  }
  await prisma.$disconnect();
}
