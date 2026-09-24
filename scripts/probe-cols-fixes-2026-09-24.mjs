/**
 * Проба 2026-09-24 (ред. 2): список правок «Где купить»/«Где дешевле» (9 пунктов).
 *
 * Проверяет на /gde-kupit (wb-*) и /gde-deshevle (cd-):
 *   П.1 «＋ Задать вопрос» — ТОЛЬКО в левой колонке: .wb-newbtn/.cd-newbtn
 *       отсутствуют, .wb-addbtn/.cd-addbtn ровно 1;
 *   П.2 кнопки левой колонки одного размера: «＋ Задать вопрос» и
 *       «Показать» — одинаковая высота (34px), padding, шрифт 13px/700;
 *   П.3 «Пожаловаться» — бордовый текст #8B0000 (кнопка e2e-карточки .e2e-report);
 *   П.4 окно поиска — белый фон (bg-white);
 *   П.5 кнопка «Найти» — синяя #0a5caa (как «📍 Ответить»);
 *   П.6 карточка вопроса — рамка 1px #4A688C (окантовка как у блока с часами,
 *       директива 2026-09-24), белый фон,
 *       компактные отступы: проверка на РЕАЛЬНОМ посте (создаётся API-вызовом
 *       под админом и удаляется после проверки — лента остаётся чистой);
 *   П.7 цветные ники: .sm-nick-gender g-male (#1050b8) / g-female (#c2185b) /
 *       g-neutral (#4c5563) — цвета как на форуме (.sk-nick g-*); у КАЖДОГО
 *       найденного ника цвет соответствует классу; на двух страницах суммарно
 *       встречаются все три класса; обёртка не меняет текст шапки;
 *   П.8 блоки левой/правой колонок — рамка 1px #4A688C (как у часов), белый фон;
 *   П.9 всё единообразно на обеих страницах (одни и те же проверки).
 * Плюс: консоль без ошибок.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
let ok = 0, fail = 0;
const errors = [];
function check(name, cond, extra = "") {
  if (cond) { ok++; console.log(`  OK   ${name}${extra ? " — " + extra : ""}`); }
  else { fail++; errors.push(name); console.log(`  FAIL ${name}${extra ? " — " + extra : ""}`); }
}

const BLUE = "rgb(10, 92, 170)";      // #0a5caa — как «📍 Ответить»
const BORDEAUX = "rgb(139, 0, 0)";    // #8B0000 — бордовый «Пожаловаться»
const CLOCK_BORDER = "rgb(74, 104, 140)"; // #4A688C — окантовка как у блока с часами (.sakh-clock), директива 2026-09-24
const WHITE = "rgb(255, 255, 255)";
const GENDERS = {
  "g-male": "rgb(16, 80, 184)",     // #1050b8 — форумский мужской
  "g-female": "rgb(194, 24, 91)",   // #c2185b — форумский женский
  "g-neutral": "rgb(76, 85, 99)",   // #4c5563 — нейтральный
};

/* Учётка для создания/удаления тестового поста (как в cleanup-скрипте 2026-09-23). */
const ADMIN = { email: "u1_модератор@sakhmatrix.local", password: "Moderator2026" };

async function apiLogin(page) {
  const r = await page.request.post(`${BASE}/api/auth/login`, { data: ADMIN });
  const d = await r.json();
  if (!r.ok || !d.user?.token) throw new Error(`login failed: ${r.status()} ${JSON.stringify(d).slice(0, 120)}`);
  return d.user;
}

/** Создать пост, вернуть {id, title}. Заголовок уникален для прогона —
 *  проверка точного дубля видит и мягко удалённые посты прошлых прогонов. */
