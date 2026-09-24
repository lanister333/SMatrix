/**
 * Проба ТЗ 2026-09-22 (раунд «FLAT 2.0 — строгий минимализм»): блоки
 * «Где купить»/«Где дешевле» на ГЛАВНОЙ странице (sakh-matrix-hints-flat.tsx),
 * заменившие панели «Быстрые подсказки…» по указу заказчика «УБЕРИ ВСЕ СИНИЕ
 * ПЛАШКИ И ТЯЖЕЛЫЕ РАМКИ… МНОГО БЕЛОГО ЦВЕТА И ВОЗДУХА».
 *
 * Проверки:
 *  A) Структура и Flat 2.0-дизайн: два блока; заголовки «Где купить»/
 *     «Где дешевле» простым чёрным текстом (фон ПРОЗРАЧНЫЙ — без синих
 *     полос, цвет = эталон text-zinc-900, жирный); 4 карточки с ДОСЛОВНЫМИ
 *     данными массива sakhMatrixData; textarea — рамка 1px border-zinc-200,
 *     БЕЗ теней; прежние панели (data-wtb-hints / data-cheap-hints) сняты
 *     с Главной.
 *  B) Прохождение сухого факта: плашки нет, поле очищено, подтверждение.
 *  C) Телефон («8924…»): серая плашка с ДОСЛОВНЫМ текстом ТЗ (маркер
 *     «Ошибка:» = text-red-600, фон bg-zinc-50, рамка border-zinc-200,
 *     текст zinc-700), поле НЕ стёрто, кнопка [💬 Опубликовать этот текст
 *     на форуме], href = /forum/topic/topic-sima?prefilled_text=<encoded>
 *     (формат ТЗ 1-в-1); hover кнопки — bg-zinc-950/text-white.
 *  D) Ярлыки («мошенники», «обдираловка»): плашка, поле живо, href
 *     topic-tyres.
 *  E) Ссылка «живая»: правка текста после блокировки обновляет href 1-в-1.
 *  F) Бесшовный перенос (пункт 4 ТЗ): клик → роут-адаптер 302 → тема-
 *     приёмник рубрики «Товары и услуги ▸ Где купить», форма ответа =
 *     текст 1-в-1, prefilled_text вычищен из URL.
 *  G) Адаптер и прежние контракты: topic-grm/topic-salmon маппятся в свои
 *     темы-приёмники; legacy wtbhint/cheapHint по-прежнему предзаполняют
 *     форму; неизвестный слаг → /?view=forum.
 *  H) Мобайл 375: плашка в вьюпорте, без горскролла, текст в поле жив.
 *
 * Гость: форма ТЗ вход не требует; запись в БД не производится (сид не
 * нужен, cleanup — закрытие браузера). Скриншоты: scripts/shots/flat-*.png
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

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

/* --- .env-lite: DATABASE_URL для Prisma (только ЧТЕНИЕ тем-приёмников) --- */
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

/* --- ДОСЛОВНЫЙ текст плашки ТЗ (пункт 3) --- */
const PLAQUE_ERROR =
  "Ошибка: На главной странице запрещены личные телефоны и оскорбления. Вы можете опубликовать этот текст на форуме.";
const BTN_LABEL = "💬 Опубликовать этот текст на форуме";

/* --- Данные массива ТЗ (пункт 2) — для проверки 1-в-1 --- */
const CARDS = {
  1: { author: "Island_Driver65", text: "Где в Южном купить ремкомплект ГРМ на двигатель 1JZ-GE?", topic: "topic-grm" },
  2: { author: "Aniva_Fisher", text: "Ищу японские блесны на симу (розовые, 18г). Где есть?", topic: "topic-sima" },
  3: { author: "Sakhalin_Gid", text: "Где в Южно-Сахалинске самая дешевая зимняя резина Triangle R16?", topic: "topic-tyres" },
  4: { author: "Korsakov_News", text: "Где найти свежую горбушу по минимальной цене напрямую от рыбаков?", topic: "topic-salmon" },
};

