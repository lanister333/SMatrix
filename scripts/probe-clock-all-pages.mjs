// Проба «часы на всех страницах»: на каждом маршруте должен быть
// ВИДИМЫЙ блок #sakh-time, который ТИКАЕТ (текст меняется за 1.3с).
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const ROUTES = [
  "/",                      // Главная (HomeRight)
  "/?view=forum",           // SPA-вид форума (не home) — часы добавлены
  "/?topic=1",              // страница темы SPA (не home) — часы добавлены
  "/weather.php",
  "/currency.php",
  "/traffic.php",
  "/disconnections.php",
  "/about.php",
  "/rules.php",
  "/feedback.php",
  "/obyavleniya",           // 10 разделов — часы добавлены
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

async function main() {
  const browser = await chromium.launch();
  const failures = [];

  for (const route of ROUTES) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    try {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector("#sakh-time", { state: "visible", timeout: 30000 });
      await page.waitForTimeout(300);

      const first = await page.evaluate(() => {
        const el = document.querySelector("#sakh-time");
        const r = el.getBoundingClientRect();
        const panel = el.closest('[aria-label="Сахалинское время"]');
        const pr = panel ? panel.getBoundingClientRect() : null;
        return {
          text: el.textContent,
          visible: r.width > 0 && r.height > 0,
          rightCol: !!panel?.closest(".right-column"),
          panelTop: pr ? Math.round(pr.top + window.scrollY) : null,
          date: document.querySelector("#sakh-date")?.textContent,
        };
      });

      await page.waitForTimeout(1300);
      const second = await page.evaluate(() => document.querySelector("#sakh-time")?.textContent);

      const ticks = first.text !== second && /^\d{2}:\d{2}:\d{2}$/.test(first.text ?? "");
      const ok = first.visible && ticks && first.rightCol;
      console.log(`${ok ? "OK " : "FAIL"} ${route.padEnd(22)} время=${first.text} → ${second}  дата="${first.date}"  правая_колонка=${first.rightCol}  верх_панели=${first.panelTop}px`);
      if (!ok) failures.push(route);
    } catch (e) {
      console.log(`FAIL ${route.padEnd(22)} — ${e.message.split("\n")[0]}`);
      failures.push(route);
    }
    await page.close();
  }

  await browser.close();
  console.log("\n================ ИТОГ ================");
  if (failures.length === 0) {
    console.log(`ЧАСЫ ЕСТЬ И ТИКАЮТ НА ВСЕХ ${ROUTES.length} СТРАНИЦАХ`);
  } else {
    console.log(`ПРОВАЛЕНО ${failures.length}: ${failures.join(", ")}`);
    process.exit(1);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
