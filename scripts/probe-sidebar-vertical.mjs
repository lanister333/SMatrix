// Проба вертикальной раскладки рубрик сайдбара (фикс 2026-09-19).
// Проверяет на Главной (page.tsx) и на /weather.php (left-nav.tsx):
//   1) при раскрытии рубрики её название НЕ сдвигается (x/width до == после);
//   2) ul.sk-sublist располагается СТРОГО ПОД .sk-rubric-header (top >= header.bottom);
//   3) подрубрики имеют отступ слева (sublist.left > li.left);
//   4) стрелка остаётся в строке заголовка (в пределах header по вертикали);
//   5) повторный клик сворачивает подрубрики, название снова не сдвигается.
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const EPS = 1.5; // допуск на субпиксельные расхождения, px

function near(a, b, eps = EPS) { return Math.abs(a - b) <= eps; }

async function rect(page, sel, rootSel) {
  return page.evaluate(({ sel, rootSel }) => {
    const root = rootSel ? document.querySelector(rootSel) : document;
    const el = root.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom, right: r.right };
  }, { sel, rootSel });
}

async function fontWeight(page, sel) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el).fontWeight : null;
  }, sel);
}

// Иконка и название В ОДНОЙ СТРОКЕ: иконка левее названия, их верх
// совпадает (±6px), высота заголовка = одна текстовая строка (≤28px).
async function checkIconNameRow(page, liSel, label, failures) {
  const header = await rect(page, `#${liSel} .sk-rubric-header`);
  const icon = await rect(page, `#${liSel} .sk-rubric-header .sk-navico`);
  const name = await rect(page, `#${liSel} .sk-rubric-name`);
  const arrow = await rect(page, `#${liSel} .sk-rubric-header .arr`);
  const t = (cond, msg) => { if (!cond) failures.push(`${label}: ${msg}`); console.log(`   ${cond ? "OK " : "FAIL"} ${msg}`); };
  t(!!icon && !!name, "иконка и название найдены в .sk-rubric-header");
  t(icon.y - name.y >= -6 && icon.y - name.y <= 6, `иконка и название В ОДНОЙ СТРОКЕ (icon.y=${icon?.y?.toFixed?.(1)}, name.y=${name?.y?.toFixed?.(1)})`);
  t(icon.x + icon.w <= name.x + 2, "иконка СЛЕВА от названия");
  t(header.h <= 28, `заголовок высотой одной строки (h=${header?.h?.toFixed?.(1)} ≤ 28)`);
  if (arrow) {
    t(arrow.y - name.y <= 8, `стрелка в той же строке, что и начало названия (arrow.y=${arrow?.y?.toFixed?.(1)}, name.y=${name?.y?.toFixed?.(1)}, diff=${(arrow.y - name.y).toFixed(1)}, h=${arrow.h?.toFixed?.(1)})`);
  }
}

