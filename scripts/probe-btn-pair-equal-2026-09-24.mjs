/**
 * Проба 2026-09-24 «пара кнопок ОДИНАКОВОГО размера».
 *
 * Под каждым сообщением «Где купить»/«Где дешевле» кнопки
 * [📍 Ответить] (синяя) и [💬 Обсудить на форуме] (бирюзовая) должны быть:
 *   1) одинаковой ширины (допуск ≤1px) на десктопе и на 375px;
 *   2) одинаковой высоты (26px десктоп / 24px мобайл, допуск ≤1px);
 *   3) с одинаковым padding (0 12px десктоп / 0 8px мобайл) и шрифтом
 *      (12.5px/700 десктоп, 12px/700 мобайл);
 *   4) в одном ряду (dy ≤1px), справа внизу карточки, зазор ровно 10px;
 *   5) одинаковой формы (border-radius 2px у обеих), белый текст;
 *   6) проверка на трёх видах карточек: e2e-сценарии, РЕАЛЬНЫЙ пост ленты
 *      wb (создаётся API и удаляется), РЕАЛЬНЫЙ пост ленты cd;
 *   7) мобайл 375px: пара в одной строке, без горскролла, текст не обрезан;
 *   8) консоль без ошибок.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
let ok = 0, fail = 0;
const errors = [];
function check(name, cond, extra = "") {
  if (cond) { ok++; console.log(`  OK   ${name}${extra ? " — " + extra : ""}`); }
  else { fail++; errors.push(name); console.log(`  FAIL ${name}${extra ? " — " + extra : ""}`); }
}

const BLUE = "rgb(10, 92, 170)";        // #0a5caa — «📍 Ответить»
const TURQ_WB = "rgb(6, 205, 189)";     // #06cdbd — бирюза лент (wb/cd)
const TURQ_E2E = "rgb(13, 148, 136)";   // #0d9488 — бирюза e2e
const WHITE = "rgb(255, 255, 255)";

const ADMIN = { email: "u1_модератор@sakhmatrix.local", password: "Moderator2026" };
const RUN = Date.now().toString(36);

async function apiLogin(page) {
  const r = await page.request.post(`${BASE}/api/auth/login`, { data: ADMIN });
  const d = await r.json();
  if (!r.ok || !d.user?.token) throw new Error(`login failed: ${r.status()}`);
  return d.user;
}
async function apiCreatePost(page, token, base, title, text) {
  const r = await page.request.post(`${BASE}/api/${base}`, {
    data: { token, title, text, place: "Южно-Сахалинск", confirmSimilar: true },
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`create failed: ${r.status()} ${JSON.stringify(d).slice(0, 120)}`);
  return d.post ?? d;
}
async function apiDeletePost(page, token, id, base) {
  const r = await page.request.patch(`${BASE}/api/${base}/${id}`, { data: { token, action: "delete" } });
  return r.ok;
}

/** Геометрия пары кнопок: root = document.querySelectorAll(rootSel)[idx] (замер
 *  целиком в браузерном контексте — дескрипторы не инвалидируются гидрацией). */
async function measurePairIdx(page, rootSel, idx = 0) {
  return page.evaluate(({ rootSel, idx }) => {
    const root = document.querySelectorAll(rootSel)[idx];
    if (!root) return null;
    const inner = root.querySelector(".e2e-pair") ?? root;
    const btns = [...inner.querySelectorAll("button, a")].filter((el) => {
      const t = (el.textContent || "").trim();
      return t.includes("Ответить") || t.includes("Обсудить на форуме");
    });
    if (btns.length < 2) return null;
    const [a, f] = btns;
    const ra = a.getBoundingClientRect(), rf = f.getBoundingClientRect();
    const ca = getComputedStyle(a), cf = getComputedStyle(f);
    return {
      aw: ra.width, fw: rf.width,
      ah: ra.height, fh: rf.height,
      aPad: `${ca.paddingTop}/${ca.paddingRight}/${ca.paddingBottom}/${ca.paddingLeft}`,
      fPad: `${cf.paddingTop}/${cf.paddingRight}/${cf.paddingBottom}/${cf.paddingLeft}`,
      aFs: ca.fontSize, fFs: cf.fontSize,
      aFw: ca.fontWeight, fFw: cf.fontWeight,
      aR: ca.borderRadius, fR: cf.borderRadius,
      aColor: ca.color, fColor: cf.color,
      aBg: ca.backgroundColor, fBg: cf.backgroundColor,
      gap: rf.left - ra.right,
      dy: Math.abs(ra.top - rf.top),
      fRightDelta: inner.getBoundingClientRect().right - rf.right,
      aClip: a.scrollWidth > a.clientWidth + 1,
      fClip: f.scrollWidth > f.clientWidth + 1,
    };
  }, { rootSel, idx });
}

