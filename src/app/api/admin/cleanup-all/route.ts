/**
 * /api/admin/cleanup-all — ОБЪЕДИНЁННАЯ АТОМАРНАЯ очистка сайта.
 *
 * Создан 2026-11-02. Заменяет два отдельных эндпоинта:
 *   - /api/admin/topics/cleanup  (темы форума)
 *   - /api/admin/blocks/cleanup  (публикации в спецразделах)
 *
 * Что удаляет (всё в одной транзакции):
 *   1. Публикации во всех 9 спецразделах со всеми ответами, жалобами,
 *      фото, медиа, голосами, подсказками.
 *   2. Все темы форума, где isPinned = false, со всеми сообщениями в них.
 *   3. Все жалобы на сообщения (Complaint), историю модерации (ModerationHistory),
 *      очереди ботов (BotQueue, BotReplyQueue).
 *
 * Что НЕ трогает:
 *   - User (ботов и реальных юзеров) — все 100% сохраняются
 *   - Topic где isPinned = true (закреплённые темы)
 *   - Message в закреплённых темах
 *   - Rubric (рубрики форума)
 *   - SiteSetting (настройки сайта)
 *   - AuthToken, Session, LoginAttempt, UserDevice, UserIp, AccountLink
 *     (сессии и аккаунты пользователей)
 *   - CurrencyRate (курсы валют)
 *   - AiVerdictCache
 *
 * ВАЖНО: AdListing и DatingPost НЕ имеют поля topicId — для них НЕ
 * запрашиваем findMany({where:{topicId:{not:null}}}) (была ошибка Prisma
 * "Unknown argument topicId" — исправлено в коммите 80cd45e).
 *
 * POST /api/admin/cleanup-all
 * body: { token: "..." }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isStaffRole } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token: string | undefined = body.token;

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

    // Подсчёт «до» — для информативного отчёта.
    const before = {
      users: await db.user.count(),
      topics: await db.topic.count(),
      topicsPinned: await db.topic.count({ where: { isPinned: true } }),
      messages: await db.message.count(),
      adListings: await db.adListing.count(),
      wtbPosts: await db.whereToBuyPost.count(),
      cheapPosts: await db.cheapPost.count(),
      datingPosts: await db.datingPost.count(),
      empPosts: await db.empPost.count(),
      overheardPosts: await db.overheardPost.count(),
      recPosts: await db.recPost.count(),
      gkhProblems: await db.gkhProblem.count(),
      helpPublications: await db.helpPublication.count(),
    };

    // АТОМАРНАЯ транзакция: если что-то упадёт — откатится всё.
    const result = await db.$transaction(async (tx) => {
      // === 1. УДАЛЕНИЕ ВСЕХ ПУБЛИКАЦИЙ В СПЕЦРАЗДЕЛАХ ===
      // (включая ответы, жалобы, фото, медиа, голоса, подсказки)

      // Obyavleniya (AdListing не имеет topicId — это нормально)
      const adComplaints = await tx.adComplaint.deleteMany({});
      const adMedia = await tx.adMedia.deleteMany({});
      const adListings = await tx.adListing.deleteMany({});

      // WhereToBuy
      const wtbAnswers = await tx.whereToBuyAnswer.deleteMany({});
      const wtbComplaints = await tx.whereToBuyComplaint.deleteMany({});
      const wtbHints = await tx.wheretobuyHint.deleteMany({});
      const wtbPosts = await tx.whereToBuyPost.deleteMany({});

      // CheapPost
      const cheapAnswers = await tx.cheapAnswer.deleteMany({});
      const cheapComplaints = await tx.cheapComplaint.deleteMany({});
      const cheapHints = await tx.cheapHint.deleteMany({});
      const cheapPosts = await tx.cheapPost.deleteMany({});

      // Dating
      const datingPhotos = await tx.datingPhoto.deleteMany({});
      const datingComplaints = await tx.datingComplaint.deleteMany({});
      const datingPosts = await tx.datingPost.deleteMany({});

      // EmpPost
      const empVotes = await tx.empVote.deleteMany({});
      const empComplaints = await tx.empComplaint.deleteMany({});
      const empPosts = await tx.empPost.deleteMany({});

      // Overheard
      const ohComplaints = await tx.overheardComplaint.deleteMany({});
      const ohPosts = await tx.overheardPost.deleteMany({});

      // RecPost
      const recVotes = await tx.recUsefulVote.deleteMany({});
      const recComplaints = await tx.recComplaint.deleteMany({});
      const recPosts = await tx.recPost.deleteMany({});

      // GkhProblem (вложенная иерархия)
      const gkhComplaints = await tx.gkhComplaint.deleteMany({});
      const gkhMedia = await tx.gkhMedia.deleteMany({});
      const gkhStatusLogs = await tx.gkhStatusLog.deleteMany({});
      const gkhUpdates = await tx.gkhUpdate.deleteMany({});
      const gkhProblems = await tx.gkhProblem.deleteMany({});

      // HelpPublication
      const helpComplaints = await tx.helpComplaint.deleteMany({});
      const helpPublications = await tx.helpPublication.deleteMany({});

      // === 2. УДАЛЕНИЕ ВСЕХ ТЕМ ФОРУМА И СООБЩЕНИЙ, КРОМЕ ЗАКРЕПЛЁННЫХ ===

      // Сначала удаляем жалобы на сообщения (Complaint) — они ссылаются на Message
      // через onDelete: Cascade, но явно удалим для подсчёта.
      const complaints = await tx.complaint.deleteMany({
        where: { message: { topic: { isPinned: false } } },
      });
      // History модерации
      const modHistory = await tx.moderationHistory.deleteMany({
        where: { message: { topic: { isPinned: false } } },
      });
      // Очереди ботов
      const botQueues = await tx.botQueue.deleteMany({
        where: { topic: { isPinned: false } },
      });
      // BotReplyQueue не имеет FK на Topic, но ссылаются на postId публикаций,
      // которые уже удалены. Удаляем все pending.
      const botReplyQueues = await tx.botReplyQueue.deleteMany({});

      // Сообщения в незакреплённых темах
      const messages = await tx.message.deleteMany({
        where: { topic: { isPinned: false } },
      });
      // Сами незакреплённые темы
      const topics = await tx.topic.deleteMany({
        where: { isPinned: false },
      });

      return {
        // Публикации в спецразделах
        adListings: adListings.count,
        adMedia: adMedia.count,
        adComplaints: adComplaints.count,
        wtbPosts: wtbPosts.count,
        wtbAnswers: wtbAnswers.count,
        wtbComplaints: wtbComplaints.count,
        wtbHints: wtbHints.count,
        cheapPosts: cheapPosts.count,
        cheapAnswers: cheapAnswers.count,
        cheapComplaints: cheapComplaints.count,
        cheapHints: cheapHints.count,
        datingPosts: datingPosts.count,
        datingPhotos: datingPhotos.count,
        datingComplaints: datingComplaints.count,
        empPosts: empPosts.count,
        empVotes: empVotes.count,
        empComplaints: empComplaints.count,
        overheardPosts: ohPosts.count,
        overheardComplaints: ohComplaints.count,
        recPosts: recPosts.count,
        recVotes: recVotes.count,
        recComplaints: recComplaints.count,
        gkhProblems: gkhProblems.count,
        gkhUpdates: gkhUpdates.count,
        gkhStatusLogs: gkhStatusLogs.count,
        gkhMedia: gkhMedia.count,
        gkhComplaints: gkhComplaints.count,
        helpPublications: helpPublications.count,
        helpComplaints: helpComplaints.count,
        // Форум
        topics: topics.count,
        messages: messages.count,
        complaints: complaints.count,
        modHistory: modHistory.count,
        botQueues: botQueues.count,
        botReplyQueues: botReplyQueues.count,
      };
    });

    // Подсчёт «после» — для контроля
    const after = {
      users: await db.user.count(),
      topics: await db.topic.count(),
      topicsPinned: await db.topic.count({ where: { isPinned: true } }),
      messages: await db.message.count(),
    };

    return NextResponse.json({
      ok: true,
      before,
      after,
      deleted: result,
      note: `Удалено: ${result.topics} незакреплённых тем, ${result.messages} сообщений форума, и все публикации в 9 спецразделах. Сохранено: ${after.users} пользователей (ботов), ${after.topicsPinned} закреплённых тем.`,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

// GET — заглушка для проверки доступности.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "/api/admin/cleanup-all", method: "POST" });
}
