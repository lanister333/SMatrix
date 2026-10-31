// src/app/api/theatre-bots/auto-reply/route.ts
// Автоматический ответ ботов на тему или сообщение от админа/пользователя.
// 2026-10-12: когда админ (или любой юзер) создаёт тему ИЛИ пишет ответ в теме,
// этот endpoint подбирает 1-2 случайных ботов и ставит их ответы в очередь
// с задержкой 15мин-2ч (имитация живого форума).
//
// POST /api/theatre-bots/auto-reply
// Body: {
//   token: "sakhmatrix-theatre-2026",
//   topicId: 42,
//   parentMessageId: "msg_xxx",     // ID родительского сообщения (на которое отвечают боты)
//   triggerText: "Текст сообщения от админа",  // контекст для рерайта
//   triggerAuthorRole: "owner" | "admin" | "user",
//   isTopicStarter: true|false       // true = новый корневой пост темы, false = ответ в существующей теме
// }
//
// Автор: вызывается хуком из POST /api/topics и POST /api/topics/[id]/messages
//        (после успешного создания темы/сообщения — fire-and-forget, без ожидания).
//
// Логика:
//   1. Если triggerAuthorRole === "owner" или "admin" — всегда отвечаем (2-3 бота).
//   2. Если triggerAuthorRole === "user" — отвечаем с вероятностью 50% (1-2 бота).
//      (Чтобы форум не превратился в спам от ботов на каждый пост юзера.)
//   3. Selector: gender-aware (как в основном selector'е) + 1-3 бота.
//   4. Z.ai-рерайт с тем же усиленным промптом (без выдуманных названий).
//   5. BotQueue: status=approved, scheduledAt = NOW + random(15..120 min),
//      cascade 5-30 min между репликами ботов.
//   6. parentMessageId = ID сообщения админа (чтобы реплики шли в правильную ветку).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export const runtime = "nodejs";

const THEATRE_BOTS_TOKEN = process.env.THEATRE_BOTS_TOKEN || process.env.SAKHMATRIX_API_TOKEN || "sakhmatrix-theatre-2026";

interface AutoReplyBody {
  token?: string;
  topicId?: number;
  parentMessageId?: string;
  triggerText?: string;
  triggerAuthorRole?: string;
  isTopicStarter?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body: AutoReplyBody = await req.json();

    // Авторизация
    if (!body.token || body.token !== THEATRE_BOTS_TOKEN) {
      return NextResponse.json({ error: "Неверный токен" }, { status: 401 });
    }
    if (!body.topicId || !body.triggerText) {
      return NextResponse.json({ error: "topicId и triggerText обязательны" }, { status: 400 });
    }

    const role = body.triggerAuthorRole || "user";
    const isStaff = role === "owner" || role === "admin";

    // Probability: staff → always reply, regular user → 50% chance
    if (!isStaff && Math.random() > 0.5) {
      return NextResponse.json({ ok: true, skipped: true, reason: "random_skip_for_user" });
    }

    // Number of bots to reply: staff → 2-3, user → 1-2
    const botCount = isStaff
      ? 2 + Math.floor(Math.random() * 2)  // 2-3
      : 1 + Math.floor(Math.random() * 2); // 1-2

    // 1. Load bots
    const users = await db.user.findMany({
      where: { email: { contains: "@theatre.local" } },
      select: { id: true, nickname: true, gender: true, bio: true },
    });
    const bots: any[] = [];
    for (const u of users) {
      if (!u.bio) continue;
      try {
        const meta = JSON.parse(u.bio);
        if (meta.role !== "theatre_bot") continue;
        bots.push({
          id: u.id,
          nickname: u.nickname,
          gender: u.gender,
          group: meta.group,
          topics: Array.isArray(meta.topics) ? meta.topics : [],
          activityWeight: typeof meta.activity_weight === "number" ? meta.activity_weight : 1,
          isLowercase: !!meta.is_lowercase,
        });
      } catch {}
    }
    if (bots.length === 0) {
      return NextResponse.json({ ok: false, error: "No theatre bots in DB" });
    }

    // 2. Gender restriction (female-only / male-only topics)
    const FEMALE_ONLY = [
      "косметолог", "чистка лица", "бьюти", "эндокринолог", "гинеколог",
      "девушки и женщины", "девчёнк", "девченк", "девочки подскажите",
      "маникюр", "педикюр", "брови", "ресниц", "наращивание",
      "ламинирование", "парикмахер", "окрашивани", "балаяж", "волос",
      "беременност", "роды", "гв", "грудное вскармливание",
      "эпиляц", "шугаринг", "йог", "пилатес", "косметик",
    ];
    const MALE_ONLY = ["шиномонтаж", "карбюратор", "свечи зажигания", "спиннинг", "катушк", "блесна"];