function assertPairEqual(tag, g, opts = {}) {
  const { hgt, fs, pad, turq } = opts;
  check(`${tag}: ОДИНАКОВАЯ ширина`, Math.abs(g.aw - g.fw) <= 1, `${g.aw.toFixed(1)}px vs ${g.fw.toFixed(1)}px`);
  check(`${tag}: ОДИНАКОВАЯ высота (${hgt}px)`, Math.abs(g.ah - g.fh) <= 1 && Math.abs(g.ah - hgt) <= 1.5,
    `${g.ah.toFixed(1)} vs ${g.fh.toFixed(1)}`);
  check(`${tag}: ОДИНАКОВЫЙ padding (${pad})`, g.aPad === g.fPad, `${g.aPad} vs ${g.fPad}`);
  check(`${tag}: ОДИНАКОВЫЙ шрифт (${fs}/700)`, g.aFs === g.fFs && g.aFs === fs && g.aFw === "700" && g.fFw === "700",
    `${g.aFs} vs ${g.fFs}`);
  check(`${tag}: ОДИНАКОВАЯ форма (radius 2)`, g.aR === g.fR && g.aR.startsWith("2px"), `${g.aR} vs ${g.fR}`);
  check(`${tag}: белый текст у обеих`, g.aColor === WHITE && g.fColor === WHITE, `${g.aColor} / ${g.fColor}`);
  check(`${tag}: синяя + бирюзовая (${turq})`, g.aBg === BLUE && g.fBg === turq, `${g.aBg} / ${g.fBg}`);
  check(`${tag}: в одном ряду (dy≤1)`, g.dy <= 1, `dy=${g.dy.toFixed(1)}`);
  check(`${tag}: зазор 10px`, Math.abs(g.gap - 10) <= 1.5, `gap=${g.gap.toFixed(1)}`);
  check(`${tag}: пара у ПРАВОГО края (Δ≤2)`, g.fRightDelta <= 2, `Δ=${g.fRightDelta.toFixed(1)}`);
  check(`${tag}: текст не обрезан`, !g.aClip && !g.fClip, `a=${g.aClip} f=${g.fClip}`);
}

const consoleErrors = [];
async function newPage(browser) {
  const p = await browser.newPage();
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => consoleErrors.push(String(e)));
  return p;
}

