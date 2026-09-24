/**
 * ШАГ 26. Объявление «Знакомства» — детальный просмотр и действия автора.
 * GET    — анонимная детальная карточка: категория, заголовок, текст, дата,
 *          статус, фото. НИКАКИХ данных автора (анонимность раздела).
 *          Автору (mine) дополнительно отдаются флаги скрытия и причина.
 * PATCH  — только автор:
 *          action="status" — переключение «Актуально» ↔ «Неактуально»
 *          (неактуальное не удаляется — остаётся в разделе серым, ниже);
 *          иначе — правка полей (категория/заголовок/текст/фото) с
 *          повторной проверкой лексики и ИИ-модерацией.
 * DELETE — мягкое удаление автором (остаётся в БД для модерации).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { getActiveRestriction } from "@/lib/moderation/sanctions";
import { moderatePublishedDatingText } from "@/lib/moderation/znakomstva";
import {
  DATING_MAX_PHOTOS,
  DATING_TITLE_MIN,
  DATING_TITLE_MAX,
  DATING_BODY_MIN,
  DATING_BODY_MAX,
  isDatingCategory,
  normalizedDatingTitle,
} from "@/lib/znakomstva";

export const runtime = "nodejs";
export const maxDuration = 60;

async function loadPost(id: string) {
  return db.datingPost.findUnique({
    where: { id },
    include: { photos: { select: { id: true, url: true }, orderBy: { createdAt: "asc" } } },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const post = await loadPost(id);
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Объявление не найдено" }, { status: 404 });
    }

    const token = req.nextUrl.searchParams.get("token");
    const viewer = token ? await userByToken(token) : null;
    const isMine = !!viewer && viewer.id === post.authorId;

    // Скрытое ИИ доступно только автору (с объяснением); гостю и другим — нет.
    if (post.isHiddenByAi && !isMine) {
      return NextResponse.json({ error: "Объявление не найдено" }, { status: 404 });
    }

    return NextResponse.json({
      post: {
        id: post.id,
        category: post.category,
        title: post.title,
        body: post.body,
        status: post.status,
        statusAt: post.statusAt,
        editedAt: post.editedAt,
        createdAt: post.createdAt,
        photos: post.photos,
        isMine,
        ...(isMine
          ? { isHiddenByAi: post.isHiddenByAi, hiddenReason: post.hiddenReason, needHuman: post.needHuman }
          : {}),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const user = await userByToken(body?.token);
    if (!user) {
      return NextResponse.json(
        { error: "Действия с объявлением доступны только его автору" },
        { status: 401 }
      );
    }
    const post = await db.datingPost.findUnique({ where: { id } });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Объявление не найдено" }, { status: 404 });
    }
    if (post.authorId !== user.id) {
      return NextResponse.json(
        { error: "Действия с объявлением доступны только его автору" },
        { status: 403 }
      );
    }

    const restriction = await getActiveRestriction(user.id);
    if (restriction) {
      return NextResponse.json(
        { error: "Ваш аккаунт ограничен модерацией. Действия с объявлениями недоступны.", restricted: true, restriction },
        { status: 403 }
      );
    }

    // Переключение статуса «Актуально» ↔ «Неактуально» (только автор).
    if (body.action === "status") {
      const status = String(body.status ?? "").trim();
      if (status !== "actual" && status !== "stale") {
        return NextResponse.json(
          { error: "Статус может быть только «Актуально» или «Неактуально»" },
          { status: 400 }
        );
      }
      const updated = await db.datingPost.update({
        where: { id },
        data: { status, statusAt: new Date() },
      });
      return NextResponse.json({
        ok: true,
        status: updated.status,
        note: status === "stale" ? "Объявление переведено в «Неактуально». Оно останется в разделе ниже актуальных." : "Объявление снова «Актуально».",
      });
    }

    // Правка полей: категория, заголовок, текст, фото.
    const category = body.category !== undefined ? String(body.category).trim() : post.category;
    const title = body.title !== undefined ? String(body.title).trim() : post.title;
    const bodyText = body.body !== undefined || body.text !== undefined
      ? String(body.body ?? body.text ?? "").trim()
      : post.body;
    const photos: string[] | null = Array.isArray(body.photos)
      ? body.photos.map(String).slice(0, DATING_MAX_PHOTOS)
      : null;

    if (!isDatingCategory(category)) {
      return NextResponse.json(
        { error: "Выберите одну из двух категорий: «Мужчина ищет женщину» или «Женщина ищет мужчину»" },
        { status: 400 }
      );
    }
    if (title.length < DATING_TITLE_MIN || title.length > DATING_TITLE_MAX) {
      return NextResponse.json(
        { error: "Заголовок должен быть от 5 до 150 символов — кратко скажите, кого и для чего ищете" },
        { status: 400 }
      );
    }
    if (bodyText.length < DATING_BODY_MIN || bodyText.length > DATING_BODY_MAX) {
      return NextResponse.json(
        { error: "Напишите текст объявления: от 10 до 8000 символов" },
        { status: 400 }
      );
    }
    // Дубль собственного заголовка (кроме самого объявления).
    const norm = normalizedDatingTitle(title);
    if (normalizedDatingTitle(post.title) !== norm) {
      const myPosts = await db.datingPost.findMany({
        where: { authorId: user.id, isDeleted: false, id: { not: id } },
        select: { title: true },
        take: 200,
      });
      if (myPosts.some((p) => normalizedDatingTitle(p.title) === norm)) {
        return NextResponse.json(
          { error: "Вы уже публиковали объявление с таким же заголовком." },
          { status: 400 }
        );
      }
    }

    // Повторная проверка (лексика + ИИ) — правка не обходит модерацию.
    const outcome = await moderatePublishedDatingText(category, title, bodyText);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    const updated = await db.datingPost.update({
      where: { id },
      data: {
        category,
        title,
        body: bodyText,
        aiStatus: outcome.action === "hide" ? "hidden" : outcome.action === "human" ? "human" : "ok",
        aiNote: outcome.aiNote ?? "",
        isHiddenByAi: outcome.action === "hide",
        hiddenReason: outcome.hiddenReason ?? "",
        needHuman: outcome.needHuman,
        editedAt: new Date(),
      },
    });

    // Обновление набора фотографий.
    if (photos) {
      const keep = photos;
      // Открепить фото, которых нет в новом наборе (затем удалить файлы нельзя
      // отсюда — загрузки живут отдельно; просто отвязываем).
      const current = await db.datingPhoto.findMany({
        where: { postId: id },
        select: { id: true },
      });
      const toDetach = current.filter((ph) => !keep.includes(ph.id));
      if (toDetach.length) {
        await db.datingPhoto.updateMany({
          where: { id: { in: toDetach.map((ph) => ph.id) } },
          data: { postId: null },
        });
      }
      // Прикрепить новые из заранее загруженных.
      const orphans = await db.datingPhoto.findMany({
        where: { id: { in: keep }, postId: null },
        select: { id: true },
      });
      if (orphans.length) {
        await db.datingPhoto.updateMany({
          where: { id: { in: orphans.map((o) => o.id) } },
          data: { postId: id },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      hidden: outcome.action === "hide",
      needHuman: outcome.needHuman,
      note:
        outcome.action === "hide"
          ? `Объявление скрыто ИИ-модерацией после правки: ${outcome.hiddenReason ?? "нарушение правил"}.`
          : "Объявление обновлено.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = req.nextUrl.searchParams.get("token") ?? "";
    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json(
        { error: "Действия с объявлением доступны только его автору" },
        { status: 401 }
      );
    }
    const post = await db.datingPost.findUnique({ where: { id } });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Объявление не найдено" }, { status: 404 });
    }
    if (post.authorId !== user.id) {
      return NextResponse.json(
        { error: "Действия с объявлением доступны только его автору" },
        { status: 403 }
      );
    }
    await db.datingPost.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), needHuman: false },
    });
    return NextResponse.json({ ok: true, note: "Объявление удалено." });
  } catch (e) {
    return handleApiError(e);
  }
}
