/**
 * ШАГ 19. Модерация раздела «ЖКХ и городские проблемы»
 * (только сотрудники: owner/admin/moderator — общая система модерации сайта,
 * Пользователь → AI → человек-модератор при спорной ситуации, ТЗ п.18).
 *
 * GET  — нерешённые жалобы (на публикации и обновления) + скрытые ИИ /
 *        спорные публикации и обновления.
 * POST — действия человека-модератора:
 *  — resolve-complaint  — жалоба рассмотрена (закрыть);
 *  — hide-problem / restore-problem — скрыть или вернуть публикацию
 *    (решение ИИ отменяется человеком — «Не нравится ≠ нарушение», ТЗ п.18);
 *  — delete-problem — удалить публикацию;
 *  — hide-update / restore-update / delete-update — модерация обновлений;
 *  — set-status — модератор может проверить ситуацию и при необходимости
 *    изменить статус проблемы (ТЗ п.3), с журналом статусов и жизненным
 *    циклом форумной темы (Решено → тема закрыта, возврат → открыта);
 *  — set-organization — добавить ответственную организацию (ТЗ п.10);
 *  — set-org-rep — подтвердить/снять статус представителя организации
 *    пользователя (ТЗ п.11: простого заявления «я директор» недостаточно).
 * Все действия пишутся в журнал действий (AdminLog).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";
import { requireStaff, logAdminAction } from "@/lib/admin";
import { isGkhStatus, GKH_STATUS_LABELS } from "@/lib/gkh";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const staff = await requireStaff(sp.get("token"));

    const show = sp.get("show") === "all" ? "all" : "open";
    const unresolved = show === "open";

    const complaints = await db.gkhComplaint.findMany({
      where: unresolved ? { resolved: false } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        problem: { select: { id: true, title: true, isHiddenByAi: true, authorName: true } },
        update: { select: { id: true, text: true, isHiddenByAi: true, authorName: true } },
      },
    });

    const [problemQueue, updateQueue] = await Promise.all([
      db.gkhProblem.findMany({
        where: { isDeleted: false, OR: [{ isHiddenByAi: true }, { needHuman: true }] },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      db.gkhUpdate.findMany({
        where: { isDeleted: false, OR: [{ isHiddenByAi: true }, { needHuman: true }] },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { problem: { select: { id: true, title: true } } },
      }),
    ]);

    const openComplaints = await db.gkhComplaint.count({ where: { resolved: false } });

    return NextResponse.json({
      complaints: complaints.map((c) => ({
        id: c.id,
        category: c.category,
        comment: c.comment,
        reporterName: c.reporterName,
        aiVerdict: c.aiVerdict,
        aiNote: c.aiNote,
        resolved: c.resolved,
        createdAt: c.createdAt,
        problem: c.problem ? { id: c.problem.id, title: c.problem.title, isHiddenByAi: c.problem.isHiddenByAi, authorName: c.problem.authorName } : null,
        update: c.update ? { id: c.update.id, text: c.update.text.slice(0, 200), isHiddenByAi: c.update.isHiddenByAi, authorName: c.update.authorName } : null,
      })),
      problems: problemQueue.map((p) => ({
        id: p.id,
        title: p.title,
        authorName: p.authorName,
        isHiddenByAi: p.isHiddenByAi,
        hiddenReason: p.hiddenReason,
        needHuman: p.needHuman,
        aiNote: p.aiNote,
        status: p.status,
        createdAt: p.createdAt,
      })),
      updates: updateQueue.map((u) => ({
        id: u.id,
        text: u.text.slice(0, 200),
        authorName: u.authorName,
        isHiddenByAi: u.isHiddenByAi,
        hiddenReason: u.hiddenReason,
        needHuman: u.needHuman,
        aiNote: u.aiNote,
        problem: { id: u.problem.id, title: u.problem.title },
        createdAt: u.createdAt,
      })),
      openComplaints,
      staff: staff.nickname,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const staff = await requireStaff(body.token);
    const action = String(body.action ?? "");

    switch (action) {
      case "resolve-complaint": {
        const complaintId = String(body.complaintId ?? "");
        const c = await db.gkhComplaint.findUnique({ where: { id: complaintId } });
        if (!c) return NextResponse.json({ error: "Жалоба не найдена" }, { status: 404 });
        await db.gkhComplaint.update({ where: { id: complaintId }, data: { resolved: true } });
        await logAdminAction({
          actor: staff.nickname,
          actorRole: staff.role,
          action: "gkh.resolve_complaint",
          targetType: "complaint",
          targetLabel: c.category,
        });
        return NextResponse.json({ ok: true, note: "Жалоба закрыта" });
      }

      case "hide-problem":
      case "restore-problem": {
        const pid = String(body.problemId ?? "");
        const p = await db.gkhProblem.findUnique({ where: { id: pid } });
        if (!p) return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
        const hide = action === "hide-problem";
        await db.gkhProblem.update({
          where: { id: pid },
          data: {
            isHiddenByAi: hide,
            hiddenReason: hide ? String(body.reason ?? "нарушение правил раздела (решение модератора)") : "",
            aiStatus: hide ? "hidden" : "ok",
            needHuman: false,
          },
        });
        await logAdminAction({
          actor: staff.nickname,
          actorRole: staff.role,
          action: hide ? "gkh.hide_problem" : "gkh.restore_problem",
          targetType: "gkh_problem",
          targetLabel: `«${p.title}»`,
          details: hide ? String(body.reason ?? "") : "решение ИИ отменено человеком",
        });
        return NextResponse.json({ ok: true, note: hide ? "Публикация скрыта" : "Публикация возвращена в ленту" });
      }

      case "delete-problem": {
        const pid = String(body.problemId ?? "");
        const p = await db.gkhProblem.findUnique({ where: { id: pid } });
        if (!p) return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
        // ТЗ п.16: связанная форумная тема не удаляется.
        await db.gkhProblem.update({ where: { id: pid }, data: { isDeleted: true, deletedAt: new Date() } });
        await logAdminAction({
          actor: staff.nickname,
          actorRole: staff.role,
          action: "gkh.delete_problem",
          targetType: "gkh_problem",
          targetLabel: `«${p.title}»`,
        });
        return NextResponse.json({ ok: true, note: "Публикация удалена" });
      }

      case "hide-update":
      case "restore-update": {
        const uid = String(body.updateId ?? "");
        const u = await db.gkhUpdate.findUnique({ where: { id: uid } });
        if (!u) return NextResponse.json({ error: "Обновление не найдено" }, { status: 404 });
        const hide = action === "hide-update";
        await db.gkhUpdate.update({
          where: { id: uid },
          data: {
            isHiddenByAi: hide,
            hiddenReason: hide ? String(body.reason ?? "нарушение правил раздела (решение модератора)") : "",
            aiStatus: hide ? "hidden" : "ok",
            needHuman: false,
          },
        });
        await logAdminAction({
          actor: staff.nickname,
          actorRole: staff.role,
          action: hide ? "gkh.hide_update" : "gkh.restore_update",
          targetType: "gkh_update",
          targetLabel: u.text.slice(0, 80),
        });
        return NextResponse.json({ ok: true, note: hide ? "Обновление скрыто" : "Обновление возвращено" });
      }

      case "delete-update": {
        const uid = String(body.updateId ?? "");
        const u = await db.gkhUpdate.findUnique({ where: { id: uid } });
        if (!u) return NextResponse.json({ error: "Обновление не найдено" }, { status: 404 });
        await db.gkhUpdate.update({ where: { id: uid }, data: { isDeleted: true, deletedAt: new Date() } });
        await logAdminAction({
          actor: staff.nickname,
          actorRole: staff.role,
          action: "gkh.delete_update",
          targetType: "gkh_update",
          targetLabel: u.text.slice(0, 80),
        });
        return NextResponse.json({ ok: true, note: "Обновление удалено" });
      }

      case "set-status": {
        const pid = String(body.problemId ?? "");
        const status = String(body.status ?? "");
        if (!isGkhStatus(status)) return NextResponse.json({ error: "Неизвестный статус" }, { status: 400 });
        const p = await db.gkhProblem.findUnique({ where: { id: pid } });
        if (!p || p.isDeleted) return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
        if (p.status === status) return NextResponse.json({ ok: true, note: "Статус уже установлен" });
        // Журнал статусов (ТЗ п.6) + жизненный цикл темы (ТЗ п.15).
        await db.gkhStatusLog.create({
          data: { problemId: pid, fromStatus: p.status, toStatus: status, byName: staff.nickname, byRole: "moderator" },
        });
        await db.gkhProblem.update({ where: { id: pid }, data: { status, statusAt: new Date() } });
        let topicNote = "";
        if (p.topicId) {
          if (status === "solved") {
            await db.topic.update({ where: { id: p.topicId }, data: { isClosed: true } });
            topicNote = " Тема форума закрыта.";
          } else if (p.status === "solved") {
            await db.topic.update({ where: { id: p.topicId }, data: { isClosed: false } });
            topicNote = " Тема форума снова открыта.";
          }
        }
        await logAdminAction({
          actor: staff.nickname,
          actorRole: staff.role,
          action: "gkh.set_status",
          targetType: "gkh_problem",
          targetLabel: `«${p.title}» → ${GKH_STATUS_LABELS[status]}`,
        });
        return NextResponse.json({ ok: true, note: `Статус: ${GKH_STATUS_LABELS[status]}.${topicNote}` });
      }

      case "set-organization": {
        const pid = String(body.problemId ?? "");
        const organization = String(body.organization ?? "").trim().slice(0, 120);
        const p = await db.gkhProblem.findUnique({ where: { id: pid } });
        if (!p) return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
        await db.gkhProblem.update({ where: { id: pid }, data: { organization } });
        await logAdminAction({
          actor: staff.nickname,
          actorRole: staff.role,
          action: "gkh.set_organization",
          targetType: "gkh_problem",
          targetLabel: `«${p.title}» → ${organization || "—"}`,
        });
        return NextResponse.json({ ok: true, note: organization ? `Организация указана: ${organization}` : "Организация убрана" });
      }

      case "set-org-rep": {
        // ТЗ п.11: статус представителя подтверждается отдельно админом.
        const nickname = String(body.nickname ?? "").trim();
        const orgName = String(body.orgName ?? "").trim().slice(0, 120);
        const orgRep = !!body.orgRep;
        const target = await db.user.findFirst({ where: { nickname } });
        if (!target) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
        await db.user.update({
          where: { id: target.id },
          data: { orgRep, orgName: orgRep ? orgName : "" },
        });
        await logAdminAction({
          actor: staff.nickname,
          actorRole: staff.role,
          action: orgRep ? "gkh.set_org_rep" : "gkh.unset_org_rep",
          targetType: "user",
          targetLabel: `${nickname}${orgRep && orgName ? ` (${orgName})` : ""}`,
        });
        return NextResponse.json({
          ok: true,
          note: orgRep ? `${nickname} — представитель организации${orgName ? ` «${orgName}»` : ""}` : `Статус представителя снят с ${nickname}`,
        });
      }

      default:
        return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }
  } catch (e) {
    return handleApiError(e);
  }
}
