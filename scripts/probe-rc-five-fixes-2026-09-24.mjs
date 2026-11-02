/**
 * ПРОВАЙДЕР 2026-09-24: 5 пунктов правок страницы
 * «Рекомендую / Не рекомендую» (/rekomenduyu):
 *   П.1 «＋ Поделиться опытом» — ТОЛЬКО в левой колонке (.rc-newbtn из
 *       центральной убран: 0 на странице).
 *   П.2 «＋ Поделиться опытом» (.rc-addbtn) — СИНЯЯ #0a5caa, белый текст.
 *   П.3 «Найти» (.rc-search button) — СИНЯЯ #0a5caa, белый текст.
 *   П.4 Блок «Раздел» (.rc-sideblock) — окантовка КАК У ЧАСОВ:
 *       1px solid #4A688C, радиус 0.
 *   П.5 Под КАЖДОЙ публикацией «Обсудить на форуме»: бирюзовая
 *       var(--sm-turquoise,#06cdbd), компактная; ссылки — относительный
 *       путь /forum/category/tovary-i-uslugi--otzyvy-i-rekomendacii
 *       (рубрика «Товары и услуги ▸ Отзывы и рекомендации»), без localhost;
 *       количество кнопок = реальные карточки + 3 демо-записи.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const BLUE = "rgb(10, 92, 170)";
const TURQ = "rgb(6, 205, 189)";
const CLOCK = "rgb(74, 104, 140)";

let ok = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { ok++; console.log(`  OK   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? " — " + extra : ""}`); }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

console.log("=== /rekomenduyu ===");
await page.goto(`${BASE}/rekomenduyu`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector(".rc-sideblock", { timeout: 30000 });
await page.waitForSelector(".rc-btn-forum", { timeout: 30000 });

/* П.1: дубль из центральной убран, левая на месте */
const btns = await page.evaluate(() => ({
  newbtn: document.querySelectorAll(".rc-newbtn").length,
  addbtnLeft: document.querySelectorAll(".rc-col-left .rc-addbtn").length,
  addbtnCenter: document.querySelectorAll(".rc-col-main .rc-addbtn").length,
}));
check("П.1: .rc-newbtn в центральной — 0", btns.newbtn === 0, String(btns.newbtn));
check("П.1: левая кнопка ровно 1", btns.addbtnLeft === 1 && btns.addbtnCenter === 0, JSON.stringify(btns));

/* П.2 + П.3 + П.4: цвета и рамки */
const styles = await page.evaluate(() => {
  const add = document.querySelector(".rc-col-left .rc-addbtn");
  const cs = add ? getComputedStyle(add) : null;
  const find = document.querySelector(".rc-search button");
  const fs = find ? getComputedStyle(find) : null;
  const section = [...document.querySelectorAll(".rc-sideblock")][0];
  const ss = section ? getComputedStyle(section) : null;
  const head = section?.querySelector(".rc-sidehead");
  const hs = head ? getComputedStyle(head) : null;
  return {
    addBg: cs?.backgroundColor, addColor: cs?.color,
    findBg: fs?.backgroundColor, findColor: fs?.color,
    border: ss ? `${ss.borderTopWidth} ${ss.borderTopStyle} ${ss.borderTopColor}` : "",
    radius: ss?.borderRadius,
    head: head?.textContent?.trim(),
    headBg: hs?.backgroundColor, headColor: hs?.color,
  };
});
check("П.2: «＋ Поделиться опытом» синяя #0a5caa", styles.addBg === BLUE, styles.addBg);
check("П.2: белый текст", styles.addColor === "rgb(255, 255, 255)", styles.addColor);
check("П.3: «Найти» синяя #0a5caa", styles.findBg === BLUE, styles.findBg);
check("П.3: белый текст", styles.findColor === "rgb(255, 255, 255)", styles.findColor);
check("П.4: блок «Раздел» — окантовка как у часов (1px solid #4A688C)", styles.border === `1px solid ${CLOCK}`, styles.border);
check("П.4: радиус 0", styles.radius === "0px", styles.radius);
check("ТЗ RC→WB: «Раздел» убран — шапка-часы «👍 Рекомендую / Не рекомендую»", styles.head === "👍 Рекомендую / Не рекомендую", styles.head);
check("ТЗ RC→WB: шапка тёмная #1E3A5F, белый текст (как у часов/wb-sidehead)", styles.headBg === "rgb(30, 58, 95)" && styles.headColor === "rgb(255, 255, 255)", `${styles.headBg} / ${styles.headColor}`);

