#!/usr/bin/env bun
/**
 * SakhMatrix — «Театр ботов» (TS-версия, бесплатно через z-ai-web-dev-sdk).
 * Аналог scripts/theatre-bots/rewriter.py, но без DeepSeek и без VPN.
 *
 * Применение:
 *   bun scripts/theatre-bots.ts scripts/theatre-bots/news-example.json --save
 *   bun scripts/theatre-bots.ts --text "Сегодня на перевале ограничили движение" --source "@astv_ru" --save
 *   bun scripts/theatre-bots.ts --clean-bots
 */

import ZAI from "z-ai-web-dev-sdk";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { randomBytes } from "crypto";

const db = new PrismaClient();

const SCRIPT_DIR = resolve(__dirname);
const DEFAULT_NEWS_FILE = resolve(SCRIPT_DIR, "theatre-bots/news-example.json");
const OUTPUT_FILE = resolve(SCRIPT_DIR, "theatre-bots/output.json");

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const SYSTEM_PROMPT = `Ты — интеллектуальный конвейер генерации контента "Театр ботов"
для сахалинского портала взаимопомощи SAKHMATRIX.RU.

Твоя задача: взять сухую новость острова Сахалин и превратить её
в реалистичный мини-диалог местных жителей из 2-3 реплик строго
по ролям.

ЛОГИКА ДИАЛОГА:
Реплики строятся по цепочке: Реакция → Возражение/Уточнение →
Бытовая деталь со стороны разных персонажей.

ЖЕСТКОЕ ПРАВИЛО «ГЕОГРАФИЧЕСКИЙ КАПКАН»:
1. Запрещено выдумывать новые улицы, маршруты объезда, навигацию.
2. Автозамены: "Южно-Сахалинск" → "Южный", "Сахалинская область" →
   "остров", "аэропорт Хомутово" → "аэропорт".
3. Если нет чётких геопривязок — размытые фразы: "там", "на перевале",
   "в нашем районе".

ЖЁСТКИЕ ТАБУ (МГНОВЕННЫЙ БАН):
Полный запрет на политику, СВО, чиновников, криминал, ДТП, трагедии.

ПРАВИЛО РЕГИСТРА И ОПЕЧАТОК:
Если ник бота записан ПОЛНОСТЬЮ СТРОЧНЫМИ буквами (например: driver,
vovan, мамочка), текст генерируется СТРОГО В НИЖНЕМ РЕГИСТРЕ —
без единой заглавной буквы и с минимальной пунктуацией.
Допускай случайные опечатки с вероятностью 30%.

СПИСОК ПЕРСОНАЖЕЙ (выбирай 2-3 под тему новости):
Кириллица (стандартный регистр): Дизелист, Штурман, Егерь, Турист,
Ворчун, Серёга, Михалыч, Толян, Хозяйка, Дачница.
Кириллица (нижний регистр): пассажир, свояк, попутчица, мамочка,
кошатница.
Латиница (стандарт): Boss, Caesar, Churchill, Plato.
Латиница (нижний): driver, hunter, biker, newton, lincoln, napoleon,
Lady, cleopatra, eva, Fox, sandra.
Транслит (все нижний регистр): vovan, svoyak, vsedorozhnik, garazh,
sanek, tolyan, mikhalych, ribak, kabanchik, putnik, khozyayka,
blondinka, mamochka, poputchica, lenka.

ФОРМАТ ВЫХОДНЫХ ДАННЫХ:
Возвращай СТРОГО чистый JSON-массив из 2-3 объектов, без markdown,
без лишнего текста.
Шаблон:
[{"username": "ИмяБота", "text": "текст реплики"}, {"username": "ИмяБота2", "text": "Текст реплики"}]`;

interface DialogEntry {
  username: string;
  text: string;
}

interface NewsInput {
  source?: string;
  text: string;
  date?: string;
  link?: string;
  place?: string;
}

interface CliArgs {
  newsFile?: string;
  text?: string;
  source?: string;
  place?: string;
  save: boolean;
  cleanBots: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { save: false, cleanBots: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--save") args.save = true;
    else if (a === "--dry-run") args.save = false;
    else if (a === "--clean-bots") args.cleanBots = true;
    else if (a === "--text") args.text = argv[++i];
    else if (a === "--source") args.source = argv[++i];
    else if (a === "--place") args.place = argv[++i];
    else if (!a.startsWith("--")) args.newsFile = a;
  }
  return args;
}

