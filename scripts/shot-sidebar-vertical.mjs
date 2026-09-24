// Чистые скриншоты сайдбара: до раскрытия / с раскрытой «Авто, Мото».
import { chromium } from "playwright";
const BASE = "http://127.0.0.1:3000";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("li.sk-rubric-row .sk-rubric-name", { timeout: 30000 });

  const aside = await page.$(".sk-col-left");
  await aside.screenshot({ path: "/home/z/my-project/download/sidebar-vertical-closed.png" });

  // раскрыть «Авто, Мото» кликом по названию
  await page.evaluate(() => {
    const li = [...document.querySelectorAll("li.sk-rubric-row")].find(
      (l) => l.querySelector(".sk-rubric-name")?.textContent.trim().startsWith("Авто, Мото")
    );
    li.querySelector(".sk-rubric-name").click();
  });
  await page.waitForSelector("li.sk-rubric-row ul.sk-sublist", { timeout: 5000 });
  await page.waitForTimeout(200);
  await aside.screenshot({ path: "/home/z/my-project/download/sidebar-vertical-open-auto.png" });
  console.log("OK: sidebar-vertical-closed.png, sidebar-vertical-open-auto.png");
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
