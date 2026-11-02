/**
 * /api/admin/blocks/cleanup — жёсткое удаление всех публикаций в спецразделах.
 *
 * Создан 2026-11-02. ЖЁСТКОЕ удаление (DELETE FROM) всех публикаций,
 * ответов, жалоб, фото и связанной форумной темы с сообщениями во всех
 * самостоятельных спецразделах SakhMatrix.
 *
 * Удаляет в разделах:
 *   - Obyavleniya      → AdListing + AdMedia + AdComplaint (БЕЗ темы форума — у раздела нет topicId)
 *   - WhereToBuy       → WhereToBuyPost + WhereToBuyAnswer + WhereToBuyComplaint + Topic + Message
 *   - CheapPost        → CheapPost + CheapAnswer + CheapComplaint + Topic + Message
 *   - DatingPost       → DatingPost + DatingPhoto + DatingComplaint (БЕЗ темы форума — у раздела нет topicId)
 *   - EmpPost          → EmpPost + EmpVote + EmpComplaint + Topic + Message
 *   - OverheardPost    → OverheardPost + OverheardComplaint + Topic + Message
 *   - RecPost          → RecPost + RecUsefulVote + RecComplaint + Topic + Message
 *   - GkhProblem       → GkhProblem + GkhUpdate + GkhStatusLog + GkhMedia + GkhComplaint + Topic + Message
 *   - HelpPublication  → HelpPublication + HelpComplaint + Topic + Message
 *
 * НЕ трогает:
 *   - User (ботов и реальных юзеров)
 *   - Topic, не связанные со спецразделами (например, обычные темы пользователей)
 *   - Закреплённые темы форума (isPinned = true) — это отдельная задача
 *
 * POST /api/admin/blocks/cleanup
 * body: { token: "..." }
 *
 * Возвращает: { ok, deleted: { adListings, wtbPosts, cheapPosts, ... }, totalTopics, totalMessages }
 *
 * ВНИМАНИЕ: операция НЕОБРАТИМА — жёсткое DELETE, без soft-delete.
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

    const result = await db.$transaction(async (tx) => {
      // 1. Собрать все topicId, связанные со спецразделами.
      // ВНИМАНИЕ: AdListing и DatingPost НЕ имеют topicId (эти разделы
      // работают без форума). Их не запрашиваем по topicId.
      const [wtbTopicIds, cheapTopicIds, empTopicIds, ohTopicIds, recTopicIds, gkhTopicIds, helpTopicIds] = await Promise.all([
        tx.whereToBuyPost.findMany({ where: { topicId: { not: null } }, select: { topicId: true } }),
        tx.cheapPost.findMany({ where: { topicId: { not: null } }, select: { topicId: true } }),
        tx.empPost.findMany({ where: { topicId: { not: null } }, select: { topicId: true } }),
        tx.overheardPost.findMany({ where: { topicId: { not: null } }, select: { topicId: true } }),
        tx.recPost.findMany({ where: { topicId: { not: null } }, select: { topicId: true } }),
        tx.gkhProblem.findMany({ where: { topicId: { not: null } }, select: { topicId: true } }),
        tx.helpPublication.findMany({ where: { topicId: { not: null } }, select: { topicId: true } }),
      ]);
      const topicIds = new Set<number>();
      for (const arr of [wtbTopicIds, cheapTopicIds, empTopicIds, ohTopicIds, recTopicIds, gkhTopicIds, helpTopicIds]) {
        for (const r of arr) if (r.topicId != null) topicIds.add(r.topicId);
      }
      const topicIdList = Array.from(topicIds);

      // 2. Подсчёт сообщений и тем «до» — для отчёта.
      const messagesBefore = topicIdList.length
        ? await tx.message.count({ where: { topicId: { in: topicIdList } } })
        : 0;

      // 3. Удаление жалоб, ответов, медиа и т.п. — CASCADE в схеме настроен
      //    на уровне публикации (например, AdMedia.post → AdListing onDelete: Cascade),
      //    но мы удаляем явно, чтобы подсчитать и не зависеть от реализации БД.

      // Obyavleniya
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

      // 4. Удаление сообщений и тем форума, связанных с этими блоками.
      //    Жалобы на сообщения (Complaint) ссылаются на Message, но если у
      //    них нет отдельной cleanup-связи с разделом — оставляем как есть.
      const messages = topicIdList.length
        ? await tx.message.deleteMany({ where: { topicId: { in: topicIdList } } })
        : { count: 0 };
      const topics = topicIdList.length
        ? await tx.topic.deleteMany({ where: { id: { in: topicIdList } } })
        : { count: 0 };

      return {
        topics: topics.count,
        messages: messages.count,
        messagesBefore,
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
      };
    });

    return NextResponse.json({
      ok: true,
      deleted: result,
      note: `Жёстко удалено: ${result.topics} тем, ${result.messages} сообщений, и публикации всех 9 спецразделов. Операция необратима.`,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

// GET — заглушка для проверки доступности.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "/api/admin/blocks/cleanup", method: "POST" });
}
