/**
 * Проба ТЗ 2026-09-22 «6 сахалинских примеров» (раунд examples-e2e):
 * СКВОЗНАЯ симуляция на сайте всех шести ДОСЛОВНЫХ примеров заказчика —
 * ИИ-фильтр форм «Где купить»/«Где дешевле» на Главной + перенос текста
 * на форум через ссылки формата /forum/topic/ИД_ТОПИКА?prefilled_text=…
 *
 * По КАЖДОМУ примеру (ввод 1-в-1 из ТЗ):
 *  1. Ввод пользователя (Ошибка) вводится в форму соответствующего блока;
 *  2. Клик «Подсказать» → отправка БЛОКИРОВАНА на клиенте (POST к API НЕ
 *     уходит), поле ввода НЕ стёрто (текст 1-в-1);
 *  3. Серая плашка внутри карточки под полем: ДОСЛОВНЫЙ текст ТЗ;
 *  4. Кнопка «💬 Перейти в тему на форуме и опубликовать там», href —
 *     СТРОГО «Ссылка для переноса» соответствующего примера (слаговый
 *     ИД темы + encodeURIComponent(text) — побайтно равны ссылкам ТЗ);
 *  5. Клик кнопки → роут-адаптер переводит слаг в тему-приёмник
 *     (topic-grm-123/topic-shkola-789/topic-sima-555 → #177 «Товары и
 *     услуги ▸ Где купить»; topic-tyres-456/topic-salmon-888/
 *     topic-timber-999 → #178 «Товары и услуги ▸ Цены»);
 *  6. Форма быстрого ответа темы предзаполнена текстом 1-в-1
 *     (prefilled_text вычищен из адресной строки).
 *
 * Дополнительно: нормализация сверки (регистр/ё/пробелы) не ломает
 * привязку к примеру; текст НЕ из примеров → числовой ИД темы-приёмника;
 * мобайл 375 (плашка в вьюпорте, без горскролла).
 * Сид: 1 пользователь + сессия (БД). Пользователь после проверок
 * удаляется (подсказки не создаются — всё блокируется клиентом).
 * Скриншоты: scripts/shots/examples-e2e-*.png
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

/* --- ДОСЛОВНЫЕ константы ТЗ --- */
const FILTER_PLAQUE =
  "Сообщение отклонено фильтром главной страницы. На главной странице запрещено публиковать личные мобильные телефоны и субъективные споры. Вы можете опубликовать этот текст на форуме.";
const BTN_LABEL = "💬 Перейти в тему на форуме и опубликовать там";

/* 6 примеров заказчика: [блок, слаг, ввод 1-в-1]. */
const EXAMPLES = [
  { panel: "wtb",   slug: "topic-grm-123",    text: "Есть мастер Вова на Железнодорожной, звони ему: 8-924-111-22-33" },
  { panel: "wtb",   slug: "topic-shkola-789", text: "В ТЦ Рояль на 3 этаже сидят хамы и мошенники, торгуют синтетикой!" },
  { panel: "wtb",   slug: "topic-sima-555",   text: "Закажи у чувака на Авито, вот его сотовый 8-914-000-44-55" },
  { panel: "cheap", slug: "topic-tyres-456",  text: "На Пуркаева в ТЦ не ходи, там барыги совсем с ума сошли, крутят цены!" },
  { panel: "cheap", slug: "topic-salmon-888", text: "Все перекупщики уроды, задрали ценник на рыбу в два раза!" },
  { panel: "cheap", slug: "topic-timber-999", text: "На базах на Холмском шоссе устроили обдираловку, воры кругом!" },
];
const PANEL = {
  wtb:   { root: '[data-wtb-hints="1"]',   input: '[data-wtb-hint-input="1"]',   submit: '[data-wtb-hint-submit="1"]',   plaque: '[data-wtb-filter-plaque]',   plaqueText: '[data-wtb-filter-plaque-text]',   btn: '[data-wtb-filter-forum-btn="1"]',   api: "/api/wheretobuy-hints",   title: "▼Быстрые подсказки «Где купить»" },
  cheap: { root: '[data-cheap-hints="1"]', input: '[data-cheap-hint-input="1"]', submit: '[data-cheap-hint-submit="1"]', plaque: '[data-cheap-filter-plaque]', plaqueText: '[data-cheap-filter-plaque-text]', btn: '[data-cheap-filter-forum-btn="1"]', api: "/api/gdedeshevle-hints", title: "▼Быстрые подсказки «Где дешевле»" },
};
const expectedHref = (ex) => `/forum/topic/${ex.slug}?prefilled_text=${encodeURIComponent(ex.text)}`;

