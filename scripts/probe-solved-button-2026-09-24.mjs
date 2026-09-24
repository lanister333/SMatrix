/**
 * Проба 2026-09-24 «ВОПРОС РЕШЁН + РАМКИ ZINC-300 + СИНЯЯ "ПОКАЗАТЬ"».
 *
 * Проверяет на /gde-kupit (wb-*) и /gde-deshevle (cd-*):
 *   К.1 Кнопка «✅ Вопрос решён» видна ТОЛЬКО автору: у гостя на карточке
 *       чужого поста её НЕТ (и «↩️ Вернуть в актуальные» тоже), есть
 *       «Пожаловаться»; у автора — есть.
 *   К.2 Нажатие «Вопрос решён» всплывает подтверждение с ДОСЛОВНЫМ текстом
 *       ТЗ: «Отметить вопрос как решённый? После этого публикация получит
 *       статус "Решено" и потускнеет.»; ОТМЕНА ничего не меняет.
 *   К.3 Подтверждение: статус «Найдено» («Где купить») / «Цена зафиксирована»
 *       («Где дешевле»), строка «✅ Статус: …», карточка ТУСКНЕЕТ (.is-dim).
 *   К.4 Кнопка меняется на «↩️ Вернуть в актуальные» (синяя #0a5caa);
 *       нажатие возвращает статус («Ищу»/«Сравниваю»), тускнение уходит,
 *       «✅ Вопрос решён» возвращается (зелёная #1e5c2e).
 *   К.5 Блоки левой/правой колонок и карточка сообщения — рамка 1px
 *       #4A688C (окантовка как у блока с часами, директива 2026-09-24),
 *       белый фон.
 *   К.6 «Показать» — синяя #0a5caa, белый текст, как «Найти»;
 *       высота 34px, шрифт 13px/700.
 *   К.7 Консоль без ошибок; тестовые посты удаляются (лента чиста).
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
let ok = 0, fail = 0;
const errors = [];
function check(name, cond, extra = "") {
  if (cond) { ok++; console.log(`  OK   ${name}${extra ? " — " + extra : ""}`); }
  else { fail++; errors.push(name); console.log(`  FAIL ${name}${extra ? " — " + extra : ""}`); }
}

const SOLVE_TEXT = "✅ Вопрос решён";
const REOPEN_TEXT = "↩️ Вернуть в актуальные";
const CONFIRM_TEXT = 'Отметить вопрос как решённый? После этого публикация получит статус "Решено" и потускнеет.';
const CLOCK_BORDER = "rgb(74, 104, 140)"; // #4A688C — окантовка как у блока с часами
const BLUE = "rgb(10, 92, 170)";      // #0a5caa
const GREEN = "rgb(30, 92, 46)";      // #1e5c2e
const WHITE = "rgb(255, 255, 255)";

const ADMIN = { email: "u1_модератор@sakhmatrix.local", password: "Moderator2026" };
const RUN = Date.now().toString(36);

/* Состояние диалога window.confirm — обработчик в main зарегистрирован
   РОВНО ОДИН раз (повторная регистрация даёт «dialog already handled»). */
let dialogText = "";
let dialogAction = "dismiss";

async function apiLogin(page) {
  const r = await page.request.post(`${BASE}/api/auth/login`, { data: ADMIN });
  const d = await r.json();
  if (!r.ok || !d.user?.token) throw new Error(`login failed: ${r.status()} ${JSON.stringify(d).slice(0, 120)}`);
  return d.user;
}

