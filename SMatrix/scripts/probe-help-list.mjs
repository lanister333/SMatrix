/**
 * Проба ТЗ 2026-09-21: новая разметка ленты «Нужна помощь» — контейнер
 * .help-publications-list (вместо текста «Загрузка…») и карточки
 * .help-item-card. Сидятся 2 пользователя и 4 публикации (активная чужая,
 * решённая чужая, неактуальная чужая, активная СВОЯ). Проверки:
 *  1) контейнер есть; текст «Загрузка…» после загрузки отсутствует;
 *  2) чужая активная: бейдж «Актуально» (не серый), «👤 Ник: …», дата
 *     с временем «, ЧЧ:ММ», h4/p 1-в-1, футер «Связь напрямую:» +
 *     a.wa-action-link → https://wa.me (_blank, «Написать в WhatsApp»),
 *     «⚠️ Пожаловаться» (.btn-report); WA-ссылка НЕ синяя (.sk a перебит);
 *  3) решённая: .status-resolved, серый бейдж «Вопрос решён», дата БЕЗ
 *     времени, футер «✓ Взаимопомощь оказана», без WA/жалобы;
 *  4) неактуальная: серый бейдж «Неактуально», без resolved-text;
 *  5) своя активная: служебные кнопки (Вопрос решён/Неактуально/
 *     Редактировать/Удалить), без btn-report;
 *  6) клик «⚠️ Пожаловаться» открывает существующую модалку жалобы;
 *  7) мобайл 375: docW === vw, без горскролла;
 *  8) CSS заказчика 2026-09-21 (slate/teal, раунд-2 ленты):
 *     карточка #ffffff/#4A688C(окантовка как у часов, директива 2026-09-24;
 *     было #e2e8f0)/r8/pad20 + border-left бирюза/серый,
 *     шапка 12px/#64748b, бейдж #ccfbf1/#0f766e (gray #e2e8f0),
 *     h4 18px, p 14px/1.6/#334155, футер-черта, WA #22c55e,
 *     btn-report #94a3b8 (hover #ef4444), решённая #f8fafc/0.8.
 * После проверок сид-данные удаляются из БД.
 * Скриншоты: scripts/shots/help-list-*.png
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

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

const stamp = Date.now();
const NICK_ME = `ВолонтёрПроба${stamp}`;
const NICK_OTHER = `НаходчивыйПроба${stamp}`;

const T_ACTIVE = "Требуется помощь в поиске потерявшейся собаки (Хаски)";
const T_ACTIVE_TEXT = "В районе улицы Ленина (Южно-Сахалинск) сорвался с поводка кобель хаски, глаза голубые, был в красном ошейнике. Если кто-то видел или смог придержать — пожалуйста, откликнитесь.";
const T_RESOLVED = "Помочь донести тяжелые коробки пожилой женщине";
const T_IRRELEVANT = "Пробный пост — неактуальная публикация пробы";

const users = [];
const browser = await chromium.launch();
try {
  const mkUser = async (nick) => {
    const salt = crypto.randomBytes(12).toString("hex");
    const u = await prisma.user.create({
      data: {
        email: `help-list-${nick}-${stamp}@test.local`,
        passwordHash: `${salt}:${crypto.scryptSync(crypto.randomBytes(8).toString("hex"), salt, 64).toString("hex")}`,
        nickname: nick,
        emailVerified: true,
      },
    });
    const token = crypto.randomBytes(24).toString("hex");
    await prisma.session.create({ data: { token, userId: u.id } });
    users.push(u);
    return { user: u, token };
  };

  const me = await mkUser(NICK_ME);
  const other = await mkUser(NICK_OTHER);

  const mkPub = (author, title, text, status) =>
    prisma.helpPublication.create({
      data: { title, text, contactData: "WhatsApp +7 (9XX) XXX-XX-XX", status, authorId: author.id, authorName: author.nickname },
    });
  const pubActive = await mkPub(other.user, T_ACTIVE, T_ACTIVE_TEXT, "active");
  await mkPub(other.user, T_RESOLVED, "Необходимо было перенести вещи при переезде на 4 этаж без лифта в Ново-Александровске.", "resolved");
  await mkPub(other.user, T_IRRELEVANT, "Пробный текст неактуальной публикации — проверка серого бейджа.", "irrelevant");
  await mkPub(me.user, "Своя пробная активная публикация", "Проверка служебных кнопок автора в новой карточке.", "active");

  const safeUser = { id: me.user.id, nickname: NICK_ME, email: me.user.email, gender: "unspecified", role: "user", emailVerified: true, orgRep: false, orgName: "" };
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(
    ([key, val]) => localStorage.setItem(key, val),
    ["sm_auth", JSON.stringify({ token: me.token, user: safeUser })]
  );
  await page.goto(BASE + "/help", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector(".help-publications-list .help-item-card", { timeout: 45000 });
  await page.waitForTimeout(1000);

  // 1) контейнер вместо «Загрузка…»
  ok("1. контейнер .help-publications-list на странице",
    (await page.locator(".help-publications-list").count()) === 1);
  ok("1a. текст «Загрузка…» после загрузки отсутствует",
    !(await page.locator(".hp-empty", { hasText: "Загрузка" }).count()));

  // 2) чужая активная карточка
  const card = page.locator(".help-item-card", { hasText: T_ACTIVE }).first();
  const cardCls = await card.getAttribute("class");
  ok("2. активная: .help-item-card.status-active", (cardCls || "").includes("status-active"), cardCls || "");
  const badge = card.locator(".help-status-badge");
  ok("2a. бейдж «Актуально» (не серый)",
    norm(await badge.textContent()) === "Актуально" && !(await badge.getAttribute("class")).includes("gray"),
    norm(await badge.textContent()));
  const badgeSt = await badge.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, c: s.color };
  });
  ok("2b. бейдж: бирюза ТЗ #ccfbf1/#0f766e",
    badgeSt.bg === rgb("#ccfbf1") && badgeSt.c === rgb("#0f766e"), JSON.stringify(badgeSt));
  const author = norm(await card.locator(".help-item-author").textContent());
  ok("2c. «👤 Ник: …» 1-в-1 формат", author === `👤 Ник: ${NICK_OTHER}`, author);
  const dateTxt = norm(await card.locator(".help-item-date").textContent());
  ok("2d. дата активной с временем «, ЧЧ:ММ»", /^\d{1,2} \S+ \d{4}, \d{2}:\d{2}$/.test(dateTxt), dateTxt);
  const h4 = norm(await card.locator(".help-item-body h4").textContent());
  ok("2e. заголовок 1-в-1", h4 === T_ACTIVE, h4.slice(0, 40) + "…");
  const pTxt = norm(await card.locator(".help-item-body p").textContent());
  ok("2f. текст 1-в-1", pTxt === T_ACTIVE_TEXT, pTxt.slice(0, 40) + "…");
  const contact = card.locator(".help-direct-contact");
  const contactTxt = norm(await contact.textContent());
  ok("2g. «Связь напрямую:» 1-в-1", contactTxt.includes("Связь напрямую:"), contactTxt);
  const wa = contact.locator("a.wa-action-link");
  const waAttr = await wa.evaluate((el) => ({ href: el.getAttribute("href"), target: el.getAttribute("target"), txt: el.textContent }));
  waAttr.txt = norm(waAttr.txt);
  const waSt = await wa.evaluate((el) => {
    const s = getComputedStyle(el);
    return { c: s.color, td: s.textDecorationLine, fw: s.fontWeight };
  });
  ok("2h. WA-ссылка: https://wa.me, _blank, «Написать в WhatsApp», #22c55e без подчёркивания (НЕ .sk a)",
    waAttr.href === "https://wa.me" && waAttr.target === "_blank" && waAttr.txt === "Написать в WhatsApp" &&
    waSt.c === rgb("#22c55e") && waSt.td === "none" && waSt.fw === "700",
    JSON.stringify({ ...waAttr, waSt }));
  const report = card.locator(".btn-report");
  ok("2i. «⚠️ Пожаловаться» (.btn-report)",
    norm(await report.textContent()) === "⚠️ Пожаловаться", norm(await report.textContent()));
  await card.screenshot({ path: `${SHOTS}/help-list-active.png` });

  // 2j…2q: CSS заказчика 2026-09-21 (slate/teal) — computed-styles
  const cardSt = await card.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, bd: s.borderTopColor, r: s.borderRadius, pad: s.padding,
      tr: s.transitionProperty, bl: `${s.borderLeftWidth} ${s.borderLeftStyle} ${s.borderLeftColor}` };
  });
  ok("2j. карточка: #ffffff/#4A688C (как у часов)/r8/pad20/border-left 4px solid #0f766e/transition border-color",
    cardSt.bg === rgb("#ffffff") && cardSt.bd === rgb("#4A688C") && cardSt.r === "8px" &&
    cardSt.pad === "20px" && cardSt.bl === "4px solid " + rgb("#0f766e") &&
    cardSt.tr === "border-color", JSON.stringify(cardSt));
  const headSt = await card.locator(".help-item-header").evaluate((el) => {
    const s = getComputedStyle(el);
    return { fs: s.fontSize, c: s.color, gap: `${s.columnGap}/${s.rowGap}`, mb: s.marginBottom, wrap: s.flexWrap };
  });
  ok("2k. шапка: 12px/#64748b/gap 16/mb 12/wrap",
    headSt.fs === "12px" && headSt.c === rgb("#64748b") && headSt.gap === "16px/16px" &&
    headSt.mb === "12px" && headSt.wrap === "wrap", JSON.stringify(headSt));
  const h4St = await card.locator(".help-item-body h4").evaluate((el) => {
    const s = getComputedStyle(el);
    return { fs: s.fontSize, c: s.color, w: s.fontWeight, mb: s.marginBottom };
  });
  ok("2l. h4: 18px/#1e293b/700/mb 8",
    h4St.fs === "18px" && h4St.c === rgb("#1e293b") && h4St.w === "700" && h4St.mb === "8px", JSON.stringify(h4St));
  const pSt = await card.locator(".help-item-body p").evaluate((el) => {
    const s = getComputedStyle(el);
    return { fs: s.fontSize, lh: s.lineHeight, c: s.color, ws: s.whiteSpace };
  });
  ok("2m. p: 14px/#334155/pre-wrap/leading 1.6",
    pSt.fs === "14px" && pSt.c === rgb("#334155") && pSt.ws === "pre-wrap" &&
    Math.abs(parseFloat(pSt.lh) / 14 - 1.6) < 0.06, JSON.stringify(pSt));
  const footSt = await card.locator(".help-item-footer").evaluate((el) => {
    const s = getComputedStyle(el);
    return { mt: s.marginTop, pt: s.paddingTop, bt: s.borderTopColor, jc: s.justifyContent };
  });
  ok("2n. футер: mt 16/pt 12/#f1f5f9/space-between",
    footSt.mt === "16px" && footSt.pt === "12px" && footSt.bt === rgb("#f1f5f9") &&
    footSt.jc === "space-between", JSON.stringify(footSt));
  const repSt = await report.evaluate((el) => {
    const s = getComputedStyle(el);
    return { c: s.color, td: s.textDecorationLine, fs: s.fontSize };
  });
  ok("2o. btn-report: #94a3b8, 12px, без подчёркивания",
    repSt.c === rgb("#94a3b8") && repSt.td === "none" && repSt.fs === "12px", JSON.stringify(repSt));
  const lstSt = await page.locator(".help-publications-list").evaluate((el) => {
    const s = getComputedStyle(el);
    return { gap: s.rowGap, mt: s.marginTop };
  });
  ok("2p. контейнер: gap 16/margin-top 20", lstSt.gap === "16px" && lstSt.mt === "20px", JSON.stringify(lstSt));
  await report.hover();
  await page.waitForTimeout(400); /* transition: color 0.2s — ждём завершения перехода */
  const repHover = await report.evaluate((el) => getComputedStyle(el).color);
  ok("2q. btn-report:hover → #ef4444", repHover === rgb("#ef4444"), repHover);

  // 3) решённая карточка
  const rcard = page.locator(".help-item-card", { hasText: T_RESOLVED }).first();
  ok("3. решённая: .status-resolved, серый бейдж «Вопрос решён»",
    ((await rcard.getAttribute("class")) || "").includes("status-resolved") &&
    norm(await rcard.locator(".help-status-badge").textContent()) === "Вопрос решён" &&
    (await rcard.locator(".help-status-badge").getAttribute("class")).includes("gray"));
  const rdate = norm(await rcard.locator(".help-item-date").textContent());
  ok("3a. дата решённой БЕЗ времени", /^\d{1,2} \S+ \d{4}$/.test(rdate), rdate);
  const rfoot = rcard.locator(".help-item-footer");
  ok("3b. футер «✓ Взаимопомощь оказана», без WA/жалобы",
    norm(await rfoot.locator(".resolved-text").textContent()) === "✓ Взаимопомощь оказана" &&
    (await rfoot.locator(".wa-action-link").count()) === 0 && (await rfoot.locator(".btn-report").count()) === 0,
    norm(await rfoot.textContent()));
  const rcardSt = await rcard.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, bl: `${s.borderLeftWidth} ${s.borderLeftStyle} ${s.borderLeftColor}`, op: s.opacity };
  });
  ok("3c. решённая: #f8fafc/border-left 4px solid #94a3b8/opacity 0.8",
    rcardSt.bg === rgb("#f8fafc") && rcardSt.bl === "4px solid " + rgb("#94a3b8") && rcardSt.op === "0.8", JSON.stringify(rcardSt));
  const graySt = await rcard.locator(".help-status-badge").evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, c: s.color };
  });
  ok("3d. серый бейдж: #e2e8f0/#475569", graySt.bg === rgb("#e2e8f0") && graySt.c === rgb("#475569"), JSON.stringify(graySt));
  const resSt = await rcard.locator(".resolved-text").evaluate((el) => getComputedStyle(el).color);
  ok("3e. «✓ Взаимопомощь оказана»: бирюза #0f766e", resSt === rgb("#0f766e"), resSt);
  await rcard.screenshot({ path: `${SHOTS}/help-list-resolved.png` });

  // 4) неактуальная
  const icard = page.locator(".help-item-card", { hasText: T_IRRELEVANT }).first();
  ok("4. неактуальная: серый бейдж «Неактуально», без resolved-text",
    norm(await icard.locator(".help-status-badge").textContent()) === "Неактуально" &&
    (await icard.locator(".help-status-badge").getAttribute("class")).includes("gray") &&
    (await icard.locator(".resolved-text").count()) === 0);

  // 5) своя активная: служебные кнопки
  const own = page.locator(".help-item-card", { hasText: "Своя пробная активная публикация" }).first();
  const ownActs = (await own.locator(".help-sys-actions .hp-act").allTextContents()).map(norm);
  ok("5. своя: Вопрос решён/Неактуально/Редактировать/Удалить, без btn-report",
    ownActs.join("|") === "Вопрос решён|Неактуально|Редактировать|Удалить" &&
    (await own.locator(".btn-report").count()) === 0,
    ownActs.join(" / "));
  await own.screenshot({ path: `${SHOTS}/help-list-own.png` });

  // 6) жалоба: модалка открывается и закрывается
  await report.click();
  await page.waitForSelector(".sk-modal", { timeout: 45000 });
  ok("6. клик «Пожаловаться» открывает модалку жалобы", true);
  await page.locator(".sk-modal-x").click();
  await page.waitForTimeout(300);
  ok("6a. модалка жалобы закрылась", (await page.locator(".sk-modal").count()) === 0);

  // 7) мобайл 375
  const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mob.addInitScript(
    ([key, val]) => localStorage.setItem(key, val),
    ["sm_auth", JSON.stringify({ token: me.token, user: safeUser })]
  );
  await mob.goto(BASE + "/help", { waitUntil: "domcontentloaded", timeout: 45000 });
  await mob.waitForSelector(".help-publications-list .help-item-card", { timeout: 45000 });
  await mob.waitForTimeout(800);
  const mobDocW = await mob.evaluate(() => document.documentElement.clientWidth);
  ok("7. мобайл 375: docW === 375", mobDocW === 375, `docW=${mobDocW}`);
  const mobScroll = await mob.evaluate(() => ({ sw: document.documentElement.scrollWidth, dw: document.documentElement.clientWidth }));
  ok("7a. мобайл 375: без горизонтального переполнения", mobScroll.sw <= mobScroll.dw, JSON.stringify(mobScroll));
  await mob.locator(".help-publications-list").screenshot({ path: `${SHOTS}/help-list-mobile.png` });

  console.log("PROBE DONE");
} finally {
  await browser.close();
  try {
    for (const u of users) {
      await prisma.helpPublication.deleteMany({ where: { authorId: u.id } });
      await prisma.session.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
    console.log(`CLEANUP OK (${users.length} users)`);
  } catch (e) {
    console.log("CLEANUP FAIL:", e instanceof Error ? e.message : String(e));
  }
  await prisma.$disconnect();
}
