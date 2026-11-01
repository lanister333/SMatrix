import { chromium } from "playwright";
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1920, height: 940 } });
const bad = [];
pg.on("response", (r) => { if (r.status() === 404) bad.push(r.url()); });
await pg.goto("http://localhost:3000/?topic=183", { waitUntil: "networkidle", timeout: 45000 }).catch(()=>{});
await pg.waitForTimeout(2000);
console.log("404 URLs:", bad.slice(0, 5));
await b.close();