async function apiCreatePost(page, token, base, title, text) {
  const r = await page.request.post(`${BASE}/api/${base}`, {
    data: { token, title, text, place: "Южно-Сахалинск", confirmSimilar: true },
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`post create failed: ${r.status()} ${JSON.stringify(d).slice(0, 160)}`);
  return d.post ?? d;
}

async function apiDeletePost(page, token, id, base) {
  const r = await page.request.patch(`${BASE}/api/${base}/${id}`, { data: { token, action: "delete" } });
  return r.ok;
}

/** Общая проверка одной страницы. cfg:
 *  variant: "wtb"|"cheap"; pfx: "wb"|"cd"; url; base (API); statusNew;
 *  statusLabel; statusBack; statusBackLabel. */
async function auditPage(page, cfg, user) {
  const { variant, pfx, url, base, statusNew, statusLabel, statusBack, statusBackLabel } = cfg;
  const idSel = `[data-${pfx}-id]`;
  console.log(`\n=== ${url} (${pfx}-*) ===`);

  // Карточка гостя: у гостя НЕТ «Вопрос решён» и «Вернуть в актуальные».
  // ЯВНО выходим (localStorage смежных проходов не должен протекать).
  await page.goto(`${BASE}/${url}`, { waitUntil: "networkidle" });
  await page.evaluate(([k]) => localStorage.removeItem(k), ["sm_auth"]);
  await page.goto(`${BASE}/${url}`, { waitUntil: "networkidle" });
  await page.waitForSelector(idSel, { timeout: 30000 });
  const guestRow = await page.$eval(idSel, (el, p) => ({
    solve: !!el.querySelector(`[data-${p}-solve]`),
    reopen: !!el.querySelector(`[data-${p}-reopen]`),
    report: (el.querySelector(`.${p}-report`)?.textContent || "").trim(),
    status: el.getAttribute(`data-${p}-status`),
  }), pfx);
  check("К.1: у гостя нет «Вопрос решён»", guestRow.solve === false, `solve=${guestRow.solve}`);
  check("К.1: у гостя нет «Вернуть в актуальные»", guestRow.reopen === false, `reopen=${guestRow.reopen}`);
  check("К.1: у гостя есть «Пожаловаться»", guestRow.report === "Пожаловаться", guestRow.report);

  // Карточка автора (токен в localStorage — тот же путь, что после входа).
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), ["sm_auth", JSON.stringify({ token: user.token, user })]);
  await page.goto(`${BASE}/${url}`, { waitUntil: "networkidle" });
  await page.waitForSelector(idSel, { timeout: 30000 });
  const ownRow = await page.$eval(idSel, (el, p) => {
    const b = el.querySelector(`[data-${p}-solve]`);
    const cs = b ? getComputedStyle(b) : null;
    return {
      solveText: (b?.textContent || "").trim(),
      solveColor: cs ? cs.color : "",
      reopen: !!el.querySelector(`[data-${p}-reopen]`),
      status: el.getAttribute(`data-${p}-status`),
      id: el.getAttribute(`data-${p}-id`),
      border: getComputedStyle(el).borderTopColor,
      dim: el.classList.contains("is-dim"),
    };
  }, pfx);
  check("К.1: у автора есть «✅ Вопрос решён»", ownRow.solveText === SOLVE_TEXT, ownRow.solveText);
  check("К.1: «Вопрос решён» зелёная #1e5c2e", ownRow.solveColor === GREEN, ownRow.solveColor);
  check("К.1: «Вернуть в актуальные» пока скрыта", ownRow.reopen === false);
  check("К.5: карточка — рамка #4A688C (как у часов)", ownRow.border === CLOCK_BORDER, ownRow.border);
  check("К.5: карточка не тускнеет в актуальном статусе", ownRow.dim === false);
  const postId = ownRow.id;

  // Диалог: ОТМЕНА — статус не меняется. (Обработчик зарегистрирован
  // ОДИН раз в main — тут только переключаем режим и сбрасываем текст.)
  dialogText = "";
  dialogAction = "dismiss";
  await page.click(`[data-${pfx}-solve="${postId}"]`);
  await page.waitForTimeout(400);
  check("К.2: текст подтверждения дословный", dialogText === CONFIRM_TEXT, JSON.stringify(dialogText));
  await page.waitForTimeout(300);
  const afterDismiss = await page.$eval(`[data-${pfx}-id="${postId}"]`, (el, p) => el.getAttribute(`data-${p}-status`), pfx);
  check("К.2: отмена — статус не изменился", afterDismiss === statusBack, afterDismiss);

  // Диалог: ПОДТВЕРЖДЕНИЕ — статус «Найдено»/«Цена зафиксирована», тускнеет.
  dialogAction = "accept";
  await page.click(`[data-${pfx}-solve="${postId}"]`);
  await page.waitForSelector(`[data-${pfx}-reopen="${postId}"]`, { timeout: 15000 });
  const solved = await page.$eval(`[data-${pfx}-id="${postId}"]`, (el, p) => {
    const rb = el.querySelector(`[data-${p}-reopen]`);
    const line = el.querySelector(`.${p}-statusline`);
    const cs = rb ? getComputedStyle(rb) : null;
    return {
      status: el.getAttribute(`data-${p}-status`),
      dim: el.classList.contains("is-dim"),
      lineText: (line?.textContent || "").replace(/\s+/g, " ").trim(),
      reopenText: (rb?.textContent || "").trim(),
      reopenColor: cs ? cs.color : "",
      solveGone: !el.querySelector(`[data-${p}-solve]`),
    };
  }, pfx);
  check(`К.3: статус стал ${statusNew}`, solved.status === statusNew, solved.status);
  check("К.3: карточка тускнеет (.is-dim)", solved.dim === true);
  check(`К.3: строка «✅ Статус: ${statusLabel}»`, solved.lineText === `✅ Статус: ${statusLabel}`, solved.lineText);
  check("К.4: кнопка стала «↩️ Вернуть в актуальные»", solved.reopenText === REOPEN_TEXT, solved.reopenText);
  check("К.4: «Вернуть в актуальные» синяя #0a5caa", solved.reopenColor === BLUE, solved.reopenColor);
  check("К.4: «Вопрос решён» у решённого скрыта", solved.solveGone === true);

  // Возврат: статус назад, тускнение уходит, «Вопрос решён» возвращается.
  await page.click(`[data-${pfx}-reopen="${postId}"]`);
  await page.waitForSelector(`[data-${pfx}-solve="${postId}"]`, { timeout: 15000 });
  const reopened = await page.$eval(`[data-${pfx}-id="${postId}"]`, (el, p) => ({
    status: el.getAttribute(`data-${p}-status`),
    dim: el.classList.contains("is-dim"),
    lineText: (el.querySelector(`.${p}-statusline`)?.textContent || "").replace(/\s+/g, " ").trim(),
  }), pfx);
  check(`К.4: статус вернулся — ${statusBackLabel}`, reopened.status === statusBack, reopened.status);
  check("К.4: тускнение ушло", reopened.dim === false);
  check(`К.4: строка статуса снова «Статус: ${statusBackLabel}»`, reopened.lineText === `Статус: ${statusBackLabel}`, reopened.lineText);

  return postId;
}

