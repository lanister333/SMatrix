/**
 * Проба ТЗ 2026-09-21: карточка отзыва .matrix-review-card в разделе
 * «Рекомендую / Не рекомендую» (/rekomenduyu) — присланная разметка заказчика.
 *
 * Проверки:
 *  1) разметка 1-в-1 (negative-карточка): .type-negative, шапка
 *     (👤 аватар-плейсхолдер, ник, дата «D месяца YYYY, ЧЧ:ММ»),
 *     .matrix-recommend-badge.status-no «👎 Не рекомендую»,
 *     h4.review-target-object (субъект + место), p.review-experience-text;
 *  2) .review-human-highlight (Пункт 6): 💡 + «Отдельно отмечу человека:»;
 *  3) футер (ТЗ 2026-09-24): голосовые .rc-votebtn «👍 Рекомендую (N)» /
 *     «👎 Не рекомендую (N)» рядом с бирюзовым форумом; «Полезный отзыв»
 *     (.rc-usefulbtn) УДАЛЁН, .rc-report «Пожаловаться» слева;
 *  4) .review-official-response (Пункт 13): бейдж «Официальный ответ
 *     организации», дата «Сегодня, ЧЧ:ММ», текст ответа;
 *  5) positive-карточка: .type-positive + .status-yes «👍 Рекомендую»;
 *  6) голоса (ТЗ 2026-09-24): клик «Рекомендую» 0→1 (подсветка is-on),
 *     повторный клик снимает; API: гость 401, автор своего 400, вид
 *     голоса kind=recommend в БД; у автора голосовых кнопок нет;
 *  7) «⚠️ Сигнал модератору» открывает прежнюю модалку жалобы;
 *  8) официальный ответ: orgRep видит .rc-orgform и публикует ответ (ИИ),
 *     после этого форма исчезает; повторный ответ API → 409; не-orgRep → 403;
 *     у автора отзыва формы нет;
 *  9) свой вид: авторские кнопки (Сменить позицию/Редактировать/Удалить);
 * 10) мобайл 375: без горскролла;
 * 11) CSS ТЗ (раунд 2): computed-styles присланной палитры (рейки
 *     #ef4444/#10b981, плашки #fef2f2/#ecfdf5, выделение #f8fafc,
 *     ответ #f1f5f9, кнопки 12px/600 #64748b, Arial-шрифт сайта);
 * 12) чекбокс подтверждения личного опыта (ТЗ 2026-09-22, Пункты 2 и 8
 *     Манифеста): разметка 1-в-1 (.form-group-flat.matrix-checkbox-group,
 *     input#review-manifest-agree[required], .checkmark-flat,
 *     .checkbox-text-flat), сабмит без галочки блокирован с ошибкой,
 *     с галочкой — публикация проходит, чекбокс есть и в редактировании;
 *     CSS раунд 2 (прислан): нативный чекбокс 16x16 accent-color
 *     #0f766e, gap 12, текст 13px #475569, отступы группы 20/20;
 * 13) ТЗ 2026-09-22 «Исправленный подвал карточки»: на демо-карточке
 *     «Мебельный цех на Ленина» — присланный фрагмент 1-в-1
 *     (.review-card-footer-fixed): .sim-toggle-zone с кнопкой
 *     #toggle-biz-view-btn (текст симуляции 1-в-1), скрытый
 *     #biz-response-field-block.matrix-official-response-zone с формой
 *     #fixed-biz-submit-form (label/placeholder/required/кнопка 1-в-1),
 *     пустой #fixed-final-viewport; кнопки «Обсудить»/редактирования на
 *     демо-карточке заменены (utility/report сохранены, остальные карточки
 *     не тронуты); toggle: открытие/закрытие с текстом «Режим бизнесмена:
 *     Активен…» и фоном #ccfbf1; ИИ-фильтр: «сам дурак»/«все врете» →
 *     alert «ИИ-БЛОКИРОВКА», ветка не запечатана; конструктивный ответ →
 *     симуляция уничтожена, .official-final-rendered-answer в
 *     #fixed-final-viewport (шапка/«кавычки»/замок, инлайн-стили #e2e8f0
 *     + рейка 4px #0f766e);
 * 14) ТЗ 2026-09-22 (раунд 2) демо-записи заказчика (sakh-001…003): присланный
 *     компонент SakhMatrixReviewCard 1-в-1 (Tailwind) — карточки в начале
 *     ленты (порядок массива, до карточек БД): крошки рубрики 10px uppercase,
 *     строка «Автор • локация • дата», бейджи «⚠️ Предупреждаю»/«👍 Рекомендую»,
 *     текст pre-line, «Особое упоминание сотрудника:» (у sakh-003 нет — null),
 *     глобальный дисклеймер [2], «Официальная позиция организации» с ответом
 *     в «кавычках» (teal-рейка 2px); статичные (без button/a/input);
 *     в «Моих публикациях» и при поиске демо-блока нет.
 * 15) ТЗ 2026-09-22 «Первая линия автоматической пре-модерации отзывов»:
 *     15a UI — форма новой публикации с ярлыками («Там работают дебилы»,
 *     «Директор — вор», «Контора мошенников») → .sk-modal-err с ТОЧНОЙ
 *     подсказкой заказчика; 15b-15f API — insults → 422 return (подсказка
 *     1-в-1), personal_data (номер сотового + домашний адрес) → 422 return,
 *     угрозы/мат/капслок → 400 block; 15g-15h — фактурный негатив заказчика
 *     (даты/цены/факты/предположение/«не приду») и бизнес-адрес ПРОПУЩЕНЫ;
 *     15i — PATCH-правка с ярлыком → 422; 15j — контрольные публикации
 *     удалены.
 * 16) ТЗ 2026-09-22 симулятор логики примирения SakhMatrixResolutionSimulator
 *     (прислан 1-в-1, Tailwind, свой сценарий sakh-001): в ленте после
 *     демо-записей и до карточек БД; исходно warning «⚠️ Предупреждаю» (red),
 *     свой текст сценария, дисклеймер Пункта 7, блок «Официальный статус
 *     организации» (бизнес не верифицирован), панель автора с кнопками форума
 *     и примирения + hover-стили; клик форума → плашка «✓ Ссылка на форум
 *     создана…» (teal); клик примирения → бейдж «✓ Вопрос закрыт / Претензий
 *     нет» (teal), opacity-75 с transition-all duration-300, панель «Конфликт
 *     успешно исчерпан…»; состояние локальное — после перезагрузки исходное;
 *     скрыт в поиске и «Моих публикациях»; мобайл 375 без горскролла.
 * Сид: 3 пользователя (автор / голосующий / представитель организации) и
 * 2 публикации (negative с выделением человека + positive) — прямо в БД.
 * Официальный ответ публикуется через UI (реальный POST с ИИ-модерацией).
 * После проверок тестовые данные удаляются из БД.
 * Скриншоты: scripts/shots/review-card-*.png
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3000";
const SHOTS = "scripts/shots";
fs.mkdirSync(SHOTS, { recursive: true });

const ok = (name, cond, extra = "") =>
  console.log(`${cond ? "OK  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
const norm = (t) => (t || "").replace(/\s+/g, " ").trim();

/* --- .env-lite: DATABASE_URL для Prisma --- */
for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/);
  if (m) {
    let v = m[1];
    if (v.startsWith("file:")) {
      const p = v.slice(5);
      v = "file:" + (path.isAbsolute(p) ? p : path.resolve(process.cwd(), p));
    }
    process.env.DATABASE_URL = v;
    break;
  }
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
import crypto from "node:crypto";

const stamp = Date.now();
const mkUser = async (nick, extra = {}) => {
  const email = `rec-probe-${nick}-${stamp}@test.local`;
  const salt = crypto.randomBytes(12).toString("hex");
  const passwordHash = `${salt}:${crypto.scryptSync(crypto.randomBytes(8).toString("hex"), salt, 64).toString("hex")}`;
  return prisma.user.create({
    data: { email, passwordHash, nickname: nick, emailVerified: true, ...extra },
  });
};

const NICK_AUTHOR = `ОтзывчикПроба${stamp}`;
const NICK_VOTER = `ГолосующийПроба${stamp}`;
const NICK_ORG = `ПредставительПроба${stamp}`;

const NEG_POST = {
  subject: "Сервисный центр «Цифра»",
  stance: "notrecommend",
  title: "Экран меняли дольше обещанного",
  text: "20 сентября обратилась для замены экрана на смартфоне. Обещали сделать за 2 часа, но по факту вернули аппарат только на следующий день. Информирование клиентов хромает.",
  place: "г. Южно-Сахалинск",
  humanHighlight: "Мастер Алексей вежливо объяснил причину задержки и сделал небольшую скидку за ожидание.",
};
const POS_POST = {
  subject: "Кофейня у Площади Победы",
  stance: "recommend",
  title: "Лучший капучино на Сахалине",
  text: "Быстро, вкусно, уютно. Персонал приветливый, кофе всегда свежий. Однозначно рекомендую.",
  place: "",
  humanHighlight: "",
};

