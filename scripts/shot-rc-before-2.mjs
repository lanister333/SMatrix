// Скриншот страницы «Рекомендую / Не рекомендую» ДО правок (полная страница)
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = process.argv[2] || "scripts/shot-rc-before-2.png";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/rekomenduyu`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT, fullPage: true });
console.log("saved:", OUT);
await browser.close();
