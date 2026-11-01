/**
 * 2026-10-01: добавить контакты в существующие тестовые объявления на
 * страницах Знакомства, Объявления, Нужна помощь. После ТЗ «контакты
 * обязательны» — старые тестовые записи без контактов остаются без
 * видимого способа связи; этот скрипт приводит их в соответствие.
 *
 * Подход:
 *   • Знакомства (DatingPost): контакт вшит в body. Склеиваем к body
 *     строку вида «Telegram: @xxxx_yss» — чтобы was visible в карточке
 *     (отдельного поля contactData у модели нет).
 *   • Объявления (AdListing): контакт в поле contact. Меняем «WhatsApp по ЛС»
 *     и плейсхолдеры «+7 924 XXX-XX-XX» на реалистичные значения.
 *   • Нужна помощь (HelpPublication): контакт в поле contactData. Меняем
 *     шаблонные «@telegram_handle» на реалистичные ники по теме просьбы.
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function fixDating() {
  const tgNicks = [
    "@sakh_engineer", "@yuzhno_dating", "@korsakov_active", "@holmsk_girl",
    "@dolina_lady", "@aniva_man", "@fisherman_sakh", "@port_korsakov",
    "@uchitel_kor", "@buhgalter_yss", "@medsestra_dl", "@dizainer_yss",
    "@friend_holmsk", "@gory_sakh", "@fish_holmsk", "@nastolki_dl",
    "@shashlyk_anv", "@odnoklassnik_yss",
  ];
  let i = 0;
  const items = await p.datingPost.findMany({ select: { id: true, body: true } });
  for (const it of items) {
    const body = it.body || "";
    const hasContact = /\+?\d[\d\s\-()]{6,}\d|@[a-zA-Z0-9_]{3,}|t\.me\/|https?:\/\//.test(body);
    if (hasContact) continue;
    const nick = tgNicks[i % tgNicks.length];
    i++;
    const newBody = body.replace(/\.?$/, "") + `. Telegram: ${nick}`;
    await p.datingPost.update({ where: { id: it.id }, data: { body: newBody } });
    console.log("  dating:", it.id.slice(-6), "→ +", nick);
  }
  console.log("dating fixed:", i);
}

async function fixAds() {
  const sample = [
    { tg: "@give_books_yss", phone: "+7 924 111-22-33" },
    { tg: "@barter_vinil", phone: "+7 924 222-33-44" },
    { tg: "@give_mebel", phone: "+7 924 333-44-55" },
    { tg: "@pet_toys_yss", phone: "+7 924 444-55-66" },
    { tg: "@give_boards", phone: "+7 924 555-66-77" },
    { tg: "@pet_feed_yss", phone: "+7 924 666-77-88" },
    { tg: "@give_materials", phone: "+7 924 777-88-99" },
    { tg: "@need_coat_yss", phone: "+7 924 888-99-00" },
    { tg: "@need_books_yss", phone: "+7 924 999-00-11" },
    { tg: "@give_laptop", phone: "+7 924 100-20-30" },
    { tg: "@need_stroller", phone: "+7 924 200-30-40" },
    { tg: "@found_keys", phone: "+7 924 300-40-50" },
    { tg: "@found_phone_yss", phone: "+7 924 400-50-60" },
    { tg: "@found_cat_yss", phone: "+7 924 500-60-70" },
    { tg: "@barter_books_yss", phone: "+7 924 600-70-80" },
    { tg: "@barter_tyres", phone: "+7 924 700-80-90" },
  ];
  let i = 0;
  const items = await p.adListing.findMany({ select: { id: true, contact: true } });
  for (const it of items) {
    const c = (it.contact || "").trim();
    // Пустой контакт или «WhatsApp по ЛС» или плейсхолдер с XXX — заменить.
    const isPlaceholder = !c || /по ЛС|XXX-XX-XX/.test(c);
    if (!isPlaceholder) continue;
    const pick = sample[i % sample.length];
    i++;
    const newContact = `Telegram ${pick.tg}, телефон ${pick.phone}`;
    await p.adListing.update({ where: { id: it.id }, data: { contact: newContact } });
    console.log("  ads:", it.id.slice(-6), "→", newContact);
  }
  console.log("ads fixed:", i);
}

async function fixHelp() {
  const handles = [
    "@kitten_search_yss", "@cat_rescue_sakh", "@sakh_volonter",
    "@help_neighbor_yss", "@dacha_help", "@pet_search_holmsk",
    "@old_pc_donate", "@korsakov_care", "@transport_help", "@elder_care_sakh",
    "@give_away_yss", "@urgent_help_sakh", "@food_aid_yss", "@winter_help",
    "@med_aid_sakh", "@repair_help",
  ];
  let i = 0;
  const items = await p.helpPublication.findMany({ select: { id: true, title: true, contactData: true } });
  for (const it of items) {
    const c = (it.contactData || "").trim();
    // Шаблонный «@telegram_handle» или пустое — заменить на реалистичный ник.
    if (!c || c === "@telegram_handle") {
      const h = handles[i % handles.length];
      i++;
      const phone = `+7 924 ${100 + i}-XX-XX`;
      const newContact = `Telegram ${h}, телефон ${phone}`;
      await p.helpPublication.update({ where: { id: it.id }, data: { contactData: newContact } });
      console.log("  help:", it.id.slice(-6), "→", newContact);
    }
  }
  console.log("help fixed:", i);
}

async function main() {
  console.log("=== Знакомства ===");
  await fixDating();
  console.log("\n=== Объявления ===");
  await fixAds();
  console.log("\n=== Нужна помощь ===");
  await fixHelp();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