const PHONE_TEXT = "Продавец: 89241234567, звоните";
const INSULT_TEXT = "Одни мошенники, обдираловка ещё та";

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  /* Tailwind v4 отдаёт палитру в OKLCH — сравнение с эталонным элементом,
     которому задан тот же класс-утилита (приём probe-review-card.mjs). */
  const twProp = (cls, prop) =>
    page.evaluate(({ c, p }) => {
      const el = document.createElement("div");
      el.className = c;
      el.style.cssText = "position:fixed;left:-9999px;visibility:hidden";
      document.body.appendChild(el);
      const v = getComputedStyle(el)[p];
      el.remove();
      return v;
    }, { c: cls, p: prop });

  /* ============ A. Структура и Flat 2.0-дизайн ============ */
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  const flat = page.locator('[data-smflat="1"]');
  await flat.waitFor({ state: "visible", timeout: 30000 });

  ok("A1 блок «Где купить» есть", await page.locator('[data-smflat-block="buy"]').isVisible());
  ok("A2 блок «Где дешевле» есть", await page.locator('[data-smflat-block="cheap"]').isVisible());
  ok("A3 заголовок «Где купить» точный", norm(await page.locator('[data-smflat-title="buy"]').innerText()) === "Где купить");
  ok("A4 заголовок «Где дешевле» точный", norm(await page.locator('[data-smflat-title="cheap"]').innerText()) === "Где дешевле");

  const buyTitle = page.locator('[data-smflat-title="buy"]');
  const titleBg = await buyTitle.evaluate((el) => getComputedStyle(el).backgroundColor);
  ok("A5 заголовок БЕЗ синей фоновой полосы (фон прозрачный)", titleBg === "rgba(0, 0, 0, 0)", titleBg);
  ok("A6 заголовок — простой чёрный текст (text-zinc-900)", (await buyTitle.evaluate((el) => getComputedStyle(el).color)) === (await twProp("text-zinc-900", "color")));
  ok("A7 заголовок жирный", (await buyTitle.evaluate((el) => getComputedStyle(el).fontWeight)) === "700");

  for (const [id, c] of Object.entries(CARDS)) {
    const card = page.locator(`[data-smflat-card="${id}"]`);
    ok(`A8 карточка ${id}: автор и текст массива 1-в-1`, (await card.count()) === 1 && norm(await card.innerText()).includes(c.author) && norm(await card.innerText()).includes(c.text));
  }

  const ta = page.locator('[data-smflat-input="1"]');
  ok("A9 textarea: рамка очень тонкая (1px)", (await ta.evaluate((el) => getComputedStyle(el).borderWidth)) === "1px");
  ok("A10 textarea: светло-серая рамка border-zinc-200", (await ta.evaluate((el) => getComputedStyle(el).borderColor)) === (await twProp("border-zinc-200", "borderColor")));
  ok("A11 textarea: без теней", ["none", "rgba(0, 0, 0, 0)"].includes(await ta.evaluate((el) => getComputedStyle(el).boxShadow)));

  ok("A12 прежняя панель «Где купить» снята с Главной", (await page.locator('[data-wtb-hints="1"]').count()) === 0);
  ok("A13 прежняя панель «Где дешевле» снята с Главной", (await page.locator('[data-cheap-hints="1"]').count()) === 0);

  await flat.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/flat-blocks.png`, fullPage: false });

  /* ============ B. Прохождение сухого факта ============ */
  await page.locator('[data-smflat-input="1"]').fill("Видел на Железнодорожной 168, бокс 4");
  await page.locator('[data-smflat-submit="1"]').click();
  await page.locator('[data-smflat-note="1"]').waitFor({ state: "visible", timeout: 30000 });
  ok("B1 сухой факт: плашка НЕ показана", (await page.locator('[data-smflat-plaque="1"]').count()) === 0);
  ok("B2 сухой факт: поле очищено", (await page.locator('[data-smflat-input="1"]').inputValue()) === "");
  ok("B3 сухой факт: подтверждение показано", await page.locator('[data-smflat-note="1"]').isVisible());

  /* ============ C. Телефон (8924…) → серая плашка ============ */
  await page.locator('[data-smflat-input="2"]').fill(PHONE_TEXT);
  await page.locator('[data-smflat-submit="2"]').click();
  const plaque2 = page.locator('[data-smflat-plaque="2"]');
  await plaque2.waitFor({ state: "visible", timeout: 30000 });
  ok("C1 телефон: плашка показана под полем", await plaque2.isVisible());
  ok("C2 текст плашки ДОСЛОВНО ТЗ", norm(await plaque2.locator('[data-smflat-plaque-text="2"]').innerText()) === norm(PLAQUE_ERROR));
  ok("C3 UX: текст из поля НЕ стёрт", (await page.locator('[data-smflat-input="2"]').inputValue()) === PHONE_TEXT);
  const btn2 = plaque2.locator('[data-smflat-forum-btn="2"]');
  ok("C4 кнопка-ссылка с точной надписью", norm(await btn2.innerText()) === norm(BTN_LABEL));
  const href2 = await btn2.getAttribute("href");
  ok(
    "C5 href = формат ТЗ 1-в-1 (/forum/topic/ИД_ТОПИКА?prefilled_text=…)",
    href2 === `/forum/topic/${CARDS[2].topic}?prefilled_text=${encodeURIComponent(PHONE_TEXT)}`,
    (href2 || "").slice(0, 70) + "…",
  );
  ok("C6 маркер «Ошибка:» — text-red-600", (await plaque2.locator('[data-smflat-plaque-text="2"] span').evaluate((el) => getComputedStyle(el).color)) === (await twProp("text-red-600", "color")));
  ok("C7 плашка: фон bg-zinc-50", (await plaque2.evaluate((el) => getComputedStyle(el).backgroundColor)) === (await twProp("bg-zinc-50", "backgroundColor")));
  ok("C8 плашка: рамка border-zinc-200", (await plaque2.evaluate((el) => getComputedStyle(el).borderColor)) === (await twProp("border-zinc-200", "borderColor")));
  ok("C9 плашка: текст zinc-700", (await plaque2.locator('[data-smflat-plaque-text="2"]').evaluate((el) => getComputedStyle(el).color)) === (await twProp("text-zinc-700", "color")));
  ok("C10 плашка: без теней", ["none", "rgba(0, 0, 0, 0)"].includes(await plaque2.evaluate((el) => getComputedStyle(el).boxShadow)));

  await btn2.hover();
  await page.waitForTimeout(600); // transition-colors
  ok("C11 hover кнопки форума: фон bg-zinc-950", (await btn2.evaluate((el) => getComputedStyle(el).backgroundColor)) === (await twProp("bg-zinc-950", "backgroundColor")));
  ok("C12 hover кнопки форума: текст text-white", (await btn2.evaluate((el) => getComputedStyle(el).color)) === (await twProp("text-white", "color")));
  await page.mouse.move(0, 0);
  await page.waitForTimeout(600);
  await plaque2.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/flat-plaque-phone.png`, fullPage: false });

  /* ============ D. Ярлыки (мошенники/обдираловка) ============ */
  await page.locator('[data-smflat-input="3"]').fill(INSULT_TEXT);
  await page.locator('[data-smflat-submit="3"]').click();
  const plaque3 = page.locator('[data-smflat-plaque="3"]');
  await plaque3.waitFor({ state: "visible", timeout: 30000 });
  ok("D1 ярлыки: плашка показана", await plaque3.isVisible());
  ok("D2 текст плашки ДОСЛОВНО ТЗ", norm(await plaque3.locator('[data-smflat-plaque-text="3"]').innerText()) === norm(PLAQUE_ERROR));
  ok("D3 UX: текст из поля НЕ стёрт", (await page.locator('[data-smflat-input="3"]').inputValue()) === INSULT_TEXT);
  const href3 = await plaque3.locator('[data-smflat-forum-btn="3"]').getAttribute("href");
  ok(
    "D4 href = формат ТЗ 1-в-1 (topic-tyres)",
    href3 === `/forum/topic/${CARDS[3].topic}?prefilled_text=${encodeURIComponent(INSULT_TEXT)}`,
    (href3 || "").slice(0, 70) + "…",
  );
  await plaque3.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/flat-plaque-insult.png`, fullPage: false });

  /* ============ E. Ссылка «живая»: правка текста обновляет href ============ */
  const EDITED = INSULT_TEXT + " на рынке";
  await page.locator('[data-smflat-input="3"]').fill(EDITED);
  const href3b = await page.locator('[data-smflat-forum-btn="3"]').getAttribute("href");
  ok(
    "E1 href всегда несёт актуальный ввод пользователя",
    href3b === `/forum/topic/${CARDS[3].topic}?prefilled_text=${encodeURIComponent(EDITED)}`,
  );

  /* ============ F. Бесшовный перенос на форум (пункт 4 ТЗ) ============ */
  const wtbTopic = await prisma.topic.findFirst({ where: { source: "wtb-hints-transfer", deletedAt: null }, select: { id: true } });
  ok("F0 тема-приёмник «Где купить» существует (seed)", !!wtbTopic);
  await page.locator('[data-smflat-forum-btn="2"]').click();
  await page.waitForURL(/\?topic=\d+/, { timeout: 45000 });
  await page.locator("#reply-form textarea").waitFor({ state: "visible", timeout: 45000 });
  ok("F1 открылась тема-приёмник (роут-адаптер 302 → /?topic=N)", /\?topic=\d+/.test(page.url()), page.url().slice(0, 60));
  ok("F2 адаптер: topic-grm/topic-sima → тема рубрики «Где купить»", wtbTopic ? page.url().includes(`topic=${wtbTopic.id}`) : false);
  ok("F3 текст перенесён в форму ответа 1-в-1", (await page.locator("#reply-form textarea").inputValue()) === PHONE_TEXT);
  ok("F4 GET-параметр prefilled_text вычищен из адресной строки", !page.url().includes("prefilled_text"));
  await page.locator("#reply-form").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/flat-forum-prefill.png`, fullPage: false });

  /* ============ G. Адаптер и прежние контракты ============ */
  const cheapTopic = await prisma.topic.findFirst({ where: { source: "cheap-hints-transfer", deletedAt: null }, select: { id: true } });
  ok("G0 тема-приёмник «Цены» существует (seed)", !!cheapTopic);

  await page.goto(`${BASE}/forum/topic/topic-grm?prefilled_text=${encodeURIComponent("АДАПТЕР_ПРОВЕРКА")}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator("#reply-form textarea").waitFor({ state: "visible", timeout: 45000 });
  ok("G1 topic-grm → тема «Где купить», prefilled_text в форме", wtbTopic && page.url().includes(`topic=${wtbTopic.id}`) && (await page.locator("#reply-form textarea").inputValue()) === "АДАПТЕР_ПРОВЕРКА");

  await page.goto(`${BASE}/forum/topic/topic-salmon?prefilled_text=${encodeURIComponent("ЦЕНА_ПРОВЕРКА")}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator("#reply-form textarea").waitFor({ state: "visible", timeout: 45000 });
  ok("G2 topic-salmon → тема «Цены», prefilled_text в форме", cheapTopic && page.url().includes(`topic=${cheapTopic.id}`) && (await page.locator("#reply-form textarea").inputValue()) === "ЦЕНА_ПРОВЕРКА");

  await page.goto(`${BASE}/?topic=${wtbTopic?.id}&wtbhint=${encodeURIComponent("ЛЕГАСИ_WTB")}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator("#reply-form textarea").waitFor({ state: "visible", timeout: 45000 });
  ok("G3 legacy wtbhint по-прежнему предзаполняет форму", (await page.locator("#reply-form textarea").inputValue()) === "ЛЕГАСИ_WTB");
  ok("G4 legacy wtbhint вычищен из URL", !page.url().includes("wtbhint"));

  await page.goto(`${BASE}/?topic=${cheapTopic?.id}&cheapHint=${encodeURIComponent("ЛЕГАСИ_CHEAP")}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator("#reply-form textarea").waitFor({ state: "visible", timeout: 45000 });
  ok("G5 legacy cheapHint по-прежнему предзаполняет форму", (await page.locator("#reply-form textarea").inputValue()) === "ЛЕГАСИ_CHEAP");

  await page.goto(`${BASE}/forum/topic/topic-unknown`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(800);
  ok("G6 неизвестный слаг → запасной переход в форум (/?view=forum)", /view=forum/.test(page.url()), page.url().slice(0, 60));

  /* ============ H. Мобайл 375 ============ */
  const mp = await browser.newPage({ viewport: { width: 375, height: 720 } });
  await mp.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await mp.locator('[data-smflat="1"]').scrollIntoViewIfNeeded();
  await mp.locator('[data-smflat-input="2"]').fill(PHONE_TEXT);
  await mp.locator('[data-smflat-submit="2"]').click();
  const mplaque = mp.locator('[data-smflat-plaque="2"]');
  await mplaque.waitFor({ state: "visible", timeout: 30000 });
  const box = await mplaque.boundingBox();
  ok("H1 мобайл 375: плашка видна и внутри вьюпорта", !!box && box.x >= 0 && box.x + box.width <= 376);
  ok("H2 мобайл 375: без горскролла", await mp.evaluate(() => document.documentElement.scrollWidth <= 375));
  ok("H3 мобайл 375: текст в поле не стёрт", (await mp.locator('[data-smflat-input="2"]').inputValue()) === PHONE_TEXT);
  await mp.screenshot({ path: `${SHOTS}/flat-mobile.png`, fullPage: false });
  await mp.close();

  /* ============ Отчёт ============ */
  console.log(`\nИТОГ: ${passCount} OK / ${failCount} FAIL`);
} catch (e) {
  console.error("PROBE ERROR:", e);
  failCount++;
} finally {
  /* Запись в БД не производилась — закрываем только соединение и браузер. */
  try {
    await prisma.$disconnect();
    await browser.close();
    console.log("Cleanup OK (записи в БД не создавались)");
  } catch (ce) {
    console.error("CLEANUP ERROR:", ce);
  }
  process.exit(failCount > 0 ? 1 : 0);
}