async function checkRubric(page, liSel, toggleSel, label, failures) {
  const li = `#${liSel}`;
  const header = `#${liSel} .sk-rubric-header`;
  const name = `#${liSel} .sk-rubric-name`;
  const sub = `#${liSel} ul.sk-sublist`;

  const before = { name: await rect(page, name), header: await rect(page, header), li: await rect(page, li), fw: await fontWeight(page, name) };

  // проверка строки «иконка + название + стрелка» — В СВЁРНУТОМ состоянии
  // (в раскрытом стрелка повернута rotate(90deg) — её bbox искажён)
  console.log(`\n== ${label} ==`);
  await checkIconNameRow(page, liSel, label, failures);

  // раскрыть
  await page.click(toggleSel);
  await page.waitForSelector(sub, { state: "visible", timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(120);

  const after = {
    name: await rect(page, name),
    header: await rect(page, header),
    li: await rect(page, li),
    sub: await rect(page, sub),
    arrow: await rect(page, `#${liSel} .sk-rubric-header .arr`),
    fw: await fontWeight(page, name),
  };
  // Ширина названия может измениться ТОЛЬКО из-за существующего стиля выбранной
  // рубрики .sk-rubric-name.active (font-weight:700) — это смена начертания,
  // а не сдвиг: левый край (x) обязан остаться на месте.

  const t = (cond, msg) => { if (!cond) failures.push(`${label}: ${msg}`); console.log(`   ${cond ? "OK " : "FAIL"} ${msg}`); };

  console.log(`   name before: x=${before.name?.x.toFixed(1)} w=${before.name?.w.toFixed(1)}`);
  console.log(`   name after : x=${after.name?.x.toFixed(1)} w=${after.name?.w.toFixed(1)}`);
  console.log(`   header bottom=${after.header?.bottom.toFixed(1)}  sub top=${after.sub?.top ?? "—"} y=${after.sub?.y?.toFixed?.(1) ?? "—"}`);
  console.log(`   sub x=${after.sub?.x?.toFixed?.(1)} li x=${after.li?.x?.toFixed?.(1)}`);

  t(!!after.sub, "ul.sk-sublist появился после клика");
  const fwChanged = before.fw !== after.fw;
  t(near(before.name.x, after.name.x) && (near(before.name.w, after.name.w) || (fwChanged && near(before.name.x, after.name.x))),
    `название НЕ сдвинулось (x без изменений${fwChanged ? "; w изменил начертание .active " + before.fw + "→" + after.fw : ""})`);
  t(after.sub.y >= after.header.bottom - EPS, "подрубрики НИЖЕ заголовка (vertical stack)");
  t(after.sub.x > after.li.x + 5, "подрубрики с отступом слева");
  t(after.arrow && after.arrow.y >= after.header.y - EPS && after.arrow.bottom <= after.header.bottom + EPS,
    "стрелка осталась в строке заголовка");
  const sidebar = await rect(page, ".sk-col-left");
  t(after.sub.right <= sidebar.right + EPS, "подрубрики не вылезают за правый край сайдбара");

  // свернуть
  await page.click(toggleSel);
  await page.waitForSelector(sub, { state: "hidden", timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(120);

  const closed = { name: await rect(page, name) };
  t(near(before.name.x, closed.name.x) && near(before.name.w, closed.name.w), "после сворачивания название НЕ сдвинулось");
  const gone = (await page.$(sub)) === null;
  t(gone, "после сворачивания ul.sk-sublist удалён из DOM");
}

async function main() {
  const browser = await chromium.launch();
  const failures = [];
  const shotTargets = [];

  // ---------- Страница 1: Главная/форум (page.tsx) ----------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector("li.sk-rubric-row .sk-rubric-name", { timeout: 30000 });

    // присвоить тестовые id строкам с подрубриками (в page.tsx стрелка внутри .sk-rubric-name)
    const expandable = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("li.sk-rubric-row").forEach((li) => {
        if (li.querySelector(".sk-rubric-name .arr")) out.push(li.querySelector(".sk-rubric-name").textContent.trim());
      });
      return out;
    });
    console.log("Главная: рубрики со стрелкой:", JSON.stringify(expandable));

    let idx = 0;
    for (const name of expandable.slice(0)) {
      const id = `t${idx++}`;
      await page.evaluate(({ name, id }) => {
        const li = [...document.querySelectorAll("li.sk-rubric-row")].find(
          (l) => l.querySelector(".sk-rubric-name")?.textContent.trim() === name
        );
        li.id = id;
      }, { name, id });
      await checkRubric(page, id, `#${id} .sk-rubric-name`, `Главная / рубрика «${name}» (клик по названию)`, failures);
      if (shotTargets.length === 0) shotTargets.push({ page, name });
    }

    // —— рубрики БЕЗ подрубрик: иконка/название тоже в одной строке ——
    const plain = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("li.sk-rubric-row").forEach((li) => {
        if (!li.querySelector(".sk-rubric-name .arr") && !li.querySelector(".sk-rubric-arr")) {
          out.push(li.querySelector(".sk-rubric-name").textContent.trim());
        }
      });
      return out;
    });
    console.log("\nГлавная: рубрики БЕЗ подрубрик:", JSON.stringify(plain));
    let pidx = 0;
    for (const name of plain) {
      const id = `hp${pidx++}`;
      await page.evaluate(({ name, id }) => {
        const li = [...document.querySelectorAll("li.sk-rubric-row")].find(
          (l) => l.querySelector(".sk-rubric-name")?.textContent.trim() === name
        );
        li.id = id;
      }, { name, id });
      console.log(`\n== Главная / рубрика «${name}» (без подрубрик) ==`);
      await checkIconNameRow(page, id, `Главная / «${name}»`, failures);
    }

    // —— все иконки выровнены по левому краю одинаково ——
    const iconXs = await page.evaluate(() =>
      [...document.querySelectorAll("li.sk-rubric-row .sk-rubric-header .sk-navico")].map((s) => s.getBoundingClientRect().x)
    );
    const aligned = iconXs.length > 0 && Math.max(...iconXs) - Math.min(...iconXs) <= 1.5;
    console.log(`\n   ${aligned ? "OK " : "FAIL"} все иконки на одной вертикали (x: ${Math.min(...iconXs).toFixed(1)}..${Math.max(...iconXs).toFixed(1)}, n=${iconXs.length})`);
    if (!aligned) failures.push("Главная: иконки не выровнены по левому краю");

    // —— перенос длинного названия: иконка остаётся на первой строке слева ——
    const wrap = await page.evaluate(() => {
      const li = [...document.querySelectorAll("li.sk-rubric-row")].find(
        (l) => l.querySelector(".sk-rubric-name")?.textContent.includes("Горные лыжи")
      );
      const header = li.querySelector(".sk-rubric-header");
      const icon = li.querySelector(".sk-navico");
      const name = li.querySelector(".sk-rubric-name");
      const prev = header.style.width;
      header.style.width = "90px";
      const ir = icon.getBoundingClientRect();
      const nr = name.getBoundingClientRect();
      header.style.width = prev;
      return { iconY: ir.y, nameY: nr.y, nameH: nr.height, wrapped: nr.height > 30 };
    });
    const wrapOk = wrap.wrapped && Math.abs(wrap.iconY - wrap.nameY) <= 6;
    console.log(`   ${wrapOk ? "OK " : "FAIL"} перенос длинного названия: текст перенесся (nameH=${wrap.nameH.toFixed(1)}), иконка осталась на первой строке (iconY=${wrap.iconY.toFixed(1)}, nameY=${wrap.nameY.toFixed(1)})`);
    if (!wrapOk) failures.push("Главная: перенос длинного названия ломает строку иконки");

    // скриншот раскрытой рубрики
    {
      const { page: p, name } = shotTargets[0];
      const id = "shot";
      await page.evaluate(({ name, id }) => {
        const li = [...document.querySelectorAll("li.sk-rubric-row")].find(
          (l) => l.querySelector(".sk-rubric-name")?.textContent.trim() === name
        );
        li.id = id;
      }, { name, id });
      await p.click(`#${id} .sk-rubric-name`);
      await p.waitForSelector(`#${id} ul.sk-sublist`, { timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(150);
      const aside = await p.$(".sk-col-left");
      await aside.screenshot({ path: "/home/z/my-project/download/sidebar-vertical-home.png" });
      console.log("Скриншот: /home/z/my-project/download/sidebar-vertical-home.png");
    }
    await page.close();
  }

  // ---------- Страница 2: /weather.php (left-nav.tsx, ForumSideNav) ----------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE + "/weather.php", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector("li.sk-rubric-row .sk-rubric-arr", { timeout: 30000 });

    const expandable = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("li.sk-rubric-row").forEach((li) => {
        if (li.querySelector(".sk-rubric-arr")) out.push(li.querySelector(".sk-rubric-name").textContent.trim());
      });
      return out;
    });
    console.log("\nweather.php: рубрики со стрелкой:", JSON.stringify(expandable));

    let idx = 0;
    for (const name of expandable.slice(0)) {
      const id = `w${idx++}`;
      await page.evaluate(({ name, id }) => {
        const li = [...document.querySelectorAll("li.sk-rubric-row")].find(
          (l) => l.querySelector(".sk-rubric-name")?.textContent.trim() === name
        );
        li.id = id;
      }, { name, id });
      await checkRubric(page, id, `#${id} .sk-rubric-arr`, `weather.php / рубрика «${name}» (клик по стрелке)`, failures);
    }

    // —— рубрики БЕЗ подрубрик + выравнивание иконок ——
    const plainW = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("li.sk-rubric-row").forEach((li) => {
        if (!li.querySelector(".sk-rubric-name .arr") && !li.querySelector(".sk-rubric-arr")) {
          out.push(li.querySelector(".sk-rubric-name").textContent.trim());
        }
      });
      return out;
    });
    let pwidx = 0;
    for (const name of plainW) {
      const id = `wp${pwidx++}`;
      await page.evaluate(({ name, id }) => {
        const li = [...document.querySelectorAll("li.sk-rubric-row")].find(
          (l) => l.querySelector(".sk-rubric-name")?.textContent.trim() === name
        );
        li.id = id;
      }, { name, id });
      console.log(`\n== weather.php / рубрика «${name}» (без подрубрик) ==`);
      await checkIconNameRow(page, id, `weather.php / «${name}»`, failures);
    }
    const iconXsW = await page.evaluate(() =>
      [...document.querySelectorAll("li.sk-rubric-row .sk-rubric-header .sk-navico")].map((s) => s.getBoundingClientRect().x)
    );
    const alignedW = iconXsW.length > 0 && Math.max(...iconXsW) - Math.min(...iconXsW) <= 1.5;
    console.log(`\n   ${alignedW ? "OK " : "FAIL"} все иконки на одной вертикали (x: ${Math.min(...iconXsW).toFixed(1)}..${Math.max(...iconXsW).toFixed(1)}, n=${iconXsW.length})`);
    if (!alignedW) failures.push("weather.php: иконки не выровнены по левому краю");

    // скриншот раскрытой первой рубрики
    {
      const name = expandable[0];
      await page.evaluate(({ name }) => {
        const li = [...document.querySelectorAll("li.sk-rubric-row")].find(
          (l) => l.querySelector(".sk-rubric-name")?.textContent.trim() === name
        );
        li.id = "shotw";
      }, { name });
      await page.click(`#shotw .sk-rubric-arr`);
      await page.waitForSelector(`#shotw ul.sk-sublist`, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(150);
      const aside = await page.$(".sk-col-left");
      await aside.screenshot({ path: "/home/z/my-project/download/sidebar-vertical-weather.png" });
      console.log("Скриншот: /home/z/my-project/download/sidebar-vertical-weather.png");
    }
    await page.close();
  }

  await browser.close();
  console.log("\n================ ИТОГ ================");
  if (failures.length === 0) {
    console.log("ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ — раскладка вертикальная, названия не сдвигаются");
  } else {
    console.log(`ПРОВАЛЕНО ${failures.length}:`);
    failures.forEach((f) => console.log(" - " + f));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