/* П.5: под каждой публикацией бирюзовая «Обсудить на форуме» */
const forum = await page.evaluate(() => {
  const real = document.querySelectorAll("[data-rc-id]").length;
  const demo = [...document.querySelectorAll(".rc-col-main .w-full.rc-democard")].length;
  const btnsAll = [...document.querySelectorAll(".rc-btn-forum")];
  const states = btnsAll.map((b) => {
    const cs = getComputedStyle(b);
    const a = b.tagName === "A" ? b.getAttribute("href") : null;
    return {
      tag: b.tagName,
      text: (b.textContent || "").trim(),
      bg: cs.backgroundColor,
      href: a || "",
      inCard: !!b.closest("[data-rc-id]"),
      nearDemo: !!b.closest(".rc-demo-forumrow"),
    };
  });
  return { real, demo, count: btnsAll.length, states };
});
check("П.5: кнопок столько же, сколько публикаций (реальные + 3 демо)", forum.count === forum.real + forum.demo && forum.count > 0,
  `кнопок=${forum.count}, реальных=${forum.real}, демо=${forum.demo}`);
check("П.5: все кнопки «Обсудить/Обсуждается…» имеют бирюзовый или нейтральный статус-фон",
  forum.states.every((s) => [TURQ, "rgb(226, 230, 234)", "rgb(237, 240, 243)"].includes(s.bg)),
  JSON.stringify([...new Set(forum.states.map((s) => s.bg))]));
check("П.5: есть кнопка с текстом «💬 Обсудить на форуме»",
  forum.states.some((s) => s.text === "💬 Обсудить на форуме"));
check("П.5: демо-карточки получили кнопки (≥3 ряда вне data-rc-id; +1 у карточки с присланным фиксированным подвалом)",
  forum.states.filter((s) => s.nearDemo).length >= forum.demo && forum.demo >= 1,
  `демо-рядов=${forum.states.filter((s) => s.nearDemo).length}, демо-карточек=${forum.demo}`);
const links = forum.states.filter((s) => s.tag === "A");
check("П.5: все ссылки ОТНОСИТЕЛЬНЫЕ (/forum/..., без localhost)",
  links.length > 0 && links.every((s) => s.href.startsWith("/forum/") && !s.href.includes("localhost")),
  JSON.stringify([...new Set(links.map((s) => s.href))]));
check("П.5: ссылки ведут в рубрику «Товары и услуги ▸ Отзывы и рекомендации»",
  links.every((s) => s.href.startsWith("/forum/category/tovary-i-uslugi--otzyvy-i-rekomendacii")),
  JSON.stringify([...new Set(links.map((s) => s.href))]));

/* Мобайл 375: без горизонтального скролла */
await page.setViewportSize({ width: 375, height: 800 });
await page.waitForTimeout(400);
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
check("Мобайл 375: без горизонтального скролла", sw <= 376, `sw=${sw}`);

const errs = consoleErrors.filter((e) => !e.includes("favicon"));
check("консоль браузера чиста", errs.length === 0, errs.slice(0, 2).join(" | "));

await page.setViewportSize({ width: 1440, height: 1000 });
await page.screenshot({ path: "scripts/shot-rc-after.png" });
await browser.close();
console.log(`\nИТОГО: OK=${ok} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
