// Расследование /obyavleniya: что реально рендерится в браузере,
// есть ли гидрация, ошибки консоли, часы, карточки FlatBoard.
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + String(e).slice(0, 200)));

  const resp = await page.goto(BASE + "/obyavleniya", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);

  const state = await page.evaluate(() => ({
    title: document.title,
    status: {
      masthead: !!document.querySelector(".sm-masthead"),
      mainNav: !!document.querySelector('[aria-label="Главная навигация"], .sm-nav, nav'),
      flatBoard: !!document.querySelector('[data-flat-board="ads"]'),
      tabs: document.querySelectorAll('[data-flat-tabs="1"] [role="tab"]').length,
      cards: document.querySelectorAll("[data-flat-card]").length,
      empty: !!document.querySelector("[data-flat-empty]"),
      form: !!document.querySelector('[data-flat-form], form'),
      clock: !!document.querySelector("#sakh-time"),
      rightColumn: !!document.querySelector(".right-column"),
      footer: !!document.querySelector("footer, .sm-footer, .site-footer"),
    },
    bodyTextLen: document.body.innerText.length,
    bodySample: document.body.innerText.slice(0, 300),
  }));

  console.log("HTTP:", resp.status());
  console.log("STATE:", JSON.stringify(state, null, 2));
  console.log("CONSOLE ERRORS:", consoleErrors.length ? consoleErrors : "нет");
  await page.screenshot({ path: "/home/z/my-project/scripts/tmp-obyav-investigate.png", fullPage: false });
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