const stamp = Date.now();
let user = null;
const browser = await chromium.launch();

try {
  user = await prisma.user.create({
    data: {
      email: `examples-e2e-${stamp}@test.local`,
      passwordHash: `${crypto.randomBytes(12).toString("hex")}:${crypto.scryptSync(crypto.randomBytes(8).toString("hex"), crypto.randomBytes(12).toString("hex"), 64).toString("hex")}`,
      nickname: `ПробаПримеров${stamp}`,
      emailVerified: true,
    },
  });
  const token = crypto.randomBytes(24).toString("hex");
  await prisma.session.create({ data: { token, userId: user.id } });
  const safeUser = { id: user.id, nickname: user.nickname, email: user.email, gender: "unspecified", role: "user", emailVerified: true, orgRep: false, orgName: "" };

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  /* Трек POST-запросов к API подсказок (блок должен быть ЧИСТО клиентским). */
  let apiPosts = 0;
  page.on("request", (req) => {
    if (req.method() === "POST" && (req.url().includes("/api/wheretobuy-hints") || req.url().includes("/api/gdedeshevle-hints"))) apiPosts++;
  });
  await page.addInitScript(([key, val]) => localStorage.setItem(key, val), ["sm_auth", JSON.stringify({ token, user: safeUser })]);

  /* ============ По одному примеру ============ */
  for (let i = 0; i < EXAMPLES.length; i++) {
    const ex = EXAMPLES[i];
    const num = i + 1;
    const P = PANEL[ex.panel];

    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
    const panel = page.locator(P.root);
    await panel.waitFor({ state: "visible", timeout: 30000 });

    apiPosts = 0;
    await page.locator(P.input).fill(ex.text);
    await page.locator(P.submit).click();
    await page.locator(P.plaque).waitFor({ state: "visible", timeout: 15000 });

    ok(`П${num}.1 блок чисто клиентский (POST к API не ушёл)`, apiPosts === 0, `posts=${apiPosts}`);
    ok(`П${num}.2 поле ввода НЕ стёрто (текст 1-в-1)`, (await page.locator(P.input).inputValue()) === ex.text);
    ok(`П${num}.3 серая плашка видна в карточке`, await page.locator(P.plaque).isVisible());
    ok(`П${num}.4 текст плашки дословный`, norm(await page.locator(P.plaqueText).innerText()) === norm(FILTER_PLAQUE));
    ok(`П${num}.5 надпись кнопки дословная`, norm(await page.locator(P.btn).innerText()) === norm(BTN_LABEL));
    const href = await page.locator(P.btn).getAttribute("href");
    ok(`П${num}.6 ссылка кнопки СТРОГО из примера`, href === expectedHref(ex), href);
    ok(`П${num}.7 слаг ИД темы в ссылке`, href.startsWith(`/forum/topic/${ex.slug}?prefilled_text=`));

    if (num === 1 || num === 4) {
      await page.locator(P.btn).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/examples-e2e-${ex.panel}-${num}.png`, fullPage: false });
    }

    /* Сквозной переход: слаг → тема-приёмник → предзаполнение формы ответа. */
    const topicId = ex.slug.endsWith("123") || ex.slug.endsWith("789") || ex.slug.endsWith("555") ? 177 : 178;
    await Promise.all([
      page.waitForURL(`**/?topic=${topicId}**`, { timeout: 30000 }),
      page.locator(P.btn).click(),
    ]);
    await page.locator("#reply-form textarea").waitFor({ state: "visible", timeout: 45000 });
    ok(`П${num}.8 адаптер привёл в тему-приёмник #${topicId}`, page.url().includes(`topic=${topicId}`), page.url());
    ok(`П${num}.9 форма ответа предзаполнена 1-в-1`, (await page.locator("#reply-form textarea").inputValue()) === ex.text);
    ok(`П${num}.10 prefilled_text вычищен из адресной строки`, !page.url().includes("prefilled_text"), page.url());
  }

  /* ============ Нормализация сверки: регистр/пробелы ============ */
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator(PANEL.wtb.input).waitFor({ state: "visible", timeout: 30000 });
  await page.locator(PANEL.wtb.input).fill("  есть   мастер Вова на Железнодорожной, звони ему: 8-924-111-22-33  ");
  await page.locator(PANEL.wtb.submit).click();
  await page.locator(PANEL.wtb.plaque).waitFor({ state: "visible", timeout: 15000 });
  const normHref = await page.locator(PANEL.wtb.btn).getAttribute("href");
  ok("Н1 сверка нечувствительна к регистру/пробелам (ссылка из примера)", normHref.startsWith("/forum/topic/topic-grm-123?prefilled_text="), normHref);

  /* ============ Текст НЕ из примеров → тема-приёмник числом ============ */
  await page.locator(PANEL.wtb.input).fill("Проverkа фильтра: мошенники у конторки, телефон +79141234567");
  await page.locator(PANEL.wtb.submit).click();
  await page.locator(PANEL.wtb.plaque).waitFor({ state: "visible", timeout: 15000 });
  const genericHref = await page.locator(PANEL.wtb.btn).getAttribute("href");
  ok("Н2 произвольный текст → числовой ИД темы-приёмника (формат ТЗ)", /^\/forum\/topic\/\d+\?prefilled_text=/.test(genericHref), genericHref);

  /* ============ Мобайл 375 ============ */
  const mp = await browser.newPage({ viewport: { width: 375, height: 800 } });
  await mp.addInitScript(([key, val]) => localStorage.setItem(key, val), ["sm_auth", JSON.stringify({ token, user: safeUser })]);
  await mp.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await mp.locator(PANEL.cheap.input).waitFor({ state: "visible", timeout: 30000 });
  await mp.locator(PANEL.cheap.input).fill(EXAMPLES[3].text);
  await mp.locator(PANEL.cheap.submit).click();
  await mp.locator(PANEL.cheap.plaque).waitFor({ state: "visible", timeout: 15000 });
  const plaqueBox = await mp.locator(PANEL.cheap.plaque).boundingBox();
  ok("М1 мобайл 375: серая плашка в вьюпорте", plaqueBox !== null && plaqueBox.y < 800);
  ok("М2 мобайл 375: ссылка кнопки из примера №4", (await mp.locator(PANEL.cheap.btn).getAttribute("href")) === expectedHref(EXAMPLES[3]));
  ok("М3 мобайл 375: без горскролла", await mp.evaluate(() => document.documentElement.scrollWidth <= 375));
  await mp.locator(PANEL.cheap.btn).scrollIntoViewIfNeeded();
  await mp.screenshot({ path: `${SHOTS}/examples-e2e-mobile.png`, fullPage: false });
  await mp.close();

  /* ============ Скриншот темы-приёмника с предзаполнением ============ */
  await page.goto(BASE + "/?topic=177&prefilled_text=" + encodeURIComponent("В ТЦ Рояль на 3 этаже сидят хамы и мошенники, торгуют синтетикой!"), { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator("#reply-form textarea").waitFor({ state: "visible", timeout: 45000 });
  await page.locator("#reply-form").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/examples-e2e-forum-prefill.png`, fullPage: false });
} finally {
  /* Cleanup: подсказки не создавались (всё блокировано клиентом) — убираем пользователя. */
  if (user) {
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
  await prisma.$disconnect();
  await browser.close();
}

console.log(`\nИТОГ: ${passCount} OK / ${failCount} FAIL`);
process.exit(failCount > 0 ? 1 : 0);
