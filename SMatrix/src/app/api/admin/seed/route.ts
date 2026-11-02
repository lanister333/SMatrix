/**
 * /api/admin/seed — универсальный эндпоинт для импорта тем и сообщений
 * из старого Sakh.com на прод-БД (без SSH — через браузер с админским токеном).
 *
 * Создан 2026-11-02. Заменяет одноразовый /api/admin/seed (коммит a3c4907).
 *
 * POST /api/admin/seed
 * body: { token: "...", payload: { ... } }
 *
 * payload:
 * {
 *   section: "wheretobuy" | "forum",
 *   title: "Заголовок темы",
 *   bodyText: "Текст темы",
 *   postType?: "service" | "product",         // только для wheretobuy
 *   place?: "Южно-Сахалинск",                  // только для wheretobuy
 *   createdAt: "2026-10-28T12:00:00+11:00",   // ISO с offset
 *   authorGender: "male" | "female",
 *   rubricId?: 132,                            // только для forum (по умолчанию 132)
 *   messages: [
 *     { gender: "male",   body: "...", createdAt: "...", parentIndex: null },
 *     { gender: "female", body: "...", createdAt: "...", parentIndex: 0 }
 *   ]
 * }
 *
 * Идемпотентность: по title + первому сообщению. Если уже есть тема с таким
 * заголовком и текстом — возвращаем что уже создано, не дублируем.
 *
 * После создания темы — кнопка «Обсудить на форуме» уже в статусе «Обсуждается».
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isStaffRole } from "@/lib/admin";
import { pickRandomBot } from "@/lib/auto-bots";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Рубрики «Обсуждение сообщений из блоков» (служебные). */
const WTB_RUBRIC_ID = 132; // wheretobuy-discuss

interface SeedMessage {
  gender: "male" | "female";
  body: string;
  createdAt: string;
  parentIndex: number | null;
}

interface SeedPayload {
  section: "wheretobuy" | "forum";
  title: string;
  bodyText: string;
  postType?: "service" | "product";
  place?: string;
  createdAt: string;
  authorGender: "male" | "female";
  rubricId?: number;
  messages: SeedMessage[];
}

/** Найти бота нужного гендера, исключая уже использованных. */
async function pickBotByGender(gender: "male" | "female", excludeIds: string[]) {
  for (let i = 0; i < 5; i++) {
    const cand = await pickRandomBot(excludeIds);
    if (!cand) return null;
    excludeIds.push(cand.id);
    if (cand.gender === gender) return cand;
  }
  return null;
}

