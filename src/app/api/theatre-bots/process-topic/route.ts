// src/app/api/theatre-bots/process-topic/route.ts
// Запуск обработки одной темы: selector → Z.ai-rewriter → BotQueue
// Используется админом из админ-панели (раздел «Театр ботов»).
//
// POST /api/theatre-bots/process-topic
// Body: {
//   token: "sakhmatrix-theatre-2026",
//   text: "Текст темы от админа...",
//   rubricId?: 130,        // если задан — тема будет создана в этой рубрике
//   topicId?: 42,          // если задан — ответы в существующую тему
//   topicTitle?: "Заголовок темы"
// }

import { NextRequest, NextResponse } from "next/server";
import { processTopic } from "@/lib/bot-theatre";

export const runtime = "nodejs";

const THEATRE_BOTS_TOKEN = process.env.THEATRE_BOTS_TOKEN || process.env.SAKHMATRIX_API_TOKEN || "sakhmatrix-theatre-2026";

interface ProcessBody {
  token?: string;
  text?: string;
  rubricId?: number | null;
  topicId?: number | null;
  topicTitle?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body: ProcessBody = await req.json();

    // 1. Авторизация
    if (!body.token || body.token !== THEATRE_BOTS_TOKEN) {
      return NextResponse.json({ error: "Неверный токен" }, { status: 401 });
    }

    if (!body.text || body.text.trim().length < 10) {
      return NextResponse.json({ error: "Текст темы слишком короткий (< 10 символов)" }, { status: 400 });
    }

    const text = body.text.trim();
    const rubricId = typeof body.rubricId === "number" ? body.rubricId : null;
    const topicId = typeof body.topicId === "number" ? body.topicId : null;
    const topicTitle = body.topicTitle?.trim() || null;

    const result = await processTopic(text, { rubricId, topicId, topicTitle });

    console.log(`[bot-theatre] Processed topic: batch=${result.batchId} bots=${result.selectedBots.length} queued=${result.queuedCount}`);

    return NextResponse.json({
      ok: true,
      batchId: result.batchId,
      selectedBots: result.selectedBots,
      queuedCount: result.queuedCount,
      items: result.queueItems,
    });
  } catch (e) {
    console.error("[bot-theatre] process-topic error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Внутренняя ошибка" },
      { status: 500 }
    );
  }
}