let author = null;
let voter = null;
let org = null;
const browser = await chromium.launch();
try {
  author = await mkUser(NICK_AUTHOR);
  voter = await mkUser(NICK_VOTER);
  org = await mkUser(NICK_ORG, { orgRep: true, orgName: "Сервисный центр «Цифра»" });
  const mkSession = (userId) => crypto.randomBytes(24).toString("hex");
  const tokenAuthor = mkSession();
  const tokenVoter = mkSession();
  const tokenOrg = mkSession();
  await prisma.session.createMany({
    data: [
      { token: tokenAuthor, userId: author.id },
      { token: tokenVoter, userId: voter.id },
      { token: tokenOrg, userId: org.id },
    ],
  });

  const created = await prisma.$transaction([
    prisma.recPost.create({
      data: { ...NEG_POST, authorId: author.id, authorName: NICK_AUTHOR, orgResponseText: "", orgResponseByName: "" },
    }),
    prisma.recPost.create({
      data: { ...POS_POST, authorId: author.id, authorName: NICK_AUTHOR },
    }),
  ]);
  const negId = created[0].id;
  const posId = created[1].id;

  const safeUser = (u) => ({ id: u.id, nickname: u.nickname, email: u.email, gender: "unspecified", role: "user", emailVerified: true, orgRep: u.orgRep, orgName: u.orgName });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(
    ([key, val]) => localStorage.setItem(key, val),
    ["sm_auth", JSON.stringify({ token: tokenVoter, user: safeUser(voter) })]
  );
  await page.goto(BASE + "/rekomenduyu", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector(".matrix-review-card", { timeout: 60000 });
  await page.waitForTimeout(1200);

  const negCard = page.locator(`[data-rc-id="${negId}"]`);
  const posCard = page.locator(`[data-rc-id="${posId}"]`);

  // 1) разметка 1-в-1 (negative)
  ok("1. negative-карточка: article.matrix-review-card.type-negative", (await negCard.count()) === 1);
  const badge = norm(await negCard.locator(".matrix-recommend-badge").textContent());
  const badgeCls = await negCard.locator(".matrix-recommend-badge").getAttribute("class");
  ok("1a. бейдж: .status-no «👎 Не рекомендую»",
    badgeCls?.includes("status-no") && badge === "👎 Не рекомендую", badge);
  const nick = norm(await negCard.locator(".rc-headrow b").first().textContent());
  ok("1b. ник автора", nick === NICK_AUTHOR, nick);
  const dateTxt = norm(await negCard.locator(".rc-date").textContent());
  ok("1c. дата «D месяца YYYY, ЧЧ:ММ»",
    /^\d{1,2} (января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря) \d{4}, \d{2}:\d{2}$/.test(dateTxt), dateTxt);
  const headTxt = norm(await negCard.locator(".rc-headrow").textContent());
  ok("1d. шапка по ТЗ wb: «📍 ник · дата · город», аватара нет (Flat 2.0)",
    headTxt.startsWith("📍") && headTxt.includes("г. Южно-Сахалинск") &&
    (await negCard.locator(".user-avatar-placeholder").count()) === 0, headTxt.slice(0, 44));
  const obj = norm(await negCard.locator(".rc-qsubject").textContent());
  ok("1e. поле суть: «Отзыв: субъект»",
    norm(await negCard.locator(".rc-q").textContent()).startsWith("Отзыв:") &&
    obj === "Сервисный центр «Цифра»", obj);
  const exp = norm(await negCard.locator(".rc-qtext").textContent());
  ok("1f. текст опыта", exp.startsWith("20 сентября обратилась для замены экрана"), exp.slice(0, 40) + "…");

  // 2) выделение человека (Пункт 6)
  const hh = negCard.locator(".review-human-highlight");
  ok("2. .review-human-highlight с 💡 и «Отдельно отмечу человека:»",
    (await hh.count()) === 1 &&
    (await hh.locator(".human-highlight-icon").textContent()) === "💡" &&
    norm(await hh.locator(".human-highlight-text strong").textContent()) === "Отдельно отмечу человека:" &&
    norm(await hh.locator(".human-highlight-text").textContent()).includes("Мастер Алексей вежливо объяснил"));

  // 3) футер: действия (ТЗ 2026-09-24: голосовые вместо «Полезный отзыв»)
  const voteYesTxt = norm(await negCard.locator(".rc-votebtn.rc-vote-yes").textContent());
  const voteNoTxt = norm(await negCard.locator(".rc-votebtn.rc-vote-no").textContent());
  ok("3. ряд .rc-actrow одной линией: «Пожаловаться» (слева) + «👍 Рекомендую (0)» + «👎 Не рекомендую (0)» + бирюзовый форум; «Полезный отзыв» удалён",
    voteYesTxt === "👍 Рекомендую (0)" &&
    voteNoTxt === "👎 Не рекомендую (0)" &&
    (await negCard.locator(".rc-usefulbtn").count()) === 0 &&
    norm(await negCard.locator(".rc-report").textContent()) === "Пожаловаться" &&
    (await negCard.locator(".rc-actrow .rc-report").count()) === 1 &&
    (await negCard.locator(".rc-actrow .rc-btn-forum").count()) === 1, `${voteYesTxt} / ${voteNoTxt}`);

  // 4) официальный ответ (Пункт 13) — сид в БД на «сегодня»
  const respAt = new Date();
  await prisma.recPost.update({ where: { id: posId }, data: { orgResponseText: "Спасибо за тёплые слова! Ждём вас снова за кофе.", orgResponseAt: respAt, orgResponseByName: "Кофейня у Площади Победы" } });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".matrix-review-card", { timeout: 60000 });
  await page.waitForTimeout(800);
  const posResp = posCard.locator(".rc-answer");
  const respBadge = norm(await posResp.locator(".rc-answerbadge").textContent());
  const respDate = norm(await posResp.locator(".rc-answerdate").textContent());
  ok("4. ответ: бейдж «Официальный ответ организации» + дата «Сегодня, ЧЧ:ММ»",
    respBadge === "Официальный ответ организации" && /^Сегодня, \d{2}:\d{2}$/.test(respDate), `${respBadge} / ${respDate}`);
  ok("4a. текст ответа — плоской строкой wb «📍 Ответ от …»",
    norm(await posResp.locator(".rc-answertext").textContent()).startsWith("📍 Ответ от") &&
    norm(await posResp.locator(".rc-answertext").textContent()).includes("Ждём вас снова за кофе"));

  // 5) positive-карточка
  ok("5. positive-карточка: .type-positive + .status-yes «👍 Рекомендую»",
    (await posCard.getAttribute("class"))?.includes("type-positive") &&
    (await posCard.locator(".matrix-recommend-badge").getAttribute("class"))?.includes("status-yes") &&
    norm(await posCard.locator(".matrix-recommend-badge").textContent()) === "👍 Рекомендую");
  ok("5a. без выделения человека — блока нет", (await posCard.locator(".review-human-highlight").count()) === 0);

  // 6) Голоса (ТЗ 2026-09-24): клик «Рекомендую» 0→1 с подсветкой, повторный — снимает
  await negCard.locator(".rc-votebtn.rc-vote-yes").click();
  await page.waitForTimeout(900);
  ok("6. клик «Рекомендую»: счётчик 0→1, кнопка подсвечена (is-on)",
    norm(await negCard.locator(".rc-votebtn.rc-vote-yes").textContent()) === "👍 Рекомендую (1)" &&
    ((await negCard.locator(".rc-votebtn.rc-vote-yes").getAttribute("class")) || "").includes("is-on"));
  await negCard.locator(".rc-votebtn.rc-vote-yes").click();
  await page.waitForTimeout(600);
  ok("6a. повторный клик (toggle): 1→0, подсветка снята",
    norm(await negCard.locator(".rc-votebtn.rc-vote-yes").textContent()) === "👍 Рекомендую (0)" &&
    !((await negCard.locator(".rc-votebtn.rc-vote-yes").getAttribute("class")) || "").includes("is-on"));

  // 6b) API: гость 401; автор своего 400; голосующий ставит отметку (для скриншота)
  const apiGuest = await page.evaluate(async (id) => {
    const r = await fetch(`/api/recommend/${id}/support`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: "" }) });
    return { status: r.status };
  }, negId);
  ok("6b. API без токена → 401", apiGuest.status === 401, JSON.stringify(apiGuest));
  const apiOwn = await page.evaluate(async ({ id, tok }) => {
    const r = await fetch(`/api/recommend/${id}/support`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: tok }) });
    return { status: r.status };
  }, { id: negId, tok: tokenAuthor });
  ok("6c. API автор своего отзыва → 400", apiOwn.status === 400, JSON.stringify(apiOwn));
  await page.evaluate(async ({ id, tok }) => {
    const r = await fetch(`/api/recommend/${id}/support`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: tok, kind: "recommend" }) });
    if (r.status !== 200) throw new Error(`support failed: ${r.status}`);
  }, { id: negId, tok: tokenVoter });
  const vRow = await prisma.recUsefulVote.findFirst({ where: { postId: negId } });
  ok("6d. БД: один голос голосующего, вид kind=recommend", (await prisma.recUsefulVote.count({ where: { postId: negId } })) === 1 && vRow?.kind === "recommend", JSON.stringify(vRow));

  // 7) «⚠️ Сигнал модератору» → прежняя модалка жалобы
  await negCard.locator(".rc-report").click();
  await page.waitForTimeout(400);
  ok("7. открылась прежняя модалка жалобы", (await page.locator(".sk-modal", { hasText: "Жалоба на публикацию" }).count()) === 1);
  await page.locator(".sk-modal .sk-btn-classic, .sk-modal button").first().click().catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator(".sk-modal-x").first().click().catch(() => {});
  await page.waitForTimeout(300);

  // 8) официальный ответ: orgRep видит форму и публикует ответ (ИИ)
  const pageOrg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await pageOrg.addInitScript(
    ([key, val]) => localStorage.setItem(key, val),
    ["sm_auth", JSON.stringify({ token: tokenOrg, user: safeUser(org) })]
  );
  await pageOrg.goto(BASE + "/rekomenduyu", { waitUntil: "domcontentloaded", timeout: 45000 });
  await pageOrg.waitForSelector(".matrix-review-card", { timeout: 60000 });
  await pageOrg.waitForTimeout(1000);
  const orgForm = pageOrg.locator(`[data-rc-id="${negId}"] .rc-orgform`);
  ok("8. orgRep видит форму официального ответа (там, где ответа нет)",
    (await orgForm.count()) === 1 &&
    norm(await orgForm.locator(".rc-orgform-title").textContent()) === "Официальный ответ организации — Сервисный центр «Цифра»");
  ok("8a. у автора отзыва формы нет", (await pageOrg.locator(`[data-rc-id="${posId}"] .rc-orgform`).count()) === 0);
  await orgForm.locator("textarea").fill("Здравствуйте! Приносим извинения за задержку и за то, что менеджер приёмки не предупредил вас вовремя. С сотрудником проведена беседа по стандартам связи. Свяжитесь с нами в WhatsApp — мы подготовили для вас бонус на следующее обслуживание.");
  await orgForm.locator("button").click();
  await pageOrg.waitForTimeout(8000); // ИИ-модерация ответа
  await pageOrg.reload({ waitUntil: "domcontentloaded" });
  await pageOrg.waitForSelector(".matrix-review-card", { timeout: 60000 });
  await pageOrg.waitForTimeout(800);
  ok("8b. после публикации формы нет (ответ уже дан)",
    (await pageOrg.locator(`[data-rc-id="${negId}"] .rc-orgform`).count()) === 0 &&
    (await pageOrg.locator(`[data-rc-id="${negId}"] .rc-answer`).count()) === 1);
  const apiDup = await pageOrg.evaluate(async ({ id, tok }) => {
    const r = await fetch(`/api/recommend/${id}/org-response`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: tok, text: "Второй официальный ответ организации" }) });
    return { status: r.status };
  }, { id: negId, tok: tokenOrg });
  ok("8c. API повторный ответ → 409", apiDup.status === 409, JSON.stringify(apiDup));
  const apiNonRep = await page.evaluate(async ({ id, tok }) => {
    const r = await fetch(`/api/recommend/${id}/org-response`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: tok, text: "Пытаюсь ответить без статуса представителя" }) });
    return { status: r.status };
  }, { id: posId, tok: tokenVoter });
  ok("8d. API не-orgRep → 403", apiNonRep.status === 403, JSON.stringify(apiNonRep));

  // 9) свой вид: авторские кнопки
  const pageAuthor = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await pageAuthor.addInitScript(
    ([key, val]) => localStorage.setItem(key, val),
    ["sm_auth", JSON.stringify({ token: tokenAuthor, user: safeUser(author) })]
  );
  await pageAuthor.goto(BASE + "/rekomenduyu?mine=1", { waitUntil: "domcontentloaded", timeout: 45000 });
  await pageAuthor.waitForSelector(".matrix-review-card", { timeout: 60000 });
  await pageAuthor.waitForTimeout(1000);
  const ownCard = pageAuthor.locator(`[data-rc-id="${posId}"]`);
  ok("9a. свой вид: голосовых кнопок нет, «Полезный отзыв» удалён", (await ownCard.locator(".rc-votebtn").count()) === 0 && (await ownCard.locator(".rc-usefulbtn").count()) === 0);
  const ownBtns = (await ownCard.locator(".rc-secrow button, .rc-actrow button").allTextContents()).map(norm);
  ok("9. свой вид: без «Пожаловаться» и без голосовых; Сменить/Редактировать/Удалить + форум",
    !ownBtns.includes("Пожаловаться") &&
    !ownBtns.some((t) => t.startsWith("👍 Рекомендую")) &&
    !ownBtns.some((t) => t.startsWith("👎 Не рекомендую")) &&
    ownBtns.some((t) => t.startsWith("Сменить на")) &&
    ownBtns.includes("Редактировать") && ownBtns.includes("Удалить"), ownBtns.join(" | "));
  await posCard.screenshot({ path: `${SHOTS}/review-card-positive.png` }).catch(() => {});
  await page.locator(`[data-rc-id="${negId}"]`).screenshot({ path: `${SHOTS}/review-card-negative.png` });

  // 11) CSS ТЗ (раунд 2): computed-styles присланной палитры
  const st = async (loc, prop) => loc.evaluate((el, p) => getComputedStyle(el)[p], prop);
  ok("11. карточка — эталон .wb-item: bg #fff, рамка 1px #4A688C (как у часов), радиус 0, padding 10px",
    (await st(negCard, "backgroundColor")) === "rgb(255, 255, 255)" &&
    (await st(negCard, "borderTopWidth")) === "1px" &&
    (await st(negCard, "borderBottomColor")) === "rgb(74, 104, 140)" &&
    (await st(negCard, "borderTopLeftRadius")) === "0px" &&
    (await st(negCard, "paddingTop")) === "10px");
  ok("11a. рейки: negative 4px #ef4444 / positive 4px #10b981",
    (await st(negCard, "borderLeftWidth")) === "4px" && (await st(negCard, "borderLeftColor")) === "rgb(239, 68, 68)" &&
    (await st(posCard, "borderLeftColor")) === "rgb(16, 185, 129)");
  ok("11b. плашки: no #fef2f2/#991b1b, yes #ecfdf5/#065f46, r6",
    (await st(negCard.locator(".matrix-recommend-badge"), "backgroundColor")) === "rgb(254, 242, 242)" &&
    (await st(negCard.locator(".matrix-recommend-badge"), "color")) === "rgb(153, 27, 27)" &&
    (await st(posCard.locator(".matrix-recommend-badge"), "backgroundColor")) === "rgb(236, 253, 245)" &&
    (await st(posCard.locator(".matrix-recommend-badge"), "color")) === "rgb(6, 95, 70)" &&
    (await st(negCard.locator(".matrix-recommend-badge"), "borderTopLeftRadius")) === "6px");
  const nickCls = (await negCard.locator(".rc-headrow b").getAttribute("class")) || "";
  const nickCol = await st(negCard.locator(".rc-headrow b"), "color");
  ok("11c. шапка wb: 12.5px #52525b, ник по полу 600 (sm-nick-gender g-*: male #1050b8 / female #c2185b / neutral #4c5563), дата nowrap",
    (await st(negCard.locator(".rc-headrow"), "fontSize")) === "12.5px" &&
    (await st(negCard.locator(".rc-headrow"), "color")) === "rgb(82, 82, 91)" &&
    (await st(negCard.locator(".rc-headrow b"), "fontWeight")) === "600" &&
    nickCls.includes("sm-nick-gender") && nickCls.includes("g-") &&
    ["rgb(16, 80, 184)", "rgb(194, 24, 91)", "rgb(76, 85, 99)"].includes(nickCol) &&
    (await st(negCard.locator(".rc-date"), "whiteSpace")) === "nowrap",
    `${nickCls} / ${nickCol}`);
  ok("11d. «Отзыв:» 13.5px, субъект 700 #1f2d3d, опыт 13.5px #1a2433 + pre-wrap",
    (await st(negCard.locator(".rc-q"), "fontSize")) === "13.5px" &&
    (await st(negCard.locator(".rc-qsubject"), "fontWeight")) === "700" &&
    (await st(negCard.locator(".rc-qsubject"), "color")) === "rgb(31, 45, 61)" &&
    (await st(negCard.locator(".rc-qtext"), "fontSize")) === "13.5px" &&
    (await st(negCard.locator(".rc-qtext"), "color")) === "rgb(26, 36, 51)" &&
    (await st(negCard.locator(".rc-qtext"), "whiteSpace")) === "pre-wrap");
  ok("11e. выделение человека: #f8fafc, рамка #e2e8f0, flex, gap 12px",
    (await st(negCard.locator(".review-human-highlight"), "backgroundColor")) === "rgb(248, 250, 252)" &&
    (await st(negCard.locator(".review-human-highlight"), "borderColor")) === "rgb(226, 232, 240)" &&
    (await st(negCard.locator(".review-human-highlight"), "display")) === "flex" &&
    (await st(negCard.locator(".review-human-highlight"), "columnGap")) === "12px");
  ok("11f. ряды wb: sep #e4e4e7, actrow flex-end gap 10px",
    (await st(negCard.locator(".rc-sep"), "borderTopColor")) === "rgb(228, 228, 231)" &&
    (await st(negCard.locator(".rc-actrow"), "justifyContent")) === "flex-end" &&
    (await st(negCard.locator(".rc-actrow"), "columnGap")) === "10px");
  const rBox = await negCard.locator(".rc-report").boundingBox();
  const vBox = await negCard.locator(".rc-votebtn.rc-vote-yes").boundingBox();
  const fBox = await negCard.locator(".rc-actrow .rc-btn-forum").boundingBox();
  ok("11g. ТЗ 2026-09-24: голосовая 12px/белый фон/26px; report #8B0000 СЛЕВА НА ОДНОЙ ЛИНИИ с голосовой и форумом (report < vote < forum)",
    (await st(negCard.locator(".rc-votebtn.rc-vote-yes"), "fontSize")) === "12px" &&
    (await st(negCard.locator(".rc-votebtn.rc-vote-yes"), "backgroundColor")) === "rgb(255, 255, 255)" &&
    (await st(negCard.locator(".rc-votebtn.rc-vote-yes"), "height")) === "26px" &&
    (await st(negCard.locator(".rc-report"), "color")) === "rgb(139, 0, 0)" &&
    !!rBox && !!vBox && !!fBox && Math.abs(rBox.y - vBox.y) < 4 && Math.abs(vBox.y - fBox.y) < 4 && rBox.x < vBox.x && vBox.x < fBox.x,
    JSON.stringify({ report: rBox, vote: vBox, forum: fBox }));
  await negCard.locator(".rc-report").hover();
  await page.waitForTimeout(400);
  ok("11h. report:hover #c40000 (как .wb-report)",
    (await st(negCard.locator(".rc-report"), "color")) === "rgb(196, 0, 0)");
  await page.mouse.move(0, 0);
  ok("11i. ответ wb: бейдж #0f766e uppercase, дата #94a3b8",
    (await st(posCard.locator(".rc-answerbadge"), "color")) === "rgb(15, 118, 110)" &&
    (await st(posCard.locator(".rc-answerbadge"), "textTransform")) === "uppercase" &&
    (await st(posCard.locator(".rc-answerdate"), "color")) === "rgb(148, 163, 184)");
  ok("11j. шрифт — Arial сайта (system-ui из ТЗ не применён)",
    (await st(negCard.locator(".rc-qtext"), "fontFamily")).startsWith("Arial"));

  // 12) ТЗ 2026-09-22: чекбокс подтверждения личного опыта (Пункты 2 и 8 Манифеста)
  await pageAuthor.locator(".rc-addbtn").first().click();
  await pageAuthor.waitForSelector("#review-manifest-agree", { timeout: 15000 });
  const chkWrap = pageAuthor.locator(".form-group-flat.matrix-checkbox-group");
  const chkInput = pageAuthor.locator("#review-manifest-agree");
  ok("12. разметка 1-в-1: .form-group-flat.matrix-checkbox-group > label.checkbox-container-flat > input#review-manifest-agree[required] + .checkmark-flat + .checkbox-text-flat",
    (await chkWrap.count()) === 1 &&
    (await chkWrap.locator("label.checkbox-container-flat").count()) === 1 &&
    (await chkInput.getAttribute("type")) === "checkbox" &&
    (await chkInput.getAttribute("required")) === "" &&
    (await chkWrap.locator(".checkmark-flat").count()) === 1 &&
    (await chkWrap.locator(".checkbox-text-flat").count()) === 1);
  const chkText = norm(await chkWrap.locator(".checkbox-text-flat").textContent());
  ok("12a. текст подтверждения (Пункты 2 и 8)",
    chkText.startsWith("Я подтверждаю, что этот отзыв описывает мой личный бытовой опыт.") &&
    (await chkWrap.locator(".checkbox-text-flat strong").textContent()) === "личный бытовой опыт" &&
    chkText.includes("не является официальной позицией SakhMatrix"), chkText.slice(0, 60) + "…");

  // 12b) сабмит без галочки — публикация невозможна
  await pageAuthor.locator("#rc-f-subject").fill("Проба чекбокса «Матрица»");
  await pageAuthor.locator("#rc-f-title").fill("Проверка обязательного подтверждения опыта");
  await pageAuthor.locator("#rc-f-text").fill("Проверяю, что без подтверждения личного опыта публикация не проходит. Тестовая запись.");
  await pageAuthor.locator(".sk-modal .sk-btn-classic").first().click();
  await pageAuthor.waitForTimeout(600);
  ok("12b. сабмит без галочки: ошибка «Отметьте подтверждение…», публикации нет",
    norm(await pageAuthor.locator(".sk-modal .sk-modal-err").textContent()).includes("Отметьте подтверждение") &&
    (await prisma.recPost.count({ where: { subject: "Проба чекбокса «Матрица»" } })) === 0);

  // 12c) CSS раунд 2 (прислан): нативный чекбокс 16x16 accent-color #0f766e, gap 12, текст 13px #475569
  ok("12c. CSS заказчика: input 16x16 виден, accent-color #0f766e, gap 12px, текст 13px #475569, strong #1e293b",
    (await st(chkInput, "width")) === "16px" &&
    (await st(chkInput, "height")) === "16px" &&
    (await st(chkInput, "opacity")) === "1" &&
    (await st(chkInput, "accentColor")) === "rgb(15, 118, 110)" &&
    (await st(chkWrap.locator(".checkbox-container-flat"), "columnGap")) === "12px" &&
    (await st(chkWrap.locator(".checkbox-text-flat"), "fontSize")) === "13px" &&
    (await st(chkWrap.locator(".checkbox-text-flat"), "color")) === "rgb(71, 85, 105)" &&
    (await st(chkWrap.locator(".checkbox-text-flat strong"), "color")) === "rgb(30, 41, 59)");
  ok("12c-2. CSS заказчика: группа 20/20, user-select:none, .checkmark-flat без стилей",
    (await st(chkWrap, "marginTop")) === "20px" &&
    (await st(chkWrap, "marginBottom")) === "20px" &&
    (await st(chkWrap.locator(".checkbox-container-flat"), "userSelect")) === "none" &&
    (await st(chkWrap.locator(".checkmark-flat"), "backgroundColor")) === "rgba(0, 0, 0, 0)");
  await pageAuthor.screenshot({ path: `${SHOTS}/review-form-checkbox.png` });

  // 12d) клик по лейблу: checked (нативная галочка accent-color)
  await chkWrap.locator(".checkbox-container-flat").click();
  await pageAuthor.waitForTimeout(300);
  ok("12d. клик по лейблу: checked", await chkInput.isChecked());
  await pageAuthor.screenshot({ path: `${SHOTS}/review-form-checkbox-checked.png` });

  // 12e) с галочкой — публикация проходит
  await pageAuthor.locator(".sk-modal .sk-btn-classic").first().click();
  await pageAuthor.waitForSelector(".sk-modal", { state: "detached", timeout: 45000 }); // ИИ-модерация
  ok("12e. с галочкой публикация прошла (модалка закрыта, запись в БД)",
    (await prisma.recPost.count({ where: { subject: "Проба чекбокса «Матрица»" } })) === 1);

  // 12f) чекбокс есть и в редактировании публикации
  await pageAuthor.locator(`[data-rc-id="${posId}"] button`, { hasText: "Редактировать" }).click();
  await pageAuthor.waitForTimeout(500);
  ok("12f. редактирование: чекбокс присутствует",
    (await pageAuthor.locator(".sk-modal .form-group-flat.matrix-checkbox-group").count()) === 1);
  await pageAuthor.locator(".sk-modal-x").first().click().catch(() => {});
  await pageAuthor.waitForTimeout(300);

  // 13) ТЗ 2026-09-22: исправленный подвал карточки (.review-card-footer-fixed)
  // — присланный фрагмент 1-в-1 на демо-карточке «Мебельный цех на Ленина»
  const demoCard = page
    .locator(".matrix-review-card")
    .filter({ has: page.locator(".rc-qsubject", { hasText: "Мебельный цех на Ленина" }) });
  ok("13. демо-карточка найдена; .review-card-footer-fixed в ней, единственный на странице",
    (await demoCard.count()) === 1 &&
    (await demoCard.locator(".review-card-footer-fixed").count()) === 1 &&
    (await page.locator(".review-card-footer-fixed").count()) === 1);
  const simZone = demoCard.locator(".sim-toggle-zone");
  const simBtn = demoCard.locator("#toggle-biz-view-btn");
  ok("13a. .sim-toggle-zone + #toggle-biz-view-btn.btn-sim-action[type=button], текст симуляции 1-в-1",
    (await simZone.count()) === 1 &&
    (await simBtn.getAttribute("type")) === "button" &&
    (await simBtn.getAttribute("class")) === "btn-sim-action" &&
    (await simBtn.getAttribute("onclick")) === "toggleBizResponseForm()" &&
    norm(await simBtn.textContent()) === "⚙️ Сэмулировать: Я владелец «Мебельного цеха на Ленина»");
  const bizZone = demoCard.locator("#biz-response-field-block");
  ok("13b. #biz-response-field-block.matrix-official-response-zone скрыт; форма 1-в-1 (label, placeholder, required, кнопка)",
    (await bizZone.count()) === 1 &&
    (await bizZone.getAttribute("class")) === "matrix-official-response-zone" &&
    (await bizZone.isHidden()) &&
    (await demoCard.locator("#fixed-biz-submit-form").getAttribute("onsubmit")) === "handleFixedBizAnswer(event)" &&
    norm(await demoCard.locator("#fixed-biz-submit-form label").textContent()) ===
      "Официальный ответ организации (Допускается только один ответ без дискуссий):" &&
    (await demoCard.locator("#fixed-biz-text-input").getAttribute("required")) === "" &&
    norm(await demoCard.locator("#fixed-biz-text-input").getAttribute("placeholder")) ===
      "Здравствуйте! Приносим извинения за задержку... Напишите нам в WhatsApp..." &&
    norm(await demoCard.locator("#fixed-biz-submit-form button[type=submit]").textContent()) ===
      "Опубликовать ответ компании");
  ok("13c. #fixed-final-viewport есть и пуст",
    (await demoCard.locator("#fixed-final-viewport").count()) === 1 &&
    (await demoCard.locator("#fixed-final-viewport").innerHTML()) === "");
  ok("13d. ТЗ 2026-09-24: у карточки с фиксированным подвалом ЕСТЬ «Обсудить на форуме» (.rc-demo-forumrow, бирюзовая, ссылка на рубрику) и 2 голосовые кнопки; «Полезный отзыв» удалён; присланное не тронуто (.rc-act = 0, report = 1)",
    (await demoCard.locator(".rc-demo-forumrow .rc-btn-forum").count()) === 1 &&
    ((await demoCard.locator(".rc-demo-forumrow .rc-btn-forum").getAttribute("href")) || "").startsWith("/forum/category/tovary-i-uslugi--otzyvy-i-rekomendacii") &&
    (await demoCard.locator(".rc-act").count()) === 0 &&
    (await demoCard.locator(".rc-usefulbtn").count()) === 0 &&
    (await demoCard.locator(".rc-votebtn").count()) === 2 &&
    (await demoCard.locator(".rc-report").count()) === 1);
  ok("13d-2. остальные карточки не тронуты: у seeded negative кнопка форума на месте",
    (await negCard.locator(".rc-btn-forum").count()) === 1);
  await demoCard.screenshot({ path: `${SHOTS}/review-card-footer-fixed.png` });

  // 13e/13f) toggle: открытие и закрытие формы
  await simBtn.click();
  await page.waitForTimeout(250);
  ok("13e. клик: блок открыт (display:block), кнопка «Режим бизнесмена: Активен (Форма ответа открыта)», фон #ccfbf1, цвет #0f766e",
    (await bizZone.isVisible()) &&
    (await bizZone.evaluate((el) => el.style.display === "block")) &&
    norm(await simBtn.innerText()) === "⚙️ Режим бизнесмена: Активен (Форма ответа открыта)" &&
    (await simBtn.evaluate((el) => el.style.background)) === "rgb(204, 251, 241)" &&
    (await simBtn.evaluate((el) => el.style.color)) === "rgb(15, 118, 110)");
  await demoCard.screenshot({ path: `${SHOTS}/review-card-footer-fixed-open.png` });
  await simBtn.click();
  await page.waitForTimeout(250);
  ok("13f. повторный клик: блок скрыт, текст и стили кнопки восстановлены",
    (await bizZone.isHidden()) &&
    norm(await simBtn.innerText()) === "⚙️ Сэмулировать: Я владелец «Мебельного цеха на Ленина»" &&
    (await simBtn.evaluate((el) => el.style.background)) === "" &&
    (await simBtn.evaluate((el) => el.style.color)) === "");

  // 13g) ИИ-фильтр: агрессия → alert, ветка НЕ запечатывается
  const dialogs = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    d.accept();
  });
  await simBtn.click();
  await page.waitForTimeout(200);
  await demoCard.locator("#fixed-biz-text-input").fill("Вы все врете, сам дурак!");
  await demoCard.locator("#fixed-biz-submit-form button[type=submit]").click();
  await page.waitForTimeout(400);
  ok("13g. ИИ-фильтр: alert «ИИ-БЛОКИРОВКА…», блоки симуляции на месте (ветка не запечатана)",
    dialogs.length === 1 &&
    dialogs[0].includes("ИИ-БЛОКИРОВКА") &&
    dialogs[0].includes("Манифесту SakhMatrix") &&
    (await bizZone.count()) === 1 &&
    (await simZone.count()) === 1);

  // 13h) конструктивный ответ: симуляция уничтожается, ветка запечатывается
  await demoCard.locator("#fixed-biz-text-input").fill("Здравствуйте! Приносим извинения за задержку заказа — напишите нам в WhatsApp, решим вопрос.");
  await demoCard.locator("#fixed-biz-submit-form button[type=submit]").click();
  await page.waitForTimeout(400);
  const fin = demoCard.locator("#fixed-final-viewport");
  ok("13h. сабмит: #biz-response-field-block и .sim-toggle-zone удалены, .official-final-rendered-answer выведен",
    (await bizZone.count()) === 0 &&
    (await simZone.count()) === 0 &&
    (await fin.locator(".official-final-rendered-answer").count()) === 1);
  ok("13h-2. содержимое 1-в-1: шапка, текст в «кавычках», замок «Цепочка обсуждения закрыта»",
    norm(await fin.locator("strong").textContent()) === "Официальный ответ организации:" &&
    norm(await fin.locator("p").textContent()) ===
      "«Здравствуйте! Приносим извинения за задержку заказа — напишите нам в WhatsApp, решим вопрос.»" &&
    norm(await fin.locator("span").textContent()) ===
      "🔒 Ответ зафиксирован. Цепочка обсуждения закрыта по Манифесту SakhMatrix.");
  ok("13i. инлайн-стили заказчика: блок #e2e8f0, рейка слева 4px #0f766e, шапка uppercase #0f766e",
    (await st(fin.locator(".official-final-rendered-answer"), "backgroundColor")) === "rgb(226, 232, 240)" &&
    (await st(fin.locator(".official-final-rendered-answer"), "borderLeftWidth")) === "4px" &&
    (await st(fin.locator(".official-final-rendered-answer"), "borderLeftColor")) === "rgb(15, 118, 110)" &&
    (await st(fin.locator(".official-final-rendered-answer strong"), "textTransform")) === "uppercase" &&
    (await st(fin.locator(".official-final-rendered-answer strong"), "color")) === "rgb(15, 118, 110)");
  await demoCard.screenshot({ path: `${SHOTS}/review-card-footer-fixed-sealed.png` });

  // 14) ТЗ 2026-09-22 (раунд 2): присланный компонент SakhMatrixReviewCard —
  // демо-записи sakh-001…003 в начале ленты, в порядке массива, до карточек БД.
  // ЦВЕТА: Tailwind v4 отдаёт палитру в OKLCH/Lab, поэтому сравнение — с
  // эталонным элементом, которому задан тот же класс-утилита (twProp).
  const twProp = (cls, prop) =>
    page.evaluate(({ c, p }) => {
      const el = document.createElement("div");
      el.className = c;
      el.style.cssText = "position:fixed;left:-9999px;visibility:hidden";
      document.body.appendChild(el);
      const v = getComputedStyle(el)[p];
      el.remove();
      return v;
    }, { c: cls, p: prop });
  const demoBy = (nick) => page.locator(".rc-col-main .rc-democard", { hasText: nick });
  const d1 = demoBy("IslandVibe_65");
  const d2 = demoBy("Aniva_Drift");
  const d3 = demoBy("Korsakov_Fish");
  const demoAll = page.locator(".rc-col-main .rc-democard", { hasText: "SakhMatrix не формирует официальный список" });
  ok("14. три карточки клиента, в порядке массива, до карточек БД",
    (await d1.count()) === 1 && (await d2.count()) === 1 && (await d3.count()) === 1 &&
    (await demoAll.count()) === 3 &&
    await page.evaluate(() => {
      const demo = document.querySelector(".rc-col-main .rc-democard");
      const db = document.querySelector(".rc-col-main article.matrix-review-card");
      return !!(demo && db && (demo.compareDocumentPosition(db) & Node.DOCUMENT_POSITION_FOLLOWING));
    }));
  // 14a) шапка sakh-001: крошки 10px uppercase tracking-widest zinc-400, строка автора
  const d1cat = d1.locator("span").first();
  ok("14a. sakh-001: крошки 1-в-1 (10px/uppercase/zinc-400/tracking-widest), «Автор • локация • дата» 14px/700/zinc-800",
    norm(await d1cat.textContent()) === "Кулинарная книга ▸ Сахалинская кухня ▸ Где поесть" &&
    (await st(d1cat, "fontSize")) === "10px" &&
    (await st(d1cat, "textTransform")) === "uppercase" &&
    (await st(d1cat, "letterSpacing")) === "1px" &&
    (await st(d1cat, "color")) === (await twProp("text-zinc-400", "color")) &&
    norm(await d1.locator("h4").textContent()).startsWith("IslandVibe_65 • Южно-Сахалинск, ул. Пуркаева • 21.09.2026") &&
    (await st(d1.locator("h4"), "fontSize")) === "14px" &&
    (await st(d1.locator("h4"), "fontWeight")) === "700" &&
    (await st(d1.locator("h4"), "color")) === (await twProp("text-zinc-800", "color")));
  const d1badge = d1.locator("span", { hasText: "Предупреждаю" });
  ok("14b. sakh-001: бейдж «⚠️ Предупреждаю» (border-red-400, text-red-700, bg-red-50/30)",
    norm(await d1badge.textContent()) === "⚠️ Предупреждаю" &&
    (await st(d1badge, "borderTopColor")) === (await twProp("border border-red-400", "borderTopColor")) &&
    (await st(d1badge, "color")) === (await twProp("text-red-700", "color")) &&
    (await st(d1badge, "backgroundColor")) === (await twProp("bg-red-50/30", "backgroundColor")));
  ok("14c. sakh-001: текст опыта 1-в-1 (14px zinc-700, whitespace-pre-line)",
    norm(await d1.locator("p").first().textContent()).startsWith("Взяли пян-се на вынос в точке на Пуркаева") &&
    (await st(d1.locator("p").first(), "fontSize")) === "14px" &&
    (await st(d1.locator("p").first(), "color")) === (await twProp("text-zinc-700", "color")) &&
    (await st(d1.locator("p").first(), "whiteSpace")) === "pre-line");
  const d1hh = d1.locator("div", { hasText: "Особое упоминание сотрудника:" }).last();
  ok("14d. sakh-001: «Особое упоминание сотрудника:» (bg-zinc-50, граница слева zinc-300, 12px) + Наталья",
    norm(await d1hh.textContent()).includes("Особое упоминание сотрудника:") &&
    norm(await d1hh.textContent()).includes("продавца Наталью") &&
    (await st(d1hh, "backgroundColor")) === (await twProp("bg-zinc-50", "backgroundColor")) &&
    (await st(d1hh, "borderLeftWidth")) === "1px" &&
    (await st(d1hh, "borderLeftColor")) === (await twProp("border border-zinc-300", "borderLeftColor")) &&
    (await st(d1hh, "fontSize")) === "12px");
  const d1disc = d1.locator("p", { hasText: "SakhMatrix не формирует" });
  ok("14e. sakh-001: глобальный дисклеймер [2] с ником автора (11px zinc-400)",
    norm(await d1disc.textContent()).includes("Публикация отражает личный опыт автора") &&
    norm(await d1disc.locator("span").textContent()) === "IslandVibe_65" &&
    norm(await d1disc.textContent()).includes("SakhMatrix не формирует официальный список «плохих» или «хороших» организаций и не является автором данного утверждения. [2]") &&
    (await st(d1disc, "fontSize")) === "11px" &&
    (await st(d1disc, "color")) === (await twProp("text-zinc-400", "color")));
  const d1label = d1.locator("span", { hasText: "Официальная позиция организации" });
  const d1resp = d1.locator("div", { hasText: "«Провели проверку технологических карт" }).last();
  ok("14f. sakh-001: «Официальная позиция организации» (10px uppercase teal-600) + ответ в «кавычках» (bg-teal-50/20, рейка 2px teal-600)",
    norm(await d1label.textContent()) === "Официальная позиция организации" &&
    (await st(d1label, "fontSize")) === "10px" &&
    (await st(d1label, "textTransform")) === "uppercase" &&
    (await st(d1label, "color")) === (await twProp("text-teal-600", "color")) &&
    norm(await d1resp.locator("p").textContent()).startsWith("«Провели проверку технологических карт на точке Пуркаева за 21.09") &&
    (await st(d1resp.locator("p"), "fontStyle")) === "italic" &&
    (await st(d1resp, "borderLeftWidth")) === "2px" &&
    (await st(d1resp, "borderLeftColor")) === (await twProp("border border-teal-600", "borderLeftColor")) &&
    (await st(d1resp, "backgroundColor")) === (await twProp("bg-teal-50/20", "backgroundColor")));
  ok("14g. sakh-002: бейдж «👍 Рекомендую» (border-emerald-500, text-emerald-700, bg-emerald-50/40) + ответ",
    norm(await d2.locator("span", { hasText: "Рекомендую" }).textContent()) === "👍 Рекомендую" &&
    (await st(d2.locator("span", { hasText: "Рекомендую" }), "borderTopColor")) === (await twProp("border border-emerald-500", "borderTopColor")) &&
    (await st(d2.locator("span", { hasText: "Рекомендую" }), "color")) === (await twProp("text-emerald-700", "color")) &&
    (await st(d2.locator("span", { hasText: "Рекомендую" }), "backgroundColor")) === (await twProp("bg-emerald-50/40", "backgroundColor")) &&
    norm(await d2.locator("h4").textContent()).startsWith("Aniva_Drift • с. Стародубское / Корсаков • 18.09.2026") &&
    norm(await d2.locator("p").last().textContent()).startsWith("«Благодарим за оценку нашего труда"));
  ok("14h. sakh-003: warning, крошки с «Цены», блока выделения НЕТ (null), ответ 1-в-1",
    (await d3.count()) === 1 &&
    (await d3.locator("span", { hasText: "Предупреждаю" }).count()) === 1 &&
    norm(await d3.locator("span").first().textContent()) === "Товары и услуги ▸ Цены ▸ Отзывы и рекомендации" &&
    (await d3.locator("div", { hasText: "Особое упоминание сотрудника:" }).count()) === 0 &&
    norm(await d3.locator("h4").textContent()).startsWith("Korsakov_Fish • Корсаков / Южно-Сахалинск • 20.09.2026") &&
    norm(await d3.locator("p").last().textContent()).startsWith("«Мы дорожим репутацией нашего корсаковского цеха"));
  ok("14i. ТЗ 2026-09-24: карточки на всю ширину, рамка часов rgb(74,104,140), компакт p-3 (12px); интерактив — ровно 2 голосовые (.rc-votebtn) + 1 ссылка форума (a.rc-btn-forum, рубрика, относительный путь); без input; корень div.rc-democard.select-none",
    (await d1.locator("input,select,textarea").count()) === 0 &&
    (await d2.locator("input,select,textarea").count()) === 0 &&
    (await d3.locator("input,select,textarea").count()) === 0 &&
    (await d1.locator("button.rc-votebtn").count()) === 2 &&
    (await d2.locator("button.rc-votebtn").count()) === 2 &&
    (await d3.locator("button.rc-votebtn").count()) === 2 &&
    (await d1.locator("a.rc-btn-forum").count()) === 1 &&
    (await d2.locator("a.rc-btn-forum").count()) === 1 &&
    (await d3.locator("a.rc-btn-forum").count()) === 1 &&
    ((await d1.locator("a.rc-btn-forum").getAttribute("href")) || "").startsWith("/forum/category/tovary-i-uslugi--otzyvy-i-rekomendacii") &&
    (await d1.evaluate((el) => !el.classList.contains("matrix-review-card") && el.classList.contains("select-none") && el.classList.contains("rc-democard") && el.getBoundingClientRect().width > 600)) &&
    (await st(d1, "borderTopColor")) === "rgb(74, 104, 140)" &&
    (await st(d1, "borderTopWidth")) === "1px" &&
    (await st(d1, "borderRadius")) === "0px" &&
    (await st(d1, "paddingTop")) === "12px");
  await d1.screenshot({ path: `${SHOTS}/demo-sakh-001.png` });
  await d2.screenshot({ path: `${SHOTS}/demo-sakh-002.png` });
  await d3.screenshot({ path: `${SHOTS}/demo-sakh-003.png` });

  // 14j/14k) демо-блок скрыт в «Моих публикациях» и при поиске
  // (?mine=1 только пишется в URL при клике, при загрузке не читается —
  // вкладку включаем кликом, как пользователь)
  await pageAuthor.locator(".rc-navlist button", { hasText: "Мои публикации" }).click();
  await pageAuthor.waitForTimeout(900);
  ok("14j. «Мои публикации»: демо-карточек нет",
    (await pageAuthor.locator(".rc-col-main .rc-democard", { hasText: "SakhMatrix не формирует" }).count()) === 0);
  await page.locator('.rc-search input[aria-label="Поиск по публикациям"]').fill("пян-се");
  await page.locator(".rc-search button", { hasText: "Найти" }).click();
  await page.waitForTimeout(900);
  ok("14k. поиск: демо-карточки скрыты",
    (await demoAll.count()) === 0);
  await page.locator(".rc-search-reset").click();
  await page.waitForTimeout(700);
  ok("14k-2. сброс поиска: демо-карточки вернулись",
    (await demoAll.count()) === 3);

  // 10) мобайл 375
  const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mob.goto(BASE + "/rekomenduyu", { waitUntil: "domcontentloaded", timeout: 45000 });
  await mob.waitForSelector(".matrix-review-card", { timeout: 60000 });
  await mob.waitForTimeout(1000);
  const sw = await mob.evaluate(() => document.documentElement.scrollWidth);
  ok("10. мобайл 375: без горскролла", sw <= 375, `sw=${sw}`);
  await mob.locator(".matrix-review-card").first().screenshot({ path: `${SHOTS}/review-card-mobile.png` });

  // 15) ТЗ 2026-09-22: первая линия автоматической пре-модерации отзывов
  // — ярлыки → СТОП с точной подсказкой заказчика; личные данные → СТОП;
  // капслок/мат/угрозы → БЛОК; фактурный негатив (примеры клиента) — пропущен.
  const PREMOD_HINT = "Пожалуйста, опишите конкретную ситуацию и ваш личный опыт без перехода на личности";
  await pageAuthor.locator(".rc-addbtn").first().click();
  await pageAuthor.waitForSelector(".sk-modal", { timeout: 15000 });
  await pageAuthor.locator("#rc-f-subject").fill("Пекарня на Комсомольской");
  await pageAuthor.locator("#rc-f-title").fill("Там работают дебилы");
  await pageAuthor.locator("#rc-f-text").fill("Директор — вор, контора мошенников. Обвесили на 200 грамм!");
  await pageAuthor.locator("#review-manifest-agree").check();
  await pageAuthor.locator(".sk-modal .sk-btn-classic").click();
  await pageAuthor.waitForTimeout(900);
  ok("15a. UI: ярлыки → .sk-modal-err с ТОЧНОЙ подсказкой заказчика (1-в-1)",
    norm(await pageAuthor.locator(".sk-modal-err").textContent()) === PREMOD_HINT,
    norm(await pageAuthor.locator(".sk-modal-err").textContent()));
  await pageAuthor.screenshot({ path: `${SHOTS}/review-form-premod-hint.png` });
  await pageAuthor.locator(".sk-modal-x").click();
  await pageAuthor.waitForTimeout(300);

  // API-вердикты первой линии (POST /api/recommend от автора)
  const pre = (payload) =>
    pageAuthor.evaluate(async (p) => {
      const r = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      return { status: r.status, body: await r.json() };
    }, payload);
  const preBase = { token: tokenAuthor, stance: "notrecommend", confirmSimilar: true, place: "", humanHighlight: "" };
  const rIns = await pre({ ...preBase, subject: "Пекарня на Комсомольской", title: "Ярлыки вместо фактов", text: "Там работают дебилы, директор — вор." });
  ok("15b. API ярлыки → 422 return/insults, подсказка 1-в-1",
    rIns.status === 422 && rIns.body.premoderation === "return" && rIns.body.rule === "insults" && rIns.body.hint === PREMOD_HINT,
    JSON.stringify(rIns.body));
  const rPers = await pre({ ...preBase, subject: "Служба доставки «Стрела»", title: "Личные данные в отзыве", text: "Курьер вёл себя грубо: это его номер +7 914 123-45-67, он проживает по адресу ул. Ленина, 25, кв. 7." });
  ok("15c. API личные данные физлиц → 422 return/personal_data",
    rPers.status === 422 && rPers.body.premoderation === "return" && rPers.body.rule === "personal_data",
    JSON.stringify(rPers.body));
  const rThr = await pre({ ...preBase, subject: "Служба доставки «Стрела»", title: "Угрозы блокируются", text: "Курьер опоздал на два часа, я приеду и набью ему лицо, мокрое место оставлю." });
  ok("15d. API угрозы физической расправы → 400 block/threats",
    rThr.status === 400 && rThr.body.premoderation === "block" && rThr.body.rule === "threats",
    JSON.stringify(rThr.body));
  const rProf = await pre({ ...preBase, subject: "СТО на Сахалинской", title: "Мат блокируется", text: "Поставили какую-то хуйню вместо детали, всё окончательно развалилось." });
  ok("15e. API мат → 400 block/profanity",
    rProf.status === 400 && rProf.body.premoderation === "block" && rProf.body.rule === "profanity",
    JSON.stringify(rProf.body));
  const rCaps = await pre({ ...preBase, subject: "Рыбный отдел на Сахалинской", title: "КАПСЛОК БЛОКИРУЕТСЯ ПРЕМОДЕРАЦИЕЙ", text: "ОБВЕШАЮТ КАЖДЫЙ РАЗ ОБСЛУЖИВАНИЕ УЖАСНОЕ ЖДАЛИ ПОЧТИ ЧАС" });
  ok("15f. API капслок → 400 block/capslock",
    rCaps.status === 400 && rCaps.body.premoderation === "block" && rCaps.body.rule === "capslock",
    JSON.stringify(rCaps.body));
  const rFact = await pre({ ...preBase, subject: "Рыбный отдел на Сахалинской", title: "Обвесили на 200 грамм, икра пересолена", text: "10 сентября купил банку икры за 3500 рублей. Икра пересолена, на дне банки много жидкости, на весах обвес 200 грамм. Возможно, сломался холодильник — продукт испортился. Больше сюда не приду, не рекомендую." });
  ok("15g. API фактурный негатив ЗАКАЗЧИКА ПРОПУЩЕН (даты/цены/факты/предположение/«не приду»)",
    rFact.status === 200 && rFact.body.ok === true && typeof rFact.body.id === "string",
    JSON.stringify({ status: rFact.status, ok: rFact.body.ok }));
  const rAddr = await pre({ ...preBase, subject: "Пекарня на Комсомольской", title: "Бизнес-адрес — не личные данные", text: "Магазин находится по адресу ул. Пуркаева, 15. 18 сентября мне продали остывший пирог, отказались вернуть деньги. Не рекомендую." });
  ok("15h. API бизнес-адрес НЕ флаг personal_data — негатив пропущен",
    rAddr.status === 200 && rAddr.body.ok === true && typeof rAddr.body.id === "string",
    JSON.stringify({ status: rAddr.status, ok: rAddr.body.ok }));
  const rEdit = await pageAuthor.evaluate(async ({ id, tok }) => {
    const r = await fetch(`/api/recommend/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tok, action: "edit", subject: "Рыбный отдел на Сахалинской", title: "Обвесили на 200 грамм", text: "Директор — вор, контора мошенников." }),
    });
    return { status: r.status, body: await r.json() };
  }, { id: rFact.body.id, tok: tokenAuthor });
  ok("15i. PATCH-правка с ярлыком → 422 return/insults (первая линия работает и на правке)",
    rEdit.status === 422 && rEdit.body.rule === "insults" && rEdit.body.hint === PREMOD_HINT,
    JSON.stringify(rEdit.body));
  for (const id of [rFact.body.id, rAddr.body.id].filter(Boolean)) {
    await pageAuthor.evaluate(async ({ pid, tok }) => {
      const r = await fetch(`/api/recommend/${pid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tok, action: "delete" }),
      });
      if (r.status !== 200) throw new Error(`delete failed: ${r.status}`);
    }, { pid: id, tok: tokenAuthor });
  }
  ok("15j. контрольные публикации удалены (БД чиста)",
    (await prisma.recPost.findMany({ where: { id: { in: [rFact.body.id, rAddr.body.id].filter(Boolean) }, isDeleted: false } })).length === 0);

  // 16) ТЗ 2026-09-22: симулятор логики примирения SakhMatrixResolutionSimulator
  // (прислан 1-в-1, Tailwind) — после демо-записей sakh-001…003, до карточек БД.
  const sim = page.locator(".rc-col-main .rc-simcard", { hasText: "Панель автора (Симулятор логики)" });
  ok("16. симулятор в ленте: единственный, после sakh-003, до карточек БД",
    (await sim.count()) === 1 &&
    await page.evaluate(() => {
      const simEl = document.querySelector(".rc-col-main .rc-simcard");
      const demos = [...document.querySelectorAll(".rc-col-main .rc-democard")];
      const d3 = demos[demos.length - 1];
      const db = document.querySelector(".rc-col-main article.matrix-review-card");
      return !!(simEl && d3 && db &&
        (d3.compareDocumentPosition(simEl) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        (simEl.compareDocumentPosition(db) & Node.DOCUMENT_POSITION_FOLLOWING));
    }));
  // 16a) исходное состояние: шапка + бейдж warning (red)
  const simCat = sim.locator("span").first();
  const simWarn = sim.locator("span", { hasText: "Предупреждаю" });
  ok("16a. шапка 1-в-1: крошки 10px/uppercase, «IslandVibe_65 • … • 21.09.2026», бейдж «⚠️ Предупреждаю» (red-400/red-700/red-50/30)",
    norm(await simCat.textContent()) === "Кулинарная книга ▸ Сахалинская кухня ▸ Где поесть" &&
    (await st(simCat, "fontSize")) === "10px" &&
    (await st(simCat, "textTransform")) === "uppercase" &&
    (await st(simCat, "color")) === (await twProp("text-zinc-400", "color")) &&
    norm(await sim.locator("h4").textContent()).startsWith("IslandVibe_65 • Южно-Сахалинск, ул. Пуркаева • 21.09.2026") &&
    (await st(sim.locator("h4"), "fontSize")) === "14px" &&
    (await st(sim.locator("h4"), "fontWeight")) === "700" &&
    norm(await simWarn.textContent()) === "⚠️ Предупреждаю" &&
    (await st(simWarn, "borderTopColor")) === (await twProp("border border-red-400", "borderTopColor")) &&
    (await st(simWarn, "color")) === (await twProp("text-red-700", "color")) &&
    (await st(simWarn, "backgroundColor")) === (await twProp("bg-red-50/30", "backgroundColor")) &&
    (await sim.locator("span", { hasText: "Вопрос закрыт" }).count()) === 0);
  // 16b) текст сценария (СВОЙ текст симулятора — без «капусты» из демо-данных)
  // + дисклеймер Пункта 7
  const simText = sim.locator("p").first();
  const simDisc = sim.locator("div", { hasText: "Публикация отражает личный опыт автора" }).last();
  ok("16b. текст сценария 1-в-1 (pre-line) + дисклеймер «SakhMatrix не формирует официальных списков.»",
    norm(await simText.textContent()) ===
      "Взяли пян-се на вынос в точке на Пуркаева. Тесто влажное, начинки наполовину меньше обычного. Всегда покупали здесь, но в этот раз качество подвело." &&
    (await st(simText, "whiteSpace")) === "pre-line" &&
    (await st(simText, "fontSize")) === "14px" &&
    (await st(simText, "color")) === (await twProp("text-zinc-700", "color")) &&
    norm(await simDisc.textContent()) ===
      "* Публикация отражает личный опыт автора. SakhMatrix не формирует официальных списков." &&
    (await st(simDisc, "fontSize")) === "11px" &&
    (await st(simDisc, "color")) === (await twProp("text-zinc-400", "color")) &&
    (await st(simDisc, "borderTopColor")) === (await twProp("border-zinc-100", "borderTopColor")));
  // 16c) блок «Официальный статус организации» — бизнес не верифицирован
  const simStatus = sim.locator("div", { hasText: "Организация еще не заявила права" }).last();
  ok("16c. «Официальный статус организации»: заглушка неверифицированного бизнеса (bg-zinc-50, italic)",
    norm(await simStatus.locator("span").textContent()) === "Официальный статус организации" &&
    (await st(simStatus.locator("span"), "textTransform")) === "uppercase" &&
    (await st(simStatus.locator("span"), "color")) === (await twProp("text-zinc-400", "color")) &&
    norm(await simStatus.locator("p").textContent()) ===
      "Организация еще не заявила права на профиль. Публичные споры в карточке запрещены." &&
    (await st(simStatus.locator("p"), "fontStyle")) === "italic" &&
    (await st(simStatus, "backgroundColor")) === (await twProp("bg-zinc-50", "backgroundColor")) &&
    (await st(simStatus, "borderTopColor")) === (await twProp("border-zinc-100", "borderTopColor")));
  // 16d) панель автора: dashed-граница, заголовок, две кнопки
  const simPanel = sim.locator("div", { hasText: "Панель автора (Симулятор логики)" }).last();
  const forumBtn = simPanel.locator("button", { hasText: "Обсудить проблему на форуме" });
  const resolveBtn = simPanel.locator("button", { hasText: "Ошибка исправлена / Претензий нет" });
  ok("16d. панель автора: dashed, заголовок 11px uppercase, кнопки форума и примирения 1-в-1",
    (await st(simPanel, "borderTopStyle")) === "dashed" &&
    (await st(simPanel, "backgroundColor")) === (await twProp("bg-zinc-50/50", "backgroundColor")) &&
    norm(await simPanel.locator("span").first().textContent()) === "Панель автора (Симулятор логики)" &&
    (await st(simPanel.locator("span").first(), "textTransform")) === "uppercase" &&
    (await forumBtn.count()) === 1 &&
    (await resolveBtn.count()) === 1 &&
    norm(await forumBtn.textContent()) === "💬 Обсудить проблему на форуме" &&
    norm(await resolveBtn.textContent()) === "🤝 Ошибка исправлена / Претензий нет" &&
    (await st(forumBtn, "textTransform")) === "uppercase" &&
    (await st(forumBtn, "backgroundColor")) === (await twProp("bg-white", "backgroundColor")) &&
    (await st(resolveBtn, "backgroundColor")) === (await twProp("bg-zinc-900", "backgroundColor")) &&
    (await st(resolveBtn, "color")) === (await twProp("text-white", "color")));
  await sim.screenshot({ path: `${SHOTS}/simulator-initial.png` });
  // 16e) hover-стили заказчика (transition-colors, 300мс)
  await forumBtn.hover();
  await page.waitForTimeout(500);
  const ok16e = (await st(forumBtn, "borderTopColor")) === (await twProp("border border-zinc-900", "borderTopColor"));
  await resolveBtn.hover();
  await page.waitForTimeout(500);
  ok("16e. hover: кнопка форума → border-zinc-900, примирения → bg-teal-600",
    ok16e &&
    (await st(resolveBtn, "backgroundColor")) === (await twProp("bg-teal-600", "backgroundColor")));
  await page.mouse.move(0, 0);
  await page.waitForTimeout(500);
  // 16f) ПОВЕДЕНИЕ ПО ТЗ 2026-09-23 (единовременная синхронизация): кнопка
  // симулятора делает РЕАЛЬНЫЙ переход в рубрику «Товары и услуги ▸ Отзывы
  // и рекомендации» (локальная плашка «Ссылка на форум создана» — только
  // мгновенный отклик до перехода, на экране не виден).
  {
    const before = page.url();
    await forumBtn.click();
    await page.waitForURL("**/forum/category/tovary-i-uslugi--otzyvy-i-rekomendacii*", { timeout: 30000 });
    ok("16f. форум: клик «Обсудить проблему на форуме» ведёт в рубрику «Товары и услуги ▸ Отзывы и рекомендации» (относительный путь)",
      page.url().startsWith(BASE + "/forum/category/tovary-i-uslugi--otzyvy-i-rekomendacii") && page.url() !== before,
      page.url().replace(BASE, ""));
    const rubric = await page.evaluate(() => document.body.innerText);
    ok("16f-2. рубрика открылась (список тем, не «Рубрика не найдена»)", !rubric.includes("Рубрика не найдена"));
    await page.screenshot({ path: `${SHOTS}/simulator-forum.png` });
    // Возврат: локальное состояние симулятора сбрасывается (документировано)
    await page.goto(BASE + "/rekomenduyu", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector(".rc-col-main .rc-simcard", { timeout: 60000 });
    await page.waitForTimeout(800);
  }
  // 16g) примирение: resolved-бейдж (teal), opacity-75, панель исчерпана
  await resolveBtn.click();
  await page.waitForTimeout(600);
  const simResolved = sim.locator("span", { hasText: "Вопрос закрыт" });
  ok("16g. примирение: бейдж «✓ Вопрос закрыт / Претензий нет» (teal-600/teal-700/teal-50/50), кнопок нет, панель исчерпана",
    (await simWarn.count()) === 0 &&
    (await simResolved.count()) === 1 &&
    norm(await simResolved.textContent()) === "✓ Вопрос закрыт / Претензий нет" &&
    (await st(simResolved, "borderTopColor")) === (await twProp("border border-teal-600", "borderTopColor")) &&
    (await st(simResolved, "color")) === (await twProp("text-teal-700", "color")) &&
    (await st(simResolved, "backgroundColor")) === (await twProp("bg-teal-50/50", "backgroundColor")) &&
    (await simPanel.locator("button").count()) === 0 &&
    norm(await simPanel.locator("p").textContent()) ===
      "Конфликт успешно исчерпан. История взаимоотношений сохранена в экосистеме." &&
    (await st(simPanel.locator("p"), "fontStyle")) === "italic");
  ok("16g-2. карточка затемнена: opacity-75 с transition-all duration-300",
    (await st(sim.locator("div").first(), "opacity")) === "0.75" &&
    (await st(sim.locator("div").first(), "transitionProperty")) === "all" &&
    (await st(sim.locator("div").first(), "transitionDuration")) === "0.3s");
  await sim.screenshot({ path: `${SHOTS}/simulator-resolved.png` });
  // 16h) состояние локальное: после перезагрузки — исходное (в БД симулятор не пишет)
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rc-col-main .rc-simcard", { timeout: 60000 });
  await page.waitForTimeout(800);
  const simR = page.locator(".rc-col-main .rc-simcard", { hasText: "Панель автора (Симулятор логики)" });
  ok("16h. перезагрузка: исходное состояние восстановлено (warning + обе кнопки)",
    (await simR.count()) === 1 &&
    (await simR.locator("span", { hasText: "Предупреждаю" }).count()) === 1 &&
    (await simR.locator("span", { hasText: "Вопрос закрыт" }).count()) === 0 &&
    (await simR.locator("button", { hasText: "Обсудить проблему на форуме" }).count()) === 1 &&
    (await simR.locator("button", { hasText: "Ошибка исправлена / Претензий нет" }).count()) === 1);
  // 16i) видимость как у демо-записей: нет при поиске и в «Моих публикациях»
  await page.locator('.rc-search input[aria-label="Поиск по публикациям"]').fill("пян-се");
  await page.locator(".rc-search button", { hasText: "Найти" }).click();
  await page.waitForTimeout(900);
  ok("16i. поиск: симулятор скрыт",
    (await page.locator(".rc-col-main .rc-simcard", { hasText: "Панель автора" }).count()) === 0);
  await page.locator(".rc-search-reset").click();
  await page.waitForTimeout(700);
  ok("16i-2. сброс поиска: симулятор вернулся",
    (await page.locator(".rc-col-main .rc-simcard", { hasText: "Панель автора" }).count()) === 1);
  await pageAuthor.locator(".rc-navlist button", { hasText: "Мои публикации" }).click();
  await pageAuthor.waitForTimeout(900);
  ok("16i-3. «Мои публикации»: симулятора нет",
    (await pageAuthor.locator(".rc-col-main .rc-simcard", { hasText: "Панель автора" }).count()) === 0);
  // 16j) мобайл 375: симулятор без горскролла
  const mobSim = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mobSim.goto(BASE + "/rekomenduyu", { waitUntil: "domcontentloaded", timeout: 45000 });
  await mobSim.waitForSelector(".rc-col-main .rc-simcard", { timeout: 60000 });
  await mobSim.waitForTimeout(800);
  const swSim = await mobSim.evaluate(() => document.documentElement.scrollWidth);
  ok("16j. мобайл 375: симулятор без горскролла", swSim <= 375, `sw=${swSim}`);
  await mobSim.locator(".rc-col-main .rc-simcard", { hasText: "Панель автора" }).screenshot({ path: `${SHOTS}/simulator-mobile.png` });
  await mobSim.close();

  console.log("PROBE DONE");
} finally {
  await browser.close();
  try {
    const ids = [NICK_AUTHOR, NICK_VOTER, NICK_ORG];
    const users = await prisma.user.findMany({ where: { nickname: { in: ids } } });
    for (const u of users) {
      await prisma.recUsefulVote.deleteMany({ where: { userId: u.id } });
      await prisma.recComplaint.deleteMany({ where: { post: { authorId: u.id } } });
      await prisma.recPost.deleteMany({ where: { authorId: u.id } });
      await prisma.session.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
    console.log(`CLEANUP OK (${users.length} users)`);
  } catch (e) {
    console.log("CLEANUP FAIL:", e instanceof Error ? e.message : String(e));
  }
  await prisma.$disconnect();
}
