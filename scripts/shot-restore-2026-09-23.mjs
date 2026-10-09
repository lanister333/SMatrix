/* Скриншоты реставрации + консоль. */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const b = await chromium.launch();
const SHOTS = [
  ["restore-currency-1920-2026-09-23.png", "/currency.php", 1920],
  ["restore-topic183-1920-2026-09-23.png", "/?topic=183", 1920],
  ["restore-znakomstva-1920-2026-09-23.png", "/znakomstva", 1920],
  ["restore-home-1920-2026-09-23.png", "/", 1920],
  ["restore-home-375-2026-09-23.png", "/", 375],
];
for (const [file, url, w] of SHOTS) {
  const pg = await b.newPage({ viewport: { width: w, height: 940 } });
  const errs = [];
  pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 100)); });
  pg.on("pageerror", (e) => errs.push("PAGEERROR " + String(e).slice(0, 100)));
  await pg.goto(BASE + url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await pg.waitForTimeout(1800);
  await pg.screenshot({ path: "download/" + file });
  console.log(`${file}: консоль ${errs.length === 0 ? "чистая" : "ОШИБКИ: " + errs.join(" || ")}`);
  await pg.close();
}
await b.close();
