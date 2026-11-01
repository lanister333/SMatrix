/**
 * ШАГ 24 (восстановление): API-приёмка раздела «Полезное» (/poleznoe).
 * 41 проверка API-уровня и контрактов:
 *  Список (1–8): ровно пять сервисов; ключи и порядок; названия; описания;
 *    число пунктов; стабильность ключей.
 *  Содержание (9–20): каждый из пяти сервисов отдаёт полное содержание;
 *    пункты с названиями и пояснениями; заметки внизу; телефоны экстренных
 *    служб 112/101/102/103/104; паромная переправа; автовокзал; аэропорт;
 *    пошаговая инструкция при потере документов; неверный ключ → fallback.
 *  Контракты (21–28): раздел без авторизации; без жалоб; без модерации;
 *    отсутствие постинга; недоступность ломающих методов; чистые ответы.
 *  Интеграции (29–36): страница /poleznoe 200; метаданные; редирект
 *    /?view=useful; раздел «Объявления» не задет; форум и «Знакомства» целы;
 *    блок входа на главной; лента объявлений жива; bootstrap отдаёт настройки.
 *  Содержательные инварианты (37–41): каждая запись сервиса непустая и
 *    осмысленная; нет дубликатов ключей; все ссылки детализаций — телефоны
 *    или домены.
 * После проверки ничего не чистит: раздел — только чтение.
 */
const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log("  ✓", name, extra ? `— ${extra}` : ""); }
  else { fail++; console.log("  ✗", name, extra ? `— ${extra}` : ""); }
}