const browser = await chromium.launch();
try {
  /* ---------- A. e2e-сценарии + реальный пост, обе страницы, десктоп ---------- */
  for (const [variant, url, pfx, apiBase, idAttr] of [
    ["wtb", "gde-kupit", "wb", "wheretobuy", "data-wb-id"],
    ["cheap", "gde-deshevle", "cd", "gdedeshevle", "data-cd-id"],
  ]) {
    console.log(`\n=== ${url}: десктоп 1280 ===`);
    const page = await newPage(browser);
    await page.goto(`${BASE}/${url}`, { waitUntil: "networkidle" });
    await page.waitForSelector(`[data-e2e-panel="${variant}"]`, { timeout: 30000 });
    await page.waitForSelector(`.${pfx}-item .${pfx}-actrow, .${pfx}-item .e2e-actrow`, { timeout: 15000 }).catch(() => {});

    // A1. Первые три e2e-карточки
    const scenCount = await page.$$eval(`[data-e2e-panel="${variant}"] .e2e-scen`, (els) => els.length);
    check(`${url}: e2e-сценарии найдены`, scenCount >= 3, `n=${scenCount}`);
    const scenSel = `[data-e2e-panel="${variant}"] .e2e-scen`;
    for (let i = 0; i < Math.min(3, scenCount); i++) {
      const g = await measurePairIdx(page, scenSel, i);
      if (!g) { check(`e2e сц.${i + 1}: пара найдена`, false); continue; }
      assertPairEqual(`e2e сц.${i + 1}`, g, { hgt: 26, fs: "12.5px", pad: "0px/12px/0px/12px", turq: TURQ_E2E });
    }

    // A2. РЕАЛЬНЫЙ пост ленты (создать → измерить → удалить); заголовок
    // с конкретным товаром/артикулом — проходит ИИ-проверку конкретности
    const user = await apiLogin(page);
    const postTitle = variant === "wtb"
      ? `Где купить подшипник NSK 6205-DDU (проба пары ${RUN})`
      : `Где дешевле подшипник NSK 6205-DDU 25х52х15 (проба пары ${RUN})`;
    const postText = variant === "wtb"
      ? "Ищу магазин в Южно-Сахалинске, где есть в наличии подшипник NSK 6205-DDU (25х52х15). Конкретный артикул 6205-DDU, подхожу для ступицы. Подскажите адрес или страницу товара."
      : "Сравниваю цены на подшипник NSK 6205-DDU (25х52х15) в магазинах Южно-Сахалинска. Где сейчас дешевле за штуку?";
    const post = await apiCreatePost(page, user.token, apiBase, postTitle, postText);
    if (!post.id) console.log(`  .. ответ API: ${JSON.stringify(post).slice(0, 200)}`);
    check(`${url}: тестовый пост создан`, !!post.id, `id=${post.id}`);
    await page.goto(`${BASE}/${url}`, { waitUntil: "networkidle" });
    const card = await page
      .waitForSelector(`[${idAttr}="${post.id}"]`, { timeout: 20000 })
      .catch(() => null);
    check(`${url}: карточка реального поста в ленте`, !!card);
    if (card) {
      const g = await measurePairIdx(page, `[${idAttr}="${post.id}"] .${pfx}-actrow`);
      if (!g) { check(`${url}: пара кнопок реальной карточки найдена`, false); }
      else assertPairEqual(`${url} реальная карточка`, g, { hgt: 26, fs: "12.5px", pad: "0px/12px/0px/12px", turq: TURQ_WB });
    }
    const del = await apiDeletePost(page, user.token, post.id, apiBase);
    check(`${url}: тестовый пост удалён (лента чиста)`, del, `id=${post.id}`);
    await page.close();
  }

  /* ---------- B. Мобайл 375px ---------- */
  console.log(`\n=== мобайл 375 ===`);
  for (const [variant, url, pfx] of [["wtb", "gde-kupit", "wb"], ["cheap", "gde-deshevle", "cd"]]) {
    const mp = await newPage(browser);
    await mp.setViewportSize({ width: 375, height: 720 });
    await mp.goto(`${BASE}/${url}`, { waitUntil: "networkidle" });
    await mp.waitForSelector(`[data-e2e-panel="${variant}"]`, { timeout: 30000 });
    const scenCount = await mp.$$eval(`[data-e2e-panel="${variant}"] .e2e-scen`, (els) => els.length);
    const g = scenCount ? await measurePairIdx(mp, `[data-e2e-panel="${variant}"] .e2e-scen`, 0) : null;
    if (!g) { check(`мобайл ${url}: пара найдена`, false); }
    else assertPairEqual(`мобайл ${url} e2e сц.1`, g, { hgt: 24, fs: "12px", pad: "0px/8px/0px/8px", turq: TURQ_E2E });
    const noHScroll = await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    check(`мобайл ${url}: без горизонтального скролла`, noHScroll);
    await mp.close();
  }

  /* ---------- C. Консоль ---------- */
  const realErrors = consoleErrors.filter((t) => !t.includes("favicon"));
  check("консоль без ошибок", realErrors.length === 0, realErrors.slice(0, 2).join(" | ").slice(0, 160));
} finally {
  await browser.close();
}

console.log(`\nИТОГО: ${ok} OK / ${fail} FAIL`);
if (fail > 0) { console.log(`Провалено: ${errors.join(" ; ")}`); process.exit(1); }
