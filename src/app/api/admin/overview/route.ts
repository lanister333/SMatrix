import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isStaffRole } from "@/lib/admin";

export const runtime = "nodejs";

const HOUR = 60 * 60 * 1000;

/**
 * ШАГ 12. Главная админ-панели — без раздутой аналитики.
 * Показывает:
 *  — дела, требующие внимания (спорные случаи ИИ, нерешённые жалобы, апелляции);
 *  — спорные AI-решения (скрытые ИИ сообщения и автоматические санкции ИИ);
 *  — последние действия модерации (из внутреннего журнала);
 *  — базовое состояние сайта (счётчики).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await userByToken(req.nextUrl.searchParams.get("token"));
    if (!user) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    if (!isStaffRole(user.role)) {
      return NextResponse.json({ error: "Доступно только администратору" }, { status: 403 });
    }

    const dayAgo = new Date(Date.now() - 24 * HOUR);

    const [
      users,
      topics,
      messages,
      topicsToday,
      messagesToday,
      needHuman,
      openComplaints,
      openAppeals,
      hiddenByAi,
      activeSanctions,
      aiSanctions,
      restrictedUsers,
    ] = await Promise.all([
      db.user.count(),
      db.topic.count({ where: { deletedAt: null } }),
      db.message.count({ where: { isDeleted: false } }),
      db.topic.count({ where: { createdAt: { gte: dayAgo } } }),
      db.message.count({ where: { createdAt: { gte: dayAgo }, isDeleted: false } }),
      db.message.count({ where: { needHuman: true } }),
      db.complaint.count({ where: { resolved: false } }),
      db.decisionAppeal.count({ where: { status: "open" } }),
      db.message.count({ where: { isHiddenByAi: true } }),
      db.sanction.count({ where: { revoked: false } }),
      db.sanction.count({ where: { revoked: false, source: "ai" } }),
      db.user.count({ where: { restrictedUntil: { gt: new Date() } } }),
    ]);

    // Дела, требующие внимания: спорные случаи ИИ + нерешённые жалобы
    const attentionMessages = await db.message.findMany({
      where: {
        OR: [{ needHuman: true }, { complaints: { some: { resolved: false } } }],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        topic: { select: { id: true, title: true } },
        complaints: { where: { resolved: false }, select: { id: true, category: true, comment: true, aiVerdict: true } },
      },
    });

    // Спорные AI-решения: открытые апелляции + авто-санкции ИИ
    const openAppealList = await db.decisionAppeal.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { sanction: { select: { kind: true, reason: true, source: true } } },
    });
    const aiSanctionList = await db.sanction.findMany({
      where: { revoked: false, source: "ai" },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { nickname: true } } },
    });

    // Последние действия модерации из внутреннего журнала
    const recentActions = await db.adminLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    return NextResponse.json({
      attention: {
        needHuman,
        openComplaints,
        openAppeals,
        items: attentionMessages.map((m) => ({
          id: m.id,
          author: m.authorName,
          topic: { id: m.topic.id, title: m.topic.title },
          body: m.body.slice(0, 300),
          isHiddenByAi: m.isHiddenByAi,
          hiddenReason: m.hiddenReason,
          needHuman: m.needHuman,
          complaints: m.complaints.map((c) => ({ id: c.id, category: c.category, comment: c.comment, aiVerdict: c.aiVerdict })),
          createdAt: m.createdAt,
        })),
      },
      disputed: {
        appeals: openAppealList.map((a) => ({
          id: a.id,
          userNick: a.userNick,
          text: a.text.slice(0, 300),
          sanction: a.sanction ? { kind: a.sanction.kind, reason: a.sanction.reason } : null,
          createdAt: a.createdAt,
        })),
        aiSanctions: aiSanctionList.map((s) => ({
          id: s.id,
          user: s.user.nickname,
          kind: s.kind,
          reason: s.reason,
          createdAt: s.createdAt,
        })),
        hiddenByAi,
      },
      recentActions: recentActions.map((l) => ({
        id: l.id,
        actor: l.actor,
        actorRole: l.actorRole,
        action: l.action,
        targetLabel: l.targetLabel,
        details: l.details,
        createdAt: l.createdAt,
      })),
      site: {
        users,
        topics,
        messages,
        topicsToday,
        messagesToday,
        hiddenByAi,
        activeSanctions,
        aiSanctions,
        restrictedUsers,
        needHuman,
        openComplaints,
        openAppeals,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
