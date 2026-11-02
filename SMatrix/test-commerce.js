
// Тесты commerce-фильтра через tsx
const cases = [
  // [text, expectedBlocked]
  ["Продам горбушу копчёную 800 руб. хвост", true],
  ["продам машину", true],
  ["Куплю рыбу оптом", true],
  ["горбуша 500 руб", true],
  ["опт + доставка по РФ", true],
  ["торг уместен, самовывоз", true],
  // whitelist / обсуждение
  ["Сколько стоит горбуша?", false],
  ["Цена нормальная, беру", false],
  ["Купил вчера горбушу, вкусная", false],
  ["Продаётся в магазине на Ленина", false],
  ["Дорого просят", false],
  ["Ехал через перекрёсток, пробка большая", false],
  ["Вечером пробка на пуркаева кто как объезжает?", false],
];

const path = require("path");
process.chdir("/opt/smatrix");

(async () => {
  const { checkCommerce } = await import("./src/lib/moderation/commerce.ts");
  let pass = 0, fail = 0;
  for (const [text, expected] of cases) {
    const r = checkCommerce(text);
    const ok = r.blocked === expected;
    console.log(`${ok ? "PASS" : "FAIL"} | expected=${expected} got=${r.blocked} | ${text} | reason=${r.reason || "-"} | hits=${r.hits.map(h=>h.word).join(",")}`);
    if (ok) pass++; else fail++;
  }
  console.log(`\nTotal: ${pass}/${cases.length} passed, ${fail} failed`);
})();
