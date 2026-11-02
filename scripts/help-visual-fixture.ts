/**
 * Визуальная проверка /help: создать длинное объявление (админ), в конце — удалить.
 * usage: tsx scripts/help-visual-fixture.ts create|delete <id>
 */
const BASE = "http://localhost:3000";

async function main() {
  const mode = process.argv[2] ?? "create";
  const login = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@sakhmatrix.ru", password: "Admin2026" }),
  }).then((r) => r.json());
  const token: string = login?.user?.token ?? "";
  if (!token) throw new Error("no admin token");

  if (mode === "cleanall") {
    const list = await fetch(BASE + "/api/help").then((r) => r.json());
    const ids: string[] = (list.requests ?? [])
      .filter((q: { title: string; authorName: string }) => q.title.includes("Длинная проверочная") || q.authorName.startsWith("HelpTest_"))
      .map((q: { id: string }) => q.id);
    for (const id of ids) {
      await fetch(BASE + "/api/help/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "delete" }),
      });
    }
    console.log("DELETED:", ids.join(", ") || "ничего");
    return;
  }

  if (mode === "create") {
    const longBody =
      "Очень длинная проверочная просьба: нужна помощь с вывозом вещей из гаража на окраине, " +
      "есть тяжёлые коробки с книгами и старая мебель, которую надо спустить со второго этажа без лифта. " +
      "Длинноесловобезпробеловдляпроверкипереносатекставузкомэкранемобильногоустройства." +
      " Ещё немного текста для заполнения высоты карточки: надеюсь на отзывчивых людей, " +
      "готов угостить чаем и показать фотографии до и после разгрузки, время — в любой удобный день.";
    const r = await fetch(BASE + "/api/help", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        title: "Длинная проверочная просьба о помощи с гаражом и вещами",
        text: longBody,
        contactData: "+7 900 000-00-00, telegram @helpcheck",
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "post failed");
    console.log("CREATED_ID=" + d.id);
  } else {
    const id = process.argv[3] ?? "";
    const r = await fetch(BASE + "/api/help/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "delete" }),
    });
    console.log("DELETE_STATUS=" + r.status);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
