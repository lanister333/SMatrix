#!/usr/bin/env bun
/**
 * SakhMatrix — парсер Telegram-каналов → «Театр ботов» → Форум (Topic + Message).
 *
 * Для каждого канала из channels.json:
 *   1) Загружает https://t.me/s/<channel> (публичное web-превью, без авторизации).
 *   2) Извлекает последние сообщения (по data-post и tgme_widget_message_text).
 *   3) Фильтрует уже обработанные (по message_id в processed.json).
 *   4) Прогоняет каждое новое сообщение через LLM (z-ai-web-dev-sdk, бесплатно).
 *   5) Создаёт в БД:
 *        - Topic в правильной рубрике (по rubricSlug в channels.json)
 *        - Message #1 от бота «ТеатрБот» с исходным текстом и ссылкой
 *        - Messages #2..N от ботов-персонажей с репликами диалога
 *
 * Запуск:
 *   DATABASE_URL="file:..." bun scripts/theatre-bots/parser-telegram.ts
 *
 * Опции:
 *   --once          Обработать один раз и выйти (по умолчанию).
 *   --loop <min>    Запустить в цикле с интервалом N минут (daemon).
 *   --limit <N>     Сколько свежих постов обрабатывать на канал за один прогон (по умолч. 5).
 *   --dry-run       Не записывать в БД, только напечатать что было бы сохранено.
 *   --reset         Стереть processed.json (обработать все свежие посты заново).
 */

import ZAI from "z-ai-web-dev-sdk";
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import crypto from "crypto";

// 2026-10-06: уведомления администратора через Telegram.
// Используем тот же механизм, что и форум при жалобах.
// Уведомление отправляется ПОСЛЕ создания темы в БД — с кратким
// содержанием реплик ботов и ссылкой на очередь модерации.
const NOTIFY_BASE_URL = process.env.SAKHMATRIX_BASE_URL || "http://127.0.0.1:3000";

/**
 * Отправляет уведомление в Telegram через Bot API напрямую.
 * Используется вместо импорта src/lib/notifications.ts, потому что
 * парсер запускается как standalone-скрипт (без Next.js-окружения).
 */
async function notifyAdminTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    console.log(`${LOG_PREFIX}   ⚠ TELEGRAM_BOT_TOKEN/CHAT_ID не заданы — уведомление не отправлено`);
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.log(`${LOG_PREFIX}   ⚠ Telegram ошибка ${res.status}: ${body.slice(0, 200)}`);
    } else {
      console.log(`${LOG_PREFIX}   ✓ Уведомление отправлено в Telegram`);
    }
  } catch (e) {
    console.log(`${LOG_PREFIX}   ⚠ Telegram send failed: ${e instanceof Error ? e.message : e}`);
  }
}

const db = new PrismaClient();

const SCRIPT_DIR = resolve(__dirname);
const CHANNELS_FILE = resolve(SCRIPT_DIR, "channels.json");
const PROCESSED_FILE = resolve(SCRIPT_DIR, "processed.json");
const LOG_PREFIX = "[parser]";

// 2026-10-06: директория для сохранения фото из постов Telegram.
// Лежит в public/ — Next.js раздаёт её как статику, URL вида /media/theatre/xxx.jpg
const PHOTOS_DIR = resolve(__dirname, "..", "..", "public", "media", "theatre");
const PHOTOS_URL_PREFIX = "/media/theatre";

// ─── Конфиг ───────────────────────────────────────────────────────────

interface ChannelCfg {
  channel: string;
  category: string;
  rubricSlug: string;
}

interface ProcessedMap {
  [channel: string]: string[];
}

interface ParsedPost {
  channel: string;
  messageId: string;
  text: string;
  datetime: string | null;
  photos: string[]; // URL-ы фото из поста (cdn*.telesco.pe/file/...)
}

// ─── Лимиты ────────────────────────────────────────────────────────────

