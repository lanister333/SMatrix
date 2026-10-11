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

export const runtime = "nodejs";

const THEATRE_BOTS_TOKEN = process.env.THEATRE_BOTS_TOKEN || process.env.SAKHMATRIX_API_TOKEN || "sakhmatrix-theatre-2026";

function auth(req: NextRequest, bodyToken?: string): boolean {
  const authHeader = req.headers.get("authorization") || "";
  const headerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  return (
    (!!headerToken && headerToken === THEATRE_BOTS_TOKEN) ||
    (!!bodyToken && bodyToken === THEATRE_BOTS_TOKEN)
  );
}

export async function GET(req: NextRequest) {
  if (!auth(req)) {
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
    if (!auth(req, body.token)) {
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

    if (action === "reject") {
      const id = body.id as string;
      if (!id) return NextResponse.json({ error: "id обязателен" }, { status: 400 });
      const reason = (body.reason as string) || "";
      const regenerate = body.regenerate !== false; // default true
      const r = await rejectQueueItem(id, reason, regenerate);
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

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    console.error("[bot-theatre] queue POST error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Внутренняя ошибка" },
      { status: 500 }
    );
  }
}
