/**
 * Проба ТЗ 2026-09-22: СКВОЗНАЯ ЛОГИКА ИИ-фильтра формы быстрых подсказок
 * «Где дешевле» (блок цен) на ГЛАВНОЙ странице SakhMatrix.ru (раунд
 * prefilled_text, зеркальная к «Где купить»).
 *
 * Проверки:
 *  A) панель на Главной: заголовок «Быстрые подсказки «Где дешевле»»,
 *     лента цен, гостевое примечание о входе (без textarea);
 *  B) после входа — форма (textarea + «Подсказать»);
 *  C) КРИТЕРИИ ПРОПУСКА (примеры заказчика 1-в-1):
 *     «На базе Успех (Железнодорожная 170) комплект стоит 18 500 руб.»,
 *     «Горбуша по 150 руб/кг на ярмарке у Дома Торговли» → публикуются;
 *  D) КЛИЕНТСКИЙ ФИЛЬТР (телефон «+79141234567»): проверка ДО отправки —
 *     аккуратная СЕРАЯ плашка с ДОСЛОВНЫМ текстом нового ТЗ, кнопка
 *     «💬 Перейти в тему на форуме и опубликовать там», href =
 *     /forum/topic/178?prefilled_text=<encoded> (формат ТЗ); ПОЛЕ НЕ
 *     СТИРАЕТСЯ; запрос к API не уходит (блок чисто клиентский);
 *  E) СКВОЗНОЙ UX: клик кнопки → адаптер /forum/topic/178 → /?topic=178&
 *     prefilled_text=… → тема форума «Товары и услуги ▸ Цены» → форма
 *     ответа предзаполнена (prefilled_text вычищен); возврат — текст жив;
 *  F) КЛИЕНТСКИЙ ФИЛЬТР (слова «с ума сошли», «барыги», «обдираловка» +
 *     НОВЫЙ маркер ТЗ «вор»): та же серая плашка, поле не стирается;
 *  G) API-задел прочности: маркеры → 422 labels (в т.ч. новые ТЗ-слова);
 *     контролы «крутятся»/«ограбления»/«накрутят» → 200;
 *     телефоны «8-914…», «+7 914…» → 422 phones; гость → 401;
 *     301 символ → 400; GET отдаёт forumTopicId=178; лента с примерами;
 *  H) мобайл 375: панель и серая плашка внутри вьюпорта, без горскролла.
 * Сид: 1 пользователь + сессия (БД). Тестовые подсказки и пользователь
 * после проверок удаляются; тема-приёмник остаётся (часть сайта).
 * Скриншоты: scripts/shots/cheap-hints-*.png
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

/* --- ДОСЛОВНЫЕ тексты заказчика --- */
/* Серая плашка клиентского фильтра (ТЗ «сквозная логика», единый текст). */
const FILTER_PLAQUE =
  "Сообщение отклонено фильтром главной страницы. На главной странице запрещено публиковать личные мобильные телефоны и субъективные споры. Вы можете опубликовать этот текст на форуме.";
/* Строгие плашки серверного задела прочности (Кейс А/Б прежнего ТЗ). */
const PLAQUE_PHONES =
  "На главной странице SakhMatrix запрещено публиковать личные мобильные телефоны для сохранения безопасности жителей. Вы можете безопасно поделиться этим контактом в ветке обсуждения на форуме.";
const PLAQUE_LABELS =
  "Ваше сообщение содержит эмоциональные оценки или общие ярлыки. На главной странице фиксируются только сухие цены и адреса. Вы можете развернуто описать свой опыт и обсудить ценообразование в целевой ветке на форуме.";
const BTN_LABEL = "💬 Перейти в тему на форуме и опубликовать там";

const stamp = Date.now();
const NICK = `ЦенщикПроба${stamp}`;
const PHONE_TEXT = "Перекуп Серёга: +79141234567";

