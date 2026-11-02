/**
 * Test primbank.ru parser with new exchange-rates__currency regex.
 */
import { CURRENCIES } from "../src/lib/currency-parser";

function normalizeToUnit(currency: string, v: number): number {
  const unit = currency === "JPY" || currency === "KRW" ? 1000 : 1;
  if (unit > 1 && isFinite(v) && v > 0) {
    if (currency === "KRW" && v < 5) return Math.round(v * unit * 100) / 100;
    if (currency === "JPY") {
      if (v < 5) return Math.round((v * unit) / 10 * 100) / 100;
      return v;
    }
    return v;
  }
  return v;
}

function parsePrimbank(html: string, bankName: string) {
  const rates = [];
  const seen = new Set<string>();
  for (const code of CURRENCIES) {
    if (seen.has(code)) continue;
    // primbank.ru format: 
    // <div class="exchange-rates__currency"...>USD    <div class="exchange-rates__unit">1 $</div>
    // </div></div>
    // <div class="exchange-rates__table-cell ">
    //   <div class="exchange-rates__value dec">82.21</div>
    // </div>
    // <div class="exchange-rates__table-cell ">
    //   <div class="exchange-rates__value dec">90.75</div>
    // </div>
    const re = new RegExp(
      'exchange-rates__currency[^>]*>\\s*' + code + '\\s*<div class="exchange-rates__unit">([^<]+)</div>' +
      '[\\s\\S]*?exchange-rates__value[^"]*">([^<]+)</div>' +
      '[\\s\\S]*?exchange-rates__value[^"]*">([^<]+)</div>',
    );
    const m = html.match(re);
    if (m) {
      const unitLabel = m[1];
      let buy = parseFloat(m[2].replace(",", ".").trim());
      let sell = parseFloat(m[3].replace(",", ".").trim());
      // primbank's data-unit tells us the unit:
      // USD/EUR/CNY per 1, JPY per 100, KRW per 1000
      // For JPY we keep per-100¥ value (convention: per-100¥ under "за 1000")
      if (isFinite(buy) && isFinite(sell) && buy > 0 && sell > 0) {
        seen.add(code);
        rates.push({ bank: bankName, currency: code, buy, sell, unitLabel, raw: m[0].slice(0, 200) });
        continue;
      }
    }
  }
  return rates;
}

const fs = require("fs");
const html = fs.readFileSync("/home/z/my-project/scripts/primbank_currency.html", "utf8");
console.log("Page size:", html.length);

console.log("\n=== Parsing primbank.ru/currency/ (new exchange-rates__currency regex) ===");
const rates = parsePrimbank(html, "Приморье");
console.log("Found rates:", rates.length);
for (const r of rates) {
  console.log(`  ${r.currency}: buy=${r.buy} sell=${r.sell} (unit: ${r.unitLabel})`);
}

console.log("\n=== Expected values from page ===");
console.log("  USD: 82.21 / 90.75 (per 1$)");
console.log("  EUR: 95.55 / 104.50 (per 1€)");
console.log("  CNY: 12.46 / 12.81 (per 1Ұ)");
console.log("  JPY: 51.32 / 100.00 (per 100¥)");
console.log("  KRW: 55.11 / 100.00 (per 1000₩)");