/** Проверка идемпотентности: тема с таким заголовком уже есть в нужной рубрике. */
async function findExistingTopic(title: string, rubricId: number) {
  return db.topic.findFirst({
    where: { title: { startsWith: "Обсуждение: " + title.slice(0, 50) }, rubricId },
    select: { id: true, number: true },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token: string | undefined = body.token;
    const payload: SeedPayload = body.payload;

    if (!token) {
      return NextResponse.json({ error: "Не передан token" }, { status: 400 });
    }
    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json({ error: "Сессия не найдена — перезайдите" }, { status: 401 });
    }
    if (!isStaffRole(user.role)) {
      return NextResponse.json({ error: "Доступно только администратору" }, { status: 403 });
    }

    if (!payload || !payload.title || !payload.bodyText || !payload.createdAt) {
      return NextResponse.json({ error: "Неверный payload: нужны title, bodyText, createdAt" }, { status: 400 });
    }
    if (!Array.isArray(payload.messages)) {
      return NextResponse.json({ error: "Неверный payload: messages должен быть массивом" }, { status: 400 });
    }

    const section = payload.section === "wheretobuy" ? "wheretobuy" : "forum";
    const rubricId = section === "wheretobuy" ? WTB_RUBRIC_ID : (payload.rubricId ?? WTB_RUBRIC_ID);
    const createdAt = new Date(payload.createdAt);
    if (isNaN(createdAt.getTime())) {
      return NextResponse.json({ error: "createdAt — некорректная дата" }, { status: 400 });
    }

    // Идемпотентность.
    const existing = await findExistingTopic(payload.title, rubricId);
    if (existing) {
      const msgCount = await db.message.count({ where: { topicId: existing.id } });
      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        topicId: existing.id,
        topicNumber: existing.number,
        messages: msgCount,
        note: "Тема с таким заголовком уже существует. Повторное создание пропущено.",
      });
    }

    // 1. Подбираем ботов для всех уникальных авторов.
    // Автор темы = один бот (gender=authorGender).
    // Авторы сообщений — каждый раз новый бот (по gender), без повторений.
    const usedBotIds: string[] = [];
    const authorBot = await pickBotByGender(payload.authorGender, usedBotIds);
    if (!authorBot) {
      return NextResponse.json({ error: `Не удалось подобрать бота-автора темы (gender=${payload.authorGender})` }, { status: 500 });
    }

    // Подбираем ботов для каждого сообщения (по гендеру, без повторов).
    const messageBots: { bot: { id: string; nickname: string; gender: string } | null; createdAt: Date; body: string; parentIndex: number | null }[] = [];
    for (const m of payload.messages) {
      const bot = await pickBotByGender(m.gender, usedBotIds);
      if (!bot) {
        return NextResponse.json({ error: `Не удалось подобрать бота для сообщения (gender=${m.gender})` }, { status: 500 });
      }
      messageBots.push({ bot, createdAt: new Date(m.createdAt), body: m.body, parentIndex: m.parentIndex });
    }

    // Сортируем сообщения по createdAt (хронология).
    messageBots.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // 2. Транзакция.
    const result = await db.$transaction(async (tx) => {
      let postId: string | null = null;

      // Если раздел «Где купить» — создаём карточку публикации.
      if (section === "wheretobuy") {
        const post = await tx.whereToBuyPost.create({
          data: {
            title: payload.title,
            text: payload.bodyText,
            place: payload.place ?? "",
            postType: payload.postType === "service" ? "service" : "product",
            status: "seeking",
            authorId: authorBot.id,
            authorName: authorBot.nickname,
            aiStatus: "ok",
            isHiddenByAi: false,
            createdAt,
            statusAt: createdAt,
          },
        });
        postId = post.id;
      }

      // Тема на форуме.
      const lastTopic = await tx.topic.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
      const number = (lastTopic?.number ?? 0) + 1;
      const fullTopicTitle = `Обсуждение: ${payload.title}`.slice(0, 150);

      const lastMsgBot = messageBots[messageBots.length - 1]?.bot ?? authorBot;
      const lastActivityAt = messageBots.length > 0
        ? messageBots[messageBots.length - 1].createdAt
        : createdAt;

      const topicData: any = {
        number,
        title: fullTopicTitle,
        authorName: authorBot.nickname,
        authorId: authorBot.id,
        rubricId,
        lastAuthorName: lastMsgBot.nickname,
        createdAt,
        lastActivityAt,
      };

      // Связь с WhereToBuyPost.
      if (postId) {
        topicData.whereToBuyPost = { connect: { id: postId } };
      }

      const topic = await tx.topic.create({ data: topicData });

      // Сообщение #1 — тело темы.
      const firstBody = `${payload.title}\n\n${payload.bodyText}`;
      await tx.message.create({
        data: {
          topicId: topic.id,
          num: 1,
          authorName: authorBot.nickname,
          authorId: authorBot.id,
          body: firstBody,
          kind: "advice",
          createdAt,
        },
      });

      // Остальные сообщения с деревом (по parentIndex).
      // parentIndex ссылается на ИНДЕКС в массиве messages (0-based).
      // Сначала создаются depth=0 (parentIndex=null), потом depth=1.
      const indexToMsgId = new Map<number, string>();
      const depth0 = messageBots.map((m, i) => ({ ...m, originalIndex: i })).filter(m => m.parentIndex === null);
      const depthN = messageBots.map((m, i) => ({ ...m, originalIndex: i })).filter(m => m.parentIndex !== null);

      let num = 2;
      for (const m of depth0) {
        const msg = await tx.message.create({
          data: {
            topicId: topic.id,
            num: num++,
            authorName: m.bot!.nickname,
            authorId: m.bot!.id,
            body: m.body,
            kind: "advice",
            depth: 0,
            parentId: null,
            createdAt: m.createdAt,
          },
        });
        indexToMsgId.set(m.originalIndex, msg.id);
      }

      // Для вложенных — нужно учитывать что parentIndex может быть любого уровня.
      // Обрабатываем по очереди, пока все не будут созданы.
      let remaining = depthN;
      let safetyCounter = 0;
      while (remaining.length > 0 && safetyCounter < 100) {
        safetyCounter++;
        const stillPending: typeof remaining = [];
        for (const m of remaining) {
          const parentId = m.parentIndex !== null ? indexToMsgId.get(m.parentIndex) : null;
          if (parentId === undefined) {
            // parent ещё не создан — оставляем на следующую итерацию.
            stillPending.push(m);
            continue;
          }
          // Вычисляем depth: 1 если parent — тема, иначе parent.depth + 1.
          // Проще: смотрим по цепочке parentIndex.
          let depth = 1;
          let curParentIdx = m.parentIndex;
          while (curParentIdx !== null && curParentIdx >= 0) {
            const parent = messageBots[curParentIdx];
            if (!parent) break;
            depth++;
            curParentIdx = parent.parentIndex;
            if (depth > 10) break; // защита от зацикливания
          }
          const msg = await tx.message.create({
            data: {
              topicId: topic.id,
              num: num++,
              authorName: m.bot!.nickname,
              authorId: m.bot!.id,
              body: m.body,
              kind: "advice",
              depth,
              parentId: parentId ?? null,
              createdAt: m.createdAt,
            },
          });
          indexToMsgId.set(m.originalIndex, msg.id);
        }
        remaining = stillPending;
      }

      if (remaining.length > 0) {
        throw new Error(`Не удалось создать ${remaining.length} сообщений (parentIndex ссылается на несуществующее сообщение)`);
      }

      // Связь post.topicId = topic.id.
      if (postId) {
        await tx.whereToBuyPost.update({ where: { id: postId }, data: { topicId: topic.id } });
      }

      return { postId, topicId: topic.id, topicNumber: number, messagesCount: 1 + messageBots.length };
    });

    return NextResponse.json({
      ok: true,
      alreadyExists: false,
      postId: result.postId,
      topicId: result.topicId,
      topicNumber: result.topicNumber,
      messages: result.messagesCount,
      note: "Тема создана.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}

// GET — заглушка для тестирования доступности.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "/api/admin/seed", method: "POST" });
}