    const lower = (body.triggerText || "").toLowerCase();
    let genderRestriction: string | null = null;
    if (FEMALE_ONLY.some((kw) => lower.includes(kw))) genderRestriction = "female";
    else if (MALE_ONLY.some((kw) => lower.includes(kw))) genderRestriction = "male";

    const filtered = genderRestriction
      ? bots.filter((b) => b.gender === genderRestriction)
      : bots;

    // 3. Pick random bots (weighted by activityWeight)
    const weighted: any[] = [];
    for (const b of filtered) {
      const w = Math.max(1, b.activityWeight);
      for (let i = 0; i < w; i++) weighted.push(b);
    }
    // Shuffle
    for (let i = weighted.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [weighted[i], weighted[j]] = [weighted[j], weighted[i]];
    }
    // Pick unique bots up to botCount
    const selected: any[] = [];
    const seen = new Set<string>();
    for (const b of weighted) {
      if (selected.length >= botCount) break;
      if (seen.has(b.id)) continue;
      selected.push(b);
      seen.add(b.id);
    }

    if (selected.length === 0) {
      return NextResponse.json({ ok: false, error: "No matching bots" });
    }

    // 4. Z.ai rewrite — call internal-api.z.ai directly (server-side, on VPS)
    //    Wait — Z.ai doesn't work from VPS! Need to delegate to sandbox.
    //    For now, save the queue items with a PENDING_REWRITE status — sandbox will
    //    pick them up and call Z.ai.
    //
    //    Actually, simpler: queue items as 'pending_rewrite', and a sandbox script
    //    will poll this endpoint's items and rewrite them.
    //
    //    EVEN SIMPLER: just save the items as 'pending' (NOT approved) so admin
    //    can see them in moderation queue, then a separate sandbox rewriter runs.

    // Save each bot's reply as a pending BotQueue item — admin must approve
    // OR a sandbox rewriter will fill in the text later.
    const batchId = crypto.randomUUID();

    // Build initial scheduledAt: NOW + 15-120 min, cascade +5-30 min between bots
    // 2026-10-27: ТЕСТОВЫЙ РЕЖИМ — мгновенные ответы.
    // В проде: 15 + Math.floor(Math.random() * 105) минут.
    // Сейчас: 0-5 секунд (умножаем на 60_000 потом, поэтому делим — задаём в минутах как 0..0.083)
    let baseDelayMin = Math.random() * 0.083; // 0..5 секунд в минутах
    const items: { id: string; botNickname: string; scheduledAt: Date }[] = [];
    for (let i = 0; i < selected.length; i++) {
      const bot = selected[i];
      const at = new Date(Date.now() + baseDelayMin * 60_000);
      const q = await db.botQueue.create({
        data: {
          botUserId: bot.id,
          botNickname: bot.nickname,
          text: "",  // будет заполнен после Z.ai-рерайта на песочнице
          sourceText: body.triggerText,
          topicId: body.topicId!,
          parentMessageId: body.parentMessageId ?? null,
          rubricId: null,  // тема уже существует, рубрика не нужна
          topicTitle: null,
          scheduledAt: at,
          status: "pending_rewrite",  // специальный статус — ждёт рерайта на песочнице
          order: i,
          batchId,
          meta: JSON.stringify({
            autoReply: true,
            triggeredBy: role,
            isTopicStarter: !!body.isTopicStarter,
            botGroup: bot.group,
            activityWeight: bot.activityWeight,
            isLowercase: bot.isLowercase,
            needsRewrite: true,
          }),
        },
      });
      items.push({ id: q.id, botNickname: bot.nickname, scheduledAt: at });
      baseDelayMin += 0.033 + Math.random() * 0.05; // +2..5 секунд между ботами (тест)
    }

    console.log(`[bot-theatre] Auto-reply queued: topic=${body.topicId} bots=${selected.length} batch=${batchId}`);

    return NextResponse.json({
      ok: true,
      queued: items.length,
      bots: selected.map((b) => b.nickname),
      batchId,
      items,
      message: "Items queued with status=pending_rewrite — sandbox rewriter must fill text + approve",
    });
  } catch (e) {
    console.error("[bot-theatre] auto-reply error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Внутренняя ошибка" },
      { status: 500 }
    );
  }
}
