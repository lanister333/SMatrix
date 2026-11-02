import { CURRENCIES } from "../src/lib/currency-parser";

const fs = require("fs");
const html = fs.readFileSync("/home/z/my-project/scripts/primbank_main.html", "utf8");
console.log("Page size:", html.length);

const rates = [];
for (const code of CURRENCIES) {
  const re = new RegExp(
    'exchange-rates__currency[^>]*>\\s*' + code + '\\s*<div class="exchange-rates__unit">([^<]+)</div>' +
    '[\\s\\S]*?exchange-rates__value[^"]*">([^<]+)</div>' +
    '[\\s\\S]*?exchange-rates__value[^"]*">([^<]+)</div>',
  );
  const m = html.match(re);
  if (m) {
    rates.push({ code, buy: parseFloat(m[2].replace(",", ".").trim()), sell: parseFloat(m[3].replace(",", ".").trim()), unit: m[1] });
  }
}
console.log("Main page rates:", rates);
