// Приёмка: клик по ячейке почасовки + крупный план карточки «Погода»
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

await page.goto("http://127.0.0.1:3000/weather.php", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);

// Клик по второй ячейке (не current) → панель .hour-details должна открыться
const second = page.locator(".hour-cell").nth(1);
await second.click();
await page.waitForTimeout(400);
const details = await page.evaluate(() => {
  const d = document.querySelector(".hour-details");
  const cell = document.querySelectorAll(".hour-cell")[1];
  return {
    detailsText: d ? d.textContent.slice(0, 90) : "NO_DETAILS",
    cellClass: cell?.className ?? "",
    cellBgAfterSelect: cell ? getComputedStyle(cell).backgroundColor : "",
  };
});
console.log("CLICK PROBE:", JSON.stringify(details, null, 2));

// Крупный план карточки «Погода»
const card = page.locator('section.mp-panel[aria-label="Погода в Южно-Сахалинске"]');
await card.screenshot({ path: "/home/z/my-project/scripts/shots/hdr-after-weather-card.png" });

console.log("CONSOLE/PAGE ERRORS:", errors.length ? errors.join(" | ") : "none");
await browser.close();