function loadNews(args: CliArgs): NewsInput {
  if (args.text) {
    return {
      text: args.text,
      source: args.source || "",
      place: args.place || "",
      date: new Date().toISOString().slice(0, 10),
      link: "",
    };
  }
  const file = args.newsFile && existsSync(args.newsFile) ? args.newsFile : DEFAULT_NEWS_FILE;
  if (!existsSync(file)) {
    console.error(`❌ Файл новости не найден: ${file}`);
    process.exit(1);
  }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf-8")) as NewsInput;
    if (!parsed.text || typeof parsed.text !== "string") {
      console.error(`❌ В файле новости отсутствует обязательное поле 'text'`);
      process.exit(1);
    }
    return parsed;
  } catch (e) {
    console.error(`❌ Не удалось распарсить JSON новости: ${e}`);
    process.exit(1);
  }
}

function buildUserPrompt(news: NewsInput): string {
  return `Новости с Сахалина:

Источник: ${news.source || ""}
Дата: ${news.date || ""}
Ссылка: ${news.link || ""}

Текст новости:
${news.text}

Преврати эту новость в мини-диалог 2-3 жителей Сахалина.
Верни СТРОГО JSON-массив, без markdown-обёртки.`;
}

async function callZai(systemPrompt: string, userPrompt: string): Promise<string> {
  const zai = await ZAI.create();
  const completion = await Promise.race([
    zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      thinking: { type: "disabled" },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI timeout (45s)")), 45000)
    ),
  ]);
  return completion.choices[0]?.message?.content ?? "";
}

function parseDialog(raw: string): DialogEntry[] | null {
  if (!raw) return null;
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text
      .split("\n")
      .filter((l) => !l.trim().startsWith("```"))
      .join("\n")
      .trim();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return null;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    for (const key of ["dialog", "replies", "messages", "data", "result"]) {
      if (Array.isArray(obj[key])) return obj[key] as DialogEntry[];
    }
    if (typeof obj.username === "string" && typeof obj.text === "string") {
      return [obj as unknown as DialogEntry];
    }
    return null;
  }
  if (Array.isArray(parsed)) return parsed as DialogEntry[];
  return null;
}

function validateDialog(dialog: unknown): dialog is DialogEntry[] {
  if (!Array.isArray(dialog)) return false;
  if (dialog.length < 2 || dialog.length > 3) return false;
  return dialog.every((e) => {
    if (!e || typeof e !== "object") return false;
    const obj = e as Record<string, unknown>;
    return typeof obj.username === "string" && obj.username.trim() !== "" &&
           typeof obj.text === "string" && obj.text.trim() !== "";
  });
}

function printDialog(dialog: DialogEntry[], news: NewsInput): void {
  console.log("\n" + "=".repeat(60));
  console.log("🎭 ТЕАТР БОТОВ — РЕЗУЛЬТАТ (через z-ai-web-dev-sdk / Z.ai, бесплатно)");
  console.log("=".repeat(60));
  console.log(`\n📰 Новость: ${news.text.slice(0, 80)}...`);
  console.log(`📅 Дата:    ${news.date || "?"}`);
  console.log(`🔗 Ссылка: ${news.link || "?"}`);
  console.log(`📣 Источник: ${news.source || "?"}`);
  if (news.place) console.log(`📍 Место: ${news.place}`);
  console.log("\n" + "-".repeat(60));
  dialog.forEach((entry, i) => {
    console.log(`\n  [${i + 1}] ${entry.username}:`);
    console.log(`      ${entry.text}`);
  });
  console.log("\n" + "-".repeat(60));
  console.log(`Всего реплик: ${dialog.length}`);
  console.log("=".repeat(60) + "\n");
}

function botEmail(nick: string): string {
  const slug = nick.toLowerCase().replace(/[^a-z0-9а-яё_-]/giu, "").slice(0, 30) || "bot";
  return `bot+${slug}@theatre.local`;
}

function randomHash(): string {
  return crypto.createHash("sha256").update(randomBytes(32).toString()).digest("hex");
}

