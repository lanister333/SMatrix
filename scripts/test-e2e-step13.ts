/** ШАГ 13: быстрый e2e-контроль ключевых пользовательских потоков после визуальной полировки */
const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
function ok(name: string, cond: boolean) { if (cond) { pass++; console.log("  ✓", name); } else { fail++; console.log("  ✗", name); } }

async function main() {
  // 1. Страницы отвечают
  for (const u of ["/", "/?topic=26", "/?view=rules", "/?view=about", "/?view=appeal", "/?view=ads", "/?view=info", "/?view=directory", "/?user=Админ"]) {
    const r = await fetch(BASE + u);
    ok(`GET ${u} → 200`, r.status === 200);
  }
  // 2. API живы
  const boot = await (await fetch(BASE + "/api/bootstrap")).json();
  ok("bootstrap: рубрики + настройки", Array.isArray(boot.rubrics) && boot.rubrics.length > 0 && !!boot.settings);
  const topics = await (await fetch(BASE + "/api/topics?page=1&perPage=5")).json();
  ok("topics: список отдаётся", Array.isArray(topics.topics) && topics.topics.length > 0);
  const search = await (await fetch(BASE + "/api/search?q=краб")).json();
  ok("search: работает", Array.isArray(search.results));
  // 3. Точные строки ШАГА 10 не сломаны (проверка констант через модерацию)
  const { PROFANITY_BLOCK_MESSAGE, COMPLAINT_CONFIRM_MESSAGE } = await import("../src/lib/moderation/index");
  ok("точный текст блокировки лексики", PROFANITY_BLOCK_MESSAGE === "Сообщение содержит нецензурную или оскорбительную лексику. Пожалуйста, отредактируйте текст и попробуйте снова.");
  ok("точное подтверждение жалобы", COMPLAINT_CONFIRM_MESSAGE === "Жалоба отправлена. Спасибо. Модерация рассмотрит сообщение.");

  console.log(`\nИТОГ: ${pass} ✓ / ${fail} ✗`);
  if (fail > 0) process.exit(1);
}
main();
