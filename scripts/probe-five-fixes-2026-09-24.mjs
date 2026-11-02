/**
 * ПРОВАЙДЕР 2026-09-24: 5 пунктов правок «Где купить» (/gde-kupit) и
 * «Где дешевле» (/gde-deshevle):
 *   П.1 Отступ (margin-bottom 12px) между полем поиска и первой карточкой.
 *   П.2 «Пожаловаться» на ОДНОЙ горизонтальной линии с [📍 Ответить]/
 *       [💬 Обсудить на форуме] (ряд .wb-actrow/.cd-actrow, слева; у автора
 *       кнопки жалобы нет — служебный ряд только с авторскими кнопками).
 *   П.3 Слово «Раздел» (заголовок левого верхнего блока) убрано.
 *   П.4 Шапка левого верхнего блока КАК У БЛОКА «SakhMatrix • Время»:
 *       тёмный фон #1E3A5F, белый текст, иконка, лента на всю ширину блока;
 *       текст «🛒 Где купить» / «🏷️ Где дешевле».
 *   П.5 «＋ Задать вопрос» — СИНЯЯ (#0a5caa, белый текст), прижата к
 *       ПРАВОМУ краю блока.
 * Посты создаются API и удаляются (маркеры уникальны). Рестарт сервера
 * перед прогоном обязателен (in-memory rate-limit 6 постов/час).
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
let ok = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { ok++; console.log(`  OK   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? " — " + extra : ""}`); }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const AUTH_KEY = "sm_auth";
async function login(page) {
  const r = await page.context().request.post(BASE + "/api/auth/login", {
    data: { email: "u1_модератор@sakhmatrix.local", password: "Moderator2026" },
  });
  const d = await r.json().catch(() => null);
  if (!d?.user?.token) return null;
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [AUTH_KEY, JSON.stringify({ token: d.user.token, user: d.user })]);
  return d.user;
}

const CLOCK_HEAD_BG = "rgb(30, 58, 95)";   // #1E3A5F — фон шапки часов
const BLUE = "rgb(10, 92, 170)";           // #0a5caa — синий «Ответить»
const REPORT_RED = "rgb(139, 0, 0)";       // #8B0000 — «Пожаловаться»

const PAGES = [
  { pfx: "wb", url: "gde-kupit", api: "wheretobuy", icon: "🛒", title: "Где купить",
    marker: (run) => `Проба пяти правок ${run}: где купить подшипник 6205-2RS?`,
    text: "Ищу подшипник 6205-2RS, Южно-Сахалинск." },
  { pfx: "cd", url: "gde-deshevle", api: "gdedeshevle", icon: "🏷️", title: "Где дешевле",
    marker: (run) => `Проба пяти правок ${run}: зимняя резина 205/55 R16 дешевле?`,
    text: "Сравниваю цены на зимнюю резину 205/55 R16, Южно-Сахалинск." },
];

for (const cfg of PAGES) {
  const { pfx, url, api, icon, title } = cfg;
  const run = Date.now().toString(36);
  console.log(`\n=== ${url} (${pfx}-*) ===`);

  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  const user = await login(page);
  check("тестовый пользователь вошёл", !!user);

  const created = await ctx.request.post(`${BASE}/api/${api}`, {
    data: { token: user.token, title: cfg.marker(run), text: cfg.text, place: "Южно-Сахалинск", confirmSimilar: true },
  });
  const post = await created.json();
  check("запрос создан через API", created.ok() && !!post?.id, JSON.stringify(post).slice(0, 120));

  /* ---------- ВИД АВТОРА ---------- */
  await page.goto(`${BASE}/${url}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(`[data-${pfx}-id="${post.id}"]`, { timeout: 30000 });

  // П.1: зазор между поиском и первой карточкой
  const gap = await page.evaluate(([pid, p]) => {
    const s = document.querySelector(`.${p}-search`)?.getBoundingClientRect();
    const card = document.querySelector(`[data-${p}-id="${pid}"]`)?.getBoundingClientRect();
    if (!s || !card) return null;
    return Math.round(card.top - s.bottom);
  }, [post.id, pfx]).catch(() => null);
  check("П.1: поиск отделён от первой карточки (12…40px)", gap !== null && gap >= 12 && gap <= 40, `gap=${gap}`);

  // П.2а: у автора «Пожаловаться» нет, служебный ряд есть, пара в actrow
  const ownRow = await page.$eval(`[data-${pfx}-id="${post.id}"]`, (el, p) => ({
    secrow: !!el.querySelector(`.${p}-secrow`),
    reportInAct: !!el.querySelector(`.${p}-actrow .${p}-report`),
    reportAnywhere: !!el.querySelector(`.${p}-report`),
    pair: el.querySelectorAll(`.${p}-actrow .${p}-answerbtn, .${p}-actrow .${p}-btn-forum`).length,
  }), pfx);
  check("П.2: у автора в основном ряду нет «Пожаловаться»", ownRow.reportInAct === false);
  check("П.2: у автора «Пожаловаться» нет нигде", ownRow.reportAnywhere === false);
  check("П.2: у автора служебный ряд на месте", ownRow.secrow === true);
  check("П.2: пара кнопок в основном ряду (2 шт.)", ownRow.pair === 2, String(ownRow.pair));

  // П.3: слова «Раздел» в заголовке блока нет; П.4: шапка как у часов
  const head = await page.$eval(`.${pfx}-col-left`, (el, [ic, tt]) => {
    const block = el.querySelector(`.${tt.startsWith("Где д") && tt.includes("дешевле") ? "cd" : "wb"}-sideblock`) || el.querySelector("div");
    const titles = [...el.querySelectorAll("*")].filter((n) => n.children.length === 0 && n.textContent.trim() === "Раздел");
    const sh = el.querySelector(".wb-sidehead,.cd-sidehead");
    const cs = sh ? getComputedStyle(sh) : null;
    const shR = sh?.getBoundingClientRect(), bR = block?.getBoundingClientRect();
    return {
      oldTitles: titles.length,
      sideheadText: (sh?.textContent || "").trim(),
      bg: cs?.backgroundColor || "",
      color: cs?.color || "",
      fontSize: cs?.fontSize || "",
      fontWeight: cs?.fontWeight || "",
      touchLeft: bR && shR ? Math.round(shR.left - bR.left) : null,
      touchTop: bR && shR ? Math.round(shR.top - bR.top) : null,
      hasIcon: !!sh && sh.textContent.trim().startsWith(ic),
      hasTitle: !!sh && sh.textContent.includes(tt),
    };
  }, [icon, title]).catch((e) => ({ err: String(e) }));
  check("П.3: заголовок «Раздел» убран", head.oldTitles === 0, `найдено=${head.oldTitles}`);
  check("П.4: шапка блока существует", !!head.sideheadText, JSON.stringify(head).slice(0, 140));
  check(`П.4: текст шапки «${icon} ${title}»`, head.hasIcon && head.hasTitle, head.sideheadText);
  check("П.4: тёмный фон #1E3A5F (как у часов)", head.bg === CLOCK_HEAD_BG, head.bg);
  check("П.4: белый текст", head.color === "rgb(255, 255, 255)", head.color);
  check("П.4: шрифт 13px/700", head.fontSize === "13px" && head.fontWeight === "700", `${head.fontSize}/${head.fontWeight}`);
  check("П.4: лента касается краёв блока (слева/сверху ±2)", head.touchLeft !== null && Math.abs(head.touchLeft) <= 2 && Math.abs(head.touchTop) <= 2, `L=${head.touchLeft} T=${head.touchTop}`);

  // П.5: «＋ Задать вопрос» синяя, белый текст, у правого края
  const addbtn = await page.$eval(`.${pfx}-col-left`, (el) => {
    const b = el.querySelector(`.wb-addbtn,.cd-addbtn`);
    const block = b?.closest(".wb-sideblock,.cd-sideblock");
    const cs = b ? getComputedStyle(b) : null;
    const bR = b?.getBoundingClientRect(), kR = block?.getBoundingClientRect();
    return {
      bg: cs?.backgroundColor || "",
      color: cs?.color || "",
      rightGap: bR && kR ? Math.round(kR.right - 11 - bR.right) : null,
      height: bR ? Math.round(bR.height) : null,
    };
  }).catch((e) => ({ err: String(e) }));
  check("П.5: кнопка синяя #0a5caa", addbtn.bg === BLUE, addbtn.bg);
  check("П.5: белый текст", addbtn.color === "rgb(255, 255, 255)", addbtn.color);
  check("П.5: прижата к правому краю (±2px)", addbtn.rightGap !== null && Math.abs(addbtn.rightGap) <= 2, `gap=${addbtn.rightGap}`);
  check("П.5: высота 34px сохранена", addbtn.height === 34, String(addbtn.height));

  /* ---------- ВИД ГОСТЯ ---------- */
  await page.evaluate(([k]) => localStorage.removeItem(k), [AUTH_KEY]);
  await page.goto(`${BASE}/${url}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(`[data-${pfx}-id="${post.id}"]`, { timeout: 30000 });

  const guestRow = await page.$eval(`[data-${pfx}-id="${post.id}"]`, (el, p) => {
    const row = el.querySelector(`.${p}-actrow`);
    const rep = row?.querySelector(`.${p}-report`)?.getBoundingClientRect();
    const ans = row?.querySelector(`.${p}-answerbtn`)?.getBoundingClientRect();
    return {
      reportInAct: !!rep,
      secrow: !!el.querySelector(`.${p}-secrow`),
      repText: (row?.querySelector(`.${p}-report`)?.textContent || "").trim(),
      repColor: row?.querySelector(`.${p}-report`) ? getComputedStyle(row.querySelector(`.${p}-report`)).color : "",
      dy: rep && ans ? Math.abs(rep.top + rep.height / 2 - (ans.top + ans.height / 2)) : null,
      repLeft: rep && ans ? rep.left < ans.left : null,
    };
  }, pfx);
  check("П.2: у гостя «Пожаловаться» в ОСНОВНОМ ряду", guestRow.reportInAct === true, JSON.stringify(guestRow));
  check("П.2: текст «Пожаловаться»", guestRow.repText === "Пожаловаться", guestRow.repText);
  check("П.2: бордовый #8B0000 сохранён", guestRow.repColor === REPORT_RED, guestRow.repColor);
  check("П.2: одна горизонтальная линия с парой (dy ≤ 3)", guestRow.dy !== null && guestRow.dy <= 3, `dy=${guestRow.dy}`);
  check("П.2: «Пожаловаться» слева, пара справа", guestRow.repLeft === true);
  check("П.2: у гостя служебного ряда нет", guestRow.secrow === false);

  /* ---------- МОБАЙЛ 375 (гость) ---------- */
  const mob = await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(400);
  const m = await page.$eval(`[data-${pfx}-id="${post.id}"]`, (el, p) => {
    const row = el.querySelector(`.${p}-actrow`);
    const rep = row?.querySelector(`.${p}-report`)?.getBoundingClientRect();
    const ans = row?.querySelector(`.${p}-answerbtn`)?.getBoundingClientRect();
    const forum = row?.querySelector(`.${p}-btn-forum`)?.getBoundingClientRect();
    return {
      reportAbove: rep && ans ? rep.bottom <= ans.top + 1 : null,
      pairSameLine: ans && forum ? Math.abs(ans.top - forum.top) <= 3 : null,
      hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  }, pfx).catch((e) => ({ err: String(e) }));
  check("Мобайл: «Пожаловаться» строкой выше пары", m.reportAbove === true, JSON.stringify(m));
  check("Мобайл: пара кнопок на одной линии", m.pairSameLine === true);
  check("Мобайл: без горизонтального скролла", m.hScroll === false);

  /* ---------- УБОРКА ---------- */
  await page.setViewportSize({ width: 1440, height: 1100 });
  const del = await page.request.patch(`${BASE}/api/${api}/${post.id}`, {
    data: { token: user.token, action: "delete" },
  });
  check("тестовый пост удалён", del.ok());

  const errs = consoleErrors.filter((e) => !e.includes("favicon"));
  check("консоль браузера чиста", errs.length === 0, errs.slice(0, 2).join(" | "));
  await page.close();
}

await browser.close();
console.log(`\nИТОГО: OK=${ok} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
