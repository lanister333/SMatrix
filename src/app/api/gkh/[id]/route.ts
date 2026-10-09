/**
 * ШАГ 19. Детальная страница проблемы «ЖКХ и городские проблемы» и действия.
 *
 * GET   — полная проблема: текст, место, дата обнаружения, медиа (ТЗ п.27),
 *         хронология (ТЗ п.6): публикация → обновления жителей → смены
 *         статуса → ответ представителя организации; состояние форумной
 *         темы; права текущего пользователя.
 * PATCH — действия:
 *   edit          — правка автором (ТЗ п.7): заголовок/текст/место/дата +
 *                   фото/видео; повторная ИИ-проверка; техническая история
 *                   правки сохраняется, надпись «Изменено» не показывается
 *                   (ТЗ п.6);
 *   status        — смена статуса (ТЗ п.3 — только три статуса). Автор
 *                   устанавливает «Решено»; модератор может проверить и
 *                   изменить статус. Ответ организации сам по себе НЕ
 *                   переводит проблему в «Решено» (ТЗ п.3). Каждый переход
 *                   попадает в журнал статусов (история, ТЗ п.6). При
 *                   «Решено» связанная тема форума ЗАКРЫВАЕТСЯ, при
 *                   повторном возникновении (возврат из «Решено») — ТА ЖЕ
 *                   тема открывается повторно, новая не создаётся (ТЗ п.15);
 *   delete        — мягкое удаление автором (ТЗ п.16): публикация исчезает
 *                   из списков, но связанная тема форума НЕ удаляется — в
 *                   теме показывается «Исходная публикация была удалена
 *                   автором.»;
 *   organization  — добавить/изменить ответственную организацию (ТЗ п.10)
 *                   может только администратор/модератор.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { join } from "path";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isStaffRole } from "@/lib/admin";
import { moderateNewGkhText } from "@/lib/moderation/gkh";
import { GKH_MAX_PHOTOS, isGkhStatus, GKH_STATUS_LABELS } from "@/lib/gkh";
import { safeAuthorGender } from "@/lib/nick-gender";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Лучший-effort удаление файла медиа с диска. */
function unlinkMediaFile(url: string): void {
  try {
    const rel = url.replace(/^\/+/, "");
    if (rel.startsWith("media/gkh/")) fs.promises.unlink(join(process.cwd(), "public", rel)).catch(() => {});
  } catch {
    /* файл мог быть уже удалён — не критично */
  }
}

function topicState(t: { isClosed: boolean; isArchived: boolean; deletedAt: Date | null } | null): string {
  if (!t || t.deletedAt) return "archived";
  if (t.isArchived) return "archived";
  if (t.isClosed) return "closed";
  return "open";
}