/** Колонки: рамки блоков #4A688C (как у часов) на белом; «Показать» — как «Найти». */
async function auditColumns(page, pfx, url) {
  await page.goto(`${BASE}/${url}`, { waitUntil: "networkidle" });
  await page.waitForSelector(`.${pfx}-sideblock`, { timeout: 30000 });
  const side = await page.$$eval(`.${pfx}-sideblock`, (els) => {
    const cs = getComputedStyle(els[0]);
    return { n: els.length, bw: cs.borderTopWidth, bc: cs.borderTopColor, bg: cs.backgroundColor };
  });
  check("К.5: блоки колонок найдены (обе колонки)", side.n >= 2, `sideblock=${side.n}`);
  check("К.5: блоки — рамка 1px #4A688C (как у часов)", side.bw === "1px" && side.bc === CLOCK_BORDER, `${side.bw} ${side.bc}`);
  check("К.5: блоки — белый фон", side.bg === WHITE, side.bg);

  const btns = await page.$eval(`.${pfx}-placefilter button`, (el) => {
    const cs = getComputedStyle(el);
    return { t: (el.textContent || "").trim(), bg: cs.backgroundColor, color: cs.color, h: el.getBoundingClientRect().height, fs: cs.fontSize, fw: cs.fontWeight };
  });
  const findBtn = await page.$eval(`.${pfx}-search button`, (el) => getComputedStyle(el).backgroundColor);
  check("К.6: «Показать» — синяя #0a5caa, как «Найти»", btns.bg === BLUE && btns.color === WHITE && findBtn === BLUE, `${btns.bg}/${btns.color}, Найти=${findBtn}`);
  check("К.6: «Показать» — высота 34px, шрифт 13px/700", Math.round(btns.h) === 34 && btns.fs === "13px" && btns.fw === "700", `${btns.h.toFixed(1)}px ${btns.fs}/${btns.fw}`);

  // e2e-карточки (если отрисованы) — тоже окантовка как у часов.
  const e2eBorder = await page.$$eval(".e2e-scen", (els) => (els.length ? getComputedStyle(els[0]).borderTopColor : ""));
  if (e2eBorder) check("К.5: e2e-карточки — рамка #4A688C", e2eBorder === CLOCK_BORDER, e2eBorder);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("dialog", async (d) => {
    dialogText = d.message();
    if (dialogAction === "accept") await d.accept(); else await d.dismiss();
  });

  let user = null;
  try { user = await apiLogin(page); } catch (e) { check("логин автора", false, String(e).slice(0, 120)); }

  // Тестовые посты (автор — админ) создаются заранее и удаляются в конце.
  let wtbId = null, cheapId = null;
  if (user) {
    try {
      const p = await apiCreatePost(page, user.token, "wheretobuy",
        `Где купить подшипник NSK 6205-DDU (проба решён ${RUN})`,
        "Ищу оригинальный подшипник NSK 6205-DDU (25х52х15). Нужен конкретный магазин в Южно-Сахалинске с наличием на складе.");
      wtbId = p.id;
      check("тестовый пост «Где купить» создан", !!wtbId && p.hidden !== true, `id=${wtbId ? wtbId.slice(0, 12) : "?"}`);
    } catch (e) { check("тестовый пост «Где купить» создан", false, String(e).slice(0, 140)); }
    try {
      const p = await apiCreatePost(page, user.token, "gdedeshevle",
        `Где дешевле купить подшипник NSK 6205-DDU (проба решён ${RUN})`,
        "Сравниваю цены на подшипник NSK 6205-DDU (25х52х15) в магазинах Южно-Сахалинска. Где сейчас дешевле за штуку?");
      cheapId = p.id;
      check("тестовый пост «Где дешевле» создан", !!cheapId && p.hidden !== true, `id=${cheapId ? cheapId.slice(0, 12) : "?"}`);
    } catch (e) { check("тестовый пост «Где дешевле» создан", false, String(e).slice(0, 140)); }
  }

  try {
    await auditColumns(page, "wb", "gde-kupit");
    await auditColumns(page, "cd", "gde-deshevle");
  } catch (e) { check("колонки: без исключений", false, String(e).slice(0, 160)); }

  if (user && wtbId && cheapId) {
    try {
      await auditPage(page, {
        variant: "wtb", pfx: "wb", url: "gde-kupit", base: "wheretobuy",
        statusNew: "found", statusLabel: "Найдено", statusBack: "seeking", statusBackLabel: "Ищу",
      }, user);
      await auditPage(page, {
        variant: "cheap", pfx: "cd", url: "gde-deshevle", base: "gdedeshevle",
        statusNew: "fixed", statusLabel: "Цена зафиксирована", statusBack: "comparing", statusBackLabel: "Сравниваю",
      }, user);
    } catch (e) { check("сценарий «Вопрос решён»: без исключений", false, String(e).slice(0, 200)); }
  } else {
    check("сценарий «Вопрос решён» выполнен", false, "нет тестовых постов или логина");
  }

  if (wtbId) { const del = await apiDeletePost(page, user.token, wtbId, "wheretobuy"); check("тестовый пост «Где купить» удалён", del, wtbId.slice(0, 12)); }
  if (cheapId) { const del = await apiDeletePost(page, user.token, cheapId, "gdedeshevle"); check("тестовый пост «Где дешевле» удалён", del, cheapId.slice(0, 12)); }

  check("консоль без ошибок", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  await browser.close();
  console.log(`\nИТОГО: ${ok} OK / ${fail} FAIL`);
  if (fail > 0) { console.log("Провалено: " + errors.join(" ; ")); process.exit(1); }
})();