const RUN = Date.now().toString(36);
async function apiCreatePost(page, token, base, title, text) {
  const r = await page.request.post(`${BASE}/api/${base}`, {
    data: { token, title, text, place: "Южно-Сахалинск", confirmSimilar: true },
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`post create failed: ${r.status()} ${JSON.stringify(d).slice(0, 160)}`);
  return d.post ?? d;
}

async function apiDeletePost(page, token, id, base) {
  const r = await page.request.patch(`${BASE}/api/${base}/${id}`, {
    data: { token, action: "delete" },
  });
  return r.ok;
}

async function auditPage(page, variant, pfx) {
  const url = variant === "wtb" ? "gde-kupit" : "gde-deshevle";
  console.log(`\n=== ${url} (${pfx}-*) ===`);
  await page.goto(`${BASE}/${url}`, { waitUntil: "networkidle" });
  await page.waitForSelector(`[data-e2e-panel="${variant}"]`, { timeout: 30000 });

  // П.1: центральной кнопки нет, левая — одна
  const newBtns = await page.$$eval(`.${pfx}-newbtn`, (els) => els.length);
  const addBtns = await page.$$eval(`.${pfx}-addbtn`, (els) => els.length);
  check("П.1: «＋ Задать вопрос» только в левой колонке (0 дублей в центре)", newBtns === 0, `${pfx}-newbtn=${newBtns}`);
  check("П.1: левая кнопка на месте (ровно 1)", addBtns === 1, `${pfx}-addbtn=${addBtns}`);

  // П.2: кнопки левой колонки одного размера
  const m = await page.$eval(`.${pfx}-addbtn`, (el) => {
    const cs = getComputedStyle(el);
    return { h: el.getBoundingClientRect().height, fs: cs.fontSize, fw: cs.fontWeight, pad: cs.paddingLeft + "/" + cs.paddingRight };
  });
  const m2 = await page.$eval(`.${pfx}-placefilter button`, (el) => {
    const cs = getComputedStyle(el);
    return { h: el.getBoundingClientRect().height, fs: cs.fontSize, fw: cs.fontWeight, pad: cs.paddingLeft + "/" + cs.paddingRight };
  });
  check("П.2: «Задать вопрос» и «Показать» — одинаковая высота",
    Math.abs(m.h - m2.h) <= 1, `${m.h.toFixed(1)}px vs ${m2.h.toFixed(1)}px`);
  check("П.2: одинаковый шрифт (13px/700)", m.fs === m2.fs && m.fs === "13px" && m.fw === "700" && m2.fw === "700",
    `${m.fs}/${m.fw} vs ${m2.fs}/${m2.fw}`);
  check("П.2: одинаковый горизонтальный padding", m.pad === m2.pad, `${m.pad} vs ${m2.pad}`);

  // П.3: «Пожаловаться» — бордовый (кнопка e2e-карточки; у лент тот же класс)
  const rep = await page.$(`[data-e2e-panel="${variant}"] .e2e-report`);
  if (rep) {
    const col = await rep.evaluate((el) => getComputedStyle(el).color);
    check("П.3: «Пожаловаться» бордовый #8B0000", col === BORDEAUX, col);
  } else {
    check("П.3: «Пожаловаться» найдена на странице", false);
  }

  // П.4: поиск — белый фон; П.5: «Найти» — синяя
  const s = await page.$eval(`.${pfx}-search input`, (el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, border: cs.borderColor };
  });
  check("П.4: окно поиска — белый фон", s.bg === WHITE, s.bg);
  const sbtn = await page.$eval(`.${pfx}-search button`, (el) => {
    const t = (el.textContent || "").trim();
    return { t, bg: getComputedStyle(el).backgroundColor };
  });
  check("П.5: «Найти» синяя #0a5caa (как «Ответить»)", sbtn.bg === BLUE, `${sbtn.bg} («${sbtn.t}»)`);
  check("П.5: кнопка поиска — именно «Найти»", sbtn.t === "Найти", sbtn.t);

  // П.7: цветные ники — у каждого найденного цвет соответствует классу;
  // классы собираются по обеим страницам (все три должны встретиться).
  const nicks = await page.$$eval(`.sm-nick-gender`, (els) =>
    els.map((el) => ({ cls: el.className, col: getComputedStyle(el).color, txt: (el.textContent || "").trim() }))
  );
  check("П.7: ники обёрнуты .sm-nick-gender", nicks.length > 0, `найдено ${nicks.length}`);
  for (const n of nicks) {
    const g = Object.keys(GENDERS).find((k) => n.cls.includes(k));
    check(`П.7: цвет ника «${n.txt}» соответствует классу`, !!g && n.col === GENDERS[g], `${g || "нет класса"} → ${n.col}`);
  }
  windowGenders.push(...nicks.map((n) => Object.keys(GENDERS).find((k) => n.cls.includes(k))).filter(Boolean));

  // П.7: обёртка ника не меняет текст шапки («Ник · Дата · Город»)
  const headTxt = await page.$eval(`[data-e2e-panel="${variant}"] [data-e2e-head]`, (el) => (el.textContent || "").replace(/\s+/g, " ").trim());
  check("П.7: обёртка ника не меняет текст шапки", /^[^·]+·[^·]+·/.test(headTxt), headTxt.slice(0, 60));

  // П.8: блоки колонок в рамке zinc-200 на белом
  const side = await page.$$eval(`.${pfx}-sideblock`, (els) => {
    if (els.length === 0) return null;
    const cs = getComputedStyle(els[0]);
    return { bg: cs.backgroundColor, bw: cs.borderTopWidth, bs: cs.borderTopStyle, bc: cs.borderTopColor, n: els.length };
  });
  check("П.8: блоки колонок найдены", !!side && side.n >= 2, `sideblock=${side ? side.n : 0}`);
  if (side) {
    check("П.8: блоки — белый фон", side.bg === WHITE, side.bg);
    check("П.8: блоки — рамка 1px solid #4A688C (как у часов)", side.bw === "1px" && side.bs === "solid" && side.bc === CLOCK_BORDER, `${side.bw} ${side.bs} ${side.bc}`);
  }
}

/** П.6: РЕАЛЬНАЯ карточка ленты — создать пост, проверить рамку/фон/отступы
 *  и цвет ника в живой шапке, удалить пост (лента остаётся чистой). */
