// src/app/api/theatre-bots/queue/route.ts
// Очередь премодерации: список + действия (approve/reject/edit/publish-now).
//
// GET /api/theatre-bots/queue?token=...&status=pending&batchId=...
//   → { items: [...], batches: [{ batchId, count, sourceText, items }] }
//
// POST /api/theatre-bots/queue
//   Body: { token, action, id?, batchId?, text?, reason?, scheduledAt? }
//   actions:
//     "approve"      — одобрить одну реплику (id), планирует публикацию с задержкой 15мин-2ч
//     "approve-batch" — одобрить весь батч (batchId) с каскадными задержками 15-60мин между репликами
//     "reject"       — отклонить (id), бот регенерирует новый текст (regenerate=true по умолч.)
//     "edit"         — отредактировать текст (id, text)
//     "publish-now"  — опубликовать одобренную реплику немедленно (минуя scheduledAt)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { approveAndScheduleQueueItem, publishApprovedQueueItem, rejectQueueItem } from "@/lib/bot-theatre";
import { userByToken } from "@/lib/auth";
import { isStaffRole } from "@/lib/admin";

export const runtime = "nodejs";

const THEATRE_BOTS_TOKEN = process.env.THEATRE_BOTS_TOKEN || process.env.SAKHMATRIX_API_TOKEN || "sakhmatrix-theatre-2026";

/**
 * Авторизация: принимает 2 типа токенов:
 *   1. THEATRE_BOTS_TOKEN (shared secret для парсеров/scheduler'а)
 *   2. Session token админа/модератора (через userByToken — как в других admin API)
 */
async function authRequest(req: NextRequest, bodyToken?: string): Promise<boolean> {
  const authHeader = req.headers.get("authorization") || "";
  const headerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  const queryToken = req.nextUrl.searchParams.get("token");
  const token = bodyToken || headerToken || queryToken;
  if (!token) return false;

  // 1. Проверяем shared secret (для scheduler/rewriter на песочнице)
  if (token === THEATRE_BOTS_TOKEN) return true;

  // 2. Проверяем session token (админ/модератор через userByToken)
  const user = await userByToken(token);
  if (user && isStaffRole(user.role)) return true;

  return false;
}

