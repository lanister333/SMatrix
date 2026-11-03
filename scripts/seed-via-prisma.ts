/**
 * scripts/seed-via-prisma.ts
 *
 * Универсальный скрипт заливки тем и сообщений напрямую через Prisma
 * (минуя HTTP-эндпоинт /api/admin/seed), чтобы избежать:
 *   1. Бага с дублированием title+bodyText в сообщении #1
 *   2. Бага с Unicode-эскейпами (\u041F...) при передаче кириллицы через
 *      shell-аргументы в `bun -e "..."` через SSH
 *
 * Поддерживаемые разделы:
 *   - wheretobuy    → WhereToBuyPost → рубрика форума 132
 *   - gdedeshevle   → CheapPost     → рубрика форума 134
 *   - recommend     → RecPost       → рубрика форума 135
 *   - employers     → EmpPost       → рубрика форума 136
 *   - help          → HelpPublication → рубрика форума 130 (Подслушано)
 *   - overheard     → OverheardPost → рубрика форума 130
 *   - gkh           → GkhProblem    → рубрика форума 133
 *   - dating        → DatingPost    → рубрика форума 139
 *   - adlisting     → AdListing     → отдельный раздел (без темы форума)
 *   - forum         → только Topic (без поста) → рубрика из payload
 *
 * Использование:
 *   bun run scripts/seed-via-prisma.ts <path-to-json>
 *
 * Формат JSON:
 * {
 *   "section": "gdedeshevle",
 *   "title": "Заголовок темы",
 *   "bodyText": "Тело темы",
 *   "createdAt": "2026-10-30T12:00:00+11:00",
 *   "authorGender": "female",
 *   "place": "Южно-Сахалинск",
 *   "postType": "service",            // только для wheretobuy: product|service
 *   "rubricId": 134,                  // только для section=forum
 *   "extraFields": {                  // раздел-специфичные поля
 *     "employer": "ООО ИнСет",         // employers
 *     "category": "m4w",              // dating
 *     "stance": "recommend",          // recommend
 *     "rubric": "services"            // adlisting
 *   },
 *   "messages": [
 *     { "gender": "male", "body": "...", "createdAt": "...", "parentIndex": null },
 *     { "gender": "female", "body": "...", "createdAt": "...", "parentIndex": 0, "isAuthor": true }
 *   ]
 * }
 *
 * Создан 2026-11-03.
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join, dirname } from "path";

const db = new PrismaClient();

// Карта разделов: какую модель создавать и в какую рубрику форума класть тему.
const SECTION_CONFIG: Record<string, { rubricId: number; hasPost: boolean }> = {
  wheretobuy: { rubricId: 132, hasPost: true },
  gdedeshevle: { rubricId: 134, hasPost: true },
  recommend: { rubricId: 135, hasPost: true },
  employers: { rubricId: 136, hasPost: true },
  overheard: { rubricId: 130, hasPost: true },
  help: { rubricId: 130, hasPost: true },
  gkh: { rubricId: 133, hasPost: true },
  dating: { rubricId: 139, hasPost: true },
  adlisting: { rubricId: 0, hasPost: true }, // без темы форума
  forum: { rubricId: 0, hasPost: false }, // рубricId из payload
};

interface SeedMessage {
  gender: "male" | "female";
  body: string;
  createdAt: string;
  parentIndex: number | null;
  isAuthor?: boolean;
  /** 2026-11-03: ник автора сообщения. Если указан — бот подбирается ОДИН РАЗ
   *  на уникальный ник и переиспользуется для всех сообщений того же ника.
   *  Без этого поля скрипт подбирает нового уникального бота на каждое сообщение,
   *  что быстро исчерпывает пул theatre-ботов (22 муж + 13 жен). */
  author?: string;
  /** 2026-11-03: массив URL изображений (например ["/media/uploads/2026/11/abc.jpg"]).
   *  Скрипт склеит их в markdown-синтаксис ![alt](url) и добавит в конец body
   *  перед сохранением в БД — так фото отображаются в сообщении. */
  images?: string[];
}

interface SeedPayload {
  section: string;
  title: string;
  bodyText: string;
  createdAt: string;
  authorGender: "male" | "female";
  place?: string;
  postType?: "product" | "service";
  rubricId?: number;
  extraFields?: Record<string, any>;
  messages?: SeedMessage[];
  /** 2026-11-03: изображения для тела темы (массив URL).
   *  Скрипт склеит их в markdown и добавит в конец bodyText. */
  images?: string[];
}