let user = null;
const browser = await chromium.launch();
try {
  user = await prisma.user.create({
    data: {
      email: `cheap-hint-probe-${stamp}@test.local`,
      passwordHash: `${crypto.randomBytes(12).toString("hex")}:${crypto.scryptSync(crypto.randomBytes(8).toString("hex"), crypto.randomBytes(12).toString("hex"), 64).toString("hex")}`,
      nickname: NICK,
      emailVerified: true,
    },
  });
  const token = crypto.randomBytes(24).toString("hex");
  await prisma.session.create({ data: { token, userId: user.id } });
  const safeUser = { id: user.id, nickname: user.nickname, email: user.email, gender: "unspecified", role: "user", emailVerified: true, orgRep: false, orgName: "" };

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  /* ============ A. Гость на Главной ============ */
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  const panel = page.locator('[data-cheap-hints="1"]');
  await panel.waitFor({ state: "visible", timeout: 30000 });
  ok("A1 панель «Быстрые подсказки «Где дешевле»» есть на Главной", await panel.isVisible());
  ok(
    "A2 заголовок панели точный",
    norm(await panel.locator(".mp-paneltitle").innerText()) === norm("▼Быстрые подсказки «Где дешевле»"),
  );
  ok("A3 лента цен присутствует", (await page.locator('[data-cheap-hints-feed="1"]').count()) === 1);
  ok("A4 гость: примечание о входе видно", await page.locator('[data-cheap-hint-guest="1"]').isVisible());
  ok("A5 гость: поля ввода нет", (await page.locator('[data-cheap-hint-input="1"]').count()) === 0);

  /* ============ B. Вход (сессия через localStorage) ============ */
  await page.addInitScript(([key, val]) => localStorage.setItem(key, val), ["sm_auth", JSON.stringify({ token, user: safeUser })]);
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await panel.waitFor({ state: "visible", timeout: 30000 });
  await page.locator('[data-cheap-hint-input="1"]').waitFor({ state: "visible", timeout: 30000 });
  ok("B1 после входа видна форма ценовой подсказки", await page.locator('[data-cheap-hint-form="1"]').isVisible());

  const fillAndSubmit = async (text) => {
    await page.locator('[data-cheap-hint-input="1"]').fill(text);
    await page.locator('[data-cheap-hint-submit="1"]').click();
  };

  /* ============ C. Критерии пропуска ============ */
  await fillAndSubmit("На базе Успех (Железнодорожная 170) комплект стоит 18 500 руб.");
  await page.locator('[data-cheap-hint-note="1"]').waitFor({ state: "visible", timeout: 30000 });
  const row1 = page.locator('[data-cheap-hints-feed="1"] .mp-trow').first();
  ok("C1 пример заказчика №1 пропущен и в ленте", norm(await row1.innerText()).includes("комплект стоит 18 500 руб"));
  ok("C2 после успеха поле очищено", (await page.locator('[data-cheap-hint-input="1"]').inputValue()) === "");

  await fillAndSubmit("Горбуша по 150 руб/кг на ярмарке у Дома Торговли");
  await page.locator('[data-cheap-hint-note="1"]').waitFor({ state: "visible", timeout: 30000 });
  const row2 = page.locator('[data-cheap-hints-feed="1"] .mp-trow').first();
  ok("C3 пример заказчика №2 пропущен и в ленте", norm(await row2.innerText()).includes("Горбуша по 150 руб/кг"));
  await page.screenshot({ path: `${SHOTS}/cheap-hints-panel.png`, fullPage: false });

  /* ============ D. Клиентский фильтр: телефон ============ */
  await fillAndSubmit(PHONE_TEXT);
  const plaqueA = page.locator('[data-cheap-filter-plaque="phones"]');
  await plaqueA.waitFor({ state: "visible", timeout: 30000 });
  ok("D1 фильтр (телефон): серая плашка показана", await plaqueA.isVisible());
  ok("D2 фильтр (телефон): текст плашки ДОСЛОВНО ТЗ", norm(await plaqueA.locator('[data-cheap-filter-plaque-text="phones"]').innerText()) === norm(FILTER_PLAQUE));
  ok("D3 фильтр (телефон): плашка СЕРАЯ (фон #f4f4f5, рамка #d4d4d8)",
    await plaqueA.evaluate((el) => getComputedStyle(el).backgroundColor === "rgb(244, 244, 245)" && getComputedStyle(el).borderColor === "rgb(212, 212, 216)"));
  const btnA = plaqueA.locator('[data-cheap-filter-forum-btn="1"]');
  ok("D4 кнопка переноса с точной надписью", norm(await btnA.innerText()) === norm(BTN_LABEL));
  ok("D5 UX: текущий текст пользователя НЕ стёрт", (await page.locator('[data-cheap-hint-input="1"]').inputValue()) === PHONE_TEXT);
  const hrefA = await btnA.getAttribute("href");
  ok("D6 href — ДОСЛОВНЫЙ формат ТЗ /forum/topic/ИД?prefilled_text=…", !!hrefA && /^\/forum\/topic\/\d+\?prefilled_text=/.test(hrefA), hrefA?.slice(0, 60) + "…");
  ok(
    "D7 текст подсказки закодирован в prefilled_text 1-в-1",
    !!hrefA && decodeURIComponent((hrefA.match(/prefilled_text=([^&]+)/) || [])[1] || "") === PHONE_TEXT,
  );
  ok("D8 ИД темы — приёмник 178 (Товары и услуги ▸ Цены)", !!hrefA && hrefA.startsWith("/forum/topic/178?"), hrefA?.split("?")[0] || "");
  ok("D9 блок чисто клиентский: POST к API не ушёл (лента без нового текста)", !(await (await fetch(BASE + "/api/gdedeshevle-hints")).json()).hints.some((h) => h.text === PHONE_TEXT));
  await page.screenshot({ path: `${SHOTS}/cheap-hints-plaque-phones.png`, fullPage: false });

  /* ============ E. Сквозной UX (перенос на форум) ============ */
  await btnA.click();
  await page.waitForURL(/\?topic=\d+/, { timeout: 45000 });
  await page.locator("#reply-form textarea").waitFor({ state: "visible", timeout: 45000 });
  ok("E1 адаптер привёл в тему-приёмник (?topic=178, рубрика «Цены»)", /\?topic=178(&|$)/.test(page.url()), page.url().slice(0, 70));
  ok(
    "E2 текст перенесён в форму ответа темы 1-в-1 (prefilled_text)",
    (await page.locator("#reply-form textarea").inputValue()) === PHONE_TEXT,
  );
  ok("E3 GET-параметр prefilled_text вычищен из адресной строки", !page.url().includes("prefilled_text"));
  await page.locator("#reply-form").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/cheap-hints-forum-prefill.png`, fullPage: false });

  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.locator('[data-cheap-hint-input="1"]').waitFor({ state: "visible", timeout: 30000 });
  ok(
    "E4 возврат на Главную: набранный текст не стёрт (черновик)",
    (await page.locator('[data-cheap-hint-input="1"]').inputValue()) === PHONE_TEXT,
  );
  await page.locator('[data-cheap-hint-input="1"]').fill("");

  /* ============ F. Клиентский фильтр: плохие слова ============ */
  await fillAndSubmit("Цены с ума сошли, барыги обдираловку устроили");
  const plaqueB = page.locator('[data-cheap-filter-plaque="labels"]');
  await plaqueB.waitFor({ state: "visible", timeout: 30000 });
  ok("F1 фильтр (слова): серая плашка показана", await plaqueB.isVisible());
  ok("F2 фильтр (слова): текст плашки ДОСЛОВНО ТЗ", norm(await plaqueB.locator('[data-cheap-filter-plaque-text="labels"]').innerText()) === norm(FILTER_PLAQUE));
  ok("F3 кнопка переноса на месте", norm(await plaqueB.locator('[data-cheap-filter-forum-btn="1"]').innerText()) === norm(BTN_LABEL));
  ok("F4 UX: текущий текст пользователя НЕ стёрт", (await page.locator('[data-cheap-hint-input="1"]').inputValue()) === "Цены с ума сошли, барыги обдираловку устроили");
  await page.screenshot({ path: `${SHOTS}/cheap-hints-plaque-labels.png`, fullPage: false });
  // НОВЫЙ маркер этого ТЗ: «вор» (в прежнем ценовом списке его не было).
  await fillAndSubmit("Вор торгуется за рыбу на рынке у порта");
  await page.locator('[data-cheap-filter-plaque="labels"]').waitFor({ state: "visible", timeout: 30000 });
  ok("F5 новый маркер ТЗ «вор» заблокирован", (await page.locator('[data-cheap-hint-input="1"]').inputValue()) === "Вор торгуется за рыбу на рынке у порта");
  ok("F6 «вор»: поле не стёрто, плашка серая на месте", await page.locator('[data-cheap-filter-plaque="labels"]').isVisible());
  await page.locator('[data-cheap-hint-input="1"]').fill("");

  /* ============ G. API: маркеры/телефоны/границы ============ */
  const api = async (body) =>
    fetch(BASE + "/api/gdedeshevle-hints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const markers = ["барыги", "оборзели", "крутят", "с ума сошли", "обдираловка", "грабеж"];
  for (const m of markers) {
    const r = await api({ token, text: `Про цены на рынке: ${m} у торговцев` });
    const d = await r.json();
    ok(`G1 маркер «${m}» → 422 labels`, r.status === 422 && d.blocked === "labels");
    ok(`G2 маркер «${m}»: плашка дословная`, norm(d.message || "") === norm(PLAQUE_LABELS));
    ok(`G3 маркер «${m}»: кнопка переноса в ответе`, (d.forumButton || "") === BTN_LABEL && /^\/\?topic=\d+&cheapHint=/.test(d.forumUrl || ""));
  }
  for (const t of ["Гайки крутятся по норме, набор в «Строймаше»", "Ограбления нет: рис 80 руб/кг на Сахалинской", "Накрутят ли цену — увидим на базе"]) {
    const r = await api({ token, text: t });
    ok(`G4 контроль прохождения «${t.slice(0, 28)}…»`, r.status === 200);
  }
  const phoneVariants = [
    ["8-914 123 45 67", "триггер заказчика 8-914…"],
    ["+7 914 123-45-67", "+7 с разделителями"],
  ];
  for (const [v, why] of phoneVariants) {
    const r = await api({ token, text: `Звонить по номеру ${v}, база на Железнодорожной` });
    const d = await r.json();
    ok(`G5 телефон ${why} → 422 phones`, r.status === 422 && d.blocked === "phones");
    ok(`G6 телефон ${why}: плашка дословная`, norm(d.message || "") === norm(PLAQUE_PHONES));
  }
  const rGuest = await api({ token: "", text: "Горбуша по 150 руб/кг на ярмарке" });
  ok("G7 гость → 401", rGuest.status === 401);
  const rLong = await api({ token, text: "А".repeat(301) });
  ok("G8 301 символ → 400", rLong.status === 400);
  const feed = await (await fetch(BASE + "/api/gdedeshevle-hints")).json();
  ok(
    "G9 лента API содержит пропущенные примеры заказчика",
    (feed.hints || []).some((h) => h.text.includes("комплект стоит 18 500 руб")) &&
      (feed.hints || []).some((h) => h.text === "Горбуша по 150 руб/кг на ярмарке у Дома Торговли"),
  );
  ok("G10 GET отдаёт forumTopicId=178 для формата ТЗ /forum/topic/…", feed.forumTopicId === 178, `forumTopicId=${feed.forumTopicId}`);

  /* ============ H. Мобайл 375 ============ */
  const mp = await browser.newPage({ viewport: { width: 375, height: 720 } });
  await mp.addInitScript(([key, val]) => localStorage.setItem(key, val), ["sm_auth", JSON.stringify({ token, user: safeUser })]);
  await mp.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await mp.locator('[data-cheap-hints="1"]').waitFor({ state: "visible", timeout: 30000 });
  await mp.locator('[data-cheap-hint-input="1"]').fill(PHONE_TEXT);
  await mp.locator('[data-cheap-hint-submit="1"]').click();
  const mplaque = mp.locator('[data-cheap-filter-plaque="phones"]');
  await mplaque.waitFor({ state: "visible", timeout: 30000 });
  const box = await mplaque.boundingBox();
  ok("H1 мобайл 375: серая плашка видна и внутри вьюпорта", !!box && box.x >= 0 && box.x + box.width <= 376);
  ok(
    "H2 мобайл 375: без горскролла",
    await mp.evaluate(() => document.documentElement.scrollWidth <= 375),
  );
  ok("H3 мобайл 375: текст в поле не стёрт", (await mp.locator('[data-cheap-hint-input="1"]').inputValue()) === PHONE_TEXT);
  await mp.screenshot({ path: `${SHOTS}/cheap-hints-mobile.png`, fullPage: false });
  await mp.close();

  /* ============ Отчёт ============ */
  console.log(`\nИТОГ: ${passCount} OK / ${failCount} FAIL`);
} catch (e) {
  console.error("PROBE ERROR:", e);
  failCount++;
} finally {
  /* ============ Cleanup ============ */
  try {
    if (user) {
      await prisma.cheapHint.deleteMany({ where: { authorId: user.id } });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
      console.log("Cleanup OK (1 пользователь, подсказки удалены; тема-приёмник сохранена)");
    }
  } catch (ce) {
    console.error("CLEANUP ERROR:", ce);
  }
  await prisma.$disconnect();
  await browser.close();
  process.exit(failCount > 0 ? 1 : 0);
}