async function ensureBotUser(nick: string): Promise<{ id: string; nickname: string }> {
  const normNick = nick.normalize("NFC").trim();
  const email = botEmail(normNick);
  const byEmail = await db.user.findUnique({ where: { email } });
  if (byEmail) return { id: byEmail.id, nickname: byEmail.nickname };
  const byNick = await db.user.findUnique({ where: { nickname: normNick } });
  if (byNick) return { id: byNick.id, nickname: byNick.nickname };
  const created = await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: randomHash(),
      nickname: normNick,
      role: "user",
      gender: "unspecified",
      emailVerified: false,
      bio: "Бот «Театра ботов» — генерируется автоматически из новостей Сахалина.",
    },
  });
  console.log(`  ✓ Создан бот-пользователь: ${normNick} (${created.email})`);
  return { id: created.id, nickname: created.nickname };
}

async function saveDialogToOverheard(dialog: DialogEntry[], news: NewsInput): Promise<number> {
  let saved = 0;
  for (const entry of dialog) {
    const user = await ensureBotUser(entry.username);
    await db.overheardPost.create({
      data: {
        title: entry.text.slice(0, 80).trim() + (entry.text.length > 80 ? "…" : ""),
        text: entry.text,
        place: news.place || "",
        tag: "message",
        authorId: user.id,
        authorName: user.nickname,
        aiStatus: "ok",
        isHiddenByAi: false,
        isDeleted: false,
      },
    });
    console.log(`  ✓ Пост в «Подслушано»: id=${saved} — @${user.nickname}`);
    saved++;
  }
  return saved;
}

async function cleanBots(): Promise<void> {
  const bots = await db.user.findMany({
    where: { email: { endsWith: "@theatre.local" } },
    select: { id: true, nickname: true },
  });
  if (bots.length === 0) {
    console.log("ℹ Ботов театра не найдено — удалять нечего.");
    return;
  }
  for (const b of bots) {
    const r = await db.overheardPost.deleteMany({ where: { authorId: b.id } });
    console.log(`  • ${b.nickname}: удалено постов ${r.count}`);
  }
  const del = await db.user.deleteMany({ where: { email: { endsWith: "@theatre.local" } } });
  console.log(`✓ Удалено пользователей-ботов: ${del.count}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.cleanBots) {
    await cleanBots();
    await db.$disconnect();
    return;
  }

  const news = loadNews(args);
  console.log(`✓ Новость загружена: ${news.text.slice(0, 60)}...`);

  const userPrompt = buildUserPrompt(news);

  let dialog: DialogEntry[] | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`\n🔄 Попытка ${attempt}/${MAX_RETRIES} — запрос к z-ai-web-dev-sdk...`);
    try {
      const raw = await callZai(SYSTEM_PROMPT, userPrompt);
      console.log(`  ✓ Получен ответ (${raw.length} символов)`);
      const parsed = parseDialog(raw);
      if (!parsed) {
        console.log(`  ⚠ Не удалось распарсить JSON. Сырой ответ (первые 200 символов):`);
        console.log(`  ${raw.slice(0, 200)}`);
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
        continue;
      }
      if (!validateDialog(parsed)) {
        console.log(`  ⚠ Валидация не пройдена (нужно 2-3 объекта с username и text).`);
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
        continue;
      }
      console.log(`  ✓ Валидация пройдена: ${parsed.length} реплик`);
      dialog = parsed;
      break;
    } catch (e) {
      console.log(`  ❌ Ошибка: ${e instanceof Error ? e.message : String(e)}`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }

  if (!dialog) {
    console.error("\n❌ Все попытки исчерпаны. Проверьте сеть и SDK-конфигурацию.");
    await db.$disconnect();
    process.exit(1);
  }

  printDialog(dialog, news);

  writeFileSync(
    OUTPUT_FILE,
    JSON.stringify({ news, dialog }, null, 2),
    "utf-8"
  );
  console.log(`✓ Результат сохранён в: ${OUTPUT_FILE}`);

  if (args.save) {
    console.log("\n💾 Сохраняю реплики в БД («Подслушано»)...");
    const saved = await saveDialogToOverheard(dialog, news);
    console.log(`✓ Сохранено постов: ${saved}`);
  } else {
    console.log("\nℹ Флаг --save не задан — посты в БД не записаны.");
    console.log("  Чтобы записать реплики в «Подслушано», добавьте --save.");
  }

  await db.$disconnect();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((e) => {
  console.error("❌ Фатальная ошибка:", e);
  db.$disconnect();
  process.exit(1);
});
