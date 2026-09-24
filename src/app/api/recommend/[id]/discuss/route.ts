/**
 * ШАГ 20. «Обсудить на форуме» для публикации «Рекомендую / Не рекомендую».
 *
 * ГАРАНТИЯ ИДЕМПОТЕНТНОСТИ (критически важно): одна публикация = МАКСИМУМ
 * ОДНА связанная тема форума. Повторное нажатие, обновление страницы,
 * двойной клик и одновременные нажатия нескольких пользователей не создают
 * вторую тему:
 *  — RecPost.topicId уникален на уровне схемы БД;
 *  — создание темы внутри одной транзакции (гонка с уникальным индексом
 *    откатывает транзакцию целиком);
 *  — после отката из-за гонки состояние перечитывается.
 *
 * Состояния кнопки: none «Обсудить на форуме» → open «Обсуждается на форуме»
 * → closed «Тема закрыта» / archived «Тема в архиве».
 *
 * Тема создаётся в разделе: Форум → «Обсуждение сообщений из блоков» →
 * «Рекомендую / Не рекомендую». Первое сообщение содержит исходную публикацию
 * и ссылку «Источник: Рекомендую / Не рекомендую» обратно.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import { restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction } from "@/lib/moderation/sanctions";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Родительская рубрика для обсуждений из самостоятельных блоков. */
export const BLOCKS_RUBRIC_NAME = "Обсуждение сообщений из блоков";
export const BLOCKS_RUBRIC_SLUG = "blocks-discuss";
/** Дочерняя рубрика раздела «Рекомендую / Не рекомендую». */
export const RC_RUBRIC_NAME = "Рекомендую / Не рекомендую";
export const RC_RUBRIC_SLUG = "recommend-discuss";

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
}

/** Ошибки блокировки/таймаутов SQLite и Prisma при параллельной записи — повторяемы. */
function isRetryableDbError(e: unknown): boolean {
  const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
  if (["P2024", "P2028", "P2034", "P1017"].includes(code)) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /database is locked|database table is locked|Socket timeout|failed to respond|Timed out fetching a new connection|Timed out during query|SQLITE_BUSY|Transaction API error/i.test(msg);
}

function topicState(t: { isClosed: boolean; isArchived: boolean; deletedAt: Date | null } | null): string {
  if (!t || t.deletedAt) return "archived";
  if (t.isArchived) return "archived";
  if (t.isClosed) return "closed";
  return "open";
}

