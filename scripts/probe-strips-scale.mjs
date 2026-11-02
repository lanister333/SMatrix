// Пробы: бирюзовые полоски удалены? + цвета бейджей по температуре
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.goto("http://127.0.0.1:3000/weather.php", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);

const probe = await page.evaluate(() => {
  const sec = document.querySelector('section.mp-panel[aria-label="Погода в Южно-Сахалинске"]');
  const st = (el) => (el ? getComputedStyle(el) : null);
  const now = st(sec.querySelector(".wth-now"));
  const metric = st(sec.querySelector(".wth-metric"));
  const header = st(sec.querySelector(".mp-paneltitle"));
  const hoursL = st(sec.querySelector(".wth-hours-l"));
  const dailyL = st(sec.querySelector(".wth-daily-l"));
  const details = st(sec.querySelector(".hour-details"));
  const badges = [...sec.querySelectorAll(".hour-cell .hour-temp")].slice(0, 8).map((b) => ({
    t: b.textContent,
    cls: b.className.replace("hour-temp", "").trim(),
    bg: st(b).backgroundColor,
    color: st(b).color,
  }));
  return {
    nowBorderLeft: now?.borderLeftWidth + " " + now?.borderLeftColor,
    metricBorderTop: metric?.borderTopWidth + " " + metric?.borderTopColor,
    headerBorderBottom: header?.borderBottomWidth + " " + header?.borderBottomColor,
    hoursLBorderLeft: hoursL?.borderLeftWidth + " " + hoursL?.borderLeftColor,
    dailyLBorderLeft: dailyL?.borderLeftWidth + " " + dailyL?.borderLeftColor,
    detailsBorderLeft: details ? details.borderLeftWidth + " " + details.borderLeftColor : "closed",
    badges,
  };
});
console.log(JSON.stringify(probe, null, 2));

const card = page.locator('section.mp-panel[aria-label="Погода в Южно-Сахалинске"]');
await card.screenshot({ path: "/home/z/my-project/scripts/shots/scale-weather-card.png" });
await browser.close();