export async function GET(req: NextRequest) {
  if (!(await authRequest(req))) {
    return NextResponse.json({ error: "Неверный токен" }, { status: 401 });
  }
  const status = req.nextUrl.searchParams.get("status") || "pending";
  const batchId = req.nextUrl.searchParams.get("batchId");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "100", 10), 500);

  const where: any = {};
  if (status !== "all") where.status = status;
  if (batchId) where.batchId = batchId;

  const items = await db.botQueue.findMany({
    where,
    orderBy: [{ batchId: "desc" }, { order: "asc" }],
    take: limit,
    select: {
      id: true,
      botNickname: true,
      text: true,
      sourceText: true,
      topicId: true,
      rubricId: true,
      topicTitle: true,
      status: true,
      scheduledAt: true,
      publishedMessageId: true,
      rejectReason: true,
      order: true,
      batchId: true,
      meta: true,
      createdAt: true,
    },
  });

  // Group by batchId for the UI
  const batchesMap = new Map<string, any[]>();
  for (const it of items) {
    const arr = batchesMap.get(it.batchId) || [];
    arr.push(it);
    batchesMap.set(it.batchId, arr);
  }
  const batches = Array.from(batchesMap.entries()).map(([bid, batchItems]) => ({
    batchId: bid,
    count: batchItems.length,
    sourceText: batchItems[0]?.sourceText || "",
    topicTitle: batchItems[0]?.topicTitle || null,
    items: batchItems.sort((a, b) => a.order - b.order),
  }));

  return NextResponse.json({ items, batches, total: items.length });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!(await authRequest(req, body.token))) {
      return NextResponse.json({ error: "Неверный токен" }, { status: 401 });
    }
    const action = body.action as string;
    if (!action) {
      return NextResponse.json({ error: "action обязателен" }, { status: 400 });
    }

    if (action === "approve") {
      const id = body.id as string;
      if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });
      const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : undefined;
      const r = await approveAndScheduleQueueItem(id, scheduledAt);
      return NextResponse.json({ ok: true, scheduledAt: r.scheduledAt });
    }

    if (action === "approve-batch") {
      const batchId = body.batchId as string;
      if (!batchId) return NextResponse.json({ error: "batchId обязателен" }, { status: 400 });
      const batch = await db.botQueue.findMany({
        where: { batchId, status: "pending" },
        orderBy: { order: "asc" },
      });
      const scheduled: { id: string; scheduledAt: Date }[] = [];
      // Каскадные задержки: каждая следующая реплика — на 15-45 мин позже предыдущей
      let baseDelay = 15 + Math.floor(Math.random() * 30); // 15..44 мин для первой
      for (const item of batch) {
        const at = new Date(Date.now() + baseDelay * 60_000);
        await db.botQueue.update({ where: { id: item.id }, data: { status: "approved", scheduledAt: at } });
        scheduled.push({ id: item.id, scheduledAt: at });
        baseDelay += 15 + Math.floor(Math.random() * 45); // +15..60 мин между репликами
      }
      return NextResponse.json({ ok: true, approved: scheduled.length, scheduled });
    }

    if (action === "publish-topic-now") {
      // 2026-10-12: Опубликовать ТЕМУ целиком немедленно.
      // Создаёт Topic (если topicId нет) + публикует все реплики батча как сообщения.
      // Используется кнопкой «🚀 Опубликовать тему» в шапке батча в админке.
      const batchId = body.batchId as string;
      if (!batchId) return NextResponse.json({ error: "batchId обязателен" }, { status: 400 });
      const batch = await db.botQueue.findMany({
        where: { batchId },
        orderBy: { order: "asc" },
      });
      if (batch.length === 0) {
        return NextResponse.json({ error: "Батч пуст" }, { status: 404 });
      }
      const first = batch[0];
      if (!first.rubricId) {
        return NextResponse.json({ error: "У батча нет rubricId — невозможно создать тему" }, { status: 400 });
      }

      // Запускаем публикацию всех реплик в одной транзакции
      const result = await db.$transaction(async (tx) => {
        let topicId = first.topicId;

        // Если topicId нет — создаём новую тему
        if (!topicId) {
          const title = first.topicTitle || first.text.slice(0, 70).replace(/\s+/g, " ").trim() + (first.text.length > 70 ? "…" : "");
          const lastTopic = await tx.topic.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
          const newTopicNumber = (lastTopic?.number ?? 0) + 1;
          const newTopic = await tx.topic.create({
            data: {
              number: newTopicNumber,
              title,
              source: "theatre-bots",
              authorName: first.botNickname,
              authorId: first.botUserId,
              rubricId: first.rubricId!,
              lastAuthorName: first.botNickname,
              lastActivityAt: new Date(),
            },
          });
          topicId = newTopic.id;
          // Обновляем все items батча с новым topicId
          await tx.botQueue.updateMany({
            where: { batchId },
            data: { topicId: newTopic.id },
          });
        }

        // Публикуем все реплики батча как сообщения в тему
        let published = 0;
        let lastMsgNum = 0;
        for (const item of batch) {
          if (item.status === "published") continue;  // уже опубликовано
          lastMsgNum += 1;
          const message = await tx.message.create({
            data: {
              topicId,
              num: lastMsgNum,
              depth: 0,
              authorName: item.botNickname,
              authorId: item.botUserId,
              body: item.text,
              kind: "news",
              aiStatus: "ok",
              modLevel: 4,
              aiAction: "WATCH",
              aiConfidence: 1.0,
              aiSignal: "theatre-bot",
            },
          });
          await tx.botQueue.update({
            where: { id: item.id },
            data: {
              status: "published",
              publishedMessageId: message.id,
              topicId,
              scheduledAt: new Date(),
            },
          });
          published++;
        }

        // Обновляем тему: lastActivityAt
        await tx.topic.update({
          where: { id: topicId },
          data: {
            lastActivityAt: new Date(),
            lastAuthorName: batch[batch.length - 1].botNickname,
          },
        });

        return { topicId, published };
      });

      console.log(`[bot-theatre] publish-topic-now: batch=${batchId} topic=${result.topicId} published=${result.published}`);
      return NextResponse.json({ ok: true, topicId: result.topicId, published: result.published });
    }

    if (action === "approve-batch-custom") {
      // Approve all items in a batch with a SPECIFIC scheduledAt time (e.g. for the scheduler).
      // All replies of the batch get the same scheduledAt — they appear in the topic together.
      const batchId = body.batchId as string;
      const scheduledAtStr = body.scheduledAt as string;
      if (!batchId || !scheduledAtStr) {
        return NextResponse.json({ error: "batchId и scheduledAt обязательны" }, { status: 400 });
      }
      const scheduledAt = new Date(scheduledAtStr);
      if (isNaN(scheduledAt.getTime())) {
        return NextResponse.json({ error: "scheduledAt не валидная дата" }, { status: 400 });
      }
      const batch = await db.botQueue.findMany({
        where: { batchId, status: "pending" },
        orderBy: { order: "asc" },
      });
      // All items get the SAME scheduledAt (they appear in the topic together)
      // — but with a small random offset (1-5 min) between them so they don't appear at the exact same second.
      const scheduled: { id: string; scheduledAt: Date }[] = [];
      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        // Each reply appears 1-5 min later than the previous
        const offsetMin = i * (1 + Math.floor(Math.random() * 4));
        const at = new Date(scheduledAt.getTime() + offsetMin * 60_000);
        await db.botQueue.update({ where: { id: item.id }, data: { status: "approved", scheduledAt: at } });
        scheduled.push({ id: item.id, scheduledAt: at });
      }
      return NextResponse.json({ ok: true, approved: scheduled.length, scheduled });
    }

    if (action === "reject") {
      const id = body.id as string;
      if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });
      const reason = (body.reason as string) || "";
      // 2026-10-12: regenerate=true вызывает Z.ai, который не работает с VPS.
      // По умолчанию НЕ регенерируем — просто помечаем как rejected.
      // Регенерация возможна отдельно через action="regenerate" (когда sandbox-rewriter активен).
      const r = await rejectQueueItem(id, reason, false);
      return NextResponse.json({ ok: true, regenerated: r.regenerated, newQueueId: r.newQueueId });
    }

    if (action === "reject-and-regenerate") {
      // Опциональная регенерация (если sandbox-rewriter может подхватить pending_rewrite).
      // НЕ вызывается по умолчанию — Z.ai endpoint не работает с VPS.
      const id = body.id as string;
      if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });
      const reason = (body.reason as string) || "";
      const r = await rejectQueueItem(id, reason, true);
      return NextResponse.json({ ok: true, regenerated: r.regenerated, newQueueId: r.newQueueId });
    }

    if (action === "edit") {
      const id = body.id as string;
      const text = (body.text as string)?.trim();
      if (!id || !text || text.length < 5) {
        return NextResponse.json({ error: "id и text (≥5 символов) обязательны" }, { status: 400 });
      }
      await db.botQueue.update({ where: { id }, data: { text } });
      return NextResponse.json({ ok: true });
    }

    if (action === "publish-now") {
      const id = body.id as string;
      if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });
      // Принудительно одобрить и опубликовать немедленно (минуя scheduledAt)
      await db.botQueue.update({ where: { id }, data: { status: "approved", scheduledAt: new Date() } });
      const r = await publishApprovedQueueItem(id);
      return NextResponse.json({ ok: true, topicId: r.topicId, messageId: r.messageId });
    }

    if (action === "update-published") {
      // Обновляет текст уже ОПУБЛИКОВАННОГО сообщения в форуме.
      // Принимает { id, text } — находит Message по publishedMessageId и обновляет body.
      const id = body.id as string;
      const text = (body.text as string)?.trim();
      if (!id || !text || text.length < 5) {
        return NextResponse.json({ error: "id и text (≥5 символов) обязательны" }, { status: 400 });
      }
      const item = await db.botQueue.findUnique({ where: { id } });
      if (!item) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
      if (item.status !== "published" || !item.publishedMessageId) {
        return NextResponse.json({ error: "Реплика ещё не опубликована" }, { status: 400 });
      }
      // Update Message body
      await db.message.update({
        where: { id: item.publishedMessageId },
        data: {
          body: text,
          editedAt: new Date(),
        },
      });
      // Update BotQueue text too (для консистентности)
      await db.botQueue.update({ where: { id }, data: { text } });
      return NextResponse.json({ ok: true, messageId: item.publishedMessageId });
    }

    if (action === "delete-published") {
      // Удаляет уже ОПУБЛИКОВАННОЕ сообщение из форума.
      // Если это было корневое сообщение темы (num=1) — удаляет ВСЮ тему и её сообщения.
      const id = body.id as string;
      if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });
      const item = await db.botQueue.findUnique({ where: { id } });
      if (!item) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
      if (item.status !== "published" || !item.publishedMessageId) {
        return NextResponse.json({ error: "Реплика ещё не опубликована" }, { status: 400 });
      }
      // Находим Message
      const msg = await db.message.findUnique({
        where: { id: item.publishedMessageId },
        select: { id: true, topicId: true, num: true },
      });
      if (!msg) {
        // Message уже удалён — просто помечаем BotQueue
        await db.botQueue.update({ where: { id }, data: { status: "rejected", rejectReason: "Message already deleted" } });
        return NextResponse.json({ ok: true, message: "Message already deleted" });
      }
      const topicId = msg.topicId;
      const isRoot = msg.num === 1;
      if (isRoot) {
        // Удаляем всю тему со всеми сообщениями
        await db.message.deleteMany({ where: { topicId } });
        await db.topic.delete({ where: { id: topicId } });
        // Помечаем все BotQueue items этого батча как rejected (т.к. тема удалена)
        await db.botQueue.updateMany({
          where: { batchId: item.batchId },
          data: { status: "rejected", rejectReason: "Topic deleted by admin" },
        });
        return NextResponse.json({ ok: true, deleted: "topic+all-messages", topicId });
      } else {
        // Удаляем только это сообщение
        await db.message.delete({ where: { id: msg.id } });
        await db.botQueue.update({
          where: { id },
          data: { status: "rejected", rejectReason: "Message deleted by admin" },
        });
        return NextResponse.json({ ok: true, deleted: "message", messageId: msg.id });
      }
    }

    if (action === "regenerate") {
      // 2026-10-12 v2: НЕ вызываем Z.ai с VPS (не работает).
      // Просто помечаем как pending_rewrite — sandbox-rewriter подхватит и сделает новый текст.
      const id = body.id as string;
      if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });
      const item = await db.botQueue.findUnique({ where: { id } });
      if (!item) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
      // Помечаем как pending_rewrite + очищаем text — sandbox-rewriter сгенерирует новый
      await db.botQueue.update({
        where: { id },
        data: {
          status: "pending_rewrite",
          text: "",
          rejectReason: "regenerate requested by admin",
        },
      });
      return NextResponse.json({ ok: true, message: "Помечено как pending_rewrite — sandbox-rewriter сгенерирует новый текст" });
    }

    if (action === "update-and-approve") {
      // Принимает текст от sandbox-rewriter'а для auto-reply items (status=pending_rewrite).
      // Обновляет text + меняет status на 'approved' (готов к публикации publisher cron'ом).
      // 2026-10-12 v2: НЕ ИСПОЛЬЗУЕТСЯ — заменено на update-to-pending (для модерации).
      const id = body.id as string;
      const text = (body.text as string)?.trim();
      if (!id || !text || text.length < 5) {
        return NextResponse.json({ error: "id и text (≥5 символов) обязательны" }, { status: 400 });
      }
      const item = await db.botQueue.findUnique({ where: { id } });
      if (!item) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
      if (item.status !== "pending_rewrite") {
        return NextResponse.json({ error: `Item status ${item.status}, expected pending_rewrite` }, { status: 400 });
      }
      await db.botQueue.update({
        where: { id },
        data: { text, status: "approved" },
      });
      return NextResponse.json({ ok: true, botNickname: item.botNickname, scheduledAt: item.scheduledAt });
    }

    if (action === "update-to-pending") {
      // 2026-10-12 v2: правильный flow для auto-reply — текст заполнен, статус → 'pending'
      // (ждёт модерации админом). Админ видит в /admin?section=bots, одобряет/редактирует/удаляет.
      const id = body.id as string;
      const text = (body.text as string)?.trim();
      if (!id || !text || text.length < 5) {
        return NextResponse.json({ error: "id и text (≥5 символов) обязательны" }, { status: 400 });
      }
      const item = await db.botQueue.findUnique({ where: { id } });
      if (!item) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
      if (item.status !== "pending_rewrite") {
        return NextResponse.json({ error: `Item status ${item.status}, expected pending_rewrite` }, { status: 400 });
      }
      await db.botQueue.update({
        where: { id },
        data: { text, status: "pending" },  // ждёт модерации админом
      });
      return NextResponse.json({ ok: true, botNickname: item.botNickname });
    }

    if (action === "publish-batch-by-title") {
      // 2026-10-12: Если у батча нет topicId (тема не создана), но есть rubricId и topicTitle —
      // создаём Topic по этим данным (без публикации реплик), возвращаем topicId.
      // Используется когда админ кликает на заголовок темы в админке, чтобы посмотреть тему.
      // Если topicId уже есть — просто возвращаем его.
      const batchId = body.batchId as string;
      if (!batchId) return NextResponse.json({ error: "batchId обязателен" }, { status: 400 });

      const items = await db.botQueue.findMany({
        where: { batchId },
        orderBy: { order: "asc" },
        take: 1,
      });
      if (items.length === 0) {
        return NextResponse.json({ error: "Батч пуст" }, { status: 404 });
      }
      const first = items[0];

      // Если topicId уже есть — возвращаем
      if (first.topicId) {
        return NextResponse.json({ ok: true, topicId: first.topicId });
      }

      // Нужно создать тему — но для этого нужен rubricId
      if (!first.rubricId) {
        return NextResponse.json({ error: "У батча нет rubricId — невозможно создать тему" }, { status: 400 });
      }

      // Заголовок темы
      const title = first.topicTitle || first.text.slice(0, 70).replace(/\s+/g, " ").trim() + (first.text.length > 70 ? "…" : "");
      if (!title) {
        return NextResponse.json({ error: "Нет заголовка для темы" }, { status: 400 });
      }

      // Создаём Topic
      const lastTopic = await db.topic.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
      const newTopicNumber = (lastTopic?.number ?? 0) + 1;
      const newTopic = await db.topic.create({
        data: {
          number: newTopicNumber,
          title,
          source: "theatre-bots",
          authorName: first.botNickname,
          authorId: first.botUserId,
          rubricId: first.rubricId,
          lastAuthorName: first.botNickname,
          lastActivityAt: new Date(),
        },
      });

      // Обновляем все items батча — проставляем topicId
      await db.botQueue.updateMany({
        where: { batchId },
        data: { topicId: newTopic.id },
      });

      console.log(`[bot-theatre] publish-batch-by-title: created topic #${newTopic.id} for batch ${batchId}`);
      return NextResponse.json({ ok: true, topicId: newTopic.id, created: true });
    }

    if (action === "save-batch-with-topic") {
      // 2026-10-12 v3: Тема и Ответы — РАЗНЫЕ сущности в модерации.
      // Создаёт:
      //   1. Тема (Topic) — order=-1, текст = topicText (корневое сообщение)
      //      Админ может одобрить/удалить ТЕМУ отдельно от ответов.
      //   2. Ответы — order=0..N, текст = replies[i].text
      // Тема может быть без ответов (если replies=[]).
      const sourceText = (body.sourceText as string) || "";
      const rubricId = typeof body.rubricId === "number" ? body.rubricId : null;
      const topicTitle = (body.topicTitle as string) || null;
      const topicText = (body.topicText as string) || "";
      const topicAuthorBot = (body.topicAuthorBot as string) || "";
      const scheduledAtStr = body.scheduledAt as string;
      const replies = body.replies as Array<{ username: string; text: string }>;
      if (!topicText || !topicAuthorBot) {
        return NextResponse.json({ error: "topicText и topicAuthorBot обязательны" }, { status: 400 });
      }
      if (!scheduledAtStr) {
        return NextResponse.json({ error: "scheduledAt обязателен" }, { status: 400 });
      }
      const scheduledAt = new Date(scheduledAtStr);
      if (isNaN(scheduledAt.getTime())) {
        return NextResponse.json({ error: "scheduledAt не валидная дата" }, { status: 400 });
      }

      const crypto = await import("crypto");
      const batchId = crypto.randomUUID();

      // Загружаем всех ботов
      const allBots = await db.user.findMany({
        where: { email: { contains: "@theatre.local" } },
        select: { id: true, nickname: true },
      });
      const botByNick = new Map(allBots.map((b) => [b.nickname, b]));

      // 1. Создаём ТЕМУ (order = -1) — корневое сообщение
      const topicBot = botByNick.get(topicAuthorBot);
      if (!topicBot) {
        return NextResponse.json({ error: `Бот "${topicAuthorBot}" не найден` }, { status: 400 });
      }
      await db.botQueue.create({
        data: {
          botUserId: topicBot.id,
          botNickname: topicBot.nickname,
          text: topicText,
          sourceText,
          topicId: null,
          rubricId,
          topicTitle,
          scheduledAt,
          status: "pending",  // ждёт модерации
          order: -1,  // -1 = ТЕМА (корневое сообщение), отличается от ответов
          batchId,
          meta: JSON.stringify({ type: "topic", savedBy: "sandbox-scheduler" }),
        },
      });

      // 2. Создаём ОТВЕТЫ (order = 0..N)
      let saved = 1;  // 1 = тема уже создана
      for (let i = 0; i < (replies?.length || 0); i++) {
        const r = replies[i];
        const bot = botByNick.get(r.username);
        if (!bot) {
          console.warn(`[bot-theatre] save-batch-with-topic: bot "${r.username}" not found, skipping`);
          continue;
        }
        const offsetMin = (i + 1) * (1 + Math.floor(Math.random() * 4));
        const at = new Date(scheduledAt.getTime() + offsetMin * 60_000);
        await db.botQueue.create({
          data: {
            botUserId: bot.id,
            botNickname: bot.nickname,
            text: r.text,
            sourceText,
            topicId: null,
            rubricId,
            topicTitle,
            scheduledAt: at,
            status: "pending",
            order: i,
            batchId,
            meta: JSON.stringify({ type: "reply", savedBy: "sandbox-scheduler" }),
          },
        });
        saved++;
      }
      return NextResponse.json({ ok: true, batchId, queuedCount: saved });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2026-10-13: РАЗДЕЛЬНАЯ МОДЕРАЦИЯ — публикует ТОЛЬКО тему (message #1).
    // Ответы (order>=0) НЕ публикуются — остаются в pending, ждут отдельного одобрения.
    // Проставляет topicId всем ответам батча (чтобы при их публикации попасть в эту тему).
    // ─────────────────────────────────────────────────────────────────────
    if (action === "approve-topic-only") {
      const id = body.id as string;
      if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });
      const item = await db.botQueue.findUnique({ where: { id } });
      if (!item) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
      if (item.order !== -1) {
        return NextResponse.json({ error: "Это не тема (order должно быть -1)" }, { status: 400 });
      }
      if (item.status === "published") {
        return NextResponse.json({ error: "Тема уже опубликована" }, { status: 400 });
      }
      if (!item.rubricId) {
        return NextResponse.json({ error: "У темы нет rubricId — невозможно создать Topic" }, { status: 400 });
      }

      const result = await db.$transaction(async (tx) => {
        // Создаём Topic (если ещё не создан)
        let topicId = item.topicId;
        if (!topicId) {
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
              rubricId: item.rubricId!,
              lastAuthorName: item.botNickname,
              lastActivityAt: new Date(),
            },
          });
          topicId = newTopic.id;

          // Проставляем topicId всем ответам этого батча (но не трогаем их status)
          await tx.botQueue.updateMany({
            where: { batchId: item.batchId, id: { not: item.id } },
            data: { topicId: newTopic.id },
          });
        }

        // Создаём message #1 (текст темы)
        const message = await tx.message.create({
          data: {
            topicId,
            num: 1,
            depth: 0,
            authorName: item.botNickname,
            authorId: item.botUserId,
            body: item.text,
            kind: "news",
            aiStatus: "ok",
            modLevel: 4,
            aiAction: "WATCH",
            aiConfidence: 1.0,
            aiSignal: "theatre-bot",
          },
        });

        // Помечаем topic-item как опубликованный
        await tx.botQueue.update({
          where: { id: item.id },
          data: {
            status: "published",
            publishedMessageId: message.id,
            topicId,
            scheduledAt: new Date(),
          },
        });

        // Обновляем тему
        await tx.topic.update({
          where: { id: topicId },
          data: {
            lastActivityAt: new Date(),
            lastAuthorName: item.botNickname,
          },
        });

        return { topicId, messageId: message.id };
      });

      console.log(`[bot-theatre] approve-topic-only: topic=${result.topicId} msg=${result.messageId}`);
      return NextResponse.json({ ok: true, topicId: result.topicId, messageId: result.messageId });
    }

    // 2026-10-13: удалить весь батч полностью из BotQueue (все items, включая тему и ответы).
    if (action === "delete-batch") {
      const batchId = body.batchId as string;
      if (!batchId) return NextResponse.json({ error: "batchId обязателен" }, { status: 400 });
      const result = await db.botQueue.deleteMany({ where: { batchId } });
      console.log(`[bot-theatre] delete-batch: ${batchId} → deleted ${result.count} items`);
      return NextResponse.json({ ok: true, deleted: result.count });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    console.error("[bot-theatre] queue POST error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Внутренняя ошибка" },
      { status: 500 }
    );
  }
}