/** Текущее состояние связи публикации с темой (обновление страницы). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const post = await db.recPost.findUnique({ where: { id } });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
    }
    if (!post.topicId) return NextResponse.json({ ok: true, topicId: null, state: "none" });
    const t = await db.topic.findUnique({
      where: { id: post.topicId },
      select: { id: true, isClosed: true, isArchived: true, deletedAt: true },
    });
    return NextResponse.json({ ok: true, topicId: post.topicId, state: topicState(t) });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { token } = body;

    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json(
        { error: "Обсуждение на форуме доступно зарегистрированным пользователям" },
        { status: 401 }
      );
    }

    const restriction = await getActiveRestriction(user.id);
    if (restriction) {
      return NextResponse.json(
        { error: restrictionBlockMessage(restriction), restricted: true, restriction },
        { status: 403 }
      );
    }

    // Защита от массового создания связанных форумных тем.
    if (!rateLimit(`recommend-discuss:${user.id}`, 12, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Слишком много действий за час. Попробуйте позже." },
        { status: 429 }
      );
    }

    const createOrOpen = async () => {
      return db.$transaction(async (tx) => {
        const post = await tx.recPost.findUnique({ where: { id } });
        if (!post || post.isDeleted) {
          return { http: 404 as const, payload: { error: "Публикация не найдена" } };
        }
        if (post.isHiddenByAi) {
          return { http: 403 as const, payload: { error: "Публикация скрыта модерацией — обсуждение недоступно" } };
        }

        // Уже есть тема — идемпотентный ответ.
        if (post.topicId) {
          const t = await tx.topic.findUnique({
            where: { id: post.topicId },
            select: { id: true, isClosed: true, isArchived: true, deletedAt: true },
          });
          return {
            http: 200 as const,
            payload: {
              ok: true,
              created: false,
              topicId: post.topicId,
              state: topicState(t),
              note: t && !t.deletedAt && !t.isArchived && !t.isClosed
                ? "Тема обсуждения уже существует"
                : undefined,
            },
          };
        }

        // Рубрики раздела: родитель «Обсуждение сообщений из блоков»
        // → ребёнок «Рекомендую / Не рекомендую». Идемпотентно.
        let parent = await tx.rubric.findFirst({ where: { OR: [{ slug: BLOCKS_RUBRIC_SLUG }, { name: BLOCKS_RUBRIC_NAME }] } });
        if (!parent) {
          parent = await tx.rubric.create({
            data: { name: BLOCKS_RUBRIC_NAME, slug: BLOCKS_RUBRIC_SLUG, isService: true },
          });
        }
        let rubric = await tx.rubric.findFirst({ where: { OR: [{ slug: RC_RUBRIC_SLUG }, { name: RC_RUBRIC_NAME, parentId: parent.id }] } });
        if (!rubric) {
          rubric = await tx.rubric.create({
            data: { name: RC_RUBRIC_NAME, slug: RC_RUBRIC_SLUG, isService: true, parentId: parent.id },
          });
        }

        const authorUser = await tx.user.findUnique({ where: { id: post.authorId }, select: { id: true, nickname: true } });
        const tAuthor = authorUser ?? user;

        const last = await tx.topic.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
        const number = (last?.number ?? 0) + 1;
        const topicTitle = `Обсуждение: ${post.title}`.slice(0, 150);

        const topic = await tx.topic.create({
          data: {
            number,
            title: topicTitle,
            authorName: tAuthor.nickname,
            authorId: tAuthor.id,
            rubricId: rubric.id,
            lastAuthorName: tAuthor.nickname,
            // Связь «одна публикация = максимум одна тема».
            recPost: { connect: { id: post.id } },
          },
        });

        // Первое сообщение темы: исходная публикация + ссылка на источник.
        const originPath = `/rekomenduyu?post=${post.id}`;
        const hostHdr = req.headers.get("host") ?? "";
        const proto = req.headers.get("x-forwarded-proto") ?? (hostHdr.startsWith("localhost") || hostHdr.startsWith("127.") ? "http" : "https");
        const originUrl = hostHdr ? `${proto}://${hostHdr}${originPath}` : originPath;
        const placeLine = post.place ? `Место: ${post.place}\n` : "";
        const stanceLine = post.stance === "notrecommend" ? "Не рекомендую" : "Рекомендую";
        const firstBody = `Публикация из раздела «Рекомендую / Не рекомендую»:\n\nКого: ${post.subject} (${stanceLine})\n\n«${post.title}»\n\n${post.text}\n\n${placeLine}Автор публикации: ${post.authorName}\nОпубликовано: ${new Date(post.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}\n\nИсточник: Рекомендую / Не рекомендую\n${originUrl}`;

        await tx.message.create({
          data: {
            topicId: topic.id,
            num: 1,
            authorName: tAuthor.nickname,
            authorId: tAuthor.id,
            body: firstBody,
          },
        });

        await tx.recPost.update({ where: { id: post.id }, data: { topicId: topic.id } });

        return {
          http: 200 as const,
          payload: { ok: true, created: true, topicId: topic.id, state: "open", note: "Тема обсуждения создана на форуме" },
        };
      });
    };

    // Попытки создания: гонка нескольких одновременных нажатий.
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await createOrOpen();
        if (result.http !== 200) {
          return NextResponse.json(result.payload, { status: result.http });
        }
        return NextResponse.json(result.payload, { status: 200 });
      } catch (e) {
        lastError = e;
        const { id } = await ctx.params;
        const post = await db.recPost.findUnique({ where: { id } });
        if (post?.topicId) {
          const t = await db.topic.findUnique({
            where: { id: post.topicId },
            select: { id: true, isClosed: true, isArchived: true, deletedAt: true },
          });
          return NextResponse.json({ ok: true, created: false, topicId: post.topicId, state: topicState(t) }, { status: 200 });
        }
        if (!isUniqueViolation(e) && !isRetryableDbError(e)) throw e;
        await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
      }
    }
    throw lastError;
  } catch (e) {
    // Последняя страховка: если тема всё-таки появилась — вернуть её.
    try {
      const { id } = await ctx.params;
      const post = await db.recPost.findUnique({ where: { id } });
      if (post?.topicId) {
        const t = await db.topic.findUnique({
          where: { id: post.topicId },
          select: { id: true, isClosed: true, isArchived: true, deletedAt: true },
        });
        return NextResponse.json({ ok: true, created: false, topicId: post.topicId, state: topicState(t) }, { status: 200 });
      }
    } catch {
      /* падение перечитывания — отдадим общий ответ ниже */
    }
    return handleApiError(e);
  }
}
