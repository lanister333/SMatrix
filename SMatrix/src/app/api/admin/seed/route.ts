/**
 * /api/admin/seed — упрощённый эндпоинт для заливки предопределённых тем
 * на прод-БД. Создан 2026-11-02.
 *
 * GET /api/admin/seed?key=KEY&topic=TOPIC_ID
 *
 * Где:
 *   KEY — фиксированный секрет ("seed-smatrix-2026")
 *   TOPIC_ID — идентификатор темы из словаря PREDEFINED_TOPICS (см. ниже)
 *
 * Не требует логина/токена — только знание ключа.
 * Идемпотентный: повторный запуск с тем же topic не дублирует.
 *
 * Чтобы добавить новую тему для заливки:
 *   1. Добавить объект в PREDEFINED_TOPICS
 *   2. Закоммитить, запушить (autodeploy подхватит)
 *   3. Заказчик открывает ссылку ?topic=новый_id
 *
 * Старый POST с JSON и DELETE — закомментированы ниже (убраны из экспорта).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";
import { pickRandomBot } from "@/lib/auto-bots";

export const runtime = "nodejs";
export const maxDuration = 60;

const SEED_KEY = "seed-smatrix-2026";

const T = (s: string) => new Date(s);

// === ПРЕДОПРЕДЕЛЁННЫЕ ТЕМЫ ===
// Добавляй сюда новые темы для заливки.
type PredefinedTopic = {
  id: string;
  section: "wheretobuy" | "forum";
  title: string;
  bodyText: string;
  postType?: "service" | "product";
  place?: string;
  createdAt: string;
  authorGender: "male" | "female";
  rubricId?: number;
  messages: { gender: "male" | "female"; body: string; createdAt: string; parentIndex: number | null }[];
};

const PREDEFINED_TOPICS: PredefinedTopic[] = [
  {
    id: "santehnik",
    section: "wheretobuy",
    title: "Подскажите толкового сантехника для частного дома",
    bodyText:
      "Добрый день, форумчане! Подскажите, пожалуйста, толкового сантехника по адекватной цене — нужно посмотреть трубы и батареи в частном доме.",
    postType: "service",
    place: "",
    createdAt: "2026-10-28T12:00:00+11:00",
    authorGender: "female",
    messages: [
      { gender: "male",   body: "Написал вам в личные сообщения.", "createdAt": "2026-10-28T13:10:00+11:00", parentIndex: null },
      { gender: "male",   body: "89025588388", "createdAt": "2026-10-28T13:12:00+11:00", parentIndex: null },
      { gender: "female", body: "Если вдруг предыдущие варианты не подойдут — звоните +79146439295. Толковый, проверенный сантехник.", "createdAt": "2026-10-28T13:54:00+11:00", parentIndex: null },
      { gender: "male",   body: "Хм, ну батареи и трубы посмотреть любой мужчина сможет. Лучше опишите проблему: как работало, когда перестало, что внутри труб. Обычно в частном доме ломаться особо нечему — вода в системе своя, не меняется, может годами работать.", "createdAt": "2026-10-28T14:32:00+11:00", parentIndex: null },
      { gender: "female", body: "89242804973 Николай", "createdAt": "2026-10-30T15:18:00+11:00", parentIndex: null },
      { gender: "male",   body: "Добрый вечер. Звоните: 89621205424", "createdAt": "2026-10-31T19:27:00+11:00", parentIndex: null },
      { gender: "female", body: "Спасибо 🙏", "createdAt": "2026-10-28T13:41:00+11:00", parentIndex: 0 },
      { gender: "female", body: "Спасибо!", "createdAt": "2026-10-28T13:42:00+11:00", parentIndex: 1 },
      { gender: "female", body: "Спасибо 🙏", "createdAt": "2026-10-28T18:58:00+11:00", parentIndex: 2 },
      { gender: "male",   body: "Только посмотреть?", "createdAt": "2026-10-28T14:48:00+11:00", parentIndex: 3 },
    ],
  },
];

const WTB_RUBRIC_ID = 132; // wheretobuy-discuss

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

/** Идемпотентность: тема с таким заголовком уже есть в нужной рубрике. */
async function findExistingTopic(title: string, rubricId: number) {
  return db.topic.findFirst({
    where: { title: { startsWith: "Обсуждение: " + title.slice(0, 50) }, rubricId },
    select: { id: true, number: true },
  });
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const key = sp.get("key");
    const topicId = sp.get("topic");

    if (key !== SEED_KEY) {
      return NextResponse.json({ error: "Неверный ключ" }, { status: 403 });
    }
    if (!topicId) {
      return NextResponse.json({
        ok: true,
        availableTopics: PREDEFINED_TOPICS.map(t => t.id),
      });
    }

    const predefined = PREDEFINED_TOPICS.find(t => t.id === topicId);
    if (!predefined) {
      return NextResponse.json({
        error: `Неизвестный topic="${topicId}"`,
        availableTopics: PREDEFINED_TOPICS.map(t => t.id),
      }, { status: 404 });
    }

    const section = predefined.section;
    const rubricId = section === "wheretobuy" ? WTB_RUBRIC_ID : (predefined.rubricId ?? WTB_RUBRIC_ID);
    const createdAt = new Date(predefined.createdAt);
    const title = predefined.title;
    const bodyText = predefined.bodyText;

    // Идемпотентность.
    const existing = await findExistingTopic(title, rubricId);
    if (existing) {
      const msgCount = await db.message.count({ where: { topicId: existing.id } });
      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        topic: topicId,
        topicId: existing.id,
        topicNumber: existing.number,
        messages: msgCount,
        note: "Тема уже была создана ранее. Повторное создание пропущено.",
      });
    }

    // Подбираем ботов.
    const usedBotIds: string[] = [];
    const authorBot = await pickBotByGender(predefined.authorGender, usedBotIds);
    if (!authorBot) {
      return NextResponse.json({ error: `Не удалось подобрать бота-автора темы (gender=${predefined.authorGender})` }, { status: 500 });
    }

    const messageBots: { bot: { id: string; nickname: string; gender: string } | null; createdAt: Date; body: string; parentIndex: number | null }[] = [];
    for (const m of predefined.messages) {
      const bot = await pickBotByGender(m.gender, usedBotIds);
      if (!bot) {
        return NextResponse.json({ error: `Не удалось подобрать бота для сообщения (gender=${m.gender})` }, { status: 500 });
      }
      messageBots.push({ bot, createdAt: new Date(m.createdAt), body: m.body, parentIndex: m.parentIndex });
    }

    // Сортируем по хронологии.
    messageBots.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const result = await db.$transaction(async (tx) => {
      let postId: string | null = null;

      if (section === "wheretobuy") {
        const post = await tx.whereToBuyPost.create({
          data: {
            title,
            text: bodyText,
            place: predefined.place ?? "",
            postType: predefined.postType === "service" ? "service" : "product",
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

      const lastTopic = await tx.topic.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
      const number = (lastTopic?.number ?? 0) + 1;
      const fullTopicTitle = `Обсуждение: ${title}`.slice(0, 150);

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

      if (postId) {
        topicData.whereToBuyPost = { connect: { id: postId } };
      }

      const topic = await tx.topic.create({ data: topicData });

      const firstBody = `${title}\n\n${bodyText}`;
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

      const indexToMsgId = new Map<number, string>();
      const withIdx = messageBots.map((m, i) => ({ ...m, originalIndex: i }));
      const depth0 = withIdx.filter(m => m.parentIndex === null);
      const depthN = withIdx.filter(m => m.parentIndex !== null);

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

      let remaining = depthN;
      let safetyCounter = 0;
      while (remaining.length > 0 && safetyCounter < 100) {
        safetyCounter++;
        const stillPending: typeof remaining = [];
        for (const m of remaining) {
          const parentId = m.parentIndex !== null ? indexToMsgId.get(m.parentIndex) : null;
          if (parentId === undefined) {
            stillPending.push(m);
            continue;
          }
          let depth = 1;
          let curParentIdx = m.parentIndex;
          while (curParentIdx !== null && curParentIdx >= 0) {
            const parent = messageBots[curParentIdx];
            if (!parent) break;
            depth++;
            curParentIdx = parent.parentIndex;
            if (depth > 10) break;
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

      if (postId) {
        await tx.whereToBuyPost.update({ where: { id: postId }, data: { topicId: topic.id } });
      }

      return { postId, topicId: topic.id, topicNumber: number, messagesCount: 1 + messageBots.length };
    });

    return NextResponse.json({
      ok: true,
      topic: topicId,
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
