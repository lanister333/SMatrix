// src/lib/bot-theatre.ts
// «ТЕАТР БОТОВ» — единый модуль: selector + Z.ai-rewriter + queue.
// 2026-10-12: 45 ботов из bots.json, рерайт через Z.ai (glm-5.3-flash),
// 3-6 реплик на тему, задержка 15мин-2ч, премодерация в админке.

import { db } from "@/lib/db";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────
// 1. Bot Theatre Bot — User record where bio JSON contains theatre metadata
// ─────────────────────────────────────────────────────────────────────────

export interface TheatreBot {
  id: string;
  nickname: string;
  gender: "female" | "male" | "unspecified";
  group: "Кириллица" | "Латиница" | "Транслит";
  topics: string[];
  activityWeight: number; // 1..5
  isLowercase: boolean;
}

/**
 * Загружает всех ботов «Театра ботов» из БД (User.email LIKE '%@theatre.local').
 * Bio содержит JSON: { group, topics, activity_weight, is_lowercase, role: 'theatre_bot' }
 */
export async function loadTheatreBots(): Promise<TheatreBot[]> {
  const users = await db.user.findMany({
    where: { email: { contains: "@theatre.local" } },
    select: { id: true, nickname: true, bio: true, gender: true },
  });
  const bots: TheatreBot[] = [];
  for (const u of users) {
    if (!u.bio) continue;
    try {
      const meta = JSON.parse(u.bio);
      if (meta.role !== "theatre_bot") continue;
      // 2026-10-20 Этап 5: пропускать удалённых ботов (bio.deleted === true)
      if (meta.deleted === true) continue;
      const gender: TheatreBot["gender"] =
        u.gender === "female" ? "female" :
        u.gender === "male" ? "male" : "unspecified";
      bots.push({
        id: u.id,
        nickname: u.nickname,
        gender,
        group: meta.group,
        topics: Array.isArray(meta.topics) ? meta.topics : [],
        activityWeight: typeof meta.activity_weight === "number" ? meta.activity_weight : 1,
        isLowercase: !!meta.is_lowercase,
      });
    } catch {
      // skip malformed bio
    }
  }
  return bots;
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Selector — выбирает 3-6 ботов под тему по соответствию тематикам
// ─────────────────────────────────────────────────────────────────────────

/**
 * Тематические ключевые слова темы → рубрики ботов.
 * Боты имеют topics: ["Авто", "Ремонт", ...] — функция сравнивает их с
 * ключевыми словами из текста темы.
 */
const TOPIC_KEYWORDS: Record<string, string[]> = {
  "Авто": ["авто", "машина", "дорог", "трасс", "шиномонтаж", "ремонт авто", "седан", "кузов", "двигатель", "карбюратор"],
  "Дороги": ["дорог", "трасс", "пробк", "светофор", "перекрест", "мост", "развязк"],
  "Ремонт": ["ремонт", "мастер", "отделк", "шпаклев", "сантехник", "труб", "проводк", "электрик"],
  "Рыбалка": ["рыб", "клёв", "клюёт", "удочк", "спиннинг", "наживк", "леска", "катушк", "карась", "щука", "навага", "корюшка"],
  "Охота": ["охот", "ружьё", "ружье", "патрон", "зверь", "утк", "гусь"],
  "Выезды": ["выезд", "поездк", "путешеств", "маршрут", "природ", "пикник"],
  "Природа": ["природ", "лес", "горы", "море", "пляж", "гриб", "ягод"],
  "ЖКХ": ["жкх", "квартплат", "отоплени", "водоканал", "счетчик", "тепло", "канализац"],
  "Цены": ["цен", "стоимост", "сколько стоит", "подорож", "подешеве", "зарплат", "з/п"],
  "Быт": ["бытов", "кафе", "ресторан", "столов", "кушать", "покушать", "еда", "завтрак", "обед", "ужин"],
  "Дети": ["дети", "ребёнок", "ребенок", "школа", "садик", "детсад", "урок"],
  "Животные": ["собак", "кот", "кош", "ветеринар", "животн"],
  "Сад": ["дач", "сажен", "рассад", "огород", "грядк", "теплиц"],
  "Споры": ["спор", "обсуждаем", "как вам", "что думаете", "кто что скажет"],
  "Критика": ["отзыв", "критик", "обман", "мошеннич", "3,14", "попахивает", "подозреваю"],
  "Ирония": ["ирон", "шутк", "прикол", "смеётесь", "шучу"],
  "Философия": ["философ", "смысл", "зачем", "почему"],
  "Авторитарные": ["надо", "должны", "обязан", "по закону"],
  "Мото": ["мото", "мотоцикл", "байк", "питбайк", "эндуро"],
  "Спорт": ["спорт", "фитнес", "зал", "тренировк"],
  "Флуд": ["флуд", "поболтать", "поговорим", "здравствуйте", "всем привет"],
  "Знакомства": ["знакомств", "познакомлюсь", "встречусь", "девушк", "парен"],
  "Универсал": [],
  "Краткие": [],
};

/**
 * Female-only темы: косметология, эндокринолог (женское здоровье),
 * гинеколог, бьюти, женская одежда, дети, «девушки подскажите».
 * Если тема содержит эти ключевые слова — selector выбирает ТОЛЬКО female ботов.
 */
const FEMALE_ONLY_KEYWORDS: string[] = [
  "косметолог", "чистка лица", "бьюти", "beauty",
  "эндокринолог", "гинеколог", "женский врач",
  "девушки и женщины", "девушки, подскажите", "девчонки", "девочки, подскажите",
  "девчёнк", "девченк", "девочки подскажите",  // обращение «к девчёнкам/девочкам»
  "маникюр", "педикюр", "брови", "ресниц", "наращивание",
  "ламинирование", "парикмахер",
  "окрашивани", "балаяж", "волос", "кудрявый метод", "шатуш", "мелировани",
  "беременност", "роды", "гв", "грудное вскармливание",
  "эпиляц", "шугаринг",
  "йог", "пилатес",  // йога/пилатес — преимущественно женские студии
  "косметик",  // уход за кожей
];

/**
 * Male-only темы: авто-ремонт, мото, рыбалка/охота, тяжёлая техника.
 * Если тема содержит эти ключевые слова — selector выбирает ТОЛЬКО male ботов.
 */
const MALE_ONLY_KEYWORDS: string[] = [
  "шиномонтаж", "карбюратор", "свечи зажигания", "двигатель", "коробка передач",
  "эндуро", "питбайк", "кроссач", "сцепление",
  "охота ружьё", "ствол", "патрон", "калибр",
  "спиннинг", "катушк", "блесна", "джиг", "воблер",
];

/**
 * Определяет, является ли тема female-only или male-only.
 * Возвращает "female" | "male" | null (null = нейтральная, оба пола).
 */
function detectGenderRestriction(text: string): "female" | "male" | null {
  const lower = text.toLowerCase();
  if (FEMALE_ONLY_KEYWORDS.some((kw) => lower.includes(kw))) return "female";
  if (MALE_ONLY_KEYWORDS.some((kw) => lower.includes(kw))) return "male";
  return null;
}

/**
 * Определяет тематики темы по тексту.
 */
function detectTopics(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (topic === "Универсал" || topic === "Краткие") continue;
    if (keywords.some((kw) => lower.includes(kw))) {
      found.add(topic);
    }
  }
  // Всегда добавляем "Универсал" — подходит любая тема
  found.add("Универсал");
  // Если тема короткая (< 100 символов) и приветственная — добавляем "Краткие" и "Флуд"
  if (text.length < 200 && /привет|здравствуйте|всем/i.test(text)) {
    found.add("Флуд");
  }
  return Array.from(found);
}