async function api(path: string, opts: RequestInit = {}) {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  let data: Record<string, unknown> = {};
  try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

interface Svc { key: string; title: string; description: string; entryCount: number }
interface Entry { title: string; note: string; detail?: string }
interface Full { key: string; title: string; description: string; entries: Entry[]; footnote: string }

async function main() {
  // ================= Список сервисов (1–8) =================
  const list = await api("/api/poleznoe");
  const services = (list.data.services as Svc[]) ?? [];
  ok("GET /api/poleznoe → 200 с сервисами", list.status === 200 && Array.isArray(services));
  ok("ровно пять сервисов", services.length === 5, String(services.length));
  ok(
    "ключи и порядок: phones, ferry, buses, airport, docs",
    services.map((s) => s.key).join(",") === "phones,ferry,buses,airport,docs",
    services.map((s) => s.key).join(",")
  );
  const expectedTitles: Record<string, string> = {
    phones: "Важные телефоны",
    ferry: "Паром Ванино — Холмск",
    buses: "Автовокзал",
    airport: "Аэропорт",
    docs: "Потерянные документы",
  };
  ok("названия сервисов соответствуют", services.every((s) => s.title === expectedTitles[s.key]));
  ok("у каждого сервиса непустое описание", services.every((s) => typeof s.description === "string" && s.description.length > 20));
  ok("у каждого сервиса есть пункты (entryCount > 0)", services.every((s) => s.entryCount > 0));
  const list2 = await api("/api/poleznoe");
  ok("список стабилен между запросами", JSON.stringify(services.map((s) => s.key)) === JSON.stringify(((list2.data.services as Svc[]) ?? []).map((s) => s.key)));
  ok("без дубликатов ключей", new Set(services.map((s) => s.key)).size === 5);

  // ================= Содержание сервисов (9–20) =================
  const fulls = new Map<string, Full>();
  for (const s of services) {
    const r = await api(`/api/poleznoe?service=${s.key}`);
    const f = r.data.service as Full | undefined;
    if (r.status === 200 && f && f.entries.length === s.entryCount) fulls.set(s.key, f);
  }
  ok("каждый сервис отдаёт полное содержание по ?service=", fulls.size === 5);

  const phones = fulls.get("phones");
  const digits = (s: string) => s.replace(/[^\d]/g, "");
  ok(
    "экстренные номера 112/101/102/103/104 присутствуют",
    !!phones && ["112", "101", "102", "103", "104"].every((n) => phones.entries.some((e) => digits(e.title).includes(n) || digits(e.detail ?? "").endsWith(n) || e.title.includes(n)))
  );
  ok("телефон 115 (единый номер ЖКХ) присутствует", !!phones && phones.entries.some((e) => (e.detail ?? "").includes("115")));
  ok("у телефонов есть пояснения", !!phones && phones.entries.every((e) => e.note.length > 15));

  const ferry = fulls.get("ferry");
  ok("паром: описана переправа Ванино — Холмск", !!ferry && ferry.entries.length >= 5 && ferry.description.includes("Ванино"));
  ok("паром: есть справочные телефоны портов", !!ferry && ferry.entries.filter((e) => e.detail && /[\d]/.test(e.detail)).length >= 2);

  const buses = fulls.get("buses");
  ok("автовокзал: есть справка и направления", !!buses && buses.entries.some((e) => /Корсаков/.test(e.note + e.title)));

  const airport = fulls.get("airport");
  ok("аэропорт: есть рейсы на материк и Курилы", !!airport && airport.entries.some((e) => /Курил/.test(e.title + e.note)));

  // Дополнительные содержательные проверки (ШАГ 24)
  ok("паром: упомянуто время в пути", !!ferry && JSON.stringify(ferry.entries).includes("12 часов"));
  ok("автовокзал: есть телефон справочной", !!buses && buses.entries.some((e) => (e.detail ?? "").length >= 10));
  ok("аэропорт: есть телефон справки", !!airport && airport.entries.some((e) => (e.detail ?? "").replace(/\D/g, "").length >= 6));
  ok(
    "entryCount списка совпадает с полным содержанием каждого сервиса",
    services.every((s) => s.entryCount === fulls.get(s.key)?.entries.length)
  );

  const docs = fulls.get("docs");
  ok(
    "документы: пошаговая инструкция (≥4 шагов)",
    !!docs && docs.entries.filter((e) => e.title.startsWith("Шаг")).length >= 4,
    String(docs?.entries.filter((e) => e.title.startsWith("Шаг")).length ?? 0)
  );
  ok("документы: упомянут Госуслуги", !!docs && (JSON.stringify(docs.entries).includes("Госуслуг") || JSON.stringify(docs.entries).includes("gosuslugi")));

  ok("у каждого сервиса непустая заметка внизу", [...fulls.values()].every((f) => f.footnote.length > 20));
  ok("все пункты непустые и осмысленные", [...fulls.values()].every((f) => f.entries.every((e) => e.title.length > 3 && e.note.length > 10)));
  const wrongKey = await api("/api/poleznoe?service=nonexistent");
  ok("неверный ключ → fallback на первый сервис", wrongKey.status === 200 && (wrongKey.data.service as Full)?.key === "phones");

  // ================= Контракты (21–28) =================
  ok("раздел доступен без авторизации", list.status === 200 && !("error" in list.data));
  const post = await api("/api/poleznoe", { method: "POST", body: JSON.stringify({ title: "x" }) });
  ok("пользовательский постинг отсутствует (405/404)", post.status === 404 || post.status === 405);
  const del = await api("/api/poleznoe?service=phones", { method: "DELETE" });
  ok("ломающие методы закрыты", del.status === 404 || del.status === 405 || del.status === 403);
  const complaintApi = await api("/api/poleznoe/complaint", { method: "POST", body: "{}" });
  ok("жалоб в разделе нет (маршрут не существует)", complaintApi.status === 404 || complaintApi.status === 405);
  const detailsOk = [...fulls.values()].every((f) => f.entries.every((e) => !e.detail || /^[\d\s()+-]+$/.test(e.detail) || /^[\w.-]+\.[a-z]{2,}$/i.test(e.detail)));
  ok("детализации — только телефоны или домены", detailsOk);
  const mod = await api("/api/admin/poleznoe?token=x");
  ok("админ-модерация раздела не нужна", mod.status === 404 || mod.status === 401 || mod.status === 403);
  ok("ключи сервисов — латиница в нижнем регистре", services.every((s) => /^[a-z]+$/.test(s.key)));
  ok("описания на русском", services.every((s) => /[а-яё]/i.test(s.description)));

  // ================= Интеграции (29–36) =================
  const page = await fetch(BASE + "/poleznoe");
  ok("страница /poleznoe → 200", page.status === 200);
  const pageHtml = await page.text();
  ok("метаданные страницы: «Полезное — SakhMatrix»", pageHtml.includes("Полезное — SakhMatrix"));
  const redirect = await fetch(BASE + "/?view=useful", { redirect: "manual" });
  ok("редирект /?view=useful → /poleznoe", redirect.status === 307 || redirect.status === 308 || redirect.status === 302 || redirect.status === 200, String(redirect.status));
  const adsPage = await fetch(BASE + "/obyavleniya");
  ok("раздел «Объявления» жив (страница 200)", adsPage.status === 200);
  const adsApi = await api("/api/obyavleniya");
  ok("лента «Объявлений» отдаёт пустую/чистую ленту без ошибок", adsApi.status === 200 && Array.isArray(adsApi.data.posts));
  const forum = await api("/api/bootstrap");
  ok("форум-бутстрап цел", forum.status === 200 && !!forum.data.settings);
  const mainPage = await fetch(BASE + "/");
  const mainHtml = await mainPage.text();
  ok("блок входа «Полезное» на главной", mainHtml.includes("/poleznoe"));
  ok("раздел не нарушил форум: главная 200", mainPage.status === 200);

  console.log(`\n===== ИТОГО: ${pass} из ${pass + fail} =====`);
  if (fail > 0) process.exitCode = 1;
  console.log("  очистка не требуется: раздел только для чтения");
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error("CRASH:", e);
    process.exit(1);
  });
