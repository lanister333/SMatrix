/** Проба ТЗ 2026-09-21 (7 задач заказчика). Проверки:
 *  T1 вход: старый пароль admin@sakhmatrix.ru отозван (401), механизм входа жив
 *     (проверяется через /api/auth/login — отказ = 401 «Неверный email или пароль»);
 *  T2 регистрация: в модалке строго два пола (Мужчина/Женщина), «Не указан» отсутствует;
 *  T3 приливы: карточка «Приливы и отливы» на /weather.php (данные или честное «обновляются…»);
 *  T4 почасовая погода: /api/weather/full — source live, hours > 0 (резерв met.no);
 *  T5 шапка часов: надпись «SakhMatrix • Время» по центру (.sakh-clock-head text-align center);
 *  T6 нажатие кнопки навигации: бирюзовый фон + синие полоски сверху и снизу (inset-тени 1px);
 *  T7 блок «Добавить тему»: только ссылка, без «Вы не вошли…», строго по центру блока.
 *  Скриншоты: scripts/shots/tz21-*.png */
import { chromium } from "playwright";
import fs from "fs";

const BASE = "http://127.0.0.1:3000";
const OUT = "scripts/shots";
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  PASS ${name}${extra ? " — " + extra : ""}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? " — " + extra : ""}`); }
};

/* ---------- T1: вход ---------- */
console.log("T1. Вход по паролю");
{
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@sakhmatrix.ru", password: "Admin2026" }),
  });
  const j = await r.json().catch(() => ({}));
  ok("старый пароль отклонён (401)", r.status === 401, `status=${r.status}`);
  ok("текст отказа штатный", (j.error || "").includes("Неверный email или пароль"));
  const r2 = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nosuchuser@sakhmatrix.local", password: "whatever123" }),
  });
  ok("механизм входа жив (иначе ошибка не 401)", r2.status === 401, `status=${r2.status}`);
}

/* ---------- браузерные проверки ---------- */
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

/* ---------- T2: регистрация, два пола ---------- */
console.log("T2. Регистрация — только два пола");
{
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  // открываем модалку входа из синей навигации и переключаемся на «Регистрация»
  await page.click(".sm-nav-right .sm-mainnav-link:has-text('Зарегистрироваться')");
  await page.waitForTimeout(600);
  const modal = page.locator(".sk-modal, [role='dialog'], .sk-modal-wrap").first();
  const male = await page.locator("input[type=radio][name=gender]").count();
  const labels = await page.locator(".sk-gender-row label").allInnerTexts();
  ok("радио пола ровно 2", male === 2, `count=${male}`);
  ok("есть «Мужчина»", labels.some((l) => l.includes("Мужчина")), labels.join(" | ").slice(0, 60));
  ok("есть «Женщина»", labels.some((l) => l.includes("Женщина")));
  ok("нет «Не указан»", !labels.some((l) => l.includes("Не указан") || l.includes("Не указан")));
  const defaultChecked = await page.locator(".sk-gender-row input:checked").isChecked().catch(() => false);
  ok("по умолчанию выбран первый (Мужчина)", defaultChecked);
  await modal.isVisible().catch(() => {});
  await page.screenshot({ path: `${OUT}/tz21-register-modal.png` });
  await page.keyboard.press("Escape");
}

/* ---------- T7 + T6: форумный список ---------- */
console.log("T7. Блок «Добавить тему»");
let addBox = null;
{
  await page.goto(`${BASE}/?scope=new`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  addBox = page.locator(".sk-sideblock-addtopic").first();
  const cnt = await addBox.count().catch(() => 0);
  ok("блок .sk-sideblock-addtopic на форумном виде", cnt === 1, `count=${cnt}`);
  if (cnt) {
    const text = (await addBox.innerText()).trim();
    ok("текст строго «Добавить тему» без стрелки", text === "Добавить тему", `"${text}"`);
    const blockText = await addBox.evaluate((el) => el.textContent || "");
    ok("строки «Вы не вошли/Вход / регистрация/выйти» удалены", !/не вошли|Вход \/ регистрация|\[выйти\]|Вы вошли как/.test(blockText));
    const geo = await addBox.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const link = el.querySelector(".sk-addtopic").getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        display: cs.display, justifyContent: cs.justifyContent, alignItems: cs.alignItems,
        dLeft: link.left - box.left, dRight: box.right - link.right,
        dTop: link.top - box.top, dBottom: box.bottom - link.bottom,
      };
    });
    ok("display:flex + center/center", geo.display === "flex" && geo.justifyContent === "center" && geo.alignItems === "center");
    ok("ссылка по центру горизонтали (Δ≤2px)", Math.abs(geo.dLeft - geo.dRight) <= 2, `L=${geo.dLeft.toFixed(1)} R=${geo.dRight.toFixed(1)}`);
    ok("ссылка по центру вертикали (Δ≤2px)", Math.abs(geo.dTop - geo.dBottom) <= 2, `T=${geo.dTop.toFixed(1)} B=${geo.dBottom.toFixed(1)}`);
    await page.locator(".sk-col-left").screenshot({ path: `${OUT}/tz21-addtopic-leftcol.png` }).catch(() => {});
  }
}

console.log("T6. Нажатие кнопки синей навигации — бирюза + синие полоски");
{
  const probe = async () => {
    const btn = page.locator(".sm-mainnav .sm-mainnav-link:has-text('Объявления')").first();
    const box = await btn.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(250);
    const st = await btn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, color: cs.color, sh: cs.boxShadow };
    });
    await page.mouse.up();
    return st;
  };
  const st = await probe();
  ok("фон при нажатии бирюзовый rgb(6,205,189)", st.bg === "rgb(6, 205, 189)", st.bg);
  ok("текст тёмно-синий rgb(30,58,95)", st.color === "rgb(30, 58, 95)", st.color);
  const sh = st.sh.replace(/\s+/g, " ");
  ok("тонкая синяя полоска сверху (inset 1px)", /rgb\(30, 58, 95\) 0px 1px 0px 0px inset/.test(sh), sh.slice(0, 90));
  ok("тонкая синяя полоска снизу (inset -1px)", /rgb\(30, 58, 95\) 0px -1px 0px 0px inset/.test(sh));
  // постоянная подсветка активного пункта — тот же стиль
  const act = await page.locator(".sm-mainnav .sm-mainnav-link.active").first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, sh: cs.boxShadow };
  });
  ok("активный пункт тоже бирюзовый с полосками", act.bg === "rgb(6, 205, 189)" && /rgb\(30, 58, 95\) 0px 1px 0px 0px inset/.test(act.sh.replace(/\s+/g, " ")) && /rgb\(30, 58, 95\) 0px -1px 0px 0px inset/.test(act.sh.replace(/\s+/g, " ")));
  const nav = page.locator(".sm-mainnav");
  await nav.screenshot({ path: `${OUT}/tz21-nav-active.png` }).catch(() => {});
}

/* ---------- T5: шапка часов ---------- */
console.log("T5. Шапка часов по центру");
{
  const head = page.locator(".sakh-clock-head").first();
  const cnt = await head.count();
  ok("шапка часов на странице", cnt >= 1, `count=${cnt}`);
  if (cnt) {
    const geo = await head.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      // фактический центр текста через Range
      const range = document.createRange();
      range.selectNodeContents(el);
      const t = range.getBoundingClientRect();
      return {
        ta: cs.textAlign,
        dLeft: t.left - box.left, dRight: box.right - t.right,
        text: (el.textContent || "").trim(),
      };
    });
    ok("text-align:center", geo.ta === "center", geo.ta);
    ok(`надпись по центру (Δ=${Math.abs(geo.dLeft - geo.dRight).toFixed(1)}px ≤3)`, Math.abs(geo.dLeft - geo.dRight) <= 3, `L=${geo.dLeft.toFixed(1)} R=${geo.dRight.toFixed(1)}`);
    ok("текст не изменился", geo.text === "🕒 SakhMatrix • Время", `"${geo.text}"`);
    await page.locator(".sakh-clock").first().screenshot({ path: `${OUT}/tz21-clock.png` }).catch(() => {});
  }
}

/* ---------- T3 + T4: /weather.php ---------- */
console.log("T3. Виджет «Приливы и отливы» на /weather.php");
{
  await page.goto(`${BASE}/weather.php`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  const sec = page.locator("section[aria-label='Приливы и отливы — залив Анива (порт Корсаков)']");
  const cnt = await sec.count();
  ok("карточка приливов есть", cnt === 1, `count=${cnt}`);
  if (cnt) {
    const headTxt = (await sec.locator(".card-header").innerText()).trim();
    ok("шапка «Приливы и отливы»", headTxt === "Приливы и отливы", `"${headTxt}"`);
    const rows = await sec.locator(".tide-row").count();
    const empty = await sec.locator(".tides-empty").count();
    const st = await page.evaluate(async () => {
      const r = await fetch("/api/weather/tides");
      return r.json();
    });
    ok("статус источника жив или честная заглушка", rows > 0 || empty === 1, `rows=${rows} empty=${empty} apiSource=${st.source}`);
    if (rows > 0) {
      const kinds = await sec.locator(".tide-kind").allInnerTexts();
      ok("строки — только «Прилив»/«Отлив»", kinds.every((k) => k === "▲ Прилив" || k === "▼ Отлив"), kinds.slice(0, 3).join(" | "));
      const heights = await sec.locator(".tide-h").allInnerTexts();
      ok("высоты в метрах", heights.every((h) => /м$/.test(h.trim())), heights.slice(0, 3).join(" | "));
      const note = await sec.locator(".tide-note").innerText();
      ok("подпись точки и шага 1 ч", note.includes("Залив Анива") && note.includes("1 ч"), note.slice(0, 60));
      const upd = await sec.locator(".mp-w-upd").innerText();
      ok("штамп источника open-meteo marine", upd.includes("open-meteo.com (marine)"), upd.slice(0, 60));
    }
    // стиль карточки = минимализм сайдбара
    const cardSt = await sec.evaluate((el) => {
      const cs = getComputedStyle(el);
      const h = getComputedStyle(el.querySelector(".card-header"));
      return { bg: cs.backgroundColor, border: cs.borderColor, hBg: h.backgroundColor, hAlign: h.textAlign };
    });
    ok("карточка белая, рамка #d6e4f0", cardSt.bg === "rgb(255, 255, 255)" && cardSt.border === "rgb(214, 228, 240)", `${cardSt.bg}/${cardSt.border}`);
    ok("шапка #1f3a5f по центру", cardSt.hBg === "rgb(31, 58, 95)" && cardSt.hAlign === "center");
    await sec.screenshot({ path: `${OUT}/tz21-tides.png` });
  }
}

console.log("T4. Почасовая погода");
{
  const wx = await page.evaluate(async () => (await fetch("/api/weather/full")).json());
  ok("источник live", wx.source === "live", `${wx.source}/${wx.via}`);
  ok("часы заполнены", Array.isArray(wx.hours) && wx.hours.length > 0, `hours=${wx.hours.length}`);
  const h0 = wx.hours[0] ?? {};
  ok("в часах есть feels/wdeg (полный набор)", typeof h0.feels === "number" && ("wdeg" in h0));
  const hourly = await page.locator(".hourly-forecast .hour-cell").count();
  ok("на странице рендерятся ячейки часов", hourly > 0, `cells=${hourly}`);
  const nowBlock = await page.locator(".wth-now-t").first().innerText().catch(() => "");
  ok("текущая температура показана", /\d/.test(nowBlock), nowBlock.slice(0, 30));
  await page.screenshot({ path: `${OUT}/tz21-weather-full.png`, fullPage: false });
}

/* ---------- финал ---------- */
ok("консоль браузера чистая", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
await browser.close();
console.log(`\nИТОГО: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