/** Склеить массив URL изображений в markdown-синтаксис. */
function imagesToMarkdown(images?: string[]): string {
  if (!images || images.length === 0) return "";
  return images.map((url) => `![фото](${url})`).join("\n");
}

/** Найти theatre-бота нужного гендера, исключая уже использованных. */
async function pickBotByGender(
  gender: "male" | "female",
  excludeIds: string[]
) {
  const users = await db.user.findMany({
    where: {
      email: { contains: "@theatre.local" },
      gender,
      id: { notIn: excludeIds },
    },
    select: { id: true, nickname: true, gender: true, bio: true },
  });
  const bots = users.filter((u) => {
    if (!u.bio) return false;
    try {
      const meta = JSON.parse(u.bio);
      return meta.role === "theatre_bot" && !meta.deleted;
    } catch {
      return false;
    }
  });
  if (bots.length === 0) return null;
  const picked = bots[Math.floor(Math.random() * bots.length)];
  excludeIds.push(picked.id);
  return picked;
}

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error("Usage: bun run scripts/seed-via-prisma.ts <path-to-json>");
    process.exit(1);
  }

  const payload: SeedPayload = JSON.parse(readFileSync(jsonPath, "utf-8"));

  // Валидация
  if (!payload.title || !payload.bodyText || !payload.createdAt) {
    console.error("Неверный payload: нужны title, bodyText, createdAt");
    process.exit(1);
  }
  if (!SECTION_CONFIG[payload.section]) {
    console.error(
      "Неизвестный раздел: " +
        payload.section +
        ". Доступные: " +
        Object.keys(SECTION_CONFIG).join(", ")
    );
    process.exit(1);
  }

  const config = SECTION_CONFIG[payload.section];
  const createdAt = new Date(payload.createdAt);
  if (isNaN(createdAt.getTime())) {
    console.error("createdAt — некорректная дата");
    process.exit(1);
  }

  // 2026-11-03: если есть images на уровне темы — добавляем их в bodyText как markdown.
  // Так фото появятся и в теле темы (Message #1), и в post.text (WhereToBuyPost и др.).
  const topicImagesMd = imagesToMarkdown(payload.images);
  if (topicImagesMd) {
    payload.bodyText = (payload.bodyText + "\n" + topicImagesMd).trim();
  }

  const messages = payload.messages ?? [];

  // 1. Подбираем ботов
  const usedBotIds: string[] = [];
  const authorBot = await pickBotByGender(payload.authorGender, usedBotIds);
  if (!authorBot) {
    console.error(
      "Не удалось подобрать бота-автора темы (gender=" +
        payload.authorGender +
        ")"
    );
    process.exit(1);
  }

  // Подбираем ботов для каждого сообщения
  // 2026-11-03: кеш author → bot, чтобы один автор получал одного бота
  // на все свои сообщения (а не нового каждый раз).
  const authorToBot = new Map<string, { id: string; nickname: string; gender: string }>();
  const messageBots: {
    bot: { id: string; nickname: string; gender: string };
    createdAt: Date;
    body: string;
    parentIndex: number | null;
  }[] = [];
  for (const m of messages) {
    // 2026-11-03: если у сообщения есть images — добавляем их в body как markdown
    const msgBody = m.images && m.images.length > 0
      ? (m.body + "\n" + imagesToMarkdown(m.images)).trim()
      : m.body;
    if (m.isAuthor) {
      messageBots.push({
        bot: authorBot,
        createdAt: new Date(m.createdAt),
        body: msgBody,
        parentIndex: m.parentIndex,
      });
      continue;
    }
    // Если указан author и уже есть бот для него — переиспользуем
    if (m.author && authorToBot.has(m.author)) {
      messageBots.push({
        bot: authorToBot.get(m.author)!,
        createdAt: new Date(m.createdAt),
        body: msgBody,
        parentIndex: m.parentIndex,
      });
      continue;
    }
    const bot = await pickBotByGender(m.gender, usedBotIds);
    if (!bot) {
      console.error(
        "Не удалось подобрать бота для сообщения (gender=" + m.gender + ")"
      );
      process.exit(1);
    }
    if (m.author) {
      authorToBot.set(m.author, bot);
    }
    messageBots.push({
      bot,
      createdAt: new Date(m.createdAt),
      body: msgBody,
      parentIndex: m.parentIndex,
    });
  }

  // 2026-11-03: НЕ сортируем сообщения по createdAt — они уже идут в
  // хронологическом порядке в payload, а сортировка ломает parentIndex
  // (parentIndex ссылается на позицию в исходном массиве, а не в отсортированном).
  // Если нужна сортировка — делать её до вычисления parentIndex в payload.

  // 2. Транзакция
  const result = await db.$transaction(async (tx) => {
    let postId: string | null = null;
    const extra = payload.extraFields ?? {};
    const place = payload.place ?? "";

    // Создаём пост в зависимости от раздела
    if (config.hasPost) {
      switch (payload.section) {
        case "wheretobuy": {
          const post = await tx.whereToBuyPost.create({
            data: {
              title: payload.title,
              text: payload.bodyText,
              place,
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
          break;
        }
        case "gdedeshevle": {
          const post = await tx.cheapPost.create({
            data: {
              title: payload.title,
              text: payload.bodyText,
              place,
              status: "comparing",
              authorId: authorBot.id,
              authorName: authorBot.nickname,
              aiStatus: "ok",
              isHiddenByAi: false,
              createdAt,
              statusAt: createdAt,
            },
          });
          postId = post.id;
          break;
        }
        case "employers": {
          const post = await tx.empPost.create({
            data: {
              employer: extra.employer ?? payload.title,
              title: payload.title,
              text: payload.bodyText,
              place,
              city: extra.city ?? "",
              workPeriod: extra.workPeriod ?? "",
              experience: extra.experience ?? "",
              personMention: extra.personMention ?? "",
              authorId: authorBot.id,
              authorName: authorBot.nickname,
              aiStatus: "ok",
              isHiddenByAi: false,
              createdAt,
            },
          });
          postId = post.id;
          break;
        }
        case "recommend": {
          const post = await tx.recPost.create({
            data: {
              subject: extra.subject ?? payload.title,
              stance: extra.stance ?? "recommend",
              title: payload.title,
              text: payload.bodyText,
              place,
              humanHighlight: extra.humanHighlight ?? "",
              authorId: authorBot.id,
              authorName: authorBot.nickname,
              aiStatus: "ok",
              isHiddenByAi: false,
              createdAt,
              stanceAt: createdAt,
            },
          });
          postId = post.id;
          break;
        }
        case "help": {
          const post = await tx.helpPublication.create({
            data: {
              title: payload.title,
              text: payload.bodyText,
              contactData: extra.contactData ?? "",
              status: "active",
              authorId: authorBot.id,
              authorName: authorBot.nickname,
              aiStatus: "ok",
              isHiddenByAi: false,
              createdAt,
            },
          });
          postId = post.id;
          break;
        }
        case "overheard": {
          const post = await tx.overheardPost.create({
            data: {
              title: payload.title,
              text: payload.bodyText,
              authorId: authorBot.id,
              authorName: authorBot.nickname,
              aiStatus: "ok",
              isHiddenByAi: false,
              createdAt,
            },
          });
          postId = post.id;
          break;
        }
        case "gkh": {
          const post = await tx.gkhProblem.create({
            data: {
              title: payload.title,
              text: payload.bodyText,
              actions: extra.actions ?? "",
              place,
              problemDate: extra.problemDate ?? "",
              status: "active",
              authorId: authorBot.id,
              authorName: authorBot.nickname,
              aiStatus: "ok",
              isHiddenByAi: false,
              createdAt,
              statusAt: createdAt,
            },
          });
          postId = post.id;
          break;
        }
        case "dating": {
          const post = await tx.datingPost.create({
            data: {
              category: extra.category ?? "m4w",
              title: payload.title,
              body: payload.bodyText,
              place,
              status: "actual",
              authorId: authorBot.id,
              authorName: authorBot.nickname,
              aiStatus: "ok",
              isHiddenByAi: false,
              createdAt,
              statusAt: createdAt,
            },
          });
          postId = post.id;
          break;
        }
        case "adlisting": {
          const post = await tx.adListing.create({
            data: {
              rubric: extra.rubric ?? "services",
              title: payload.title,
              text: payload.bodyText,
              price: extra.price ?? "",
              contact: extra.contact ?? "",
              place,
              status: "active",
              authorId: authorBot.id,
              authorName: authorBot.nickname,
              aiStatus: "ok",
              isHiddenByAi: false,
              createdAt,
              statusAt: createdAt,
            },
          });
          postId = post.id;
          break;
        }
      }
    }

    // Создаём тему на форуме (кроме adlisting — у него нет темы форума)
    let topicId: number | null = null;
    let topicNumber: number | null = null;

    if (payload.section !== "adlisting") {
      const rubricId =
        payload.section === "forum"
          ? payload.rubricId ?? 132
          : config.rubricId;

      const lastTopic = await tx.topic.findFirst({
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const number = (lastTopic?.number ?? 0) + 1;
      const fullTopicTitle = ("Обсуждение: " + payload.title).slice(0, 150);

      const lastMsgBot = messageBots[messageBots.length - 1]?.bot ?? authorBot;
      const lastActivityAt =
        messageBots.length > 0
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

      // Связь с постом
      if (postId) {
        switch (payload.section) {
          case "wheretobuy":
            topicData.whereToBuyPost = { connect: { id: postId } };
            break;
          case "gdedeshevle":
            topicData.cheapPost = { connect: { id: postId } };
            break;
          case "employers":
            topicData.empPost = { connect: { id: postId } };
            break;
          case "recommend":
            topicData.recPost = { connect: { id: postId } };
            break;
          case "help":
            topicData.helpPublication = { connect: { id: postId } };
            break;
          case "overheard":
            topicData.overheardPost = { connect: { id: postId } };
            break;
          case "gkh":
            topicData.gkhProblem = { connect: { id: postId } };
            break;
          case "dating":
            topicData.datingPost = { connect: { id: postId } };
            break;
        }
      }

      const topic = await tx.topic.create({ data: topicData });
      topicId = topic.id;
      topicNumber = number;

      // Связь post.topicId = topic.id
      if (postId) {
        switch (payload.section) {
          case "wheretobuy":
            await tx.whereToBuyPost.update({
              where: { id: postId },
              data: { topicId: topic.id },
            });
            break;
          case "gdedeshevle":
            await tx.cheapPost.update({
              where: { id: postId },
              data: { topicId: topic.id },
            });
            break;
          case "employers":
            await tx.empPost.update({
              where: { id: postId },
              data: { topicId: topic.id },
            });
            break;
          case "recommend":
            await tx.recPost.update({
              where: { id: postId },
              data: { topicId: topic.id },
            });
            break;
          case "help":
            await tx.helpPublication.update({
              where: { id: postId },
              data: { topicId: topic.id },
            });
            break;
          case "overheard":
            await tx.overheardPost.update({
              where: { id: postId },
              data: { topicId: topic.id },
            });
            break;
          case "gkh":
            await tx.gkhProblem.update({
              where: { id: postId },
              data: { topicId: topic.id },
            });
            break;
          case "dating":
            await tx.datingPost.update({
              where: { id: postId },
              data: { topicId: topic.id },
            });
            break;
        }
      }

      // Сообщение #1 — тело темы.
      // 2026-11-03: если title и bodyText одинаковые — не дублируем, только bodyText.
      const firstBody =
        payload.title.trim() === payload.bodyText.trim()
          ? payload.bodyText
          : payload.title + "\n\n" + payload.bodyText;
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

      // Остальные сообщения с деревом (по parentIndex)
      const indexToMsgId = new Map<number, string>();
      const depth0 = messageBots
        .map((m, i) => ({ ...m, originalIndex: i }))
        .filter((m) => m.parentIndex === null);
      const depthN = messageBots
        .map((m, i) => ({ ...m, originalIndex: i }))
        .filter((m) => m.parentIndex !== null);

      let num = 2;
      for (const m of depth0) {
        const msg = await tx.message.create({
          data: {
            topicId: topic.id,
            num: num++,
            authorName: m.bot.nickname,
            authorId: m.bot.id,
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
          const parentId =
            m.parentIndex !== null ? indexToMsgId.get(m.parentIndex) : null;
          if (parentId === undefined) {
            stillPending.push(m);
            continue;
          }
          // 2026-11-03: вычисляем depth по цепочке parentIndex.
          // depth-0 сообщение (parentIndex=null) → depth=0
          // ответ на depth-0 → depth=1, ответ на depth-N → depth=N+1
          let depth = 1;
          let curParentIdx = m.parentIndex;
          while (curParentIdx !== null) {
            const parent = messageBots[curParentIdx];
            if (!parent) break;
            if (parent.parentIndex === null) {
              // parent — это depth-0 сообщение, мы уже на depth=1
              break;
            }
            depth++;
            curParentIdx = parent.parentIndex;
            if (depth > 10) break;
          }
          const msg = await tx.message.create({
            data: {
              topicId: topic.id,
              num: num++,
              authorName: m.bot.nickname,
              authorId: m.bot.id,
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
        throw new Error(
          "Не удалось создать " +
            remaining.length +
            " сообщений (parentIndex ссылается на несуществующее сообщение)"
        );
      }
    }

    return {
      postId,
      topicId,
      topicNumber,
      authorBot: authorBot.nickname,
      messagesCount: 1 + messageBots.length,
    };
  });

  console.log(JSON.stringify(result, null, 2));
  await db.$disconnect();
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  console.error(e.stack);
  process.exit(1);
});
