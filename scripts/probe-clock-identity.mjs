// Проба «часы выглядят одинаково на всех страницах»: сравниваем computed
// стили и геометрию блока Сахалинских часов на каждой странице с ЭТАЛОНОМ
// (Главная /). Проверяем: шапку, тело, дату, время, контейнер — цвета,
// шрифты, размеры, рамки, отступы, ширину/высоту панели.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:3000";
// Режимы: --save <file> — сохранить эталон с Главной; --check <file> —
// сверить Главную с сохранённым ДО-фиксным эталоном (дизайн не изменился).
const savePath = process.argv.includes("--save") ? process.argv[process.argv.indexOf("--save") + 1] : null;
const checkPath = process.argv.includes("--check") ? process.argv[process.argv.indexOf("--check") + 1] : null;
const ROUTES = [
  "/",                      // Главная — ЭТАЛОН
  "/?view=forum",           // SPA-вид форума
  "/?topic=1",              // страница темы SPA
  "/weather.php",
  "/currency.php",
  "/traffic.php",
  "/disconnections.php",
  "/about.php",
  "/rules.php",
  "/feedback.php",
  "/obyavleniya",
  "/o-rabotodatelyah",
  "/gde-deshevle",
  "/gde-kupit",
  "/gkh",
  "/help",
  "/podslyshano",
  "/poleznoe",
  "/rekomenduyu",
  "/znakomstva",
];

// Снимаем дамп внешнего вида блока часов
async function snapshot(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[aria-label="Сахалинское время"]');
    if (!panel) return null;
    const cs = (el) => {
      const s = getComputedStyle(el);
      return {
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        color: s.color,
        backgroundColor: s.backgroundColor,
        border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
        borderBottom: `${s.borderBottomWidth} ${s.borderBottomStyle} ${s.borderBottomColor}`,
        borderRadius: s.borderRadius,
        boxShadow: s.boxShadow,
        padding: s.padding,
        margin: s.margin,
        lineHeight: s.lineHeight,
        textAlign: s.textAlign,
        textTransform: s.textTransform,
        fontVariant: s.fontVariant,
        fontVariantNumeric: s.fontVariantNumeric,
      };
    };
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
    };
    const header = panel.children[0];
    const body = panel.children[1];
    const date = document.querySelector("#sakh-date");
    const time = document.querySelector("#sakh-time");
    const col = panel.closest(".right-column");
    const colR = col ? col.getBoundingClientRect() : null;
    return {
      panel: { rect: rect(panel), style: cs(panel) },
      header: { rect: rect(header), style: cs(header), text: header.textContent },
      body: { rect: rect(body), style: cs(body), display: getComputedStyle(body).display },
      date: { rect: rect(date), style: cs(date), text: date.textContent },
      time: { rect: rect(time), style: cs(time), text: time.textContent },
      column: colR ? { w: +colR.width.toFixed(1), x: +colR.x.toFixed(1) } : null,
    };
  });
}

// Убираем изменчивые поля (текст времени/даты) для сравнения
function stripVolatile(s) {
  if (!s) return null;
  const c = JSON.parse(JSON.stringify(s));
  delete c.date.text;
  delete c.time.text;
  delete c.header.text;
  // y зависит от содержимого над блоком — сравниваем только размеры и x
  delete c.panel.rect.y;
  delete c.header.rect.y;
  delete c.body.rect.y;
  delete c.date.rect.y;
  delete c.time.rect.y;
  return c;
}

async function main() {
  const browser = await chromium.launch();
  let reference = null;
  const failures = [];

  // Режим --save: только Главная, сохранить эталон в файл
  if (savePath) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#sakh-time", { state: "visible", timeout: 30000 });
    await page.waitForTimeout(400);
    const snap = await snapshot(page);
    writeFileSync(savePath, JSON.stringify(stripVolatile(snap), null, 2));
    console.log(`ЭТАЛОН ГЛАВНОЙ СОХРАНЁН → ${savePath} (панель ${snap.panel.rect.w}x${snap.panel.rect.h})`);
    await browser.close();
    return;
  }

  // Режим --check: загрузить ДО-фиксный эталон для сверки Главной
  const prefixRef = checkPath ? JSON.parse(readFileSync(checkPath, "utf8")) : null;

  for (const route of ROUTES) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    try {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector("#sakh-time", { state: "visible", timeout: 30000 });
      await page.waitForTimeout(400);
      const snap = await snapshot(page);
      if (!snap) {
        console.log(`FAIL ${route.padEnd(20)} — блок часов не найден`);
        failures.push(route);
        continue;
      }
      const ref = route === "/" ? (reference = stripVolatile(snap)) : reference;
      if (!ref) { await page.close(); continue; }

      const cur = stripVolatile(snap);
      const diffs = [];
      const walk = (a, b, path, out) => {
        if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
          const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
          for (const k of keys) walk(a[k], b[k], `${path}.${k}`, out);
        } else if (String(a) !== String(b)) {
          out.push(`${path}: эталон=${a} | страница=${b}`);
        }
      };
      walk(ref, cur, "", diffs);

      // Главная дополнительно сверяется с ДО-фиксным эталоном
      if (route === "/" && prefixRef) {
        const prefixDiffs = [];
        walk(prefixRef, cur, "", prefixDiffs);
        if (prefixDiffs.length === 0) {
          console.log(`     Главная соответствует ДО-фиксному эталону — дизайн не изменился`);
        } else {
          console.log(`     !!! Главная ОТЛИЧАЕТСЯ от ДО-фиксного эталона (${prefixDiffs.length}):`);
          for (const d of prefixDiffs.slice(0, 12)) console.log(`     ${d}`);
          failures.push(route + " [vs до-фиксный эталон]");
        }
      }

      if (diffs.length === 0) {
        console.log(`OK   ${route.padEnd(20)} — идентичен Главной (панель ${snap.panel.rect.w}x${snap.panel.rect.h})`);
      } else {
        console.log(`DIFF ${route.padEnd(20)} — ${diffs.length} отличий:`);
        for (const d of diffs.slice(0, 12)) console.log(`     ${d}`);
        failures.push(route);
      }
    } catch (e) {
      console.log(`FAIL ${route.padEnd(20)} — ${e.message.split("\n")[0]}`);
      failures.push(route);
    }
    await page.close();
  }

  await browser.close();
  console.log("\n================ ИТОГ ================");
  if (failures.length === 0) {
    console.log(`БЛОК ЧАСОВ ВИЗУАЛЬНО ИДЕНТИЧЕН ГЛАВНОЙ НА ВСЕХ ${ROUTES.length} СТРАНИЦАХ`);
  } else {
    console.log(`ОТЛИЧИЯ НА ${failures.length}: ${failures.join(", ")}`);
    process.exit(1);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