const MAX_RETRIES_LLM = 2;
const HTTP_TIMEOUT_MS = 20_000;
const LLM_TIMEOUT_MS = 45_000;
const MAX_POST_TEXT_LEN = 1500;
const MIN_POST_TEXT_LEN = 30;

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const SYSTEM_PROMPT = `Ты — интеллектуальный конвейер генерации контента "Театр ботов"
для сахалинского портала SAKHMATRIX.RU.

ВАЖНО: SakhMatrix — НЕ официальное медиа. Мы — сарафанное радио.
Не цитируй новости дословно, не используй новостной стиль.
Пересказывай всё так, как будто сосед рассказывает на лавочке
или подслушал разговор в очереди.

Твоя задача: взять сухую новость острова Сахалин и превратить её
в живой мини-диалог местных жителей из 2-3 реплик по ролям.

ЛЮБАЯ РЕПЛИКА — это рерайт простым языком, а не цитата источника.
Никакой официалки: убирай канцеляризмы, должности, формулировки
«в рамках», «по причине», «в связи с». Пиши как говорят в жизни.

РЕРАЙТ НОВОСТИ (первое сообщение темы):
Это НЕ пересказ новости. Это ОБОЗНАЧЕНИЕ темы — одно-два предложения,
простым разговорным языком, как будто бросил фразу проходя мимо.
НЕ копируй и НЕ пересказывай содержание новости подробно.

Примеры:
  - «Слышал, на трассе Южный-Оха опять асфальт кладут...»
  - «Говорят, воду отключат на неделю...»
  - «Видел сегодня лису около ТЦ!»

Только суть темы. Никаких деталей, цифр, цитат, имён.
Максимум 1-2 предложения.

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
Если в новости есть имя чиновника — убери его, оставь только суть.

РЕГИСТР И ОПЕЧАТКИ (ВАЖНО!):
Если ник бота записан ПОЛНОСТЬЮ СТРОЧНЫМИ буквами (driver, vovan,
мамочка, blondinka), текст генерируется СТРОГО В НИЖНЕМ РЕГИСТРЕ —
без единой заглавной буквы, с минимальной пунктуацией и 30% опечаток.
Если ник с заглавной — обычная грамотная речь.

ГЕНДЕР И ХАРАКТЕР НИКА (КЛЮЧЕВОЕ ПРАВИЛО):
Пол и характер реплики определяются НИКОМ бота:

МУЖСКИЕ НИКИ (муж.род реплики, мужская точка зрения):
  Кириллица: Дизелист, Штурман, Егерь, Турист, Ворчун, Серёга,
              Михалыч, Толян, пассажир, свояк, vovan, svoyak,
              sanek, tolyan, mikhalych, ribak, kabanchik, putnik,
              vsedorozhnik, garazh.
  Латиница:  Boss, Caesar, Churchill, Plato, driver, hunter, biker,
              newton, lincoln, napoleon, Fox.

ЖЕНСКИЕ НИКИ (жен.род реплики, женская интонация):
  Кириллица: Хозяйка, Дачница, попутчица, мамочка, кошатница,
              khozyayka, blondinka, mamochka, poputchica, lenka.
  Латиница:  Lady, cleopatra, eva, sandra.

ГАРАНТИИ ПО ГЕНДЕРУ:
- Если ник женский — реплика от первого лица женского рода
  ("я была", "купила", "пошла", "у меня дома").
- Если ник мужской — реплика от первого лица мужского рода
  ("я был", "купил", "пошёл", "у меня в гараже").
- Согласование прилагательных и глаголов в прошедшем времени —
  строго по полу ника.

ХАРАКТЕР РЕПЛИК ПО ТИПУ НИКА:
- Ворчун, Михалыч, Толян, Дизелист — ворчливые, недовольные,
  со ссылкой на свой опыт ("опять эти...", "в моё время...").
- Хозяйка, Дачница, мамочка, khozyayka — бытовая приземлённость,
  забота о доме/семье/урожае.
- driver, biker, vovan, sanek — простой сленг, lowercase, опечатки.
- Boss, Caesar, Plato — возвышенная, философская интонация.
- Lady, eva, cleopatra, sandra — женственная, эмоциональная.
- Турист, Егерь, ribak — уличная тематика, природа, рыбалка/охота.

АДАПТАЦИЯ ПОД РУБРИКУ:
- АВТО/транспорт → driver, biker, Дизелист, Михалыч
- ТУРИЗМ/природа → Турист, Егерь, putnik, ribak
- ЖКХ/быт → Хозяйка, Дачница, Ворчун, khozyayka
- Животные → кошатница, Егерь, ribak
- Здоровье → мамочка, Хозяйка, Lady
- Знакомства → blondinka, eva, vovan, sanek
- Новости общие → Михалыч, Толян, Ворчун, Хозяйка

ФОРМАТ ВЫХОДНЫХ ДАННЫХ:
Возвращай СТРОГО чистый JSON-объект (без markdown, без лишнего текста).
Объект содержит ДВА поля:
  - "rewrittenNews": рерайт в стиле сарафанного радио — слух с улицы,
    от первого лица (2-4 предложения). Никаких имён чиновников,
    канцеляризмов, новостной подачи. Только: «слышал», «говорят», «видел».
  - "dialog": JSON-массив из 2-3 объектов с репликами ботов:
    [{"username": "ИмяБота", "text": "текст реплики"}, ...]

Шаблон ответа:
{"rewrittenNews": "Слышал, на трассе Южный-Оха опять асфальт кладут...", "dialog": [{"username": "Дизелист", "text": "..."}, {"username": "Хозяйка", "text": "..."}]}`;

