import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export const runtime = "nodejs";

/**
 * POST /api/theatre-bots/publish
 *
 * Принимает готовые посты от «Театра ботов v2» (Python-скрипт на VPS),
 * который парсит biz65.ru и рерайтит через Z.ai.
 *
 * Тело запроса:
 * {
 *   "token": "shared_secret",         // авторизация
 *   "character": "Димон",             // персонаж
 *   "text": "да я сам вчера...",      // рерайт
 *   "source_url": "https://biz65.ru/forum/topic/123"
 * }
 *
 * Ответ:
 * {
 *   "ok": true,
 *   "topicId": 231,
 *   "messageId": "cmux..."
 * }
 *
 * Логика:
 * 1. Проверка токена (shared secret)
 * 2. Создание темы в рубрике «Подслушано Сахалин» (podslyshano-discuss)
 * 3. Первое сообщение = текст от персонажа
 * 4. Создание User-бота (если ещё нет) по имени персонажа
 * 5. Дедупликация по source_url (не создаём повторно)
 */

const THEATRE_BOTS_TOKEN = process.env.THEATRE_BOTS_TOKEN || "sakhmatrix-theatre-2026";
const TARGET_RUBRIC_SLUG = "podslyshano-discuss";

interface PublishBody {
  token?: string;
  character?: string;
  text?: string;
  source_url?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: PublishBody = await req.json();

    // 1. Авторизация
    if (!body.token || body.token !== THEATRE_BOTS_TOKEN) {
      return NextResponse.json({ error: "Неверный токен" }, { status: 401 });
    }

    if (!body.text || body.text.trim().length < 10) {
      return NextResponse.json({ error: "Пустой текст" }, { status: 400 });
    }

    if (!body.character || body.character.trim().length < 2) {
      return NextResponse.json({ error: "Не указан персонаж" }, { status: 400 });
    }

    const sourceUrl = body.source_url || "";
    const characterName = body.character.trim();
    const text = body.text.trim();

    // 2. Дедупликация: если тема с таким source уже есть — пропускаем
    if (sourceUrl) {
      const source = `biz65:${sourceUrl}`;
      const existing = await db.topic.findFirst({
        where: { source },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({
          ok: true,
          topicId: existing.id,
          message: "Тема уже существует",
        });
      }
    }

    // 3. Найти рубрику
    const rubric = await db.rubric.findFirst({
      where: { slug: TARGET_RUBRIC_SLUG },
      select: { id: true },
    });
    if (!rubric) {
      return NextResponse.json({ error: "Рубрика не найдена" }, { status: 500 });
    }

    // 4. Создать или найти бота-пользователя (по нику персонажа)
    const botEmail = `bot+${characterName.toLowerCase().replace(/[^a-z0-9а-яё_-]/giu, "")}@theatre.local`;
    const botUser = await db.user.upsert({
      where: { email: botEmail },
      update: {},
      create: {
        email: botEmail,
        passwordHash: crypto.createHash("sha256").update(crypto.randomBytes(32)).digest("hex"),
        nickname: characterName,
        role: "user",
        gender: "unspecified",
        emailVerified: false,
        bio: "Бот «Театра ботов» — рерайт с biz65.ru",
      },
    });

    // 5. Создать тему + первое сообщение
    const title = text.slice(0, 70).replace(/\s+/g, " ").trim() + (text.length > 70 ? "…" : "");

    const result = await db.$transaction(async (tx) => {
      const last = await tx.topic.findFirst({
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const number = (last?.number ?? 0) + 1;

      const topic = await tx.topic.create({
        data: {
          number,
          title,
          source: `biz65:${sourceUrl}`,
          authorName: botUser.nickname,
          authorId: botUser.id,
          rubricId: rubric.id,
          lastAuthorName: botUser.nickname,
          lastActivityAt: new Date(),
        },
      });

      const message = await tx.message.create({
        data: {
          topicId: topic.id,
          num: 1,
          depth: 0,
          authorName: botUser.nickname,
          authorId: botUser.id,
          body: text,
          kind: "news",
          aiStatus: "ok",
          modLevel: 4,
          aiAction: "WATCH",
          aiConfidence: 1.0,
          aiSignal: "theatre-bot-biz65",
        },
      });

      return { topic, message };
    });

    console.log(`[theatre-bots] Опубликовано: тема #${result.topic.id} от ${characterName}`);

    return NextResponse.json({
      ok: true,
      topicId: result.topic.id,
      messageId: result.message.id,
    });
  } catch (e) {
    console.error("[theatre-bots] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Внутренняя ошибка" },
      { status: 500 }
    );
  }
}
