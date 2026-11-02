/**
 * /api/admin/seed — ОДНОРАЗОВЫЙ эндпоинт для заполнения форума/разделов
 * импортированными темами. Создан 2026-11-02 для миграции темы сантехника
 * на прод-БД (без SSH — запускается через браузер с админским токеном).
 *
 * ВНИМАНИЕ: после применения на проде — удалить файл и закоммитить.
 *
 * Логика: аналогична scripts/seed-topic-1-santehnik.ts, но интегрирована
 * в приложение и использует pickRandomBot() из src/lib/auto-bots.ts
 * (для совместимости с prod-БД, где боты помечены bio.role="theatre_bot").
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isStaffRole } from "@/lib/admin";
import { pickRandomBot } from "@/lib/auto-bots";

export const runtime = "nodejs";
export const maxDuration = 60;

// Даты в Сахалинском времени (UTC+11), через ISO с offset.
const T = (s: string) => new Date(s);

const DATES = {
  topic:    T("2026-10-28T12:00:00+11:00"),
  korennoy: T("2026-10-28T13:10:00+11:00"),
  yapo_k:   T("2026-10-28T13:41:00+11:00"),
  kirill:   T("2026-10-28T13:12:00+11:00"),
  yapo_kir: T("2026-10-28T13:42:00+11:00"),
  hottey:   T("2026-10-28T13:54:00+11:00"),
  yapo_hot: T("2026-10-28T18:58:00+11:00"),
  whoami:   T("2026-10-28T14:32:00+11:00"),
  viktor:   T("2026-10-28T14:48:00+11:00"),
  nastya:   T("2026-10-30T15:18:00+11:00"),
  cs:       T("2026-10-31T19:27:00+11:00"),
};

const TOPIC_TITLE = "Подскажите толкового сантехника для частного дома";
const TOPIC_BODY_TEXT =
  "Добрый день, форумчане! Подскажите, пожалуйста, толкового сантехника по адекватной цене — нужно посмотреть трубы и батареи в частном доме.";

// Защита от повторного запуска: ищем уже созданную публикацию по title.
async function findExisting() {
  return db.whereToBuyPost.findFirst({
    where: { title: TOPIC_TITLE },
    select: { id: true, topicId: true },
  });
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    if (!isStaffRole(user.role)) {
      return NextResponse.json({ error: "Доступно только администратору" }, { status: 403 });
    }

    // Идемпотентность: если уже создано — вернуть что есть.
    const existing = await findExisting();
    if (existing && existing.topicId) {
      const messages = await db.message.count({ where: { topicId: existing.topicId } });
      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        postId: existing.id,
        topicId: existing.topicId,
        messages,
        note: "Тема уже была создана ранее. Повторное создание пропущено.",
      });
    }

    // 1. Боты по гендеру (один автор для темы + 3 «спасибо» = один бот)
    const yapoBot = await pickRandomBot([]);
    if (!yapoBot || yapoBot.gender !== "female") {
      // попробовать ещё раз — нужна женщина
      const yapoBot2 = await pickRandomBot(yapoBot ? [yapoBot.id] : []);
      if (!yapoBot2) {
        return NextResponse.json({ error: "Не найден ни один бот в БД" }, { status: 500 });
      }
    }
    // финальный выбор yapoBot — точно женщина
    let yapo: typeof yapoBot = yapoBot;
    if (yapoBot.gender !== "female") {
      // пытаемся подобрать женского до 5 раз
      const used = [yapoBot.id];
      for (let i = 0; i < 5; i++) {
        const cand = await pickRandomBot(used);
        if (!cand) break;
        used.push(cand.id);
        if (cand.gender === "female") {
          yapo = cand;
          break;
        }
      }
      if (yapo.gender !== "female") {
        return NextResponse.json({ error: "Не найден женский бот в БД" }, { status: 500 });
      }
    }

    const used = new Set<string>([yapo.id]);

    const pickExcl = async (gender: "male" | "female") => {
      for (let i = 0; i < 5; i++) {
        const cand = await pickRandomBot([...used]);
        if (!cand) return null;
        if (cand.gender === gender) {
          used.add(cand.id);
          return cand;
        }
        used.add(cand.id);
      }
      return null;
    };

    const korennoy = await pickExcl("male");
    const kirill   = await pickExcl("male");
    const hottey   = await pickExcl("female");
    const whoami   = await pickExcl("male");
    const viktor   = await pickExcl("male");
    const nastya   = await pickExcl("female");
    const cs       = await pickExcl("male");

    const required = { korennoy, kirill, hottey, whoami, viktor, nastya, cs };
    for (const [k, v] of Object.entries(required)) {
      if (!v) {
        return NextResponse.json({ error: `Не удалось подобрать бота для роли ${k}` }, { status: 500 });
      }
    }

    // 2. Тексты (лёгкий рерайт) + дерево
    const answers = [
      // depth=0
      { author: korennoy!, body: "Написал вам в личные сообщения.", createdAt: DATES.korennoy, parentKey: null,   key: "korennoy" },
      { author: kirill!,   body: "89025588388", createdAt: DATES.kirill,   parentKey: null,   key: "kirill"   },
      { author: hottey!,   body: "Если вдруг предыдущие варианты не подойдут — звоните +79146439295. Толковый, проверенный сантехник.", createdAt: DATES.hottey, parentKey: null,   key: "hottey"   },
      { author: whoami!,   body: "Хм, ну батареи и трубы посмотреть любой мужчина сможет. Лучше опишите проблему: как работало, когда перестало, что внутри труб. Обычно в частном доме ломаться особо нечему — вода в системе своя, не меняется, может годами работать.", createdAt: DATES.whoami, parentKey: null,   key: "whoami"   },
      { author: nastya!,   body: "89242804973 Николай", createdAt: DATES.nastya,   parentKey: null,   key: "nastya"   },
      { author: cs!,       body: "Добрый вечер. Звоните: 89621205424", createdAt: DATES.cs,       parentKey: null,   key: "cs"       },
      // depth=1
      { author: yapo,      body: "Спасибо 🙏", createdAt: DATES.yapo_k,   parentKey: "korennoy", key: "yapo_k"   },
      { author: yapo,      body: "Спасибо!",    createdAt: DATES.yapo_kir, parentKey: "kirill",   key: "yapo_kir" },
      { author: yapo,      body: "Спасибо 🙏", createdAt: DATES.yapo_hot, parentKey: "hottey",   key: "yapo_hot" },
      { author: viktor!,   body: "Только посмотреть?", createdAt: DATES.viktor,   parentKey: "whoami",   key: "viktor"   },
    ];

    // 3. Транзакция
    const result = await db.$transaction(async (tx) => {
      const post = await tx.whereToBuyPost.create({
        data: {
          title: TOPIC_TITLE,
          text: TOPIC_BODY_TEXT,
          place: "",
          postType: "service",
          status: "seeking",
          authorId: yapo.id,
          authorName: yapo.nickname,
          aiStatus: "ok",
          isHiddenByAi: false,
          createdAt: DATES.topic,
          statusAt: DATES.topic,
        },
      });

      const last = await tx.topic.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
      const number = (last?.number ?? 0) + 1;
      const fullTopicTitle = `Обсуждение: ${TOPIC_TITLE}`.slice(0, 150);

      const topic = await tx.topic.create({
        data: {
          number,
          title: fullTopicTitle,
          authorName: yapo.nickname,
          authorId: yapo.id,
          rubricId: 132, // wheretobuy-discuss
          lastAuthorName: cs!.nickname,
          createdAt: DATES.topic,
          lastActivityAt: DATES.cs,
          whereToBuyPost: { connect: { id: post.id } },
        },
      });

      const firstBody = `${TOPIC_TITLE}\n\n${TOPIC_BODY_TEXT}`;
      await tx.message.create({
        data: {
          topicId: topic.id,
          num: 1,
          authorName: yapo.nickname,
          authorId: yapo.id,
          body: firstBody,
          kind: "advice",
          createdAt: DATES.topic,
        },
      });

      const keyToMsgId = new Map<string, string>();
      const depth0 = answers.filter(a => a.parentKey === null);
      const depth1 = answers.filter(a => a.parentKey !== null);

      let num = 2;
      for (const a of depth0) {
        const msg = await tx.message.create({
          data: {
            topicId: topic.id,
            num: num++,
            authorName: a.author.nickname,
            authorId: a.author.id,
            body: a.body,
            kind: "advice",
            depth: 0,
            parentId: null,
            createdAt: a.createdAt,
          },
        });
        keyToMsgId.set(a.key, msg.id);
      }

      for (const a of depth1) {
        const parentMsgId = a.parentKey ? keyToMsgId.get(a.parentKey) : null;
        if (!parentMsgId) {
          throw new Error(`Не найден parent-сообщение для "${a.key}"`);
        }
        const msg = await tx.message.create({
          data: {
            topicId: topic.id,
            num: num++,
            authorName: a.author.nickname,
            authorId: a.author.id,
            body: a.body,
            kind: "advice",
            depth: 1,
            parentId: parentMsgId,
            createdAt: a.createdAt,
          },
        });
        keyToMsgId.set(a.key, msg.id);
      }

      await tx.whereToBuyPost.update({ where: { id: post.id }, data: { topicId: topic.id } });

      return { post, topic, totalMessages: 1 + answers.length };
    });

    return NextResponse.json({
      ok: true,
      alreadyExists: false,
      postId: result.post.id,
      topicId: result.topic.id,
      topicNumber: result.topic.number,
      topicTitle: result.topic.title,
      messages: result.totalMessages,
      bots: {
        Yaponochka: yapo.nickname,
        Korennoy: korennoy!.nickname,
        Kirill: kirill!.nickname,
        Hottey: hottey!.nickname,
        Whoami: whoami!.nickname,
        Viktor: viktor!.nickname,
        Nastya: nastya!.nickname,
        Cs: cs!.nickname,
      },
      note: "Тема создана. Теперь можно удалить файл /api/admin/seed/route.ts и закоммитить зачистку.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