// ─── CLI ──────────────────────────────────────────────────────────────

interface CliArgs {
  loopMin: number;
  limit: number;
  dryRun: boolean;
  reset: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const a: CliArgs = { loopMin: 0, limit: 5, dryRun: false, reset: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--once") a.loopMin = 0;
    else if (v === "--loop") a.loopMin = parseInt(argv[++i] || "60", 10);
    else if (v === "--limit") a.limit = parseInt(argv[++i] || "5", 10);
    else if (v === "--dry-run") a.dryRun = true;
    else if (v === "--reset") a.reset = true;
  }
  return a;
}

// ─── processed.json ──────────────────────────────────────────────────

function loadProcessed(): ProcessedMap {
  if (!existsSync(PROCESSED_FILE)) return {};
  try {
    return JSON.parse(readFileSync(PROCESSED_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveProcessed(p: ProcessedMap): void {
  writeFileSync(PROCESSED_FILE, JSON.stringify(p, null, 2), "utf-8");
}

// ─── HTTP fetch ────────────────────────────────────────────────────────

async function fetchTgPreview(channel: string): Promise<string> {
  const url = `https://t.me/s/${channel}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

// ─── HTML → посты ──────────────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractPosts(html: string, channel: string): ParsedPost[] {
  const posts: ParsedPost[] = [];
  const postRe =
    /<div class="tgme_widget_message[^"]*"[^>]*data-post="([^"\/]+)\/(\d+)"[^>]*>([\s\S]*?)(?=<div class="tgme_widget_message[^"]*"[^>]*data-post=|<\/section>)/g;
  let m: RegExpExecArray | null;
  while ((m = postRe.exec(html)) !== null) {
    const ch = m[1];
    const msgId = m[2];
    const inner = m[3];
    if (ch !== channel) continue;

    const textMatch =
      inner.match(
        /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div class="tgme_widget_message_/
      ) ||
      inner.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/) ||
      inner.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    if (!textMatch) continue;
    let text = htmlToText(textMatch[1]);
    if (text.length < MIN_POST_TEXT_LEN) continue;
    if (text.length > MAX_POST_TEXT_LEN) text = text.slice(0, MAX_POST_TEXT_LEN);

    const timeMatch = inner.match(/<time[^>]*datetime="([^"]+)"/);
    const datetime = timeMatch ? timeMatch[1] : null;

    // 2026-10-06: извлекаем URL фото из поста.
    // В Telegram preview фото отображаются через <a class="tgme_widget_message_photo_wrap"
    // style="background-image:url(//cdn4.telesco.pe/file/...)"> или
    // <img class="tgme_widget_message_photo" src="https://cdn4.telesco.pe/file/...">
    const photos = extractPhotoUrls(inner);

    posts.push({ channel, messageId: msgId, text, datetime, photos });
  }
  return posts;
}

/** Извлекает URL-ы фото из HTML одного поста. */
function extractPhotoUrls(inner: string): string[] {
  const urls = new Set<string>();
  // Вариант 1: <a class="tgme_widget_message_photo_wrap" style="background-image:url('https://cdn4.telesco.pe/...')">
  // URL может быть в одинарных кавычках, двойных или без кавычек.
  const bgRe = /tgme_widget_message_photo_wrap[^>]*style="[^"]*background-image:url\(['"]?(https?:)?(\/\/cdn\d*\.telesco\.pe\/file\/[^)'"]+)['"]?\)/g;
  let m: RegExpExecArray | null;
  while ((m = bgRe.exec(inner)) !== null) {
    const proto = m[1] || "https:";
    urls.add(proto + m[2]);
  }
  // Вариант 2: <img class="tgme_widget_message_photo" src="https://cdn4.telesco.pe/file/...">
  const imgRe = /<img[^>]*class="[^"]*tgme_widget_message_photo[^"]*"[^>]*src="(https?:\/\/cdn\d*\.telesco\.pe\/file\/[^"]+)"/g;
  while ((m = imgRe.exec(inner)) !== null) {
    urls.add(m[1]);
  }
  return Array.from(urls).slice(0, 4); // максимум 4 фото на пост
}

/**
 * Скачивает фото и сохраняет в /public/media/theatre/<channel>_<msgId>_<n>.jpg
 * Возвращает массив публичных URL-ов для markdown-ссылок (или пустой массив).
 */
async function downloadPhotos(post: ParsedPost): Promise<string[]> {
  if (!post.photos || post.photos.length === 0) return [];
  // Создаём директорию если её нет
  try {
    mkdirSync(PHOTOS_DIR, { recursive: true });
  } catch {
    // уже существует — ок
  }

  const savedUrls: string[] = [];
  for (let i = 0; i < post.photos.length; i++) {
    const url = post.photos[i];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        console.log(`${LOG_PREFIX}   ⚠ фото HTTP ${res.status}: ${url.slice(0, 80)}…`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      // Размер: не больше 8 МБ (защита от гигантов)
      if (buf.length > 8 * 1024 * 1024) {
        console.log(`${LOG_PREFIX}   ⚠ фото слишком большое: ${buf.length} байт`);
        continue;
      }
      const ext = url.toLowerCase().endsWith(".png") ? "png" : "jpg";
      const filename = `${post.channel}_${post.messageId}_${i + 1}.${ext}`;
      const filepath = join(PHOTOS_DIR, filename);
      writeFileSync(filepath, buf);
      savedUrls.push(`${PHOTOS_URL_PREFIX}/${filename}`);
      console.log(`${LOG_PREFIX}   ✓ фото сохранено: ${filename} (${Math.round(buf.length / 1024)} КБ)`);
    } catch (e) {
      console.log(`${LOG_PREFIX}   ⚠ ошибка загрузки фото: ${e instanceof Error ? e.message : e}`);
    }
  }
  return savedUrls;
}

// ─── LLM ───────────────────────────────────────────────────────────────

function buildUserPrompt(post: ParsedPost, category: string): string {
  return `Новости с Сахалина (категория: ${category}):

Источник: @${post.channel}
Дата: ${post.datetime || new Date().toISOString()}
Ссылка: https://t.me/${post.channel}/${post.messageId}

Текст новости:
${post.text}

Преврати эту новость в мини-диалог 2-3 жителей Сахалина.
Верни СТРОГО JSON-массив, без markdown-обёртки.`;
}

interface DialogEntry {
  username: string;
  text: string;
}

async function callLlm(systemPrompt: string, userPrompt: string): Promise<string> {
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
      setTimeout(() => reject(new Error("LLM timeout")), LLM_TIMEOUT_MS)
    ),
  ]);
  return completion.choices[0]?.message?.content ?? "";
}

interface LlmResponse {
  rewrittenNews: string;
  dialog: DialogEntry[];
}

/**
 * 2026-10-07: парсинг ответа LLM — теперь объект с двумя полями:
 *   { rewrittenNews: "...", dialog: [{username, text}, ...] }
 * Если LLM вернул старый формат (массив), извлекаем dialog из массива
 * и rewrittenNews из исходного текста поста (fallback).
 */
function parseLlmResponse(raw: string, fallbackNews: string): LlmResponse | null {
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
    // Ищем JSON-объект или массив в тексте
    const objMatch = text.match(/\{[\s\S]*\}/);
    const arrMatch = text.match(/\[[\s\S]*\]/);
    const match = objMatch || arrMatch;
    if (!match) return null;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
  // Новый формат: объект с rewrittenNews и dialog
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const rewrittenNews = typeof obj.rewrittenNews === "string" ? obj.rewrittenNews.trim() : "";
    let dialog: DialogEntry[] | null = null;
    if (Array.isArray(obj.dialog)) dialog = obj.dialog as DialogEntry[];
    else if (Array.isArray(obj.replies)) dialog = obj.replies as DialogEntry[];
    else if (Array.isArray(obj.messages)) dialog = obj.messages as DialogEntry[];
    if (dialog && validateDialog(dialog) && rewrittenNews) {
      return { rewrittenNews, dialog };
    }
    // Если dialog есть, но rewrittenNews пустой — берём fallback
    if (dialog && validateDialog(dialog)) {
      return { rewrittenNews: fallbackNews, dialog };
    }
    return null;
  }
  // Старый формат: просто массив реплик
  if (Array.isArray(parsed)) {
    const dialog = parsed as DialogEntry[];
    if (validateDialog(dialog)) {
      return { rewrittenNews: fallbackNews, dialog };
    }
  }
  return null;
}

function validateDialog(d: unknown): d is DialogEntry[] {
  if (!Array.isArray(d) || d.length < 2 || d.length > 3) return false;
  return d.every((e) => {
    if (!e || typeof e !== "object") return false;
    const o = e as Record<string, unknown>;
    return typeof o.username === "string" && o.username.trim() !== "" &&
           typeof o.text === "string" && o.text.trim() !== "";
  });
}

// ─── БД: бот-пользователь ──────────────────────────────────────────────

function botEmail(nick: string): string {
  const slug = nick.toLowerCase().replace(/[^a-z0-9а-яё_-]/giu, "").slice(0, 30) || "bot";
  return `bot+${slug}@theatre.local`;
}

function randomHash(): string {
  return crypto.createHash("sha256").update(crypto.randomBytes(32).toString()).digest("hex");
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
  console.log(`${LOG_PREFIX}   ✓ Создан бот-пользователь: ${normNick} (${created.email})`);
  return { id: created.id, nickname: created.nickname };
}

// ─── БД: форум (Topic + Message) ────────────────────────────────────────

async function saveDialogToForum(
  dialog: DialogEntry[],
  post: ParsedPost,
  rubricId: number,
  category: string,
  photoUrls: string[],
  rewrittenNews: string
): Promise<{ topicId: number; messagesSaved: number }> {
  const source = `tg:${post.channel}/${post.messageId}`;

  // Дедупликация (source не @unique, поэтому findFirst).
  const existing = await db.topic.findFirst({ where: { source }, select: { id: true } });
  if (existing) {
    console.log(`${LOG_PREFIX}   ⚠ Тема уже существует (topic #${existing.id}), пропускаем.`);
    return { topicId: existing.id, messagesSaved: 0 };
  }

  // 2026-10-07: заголовок темы = из рерайта (а не из оригинала).
  // Короткий и разговорный, без официалки.
  const title = rewrittenNews.slice(0, 70).replace(/\s+/g, " ").trim() + (rewrittenNews.length > 70 ? "…" : "");

  const host = await ensureBotUser("ТеатрБот");

  const dialogAuthors: { id: string; nickname: string }[] = [];
  for (const d of dialog) dialogAuthors.push(await ensureBotUser(d.username));

  // 2026-10-07: первое сообщение темы = РЕРАЙТ новости простым языком,
  // а не оригинальный текст из канала. SakhMatrix не официальное медиа —
  // пересказываем своими словами, без канцеляризмов и имён чиновников.
  // Фото (если есть) добавляются в конец через Markdown-ссылки.
  let firstBody = rewrittenNews
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Добавляем фото в конец первого сообщения (Markdown-синтаксис).
  if (photoUrls.length > 0) {
    const photoMarkdown = photoUrls
      .map((url) => `![photo](${url})`)
      .join("\n");
    firstBody = `${firstBody}\n\n${photoMarkdown}`;
  }

  const result = await db.$transaction(async (tx) => {
    const last = await tx.topic.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    const number = (last?.number ?? 0) + 1;

    const topic = await tx.topic.create({
      data: {
        number,
        title,
        source,
        authorName: host.nickname,
        authorId: host.id,
        rubricId,
        lastAuthorName: dialog[dialog.length - 1]?.username || host.nickname,
        lastActivityAt: new Date(),
      },
    });

    // Первое сообщение — исходный пост (от ведущего).
    // 2026-10-06: премиальное сообщение (новость) оставляем видимым —
    // это оригинальный текст из канала, не сгенерирован ИИ. Виден сразу.
    const rootMsg = await tx.message.create({
      data: {
        topicId: topic.id,
        num: 1,
        depth: 0,
        authorName: host.nickname,
        authorId: host.id,
        body: firstBody,
        kind: "news",
        aiStatus: "ok",
        modLevel: 4,
        aiAction: "WATCH",
        aiConfidence: 1.0,
        aiSignal: "theatre-bot",
      },
    });

    // Реплики ботов — линейная цепочка ответов:
    //   #2 → parent=#1 (ведущий), depth=1
    //   #3 → parent=#2,              depth=2
    //   #4 → parent=#3,              depth=3
    // 2026-10-06: все реплики ботов отправляются на ПРЕМОДЕРАЦИЮ:
    //   - needHuman: true → попадает в очередь модерации в админ-панели
    //   - isHiddenByAi: true → скрывается от публичного просмотра
    //   - hiddenReason: «🎭 Премодерация бот-поста» — видно в админке
    // Админ видит их в разделе «Модерация → Спорные случаи», может
    // отредактировать, опубликовать (снять isHiddenByAi) или отклонить.
    let prevMsgId: string = rootMsg.id;
    let prevDepth = 0;
    const premoderationReason = "🎭 Премодерация: пост от бота «Театра ботов» — проверьте перед публикацией";
    for (let i = 0; i < dialog.length; i++) {
      const entry = dialog[i];
      const author = dialogAuthors[i];
      const depth = Math.min(6, prevDepth + 1);
      const created = await tx.message.create({
        data: {
          topicId: topic.id,
          num: 2 + i,
          depth,
          parentId: prevMsgId,
          authorName: author.nickname,
          authorId: author.id,
          body: entry.text,
          kind: "comment",
          aiStatus: "human",
          needHuman: true,
          isHiddenByAi: true,
          hiddenReason: premoderationReason,
          modLevel: 3,
          aiAction: "LIMIT",
          aiConfidence: 1.0,
          aiSignal: "theatre-bot-premoderation",
        },
      });
      prevMsgId = created.id;
      prevDepth = depth;
    }

    return topic;
  });

  console.log(
    `${LOG_PREFIX}   ✓ Тема #${result.id} «${title}» в рубрике [id=${rubricId}] — ${dialog.length + 1} сообщений`
  );
  return { topicId: result.id, messagesSaved: dialog.length + 1 };
}

// ─── Основная логика ───────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 2026-10-06: формирует и отправляет в Telegram уведомление о новой
 * теме от ботов «Театра ботов» — с кратким текстом реплик, ссылкой на
 * очередь модерации и прямой ссылкой на тему для редактирования.
 *
 * Формат сообщения (HTML):
 *   🎭 Новая тема от «Театра ботов»
 *
 *   📰 <заголовок темы>
 *   📂 <категория> · @<канал>
 *   📷 N фото (если есть)
 *
 *   👤 <ник>: <реплика>
 *   👤 <ник>: <реплика>
 *   👤 <ник>: <реплика>
 *
 *   ⏳ Ждёт модерации: <ссылка на админку>
 *   🔍 Открыть тему: <ссылка на форум>
 */
async function sendPremoderationNotification(
  topicId: number,
  post: ParsedPost,
  dialog: DialogEntry[],
  category: string,
  photoUrls: string[],
  rewrittenNews: string
): Promise<void> {
  const title = rewrittenNews.slice(0, 70).replace(/\s+/g, " ").trim() + (rewrittenNews.length > 70 ? "…" : "");

  // Формируем список реплик (макс. 3, каждая до 200 символов)
  const dialogLines = dialog
    .map((d) => {
      const text = d.text.length > 200 ? d.text.slice(0, 200) + "…" : d.text;
      // Экранируем HTML-спецсимволы в тексте
      const safe = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `👤 <b>${d.username}:</b> ${safe}`;
    })
    .join("\n");

  const safeTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const photoLine = photoUrls.length > 0 ? `\n📷 Фото: ${photoUrls.length} шт.` : "";
  const moderationUrl = `${NOTIFY_BASE_URL}/kabinet?section=moderation`;
  const topicUrl = `${NOTIFY_BASE_URL}/forum/topic/${topicId}`;

  const message = [
    `🎭 <b>Новая тема от «Театра ботов»</b>`,
    ``,
    `📰 <b>${safeTitle}</b>`,
    `📂 ${category} · @${post.channel}${photoLine}`,
    ``,
    dialogLines,
    ``,
    `⏳ <b>Ждёт модерации:</b> ${moderationUrl}`,
    `🔍 <b>Открыть тему:</b> ${topicUrl}`,
  ].filter(Boolean).join("\n");

  await notifyAdminTelegram(message);
}

async function processChannel(
  cfg: ChannelCfg,
  rubricId: number | null,
  processed: ProcessedMap,
  limit: number,
  dryRun: boolean
): Promise<{ found: number; processed: number; saved: number; skippedPreview: boolean }> {
  const stats = { found: 0, processed: 0, saved: 0, skippedPreview: false };
  let html: string;
  try {
    html = await fetchTgPreview(cfg.channel);
  } catch (e) {
    console.log(
      `${LOG_PREFIX} ⚠ [@${cfg.channel}] HTTP-ошибка: ${e instanceof Error ? e.message : e}`
    );
    return stats;
  }

  const posts = extractPosts(html, cfg.channel);
  stats.found = posts.length;

  if (posts.length === 0) {
    stats.skippedPreview = true;
    console.log(
      `${LOG_PREFIX} ⚪ [@${cfg.channel}] нет сообщений — public preview выключен владельцем канала.`
    );
    return stats;
  }

  if (!rubricId) {
    console.log(
      `${LOG_PREFIX} ⚠ [@${cfg.channel}] не найдена рубрика slug="${cfg.rubricSlug}" — пропуск.`
    );
    return stats;
  }

  const done = processed[cfg.channel] || [];
  const fresh = posts.filter((p) => !done.includes(p.messageId)).slice(-limit);

  console.log(
    `${LOG_PREFIX} 📥 [@${cfg.channel}] рубрика=${cfg.rubricSlug} (id=${rubricId}) | найдено ${posts.length}, новых к обработке: ${fresh.length} (лимит ${limit})`
  );

  for (const post of fresh) {
    console.log(
      `${LOG_PREFIX} ▶ [#${post.messageId}] ${post.text.slice(0, 80).replace(/\n/g, " ")}…`
    );

    let llmResponse: LlmResponse | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES_LLM && !llmResponse; attempt++) {
      try {
        const raw = await callLlm(SYSTEM_PROMPT, buildUserPrompt(post, cfg.category));
        const parsed = parseLlmResponse(raw, post.text);
        if (parsed) llmResponse = parsed;
        else console.log(`${LOG_PREFIX}   ⚠ попытка ${attempt}: невалидный ответ LLM, retry…`);
      } catch (e) {
        console.log(
          `${LOG_PREFIX}   ⚠ попытка ${attempt}: ${e instanceof Error ? e.message : e}`
        );
      }
      if (!llmResponse && attempt < MAX_RETRIES_LLM) await sleep(1500);
    }

    if (!llmResponse) {
      console.log(`${LOG_PREFIX}   ✗ LLM не дал валидный ответ, пропускаем пост.`);
      done.push(post.messageId);
      continue;
    }

    const dialog = llmResponse.dialog;
    stats.processed++;
    if (dryRun) {
      console.log(`${LOG_PREFIX}   [dry-run] была бы создана тема в рубрике ${cfg.rubricSlug}, реплик: ${dialog.length}:`);
      console.log(`${LOG_PREFIX}     📰 Рерайт: ${llmResponse.rewrittenNews.slice(0, 100)}`);
      dialog.forEach((d) =>
        console.log(`${LOG_PREFIX}     • ${d.username}: ${d.text.slice(0, 70)}`)
      );
      if (post.photos.length > 0) {
        console.log(`${LOG_PREFIX}     📷 фото в посте: ${post.photos.length}`);
      }
    } else {
      // 2026-10-06: скачиваем фото из поста, если есть.
      let photoUrls: string[] = [];
      if (post.photos.length > 0) {
        photoUrls = await downloadPhotos(post);
      }
      const r = await saveDialogToForum(dialog, post, rubricId, cfg.category, photoUrls, llmResponse.rewrittenNews);
      stats.saved += r.messagesSaved;

      // 2026-10-06: отправляем уведомление в Telegram с текстом реплик
      // ботов и ссылкой на очередь модерации. Админ может перейти и
      // отредактировать/опубликовать/отклонить.
      if (!dryRun) {
        await sendPremoderationNotification(r.topicId, post, dialog, cfg.category, photoUrls, llmResponse.rewrittenNews);
      }
    }

    done.push(post.messageId);
    if (done.length > 500) done.splice(0, done.length - 500);
    processed[cfg.channel] = done;

    saveProcessed(processed);

    await sleep(800);
  }

  return stats;
}

async function runOnce(args: CliArgs): Promise<void> {
  const channels: ChannelCfg[] = JSON.parse(readFileSync(CHANNELS_FILE, "utf-8"));
  const processed = args.reset ? {} : loadProcessed();
  if (args.reset) saveProcessed(processed);

  const rubrics = await db.rubric.findMany({ select: { id: true, slug: true } });
  const slugToId = new Map<string, number>(rubrics.map((r) => [r.slug, r.id]));

  console.log(
    `${LOG_PREFIX} === Прогон ${new Date().toISOString()} === каналов: ${channels.length}, лимит: ${args.limit}, dryRun: ${args.dryRun}, рубрик в БД: ${slugToId.size}`
  );

  let total = { found: 0, processed: 0, saved: 0, channelsWithPosts: 0, channelsSkipped: 0 };
  for (const cfg of channels) {
    const rubricId = slugToId.get(cfg.rubricSlug) ?? null;
    const r = await processChannel(cfg, rubricId, processed, args.limit, args.dryRun);
    total.found += r.found;
    total.processed += r.processed;
    total.saved += r.saved;
    if (r.skippedPreview) total.channelsSkipped++;
    else if (r.found > 0) total.channelsWithPosts++;
  }

  console.log(
    `${LOG_PREFIX} === ИТОГ: найдено ${total.found}, обработано ${total.processed}, ` +
      `сохранено ${total.saved}. Каналов с постами: ${total.channelsWithPosts}, ` +
      `каналов без preview: ${total.channelsSkipped} ===\n`
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.loopMin > 0) {
    console.log(`${LOG_PREFIX} Daemon mode, интервал ${args.loopMin} мин.`);
    while (true) {
      try {
        await runOnce(args);
      } catch (e) {
        console.error(
          `${LOG_PREFIX} Фатальная ошибка прогона: ${e instanceof Error ? e.message : e}`
        );
      }
      console.log(`${LOG_PREFIX} Sleep ${args.loopMin} мин до следующего прогона…\n`);
      await sleep(args.loopMin * 60 * 1000);
    }
  } else {
    await runOnce(args);
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("❌ Фатальная ошибка:", e);
  db.$disconnect();
  process.exit(1);
});