async function auditRealCard(page, variant, pfx, user, title, text) {
  const url = variant === "wtb" ? "gde-kupit" : "gde-deshevle";
  const base = variant === "wtb" ? "wheretobuy" : "gdedeshevle";
  console.log(`\n=== ${url}: реальная карточка ленты (П.6/П.7) ===`);
  let post = null;
  try {
    post = await apiCreatePost(page, user.token, base, title, text);
  } catch (e) {
    check("П.6: тестовый пост создан", false, String(e).slice(0, 160));
    return;
  }
  const id = post.id;
  check("П.6: тестовый пост создан", !!id && post.hidden !== true, `id=${id ? id.slice(0, 12) : "?"} hidden=${post.hidden} needHuman=${post.needHuman}`);
  if (!id || post.hidden === true) { await apiDeletePost(page, user.token, id, base); return; }

  try {
    await page.goto(`${BASE}/${url}`, { waitUntil: "networkidle" });
    const cardSel = `.${pfx}-item[data-${pfx}-id="${id}"]`;
    const headSel = `[data-${pfx}-head]`;
    await page.waitForSelector(cardSel, { timeout: 15000 });
    const c = await page.$eval(cardSel, (el, hsel) => {
      const cs = getComputedStyle(el);
      return {
        bg: cs.backgroundColor, bw: cs.borderTopWidth, bs: cs.borderTopStyle, bc: cs.borderTopColor,
        pt: parseFloat(cs.paddingTop), pl: parseFloat(cs.paddingLeft),
        nickCls: el.querySelector(hsel + " .sm-nick-gender")?.className || "",
        headTxt: (el.querySelector(hsel)?.textContent || "").replace(/\s+/g, " ").trim(),
      };
    }, headSel);
    check("П.6: карточка — белый фон", c.bg === WHITE, c.bg);
    check("П.6: карточка — рамка 1px solid #4A688C (как у часов)",
      c.bw === "1px" && c.bs === "solid" && c.bc === CLOCK_BORDER, `${c.bw} ${c.bs} ${c.bc}`);
    check("П.6: компактные отступы внутри карточки", c.pt <= 12 && c.pl <= 12, `padding ${c.pt}/${c.pl}`);
    check("П.7: ник в живой шапке карточки окрашен", Object.keys(GENDERS).some((k) => c.nickCls.includes(k)), c.nickCls || "нет класса");
    check("П.7: обёртка не меняет шапку реальной карточки", /^[^·]+·[^·]+·/.test(c.headTxt), c.headTxt.slice(0, 60));
  } catch (e) {
    // Возможная причина: ИИ-модерация скрыла пост. Диагностика через ?mine=1.
    let hidden = "";
    try {
      const r = await page.request.get(`${BASE}/api/${base}?mine=1&token=${user.token}`);
      const d = await r.json();
      const mine = (d.posts || []).find((x) => x.id === id);
      if (mine) hidden = `isHiddenByAi=${mine.isHiddenByAi} needHuman=${mine.needHuman}`;
    } catch {}
    check("П.6: карточка реального поста отрисована в ленте", false, `${String(e).slice(0, 100)} ${hidden}`);
  } finally {
    const del = await apiDeletePost(page, user.token, id, base);
    check("П.6: тестовый пост удалён (лента чиста)", del, `id=${id.slice(0, 12)}`);
  }
}

const windowGenders = [];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  let user = null;
  try {
    user = await apiLogin(page);
  } catch (e) {
    check("логин админа для П.6", false, String(e).slice(0, 120));
  }

  try {
    await auditPage(page, "wtb", "wb");
    await auditPage(page, "cheap", "cd");
  } catch (e) {
    check("проба выполнилась без исключений", false, String(e));
  }

  // П.7 (сводно): все три гендерных класса встречаются на двух страницах
  check("П.7: мужской класс g-male встречается", windowGenders.includes("g-male"), `всего ников ${windowGenders.length}`);
  check("П.7: женский класс g-female встречается", windowGenders.includes("g-female"));
  check("П.7: нейтральный класс g-neutral встречается", windowGenders.includes("g-neutral"));

  if (user) {
    try {
      await auditRealCard(page, "wtb", "wb", user,
        `Где купить подшипник NSK 6205-DDU (проба колонок ${RUN})`,
        "Ищу оригинальный подшипник NSK 6205-DDU (25х52х15). Нужен конкретный магазин в Южно-Сахалинске с наличием на складе.");
      await auditRealCard(page, "cheap", "cd", user,
        `Где дешевле купить подшипник NSK 6205-DDU (проба колонок ${RUN})`,
        "Сравниваю цены на подшипник NSK 6205-DDU (25х52х15) в магазинах Южно-Сахалинска. Где сейчас дешевле за штуку?");
    } catch (e) {
      check("П.6: блок реальных карточек выполнен", false, String(e).slice(0, 140));
    }
  }

  check("консоль без ошибок", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  await browser.close();
  console.log(`\nИТОГО: ${ok} OK / ${fail} FAIL`);
  if (fail > 0) { console.log("Провалено: " + errors.join(" ; ")); process.exit(1); }
})();
