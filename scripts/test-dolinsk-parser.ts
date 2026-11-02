/**
 * Test direct parser against fetched dolinskbank.ru page.
 * Confirms we extract USD/EUR/JPY/CNY rates correctly.
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

function parseDirectBankPage(html: string, bankName: string) {
  const rates = [];
  const seen = new Set<string>();
  for (const code of CURRENCIES) {
    if (seen.has(code)) continue;

    // Формат 1 (atb.su / primbank.ru)
    const idx1 = html.indexOf(code + "</div>");
    if (idx1 > -1) {
      const chunk = html.slice(idx1, idx1 + 800);
      const nums = chunk.match(/(\d+\.\d+)/g);
      if (nums && nums.length >= 2) {
        const buy = normalizeToUnit(code, parseFloat(nums[0]));
        const sell = normalizeToUnit(code, parseFloat(nums[1]));
        if (isFinite(buy) && isFinite(sell) && buy > 0 && sell > 0) {
          seen.add(code);
          rates.push({ bank: bankName, currency: code, buy, sell });
          continue;
        }
      }
    }

    // Формат 2 (dolinskbank.ru)
    const re2 = new RegExp(code + "</b>.*?unit_symbol\">([^<]+)</span>.*?(\\d+[.,]\\d+).*?(\\d+[.,]\\d+)", "s");
    const m2 = html.match(re2);
    if (m2) {
      const unitLabel = m2[1];
      let buy = parseFloat(m2[2].replace(",", "."));
      let sell = parseFloat(m2[3].replace(",", "."));
      if (code === "CNY" && unitLabel.includes("10")) { buy /= 10; sell /= 10; }
      // JPY за 100¥ → не умножаем (конвенция сайта: per-100¥ labeled «за 1000»)
      if (isFinite(buy) && isFinite(sell) && buy > 0 && sell > 0) {
        seen.add(code);
        rates.push({ bank: bankName, currency: code, buy, sell, unitLabel });
        continue;
      }
    }
  }
  return rates;
}

const fs = require("fs");
const html = fs.readFileSync("/home/z/my-project/scripts/dolinskbank_main.html", "utf8");
console.log("Page size:", html.length);

console.log("\n=== Parsing dolinskbank.ru (active BNAL:STR table) ===");
const rates = parseDirectBankPage(html, "Долинск Банк");
console.log("Found rates:", rates.length);
for (const r of rates) {
  console.log(`  ${r.currency}: buy=${r.buy} sell=${r.sell} (unit: ${r.unitLabel || "1"})`);
}

console.log("\n=== Expected values from page (BNAL:STR active table) ===");
console.log("  USD: 80.4547 / 89.1270 (per 1$)");
console.log("  EUR: 92.3040 / 102.3256 (per 1€)");
console.log("  JPY: 50.8446 / 56.9000 (per 100¥ → ×10 = 508.446 / 569.00 per 1000¥)");
console.log("  CNY: 121.2403 / 131.6752 (per 10¥ → ÷10 = 12.12 / 13.17 per 1¥)");
console.log("  KRW: NOT on dolinskbank page (will be dashes)");
