// Пул ботов SMatrix (gendered) — выгружено из db/custom.db (snapshot 2026-10-12).
// Все user с email вида bot+*@theatre.local.
// Источник: db/custom.db → User where email contains "theatre.local"
//
// Используется скриптами парсинга форума для рандомного выбора автора темы/ответа
// с учётом гендерного признака.

export const BOT_POOL = [
  // --- Камчатские/Сахалинские никнеймы (k_*) ---
  { id: "cmae2ca294af746c6dfd7519b1", nickname: "Штурман",       gender: "male"   },
  { id: "cm0d9f04906a26cd5731c97fe3", nickname: "Егерь",          gender: "male"   },
  { id: "cmad71f9ef4a2605e6a584a2c2", nickname: "Турист",        gender: "male"   },
  { id: "cm548b8461aed31bb3b2034a1e", nickname: "Ворчун",        gender: "male"   },
  { id: "cme427065c90b6d82def0945f8", nickname: "Михалыч",       gender: "male"   },
  { id: "cm54b776d1c56a46a9d2b79f1c", nickname: "Серёга",        gender: "male"   },
  { id: "cm3f83de95394840d09afadb71", nickname: "Толян",         gender: "male"   },
  { id: "cmaecae86b39395a4b93f0e7f0", nickname: "Хозяйка",        gender: "female" },
  { id: "cm11d8ed6ebec46a8b289b890a", nickname: "Дачница",       gender: "female" },
  { id: "cm77b60573d2fc102031fb6e13", nickname: "пассажир",      gender: "male"   },
  { id: "cmaeccbb90417127cd5481c24f", nickname: "свояк",         gender: "male"   },
  { id: "cmd12b2cf7298556e8defb9f48", nickname: "попутчица",     gender: "female" },
  { id: "cmf73a14dd64e89d04955a3478", nickname: "мамочка",      gender: "female" },
  { id: "cm041530563b49eaded88dd721", nickname: "кошатница",     gender: "female" },
  { id: "cmc730bb3d50dc8500bed785ee", nickname: "Boss",          gender: "male"   },
  { id: "cm3b2293dab55cd627f446def5", nickname: "Caesar",        gender: "male"   },
  { id: "cm1a2dd90785694c2bf10598b0", nickname: "Churchill",     gender: "male"   },
  { id: "cm9598f74d49f9f316a4cfafb6", nickname: "Plato",         gender: "male"   },
  { id: "cm3db4c94906c10d06b7aef711", nickname: "driver",        gender: "male"   },
  { id: "cm07c3cf6a6a4a0df6bb01292c", nickname: "hunter",        gender: "male"   },
  { id: "cmfa933f86b2789e39aa0dfe97", nickname: "biker",         gender: "male"   },
  { id: "cm44ba551e69c4e44b1b741da0", nickname: "newton",        gender: "male"   },
  { id: "cm5854a25ea8be1c346c9b8989", nickname: "lincoln",       gender: "male"   },
  { id: "cm615c6ab99de18d581b68b607", nickname: "napoleon",      gender: "male"   },
  { id: "cmdcf18e4032759a0be8d370d6", nickname: "Lady",          gender: "female" },
  { id: "cm572b2e966d33fa49000e02ee", nickname: "cleopatra",     gender: "female" },
  { id: "cm861b5f71f0c0da79c08fc98b", nickname: "eva",           gender: "female" },
  { id: "cm00733f9bc897201d9dd39b38", nickname: "Fox",          gender: "female" },
  { id: "cmedc2b0fcb3ddf7fee48fae82", nickname: "sandra",       gender: "female" },
  { id: "cmbf7e1033bf0ae163eb539d5c", nickname: "vovan",         gender: "male"   },
  { id: "cm4bc9912e0970e06452422ae2", nickname: "svoyak",       gender: "male"   },
  { id: "cm51fe3c54a48a6393165a3c2b", nickname: "vsedorozhnik", gender: "male"   },
  { id: "cm364f3ee2942e51add3189eb3", nickname: "garazh",       gender: "male"   },
  { id: "cm60ebeb97e2b8e79504a19e68", nickname: "sanek",        gender: "male"   },
  { id: "cm05048e07ed5441ecaeaacd1c", nickname: "tolyan",       gender: "male"   },
  { id: "cm04adab7125c6779f60983b07", nickname: "mikhalych",    gender: "male"   },
  { id: "cm8ceef64e75e37bd743cbb991", nickname: "ribak",        gender: "male"   },
  { id: "cm87128505519852cd1b3533ef", nickname: "kabanchik",    gender: "male"   },
  { id: "cm38ede29286bb318cebca69e6", nickname: "putnik",       gender: "male"   },
  { id: "cm7f785e152b65413454ab3f65", nickname: "khozyayka",    gender: "female" },
  { id: "cmfd95dd16bd3a64013983b70d", nickname: "blondinka",    gender: "female" },
  { id: "cmc7ce54480773f7c6ca01e550", nickname: "mamochka",     gender: "female" },
  { id: "cm635726dfdad2b0a05ac18765", nickname: "poputchica",   gender: "female" },
  { id: "cme61355435c522f85103de7b6", nickname: "lenka",        gender: "female" },
];

/**
 * Выбрать случайного бота с указанным гендером.
 * @param {("male"|"female"|"unspecified")} gender — предпочтительный гендер.
 *        Если ничего не подходит или передано unspecified — выбирается из всего пула.
 * @param {string[]} excludeIds — id ботов, которых не выбирать (чтобы не было повтора подряд).
 * @returns {{id:string, nickname:string, gender:string}}
 */
export function pickBot(gender = "unspecified", excludeIds = []) {
  let pool = BOT_POOL.filter(b => !excludeIds.includes(b.id));
  if (gender && gender !== "unspecified") {
    const filtered = pool.filter(b => b.gender === gender);
    if (filtered.length > 0) pool = filtered;
  }
  if (pool.length === 0) {
    // fallback на весь пул
    pool = BOT_POOL.filter(b => !excludeIds.includes(b.id));
  }
  if (pool.length === 0) return BOT_POOL[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

// Полный список рубрик форума (для справки):
//   1  Новости Сахалинской области
//   2  Главное
//   ...
//  117 Товары и услуги
//  118 Где купить
//  119 Услуги и специалисты
//  120 Цены
//  121 Отзывы и рекомендации
//  122 Туризм, отдых
//  137 Доставка еды
//  138 Клубы по интересам
//
// Сервисные рубрики для спецразделов:
//  130 Обсуждение «Подслушано»
//  131 Обсуждение сообщений из блоков
//  132 Где купить (wheretobuy-discuss)
//  133 ЖКХ (gkh-discuss)
//  134 Где дешевле (gdedeshevle-discuss)
//  135 Рекомендую/Не рекомендую (recommend-discuss)
//  136 О работодателях (employers-discuss)
//  139 Знакомства (znakomstva-discuss)

export const FORUM_RUBRICS = {
  NEWS: 1,
  MAIN: 2,
  GOODS_SERVICES: 117,
  WHERE_TO_BUY: 118,
  SERVICES: 119,
  PRICES: 120,
  REVIEWS: 121,
  TOURISM: 122,
  RECIPES: 91,
  REAL_ESTATE: 99,
  FISH_HUNT: 110,
  RELATIONS: 106,
  BEAUTY: 85,
  TRANSPORT: 53, // проверить в коде
  FOOD_DELIVERY: 137,
  CLUBS: 138,
};