/**
 * Считает score бота под тему: кол-во совпадающих тематик × activity_weight.
 */
function scoreBot(bot: TheatreBot, detectedTopics: string[]): number {
  let score = 0;
  for (const topic of detectedTopics) {
    if (bot.topics.includes(topic)) {
      score += 1;
    }
  }
  // бонус за activity_weight — активные боты чаще появляются
  score += bot.activityWeight * 0.3;
  return score;
}

/**
 * Выбирает 3-6 ботов под тему.
 * Алгоритм:
 *   1. Считаем score каждого бота (совпадение тем × activity_weight).
 *   2. Берём топ-50% по score.
 *   3. Из них взвешенно-случайно выбираем 3-6 (вес = score + 0.5 для минимума).
 *   4. Гарантируем: не более 2 ботов из одной группы (Кириллица/Латиница/Транслит).
 */
export function selectBots(bots: TheatreBot[], topicText: string, countRange: [number, number] = [3, 6]): TheatreBot[] {
  const detected = detectTopics(topicText);
  // 2026-10-12: gender restriction — female-only / male-only темы (косметология, эндокринолог, шиномонтаж и т.д.)
  const genderRestriction = detectGenderRestriction(topicText);
  const filteredBots = genderRestriction
    ? bots.filter((b) => b.gender === genderRestriction)
    : bots;
  const scored = filteredBots
    .map((b) => ({ bot: b, score: scoreBot(b, detected) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  // Берём топ-60% от тех, у кого score > 0
  const cutoff = Math.max(8, Math.ceil(scored.length * 0.6));
  const pool = scored.slice(0, cutoff).map((x) => x.bot);

  if (pool.length < countRange[0]) {
    // Если пул слишком маленький — дополняем случайными ботами (из того же gender-restricted набора)
    const remaining = filteredBots.filter((b) => !pool.some((p) => p.id === b.id));
    while (pool.length < countRange[0] && remaining.length > 0) {
      const idx = Math.floor(Math.random() * remaining.length);
      pool.push(remaining.splice(idx, 1)[0]);
    }
  }

  // Взвешенно-случайный выбор 3-6 ботов, не более 2 из одной группы
  const [minN, maxN] = countRange;
  const target = minN + Math.floor(Math.random() * (maxN - minN + 1));
  const selected: TheatreBot[] = [];
  const groupCount: Record<string, number> = {};

  // Перемешиваем пул с учётом score (вес = score + 0.5)
  const weighted: TheatreBot[] = [];
  for (const b of pool) {
    const w = Math.max(1, Math.ceil(scoreBot(b, detected) * 2));
    for (let i = 0; i < w; i++) weighted.push(b);
  }
  // Shuffle
  for (let i = weighted.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [weighted[i], weighted[j]] = [weighted[j], weighted[i]];
  }

  for (const b of weighted) {
    if (selected.length >= target) break;
    if (selected.some((s) => s.id === b.id)) continue;
    const g = b.group;
    if ((groupCount[g] || 0) >= 2) continue; // не более 2 из одной группы
    selected.push(b);
    groupCount[g] = (groupCount[g] || 0) + 1;
  }

  return selected;
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Rewriter — Z.ai рерайт темы в 3-6 реплик от лица ботов
// ─────────────────────────────────────────────────────────────────────────

// 2026-10-12: используем internal-api.z.ai (sandbox config) — рабочий токен
// лежит в /etc/.z-ai-config на VPS. Endpoint: internal-api.z.ai/v1/chat/completions
// Headers: Authorization: Bearer Z.ai, X-Token: <jwt>, X-User-Id, X-Chat-Id, X-Z-AI-From: Z
import fs from "fs";
import os from "os";
import path from "path";

interface ZaiConfig {
  baseUrl: string;
  apiKey: string;
  token?: string;
  userId?: string;
  chatId?: string;
}

let _zaiConfig: ZaiConfig | null = null;
function loadZaiConfig(): ZaiConfig {
  if (_zaiConfig) return _zaiConfig;
  const homeDir = os.homedir();
  const configPaths = [
    path.join(process.cwd(), ".z-ai-config"),
    path.join(homeDir, ".z-ai-config"),
    "/etc/.z-ai-config",
  ];
  for (const filePath of configPaths) {
    try {
      const configStr = fs.readFileSync(filePath, "utf-8");
      const config = JSON.parse(configStr);
      if (config.baseUrl && config.apiKey) {
        _zaiConfig = config;
        return config;
      }
    } catch {
      // try next path
    }
  }
  throw new Error("Z.ai config not found in .z-ai-config (cwd, home, or /etc/)");
}

const ZAI_MODEL = "glm-4-plus";

interface ZaiReply {
  username: string;
  text: string;
}

/**
 * Рерайт темы в 3-6 реплик-диалог от лица выбранных ботов через Z.ai.
 * Возвращает массив { username, text }.
 */
export async function rewriteTopicWithBots(topicText: string, bots: TheatreBot[]): Promise<ZaiReply[]> {
  const config = loadZaiConfig();
  const url = `${config.baseUrl}/chat/completions`;

  // Формируем описание персонажей для промпта
  const charDesc = bots
    .map((b, i) => {
      const topicsStr = b.topics.join(", ");
      const style = b.isLowercase ? "нижний регистр, сленг, как в мессенджере" : "обычный регистр, разговорный";
      return `${i + 1}. ${b.nickname} (темы: ${topicsStr}; активность: ${b.activityWeight}/5; стиль: ${style})`;
    })
    .join("\n");

  const systemPrompt = `Ты — «Театр ботов» для сахалинского форума SakhMatrix.
Задача: пересказать тему форума простым разговорным языком от лица 3-6 разных ботов-персонажей.

ВАЖНЫЕ ПРАВИЛА:
- Это НЕ официальное медиа. Мы — сарафанное радио.
- Только факты из темы, никакой отсебятины, никаких выдуманных адресов, цен, имён.
- Каждый персонаж пишет от первого лица, 1-3 коротких предложения.
- Стиль: бытовой, мессенджерный, как живой форум.
- Lowercase-персонажи пишут без заглавных (опечатка допускается 30%).
- Замены: «Южно-Сахалинск» → «Южный», «Сахалинская область» → «остров».

САХАЛИНСКИЙ СЛЕНГ (используй НЕ БОЛЕЕ 15% слов в каждом сообщении, естественно встраивая):
- Кукса — лапша быстрого приготовления
- Уёк — мойва
- Чилим — креветка
- Зубатка — крупная корюшка
- Пруль — праворульный автомобиль
- Копытить — тяжело работать
- Вкатывать — нравиться, приносить удовольствие
- Пульный — похожий, такой же
- Гольный — чистый, полнейший
- Позоруха — позор
- Гопка — шайка, компания
- Богодул — алкоголик, бомж
- Потеха — автомобильная магнитола
- Аргамак — снегокат
- Пузотёрка — низкий автомобиль
- Клоповка — местная ягода (красница)
- Чимча — кимчи
- Пянсе — пирожки на пару
- Хачи — палочки для еды
- Фанза — ветхий барак
- Корка — смешно
- Кубатурить — думать, размышлять
- Шваркаться — ходить туда-сюда без дела
- Юкола — вяленая рыба
- Материк — континентальная Россия
- Эн-бэн-цо — камень-ножницы-бумага
- «Через Корсаков» — очень долго добираться
- «До корейской Пасхи» — никогда
- «На 16-м до конечной» — сойти с ума
- Муфта / тяпка — автоматическая коробка передач
- Титаны — литые диски
Сленг должен звучать органично, не как словарь. Если слово не подходит по смыслу — не вставляй.

ВАЖНОЕ ПРАВИЛО ПРО ПОЛ:
- Female-боты НЕ откликаются на ремонт, строительство, сантехнику, электрику, кровлю, отделку, автомобили (ремонт), технику.
- Если тема про ремонт/строительство — отвечают только male-боты (маляр, строитель, электрик, сантехник, автослесарь).
- Female-боты пишут про быт, дети, сад, косметику, здоровье, покупки, моду, готовку, животных, школу, отношения.
- НЕ вставляй пояснения сленга в скобках! Слово должно стоять как естественное, без перевода.
  Плохо: «купил чилим (креветку)»
  Хорошо: «купил чилим»

КРИТИЧЕСКИЕ ПРАВИЛА ЛОГИКИ ТЕМЫ:
- Тема должна быть ОДНОРОДНОЙ — не смешивай разные несвязанные предметы в одной теме.
  Плохо: «Где купить мочалку оптом в Тепличном?» (мочалка + опт + Тепличное — 3 разные темы)
  Хорошо: «Где купить мочалку подешевле?»
- НЕ используй ОПТ, КОММЕРЦИЮ, ПАРТИИ — это некоммерческий раздел, обычные люди ищут вещи для себя.
- ТЕПЛИЧНОЕ — это совхоз по производству овощей (не место для мочалок/бытовых вещей).
- Если предмет копеечный (мочалка, губка, зубочистка) — НЕ поднимай тему «где дешевле», это бессмысленно.
- Логика: предмет + город + конкретная ситуация. Без взаимоисключающих комбинаций.
- Рынок «Техник» (или просто «на Технике») — основной и самый большой рынок в Южном-Сахалинске. Там есть ВСЁ: продукты, морепродукты, рыба, вещи, бытовое, электроника, одежда, инструменты. Используй как ОСНОВНОЕ место для любых тем про покупки.
- Рынок «Новость» (или «на Новости») — второе место для морепродуктов/раков/рыбы.
- НЕ используй федеральные сети (DNS, Эльдорадо, Сельпо, Фуд-Сити, Стройдвор) и не выдумывай другие названия.
- Никогда НЕ повторяй один и тот же факт одинаково у разных ботов — каждый видит тему по-своему.
- Не используй эмодзи, если только персонаж не «пацанский» или «девчоночьий» стиль.

ПЕРСОНАЖИ:
${charDesc}

ФОРМАТ ОТВЕТА — строго JSON, без markdown, без \`\`\`:
{"replies": [{"username": "ТочныйНикИзСписка", "text": "реплика от первого лица..."}]}

Количество реплик = ${bots.length} (столько же, сколько персонажей в списке выше).`;

  const userPrompt = `Тема форума:
${topicText}

Перепиши эту тему в диалог от лица всех ${bots.length} персонажей выше. Верни JSON.`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
    "X-Z-AI-From": "Z",
  };
  if (config.token) headers["X-Token"] = config.token;
  if (config.userId) headers["X-User-Id"] = config.userId;
  if (config.chatId) headers["X-Chat-Id"] = config.chatId;

  const payload = {
    model: ZAI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 1500,
    thinking: { type: "disabled" },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Z.ai HTTP ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await resp.json()) as any;
  const content = data?.choices?.[0]?.message?.content || "";
  const parsed = parseLlmJson(content);
  if (!parsed || !Array.isArray(parsed.replies)) {
    throw new Error(`Z.ai returned malformed JSON: ${content.slice(0, 200)}`);
  }
  return parsed.replies as ZaiReply[];
}

function parseLlmJson(raw: string): any {
  if (!raw) return null;
  let text = raw.trim();
  // Strip ```json ... ``` fences
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting {...} from text
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Queue — сохраняет реплики в BotQueue для премодерации
// ─────────────────────────────────────────────────────────────────────────

export interface QueueResult {
  batchId: string;
  queuedCount: number;
  items: { id: string; botNickname: string; text: string; order: number }[];
}

/**
 * Сохраняет массив реплик в BotQueue — каждая реплика = отдельная запись.
 * Все реплики одного батча имеют один batchId (для группировки в UI модерации).
 * rubricId — куда публиковать (если topicId null — будет создана новая тема).
 * topicId — если уже есть тема (например, ответ админа в существующей теме).
 * parentMessageId — если реплика отвечает на конкретное сообщение.
 */
export async function queueForModeration(
  replies: ZaiReply[],
  opts: {
    sourceText: string;
    rubricId?: number | null;
    topicId?: number | null;
    parentMessageId?: string | null;
    topicTitle?: string | null;
  },
): Promise<QueueResult> {
  const batchId = crypto.randomUUID();
  const bots = await loadTheatreBots();
  const botByNick = new Map(bots.map((b) => [b.nickname, b]));

  const items: QueueResult["items"] = [];
  for (let i = 0; i < replies.length; i++) {
    const r = replies[i];
    const bot = botByNick.get(r.username);
    if (!bot) {
      console.warn(`[bot-theatre] Bot "${r.username}" not found in DB, skipping`);
      continue;
    }
    const q = await db.botQueue.create({
      data: {
        botUserId: bot.id,
        botNickname: bot.nickname,
        text: r.text,
        sourceText: opts.sourceText,
        topicId: opts.topicId ?? null,
        parentMessageId: opts.parentMessageId ?? null,
        rubricId: opts.rubricId ?? null,
        topicTitle: opts.topicTitle ?? null,
        status: "pending",
        order: i,
        batchId,
        meta: JSON.stringify({ group: bot.group, activityWeight: bot.activityWeight, isLowercase: bot.isLowercase }),
      },
    });
    items.push({ id: q.id, botNickname: bot.nickname, text: r.text, order: i });
  }

  return { batchId, queuedCount: items.length, items };
}

// ─────────────────────────────────────────────────────────────────────────
// 5. END-TO-END — обработать тему: выбрать ботов → рерайт → поставить в очередь
// ─────────────────────────────────────────────────────────────────────────

export interface ProcessTopicResult {
  batchId: string;
  selectedBots: { nickname: string; group: string }[];
  queuedCount: number;
  queueItems: { id: string; botNickname: string; text: string; order: number }[];
}

/**
 * Обрабатывает одну тему:
 *   1. Загружает всех ботов
 *   2. Выбирает 3-6 под тему
 *   3. Рерайт через Z.ai
 *   4. Сохраняет в BotQueue для премодерации
 */
export interface ProvidedReply {
  botNickname: string;
  text: string;
  delayMin?: number;
}

export async function processTopic(
  topicText: string,
  opts: {
    rubricId?: number | null;
    topicId?: number | null;
    parentMessageId?: string | null;
    topicTitle?: string | null;
    // 2026-10-20 Этап 4: готовые ответы от пользователя + доп. боты
    providedReplies?: ProvidedReply[];
    extraBotRepliesCount?: number;
    useSakhalinSlang?: boolean;
  } = {},
): Promise<ProcessTopicResult> {
  const bots = await loadTheatreBots();
  if (bots.length === 0) throw new Error("No theatre bots in DB");

  // Этап 4: если есть готовые ответы — используем их + добавляем extraBotRepliesCount ботов
  const extraCount = opts.extraBotRepliesCount ?? 1;
  const providedReplies = opts.providedReplies ?? [];

  let selected;
  let replies;

  if (providedReplies.length > 0) {
    // Режим A: готовые ответы от пользователя
    // Найти ботов по никнеймам из providedReplies
    const providedBots = providedReplies
      .map((r) => bots.find((b) => b.nickname === r.botNickname))
      .filter((b): b is TheatreBot => b !== undefined);

    // Выбрать дополнительных ботов по тематике (исключая уже использованных)
    const usedNicks = new Set(providedBots.map((b) => b.nickname));
    const availableForExtra = bots.filter((b) => !usedNicks.has(b.nickname));
    const extraBots = selectBots(availableForExtra, topicText, [extraCount, extraCount]);

    selected = [...providedBots, ...extraBots];

    // Готовые ответы используем как есть, для доп. ботов генерируем через Z.ai
    const extraReplies = extraBots.length > 0
      ? await rewriteTopicWithBots(topicText, extraBots)
      : [];

    replies = [
      ...providedReplies.map((r) => ({ username: r.botNickname, text: r.text })),
      ...extraReplies,
    ];
  } else {
    // Режим B: обычный — все реплики генерируются через Z.ai
    selected = selectBots(bots, topicText);
    if (selected.length < 3) throw new Error(`Only ${selected.length} bots matched, need ≥3`);
    replies = await rewriteTopicWithBots(topicText, selected);
  }

  const q = await queueForModeration(replies, {
    sourceText: topicText,
    rubricId: opts.rubricId ?? null,
    topicId: opts.topicId ?? null,
    parentMessageId: opts.parentMessageId ?? null,
    topicTitle: opts.topicTitle ?? null,
  });

  return {
    batchId: q.batchId,
    selectedBots: selected.map((b) => ({ nickname: b.nickname, group: b.group })),
    queuedCount: q.queuedCount,
    queueItems: q.items,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Publish — одобренная реплика → публикуется в форум
// ─────────────────────────────────────────────────────────────────────────

/**
 * Публикует одобренную реплику из BotQueue в форум:
 *   - Если topicId задан — добавляет сообщение в существующую тему.
 *   - Если topicId null — создаёт новую тему в rubricId с заголовком topicTitle.
 *     Первая реплика батча становится сообщением №1 (корневым постом темы),
 *     остальные — ответы на него (parentId = первому сообщению).
 *   - scheduledAt = NOW() + случайная задержка 15мин-2ч (только если null).
 *   - Status → "approved" (после publish — "published").
 */
export async function approveAndScheduleQueueItem(queueId: string, customScheduledAt?: Date): Promise<{ scheduledAt: Date; topicId?: number; messageId?: string }> {
  const item = await db.botQueue.findUnique({ where: { id: queueId } });
  if (!item) throw new Error("Queue item not found");
  if (item.status !== "pending") throw new Error(`Item status is ${item.status}, expected pending`);

  // Случайная задержка 15-120 минут
  const delayMin = 15 + Math.floor(Math.random() * 105); // 15..119
  const scheduledAt = customScheduledAt ?? new Date(Date.now() + delayMin * 60_000);

  await db.botQueue.update({
    where: { id: queueId },
    data: { status: "approved", scheduledAt },
  });

  return { scheduledAt };
}

/**
 * Публикует одобренную реплику в форум (вызывается scheduler'ом когда scheduledAt наступило).
 *   - Создаёт Topic (если topicId null) с первой репликой батча как сообщением №1.
 *   - Добавляет Message (как ответ, если есть parentMessageId).
 *   - Status → "published", publishedMessageId = ID нового сообщения.
 */
export async function publishApprovedQueueItem(queueId: string): Promise<{ topicId: number; messageId: string; topicNumber: number }> {
  const item = await db.botQueue.findUnique({ where: { id: queueId } });
  if (!item) throw new Error("Queue item not found");
  if (item.status !== "approved") throw new Error(`Item status is ${item.status}, expected approved`);
  // 2026-10-27: не публиковать пустые ответы
  if (!item.text || item.text.trim().length === 0) {
    throw new Error(`Item ${queueId} has empty text — refusing to publish`);
  }

  return await db.$transaction(async (tx) => {
    let topicId = item.topicId;
    let parentMessageId = item.parentMessageId ?? null;

    // Если topicId null — создаём новую тему (только для order=0 в батче)
    if (!topicId) {
      const rubricId = item.rubricId;
      if (!rubricId) throw new Error("No rubricId for new topic");
      const title = item.topicTitle || item.text.slice(0, 70).replace(/\s+/g, " ").trim() + (item.text.length > 70 ? "…" : "");

      const lastTopic = await tx.topic.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
      const newTopicNumber = (lastTopic?.number ?? 0) + 1;

      const newTopic = await tx.topic.create({
        data: {
          number: newTopicNumber,
          title,
          source: "theatre-bots",
          authorName: item.botNickname,
          authorId: item.botUserId,
          rubricId,
          lastAuthorName: item.botNickname,
          lastActivityAt: new Date(),
        },
      });
      topicId = newTopic.id;

      // Если у этого батча есть другие реплики (order > 0), обновляем их topicId
      await tx.botQueue.updateMany({
        where: { batchId: item.batchId, id: { not: item.id } },
        data: { topicId: newTopic.id },
      });
    }

    // Считаем номер сообщения в теме
    const lastMsg = await tx.message.findFirst({
      where: { topicId },
      orderBy: { num: "desc" },
      select: { num: true, id: true },
    });
    const newMsgNum = (lastMsg?.num ?? 0) + 1;

    // 2026-10-13: НЕ привязываем новые ответы ботов к msg#1 — ответы создаются
    // как корневые узлы (parentId=null). msg#1 скрыт из ленты, его текст в шапке темы.

    // 2026-10-13: фильтр текста — удалить слово «ой» во всех формах (ой, Ой, ОЙ, ой-ой).
    // Регулярка: [Оо]й — граница слова + регистр О или о + "й" + граница слова.
    // Также удаляем "ой," в начале реплики (например "Ой, девочки..." → "девочки...").
    // Также схлопываем двойные пробелы после удаления.
    let cleanText = item.text
      .replace(/^\s*[Оо]й[Оо]й[Оо]й[Оо]й[Оо]й[,\s]*/g, "")  // "ой-ой-ой, " в начале
      .replace(/^\s*[Оо]й-?[Оо]й[,\s]*/g, "")               // "ой-ой, " в начале
      .replace(/^\s*[Оо]й[,\s]+/g, "")                       // "ой, " в начале
      .replace(/\b[Оо]й\b\.?/g, "")                          // отдельное "ой" везде
      .replace(/\s{2,}/g, " ")                                // схлопнуть двойные пробелы
      .trim();
    if (!cleanText) cleanText = item.text; // если после фильтра пусто — вернуть оригинал

    // Создаём сообщение
    const message = await tx.message.create({
      data: {
        topicId,
        num: newMsgNum,
        depth: parentMessageId ? 1 : 0,
        authorName: item.botNickname,
        authorId: item.botUserId,
        body: cleanText,
        kind: "news",
        aiStatus: "ok",
        modLevel: 4,
        aiAction: "WATCH",
        aiConfidence: 1.0,
        aiSignal: "theatre-bot",
        parentId: parentMessageId,
      },
    });

    // Обновляем тему: lastActivityAt, lastAuthorName
    await tx.topic.update({
      where: { id: topicId },
      data: {
        lastActivityAt: new Date(),
        lastAuthorName: item.botNickname,
      },
    });

    // Помечаем queue item как опубликованный
    await tx.botQueue.update({
      where: { id: queueId },
      data: {
        status: "published",
        publishedMessageId: message.id,
        topicId,  // 2026-10-12: фикс — обновляем topicId у текущего item, чтобы админка показывала кликабельную ссылку
      },
    });

    return { topicId, messageId: message.id, topicNumber: topicId };
  });
}

/**
 * Отклоняет реплику (админ удалил). Помечает как rejected.
 * Если regenerate=true — бот регенерирует новый текст через Z.ai и кладёт в очередь заново.
 */
export async function rejectQueueItem(queueId: string, reason: string = "", regenerate: boolean = true): Promise<{ regenerated: boolean; newQueueId?: string }> {
  const item = await db.botQueue.findUnique({ where: { id: queueId } });
  if (!item) throw new Error("Queue item not found");

  await db.botQueue.update({
    where: { id: queueId },
    data: { status: "rejected", rejectReason: reason },
  });

  if (!regenerate) return { regenerated: false };

  // Регенерация: загружаем всех ботов, выбираем другого бота (не того, что отклонён),
  // делаем рерайт от его лица, кладём в очередь с тем же batchId
  const bots = await loadTheatreBots();
  const otherBots = bots.filter((b) => b.id !== item.botUserId);
  if (otherBots.length === 0) return { regenerated: false };

  // Выбираем одного случайного другого бота
  const newBot = otherBots[Math.floor(Math.random() * otherBots.length)];
  const replies = await rewriteTopicWithBots(item.sourceText, [newBot]);
  if (replies.length === 0) return { regenerated: false };

  const newQ = await db.botQueue.create({
    data: {
      botUserId: newBot.id,
      botNickname: newBot.nickname,
      text: replies[0].text,
      sourceText: item.sourceText,
      topicId: item.topicId,
      parentMessageId: item.parentMessageId,
      rubricId: item.rubricId,
      topicTitle: item.topicTitle,
      status: "pending",
      order: item.order,
      batchId: item.batchId,
      meta: JSON.stringify({ group: newBot.group, activityWeight: newBot.activityWeight, isLowercase: newBot.isLowercase, regeneratedFrom: item.id }),
    },
  });

  return { regenerated: true, newQueueId: newQ.id };
}
