/**
 * ШАГ 19 (ТЗ п.8). Редактирование и удаление СОБСТВЕННОГО обновления.
 *   PATCH { action: "edit" }   — изменить текст своего обновления
 *                                (повторная ИИ-проверка);
 *   PATCH { action: "delete" } — удалить своё обновление. Обновление
 *                                удаляется ПОЛНОСТЬЮ: в истории проблемы
 *                                надпись «Обновление удалено» не показывается
 *                                (ТЗ п.8), техническая история изменений
 *                                сохраняется в базе для системы/модерации.
 * Чужое обновление изменить/удалить нельзя (403).
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { join } from "path";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { moderateNewGkhText } from "@/lib/moderation/gkh";
import { GKH_MAX_PHOTOS } from "@/lib/gkh";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Лучший-effort удаление файла медиа с диска. */
function unlinkMediaFile(url: string): void {
  try {
    const rel = url.replace(/^\/+/, "");
    if (rel.startsWith("media/gkh/")) fs.promises.unlink(join(process.cwd(), "public", rel)).catch(() => {});
  } catch {
    /* не критично */
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
    if (!["edit", "delete"].includes(String(action))) {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }

    const update = await db.gkhUpdate.findUnique({ where: { id } });
    if (!update || update.isDeleted) {
      return NextResponse.json({ error: "Обновление не найдено" }, { status: 404 });
    }

    // Каждый пользователь управляет ТОЛЬКО собственными обновлениями (ТЗ п.8).
    // Модератор может скрыть/удалить нарушение — это делается в админ-API.
    if (update.authorId !== user.id) {
      return NextResponse.json({ error: "Редактировать и удалять можно только свои обновления" }, { status: 403 });
    }

    if (action === "delete") {
      // Полное удаление из интерфейса; техническая история сохраняется (ТЗ п.8).
      const media = await db.gkhMedia.findMany({ where: { updateId: id }, select: { url: true } });
      await db.gkhMedia.deleteMany({ where: { updateId: id } });
      await db.gkhUpdate.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
      for (const m of media) unlinkMediaFile(m.url);
      return NextResponse.json({ ok: true, note: "Обновление удалено" });
    }

    // action === "edit"
    const text = String(body.text ?? "").trim();
    if (text.length < 3 || text.length > 2000) {
      return NextResponse.json({ error: "Текст обновления: от 3 до 2000 символов" }, { status: 400 });
    }
    const photos: string[] = Array.isArray(body.photos) ? body.photos.map(String).slice(0, GKH_MAX_PHOTOS) : [];
    const video: string | null = body.video ? String(body.video) : null;
    const mediaConnect = [...photos.map((pid) => ({ id: pid })), ...(video ? [{ id: video }] : [])];

    if (mediaConnect.length > 0) {
      const mediaRows = await db.gkhMedia.findMany({
        where: { id: { in: mediaConnect.map((m) => m.id) } },
        select: { id: true, problemId: true, updateId: true },
      });
      const byId = new Map(mediaRows.map((m) => [m.id, m]));
      for (const m of mediaConnect) {
        const row = byId.get(m.id);
        if (!row || (row.problemId && row.problemId !== update.problemId) || row.updateId) {
          return NextResponse.json({ error: "Некорректное вложение (фото/видео). Загрузите файл заново." }, { status: 400 });
        }
      }
    }

    const outcome = await moderateNewGkhText("обновление жителя", "", text);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    // Откреплённые при правке медиа — удалить (метаданные и файл).
    const keepIds = new Set(mediaConnect.map((m) => m.id));
    const currentMedia = await db.gkhMedia.findMany({ where: { updateId: id }, select: { id: true, url: true } });
    const dropped = currentMedia.filter((m) => !keepIds.has(m.id));
    if (dropped.length > 0) {
      await db.gkhMedia.deleteMany({ where: { id: { in: dropped.map((m) => m.id) } } });
      for (const m of dropped) unlinkMediaFile(m.url);
    }

    await db.gkhUpdate.update({
      where: { id },
      data: {
        text,
        editedAt: new Date(),
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
        ? `Обновление скрыто ИИ-модерацией после правки: ${outcome.hiddenReason ?? "нарушение правил"}.`
        : outcome.needHuman
          ? "Правка отправлена на дополнительную проверку человеку-модератору."
          : "Обновление изменено";

    return NextResponse.json({ ok: true, hidden: outcome.action === "hide", note });
  } catch (e) {
    return handleApiError(e);
  }
}