/** Форма события хронологии (ТЗ п.6). */
type HistoryEvent =
  | { kind: "problem"; at: Date; authorName: string }
  | { kind: "status"; at: Date; fromStatus: string; toStatus: string; byName: string; byRole: string }
  | { kind: "update"; at: Date; update: Record<string, unknown> }
  | { kind: "org"; at: Date };

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const token = req.nextUrl.searchParams.get("token");
    const viewer = await userByToken(token);

    const problem = await db.gkhProblem.findUnique({
      where: { id },
      include: {
        author: { select: { nickname: true, gender: true } },
        media: { where: { updateId: null }, orderBy: { createdAt: "asc" } },
        statusLog: { orderBy: { createdAt: "asc" } },
        updates: {
          where: { isDeleted: false },
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { nickname: true, gender: true } },
            media: { orderBy: { createdAt: "asc" } },
          },
        },
      },
    });

    if (!problem) {
      return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
    }

    // Удалённая автором публикация (ТЗ п.16): форумная тема сохраняется,
    // здесь показываем уведомление; содержимое недоступно.
    if (problem.isDeleted) {
      return NextResponse.json({
        deleted: true,
        note: "Исходная публикация была удалена автором.",
        topicId: problem.topicId,
      });
    }

    const isAuthor = !!viewer && viewer.id === problem.authorId;
    const isStaff = !!viewer && isStaffRole(viewer.role);

    // Скрытая ИИ публикация не показывается никому, кроме автора и
    // сотрудников, пока модерация не решит её судьбу (ТЗ п.18).
    if (problem.isHiddenByAi && !isAuthor && !isStaff) {
      return NextResponse.json({ hidden: true, note: "Публикация скрыта модерацией и ожидает решения." });
    }

    // Скрытые ИИ обновления видит только их автор (с пояснением).
    const visibleUpdates = problem.updates.filter((u) => !u.isHiddenByAi || (viewer && u.authorId === viewer.id));

    const history: HistoryEvent[] = [
      { kind: "problem" as const, at: problem.createdAt, authorName: problem.authorName },
      ...problem.statusLog.map((s): HistoryEvent => ({
        kind: "status" as const,
        at: s.createdAt,
        fromStatus: s.fromStatus,
        toStatus: s.toStatus,
        byName: s.byName,
        byRole: s.byRole,
      })),
      ...visibleUpdates.map((u) => ({
        kind: "update" as const,
        at: u.createdAt,
        update: {
          id: u.id,
          text: u.text,
          authorId: u.authorId,
          authorName: u.authorName,
          authorGender: safeAuthorGender(u.authorName, u.author as { nickname: string; gender: string | null } | null),
          createdAt: u.createdAt,
          editedAt: u.editedAt,
          isHiddenByAi: u.isHiddenByAi,
          hiddenReason: u.hiddenReason,
          needHuman: u.needHuman,
          photos: u.media.filter((m) => m.kind === "photo").map((m) => ({ id: m.id, url: m.url })),
          video: u.media.find((m) => m.kind === "video")?.url ?? null,
        },
      })),
      ...(problem.orgResponseAt
        ? [{ kind: "org" as const, at: problem.orgResponseAt }]
        : []),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    let topicT: { isClosed: boolean; isArchived: boolean; deletedAt: Date | null } | null = null;
    if (problem.topicId) {
      const t = await db.topic.findUnique({
        where: { id: problem.topicId },
        select: { id: true, isClosed: true, isArchived: true, deletedAt: true },
      });
      topicT = t;
    }

    return NextResponse.json({
      problem: {
        id: problem.id,
        title: problem.title,
        text: problem.text,
        place: problem.place,
        problemDate: problem.problemDate,
        status: problem.status,
        statusAt: problem.statusAt,
        authorId: problem.authorId,
        authorName: problem.authorName,
        authorGender: safeAuthorGender(problem.authorName, problem.author as { nickname: string; gender: string | null } | null),
        organization: problem.organization,
        orgResponseText: problem.orgResponseText,
        orgResponseAt: problem.orgResponseAt,
        orgResponseByName: problem.orgResponseByName,
        createdAt: problem.createdAt,
        editedAt: problem.editedAt, // техническое поле — UI не показывает «Изменено»
        photos: problem.media.filter((m) => m.kind === "photo").map((m) => ({ id: m.id, url: m.url })),
        video: (() => {
          const v = problem.media.find((m) => m.kind === "video");
          return v ? { id: v.id, url: v.url } : null;
        })(),
        topicId: problem.topicId,
        topicState: problem.topicId ? topicState(topicT) : "none",
        isHiddenByAi: problem.isHiddenByAi,
        hiddenReason: problem.hiddenReason,
        needHuman: problem.needHuman,
      },
      history,
      viewer: {
        isAuthor,
        isStaff,
        canRespond: !!viewer && !!viewer.orgRep && !problem.orgResponseAt,
        orgName: viewer?.orgRep ? viewer.orgName : "",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { token, action } = body;

    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json({ error: "Доступно только зарегистрированным пользователям" }, { status: 401 });
    }
    if (!["edit", "status", "delete", "organization"].includes(String(action))) {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }

    const problem = await db.gkhProblem.findUnique({ where: { id } });
    if (!problem || problem.isDeleted) {
      return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
    }

    const isAuthor = problem.authorId === user.id;
    const isStaff = isStaffRole(user.role);

    // Правка и удаление — только автор (ТЗ п.7/16).
    if ((action === "edit" || action === "delete") && !isAuthor) {
      return NextResponse.json({ error: "Изменить публикацию может только её автор" }, { status: 403 });
    }

    if (action === "delete") {
      // ТЗ п.16: связанная форумная тема НЕ удаляется — целостность обсуждения.
      await db.gkhProblem.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() },
      });
      return NextResponse.json({
        ok: true,
        note: problem.topicId
          ? "Публикация удалена. Связанная тема форума сохранена — в ней будет видно, что исходная публикация удалена автором."
          : "Публикация удалена",
      });
    }

    if (action === "status") {
      // Статус меняет автор или модератор (ТЗ п.3: автор устанавливает
      // «Решено», модератор может проверить и изменить).
      if (!isAuthor && !isStaff) {
        return NextResponse.json({ error: "Статус может изменить только автор публикации или модератор" }, { status: 403 });
      }
      const status = String(body.status ?? "");
      if (!isGkhStatus(status)) {
        return NextResponse.json({ error: "Неизвестный статус" }, { status: 400 });
      }
      if (status === problem.status) {
        return NextResponse.json({ ok: true, status, note: `Статус уже: ${GKH_STATUS_LABELS[status]}` });
      }

      // Журнал статусов — часть истории проблемы (ТЗ п.6).
      await db.gkhStatusLog.create({
        data: {
          problemId: id,
          fromStatus: problem.status,
          toStatus: status,
          byName: user.nickname,
          byRole: isAuthor ? "author" : "moderator",
        },
      });
      await db.gkhProblem.update({ where: { id }, data: { status, statusAt: new Date() } });

      // Жизненный цикл форумной темы (ТЗ п.15): «Решено» → тема закрывается;
      // повторное возникновение (возврат из «Решено») → ТА ЖЕ тема открывается.
      let topicNote = "";
      if (problem.topicId) {
        if (status === "solved") {
          await db.topic.update({ where: { id: problem.topicId }, data: { isClosed: true } });
          topicNote = " Связанная тема форума закрыта.";
        } else if (problem.status === "solved") {
          await db.topic.update({ where: { id: problem.topicId }, data: { isClosed: false } });
          topicNote = " Связанная тема форума снова открыта.";
        }
      }

      const notes: Record<string, string> = {
        active: "Статус: «Проблема актуальна». Проблема возвращена в список активных.",
        in_progress: "Статус: «Решается».",
        solved: "Статус: «Решено». Публикация скрыта из списка активных проблем; история сохранена.",
      };
      return NextResponse.json({ ok: true, status, note: (notes[status] ?? "Статус обновлён") + topicNote });
    }

    if (action === "organization") {
      // Ответственная организация добавляется администратором/модератором (ТЗ п.10).
      if (!isStaff) {
        return NextResponse.json({ error: "Организацию может добавить только модератор" }, { status: 403 });
      }
      const organization = String(body.organization ?? "").trim().slice(0, 120);
      await db.gkhProblem.update({ where: { id }, data: { organization } });
      return NextResponse.json({
        ok: true,
        note: organization ? `Организация указана: ${organization}` : "Организация убрана",
      });
    }

    // action === "edit" — правка автором (ТЗ п.7), с повторной ИИ-проверкой.
    const title = String(body.title ?? "").trim();
    const text = String(body.text ?? body.body ?? "").trim();
    const place = String(body.place ?? "").trim().slice(0, 120);
    const problemDate = String(body.problemDate ?? "").trim().slice(0, 10);
    const photos: string[] = Array.isArray(body.photos) ? body.photos.map(String).slice(0, GKH_MAX_PHOTOS) : [];
    const video: string | null = body.video ? String(body.video) : null;

    if (title.length < 5 || title.length > 150) {
      return NextResponse.json({ error: "Заголовок должен быть от 5 до 150 символов" }, { status: 400 });
    }
    if (text.length < 10 || text.length > 8000) {
      return NextResponse.json({ error: "Текст проблемы: от 10 до 8000 символов" }, { status: 400 });
    }
    if (problemDate && !/^\d{4}-\d{2}-\d{2}$/.test(problemDate)) {
      return NextResponse.json({ error: "Некорректная дата обнаружения" }, { status: 400 });
    }

    const outcome = await moderateNewGkhText("публикацию о проблеме", title, text, place);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    // Медиа: полный список после правки (старые + добавленные, с учётом удалений).
    const mediaConnect = [
      ...photos.map((pid) => ({ id: pid })),
      ...(video ? [{ id: video }] : []),
    ];

    // Откреплённые при правке медиа: удаляем метаданные и файл (ТЗ п.27 —
    // автор управляет фото/видео своей публикации).
    const keepIds = new Set(mediaConnect.map((m) => m.id));
    const currentMedia = await db.gkhMedia.findMany({ where: { problemId: id, updateId: null }, select: { id: true, url: true } });
    const dropped = currentMedia.filter((m) => !keepIds.has(m.id));
    if (dropped.length > 0) {
      await db.gkhMedia.deleteMany({ where: { id: { in: dropped.map((m) => m.id) } } });
      for (const m of dropped) unlinkMediaFile(m.url);
    }

    await db.gkhProblem.update({
      where: { id },
      data: {
        title,
        text,
        place,
        problemDate,
        editedAt: new Date(), // техническая история для модерации (ТЗ п.6)
        aiStatus: outcome.action === "hide" ? "hidden" : outcome.action === "human" ? "human" : "ok",
        aiNote: outcome.aiNote ?? "",
        isHiddenByAi: outcome.action === "hide",
        hiddenReason: outcome.hiddenReason ?? "",
        needHuman: outcome.needHuman,
        ...(mediaConnect.length ? { media: { connect: mediaConnect } } : {}),
      },
    });

    const note =
      outcome.action === "hide"
        ? `Публикация скрыта модерацией после правки: ${outcome.hiddenReason ?? "нарушение правил"}.`
        : outcome.needHuman
          ? "Правка отправлена на дополнительную проверку человеку-модератору."
          : "Публикация обновлена";

    return NextResponse.json({ ok: true, hidden: outcome.action === "hide", note });
  } catch (e) {
    return handleApiError(e);
  }
}
