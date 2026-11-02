/**
 * ШАГ 23 (ТЗ п.15–17). «Обсудить на форуме» для вопроса «Где дешевле».
 *
 * ГАРАНТИЯ ИДЕМПОТЕНТНОСТИ (ТЗ п.16 — критически важно):
 * один вопрос = МАКСИМУМ ОДНА связанная тема форума. Повторное нажатие,
 * обновление страницы, двойной клик и одновременные нажатия нескольких
 * пользователей не создают вторую тему:
 *  — CheapPost.topicId уникален на уровне схемы БД;
 *  — создание темы происходит внутри одной транзакции: проверка «темы нет»
 *    → создание темы → первое сообщение → запись ссылки. Гонка с уникальным
 *    индексом откатывает транзакцию целиком (темы-сироты не остаются);
 *  — после отката из-за гонки состояние перечитывается и возвращается
 *    существующая тема.
 * Если тема уже существует, повторное нажатие просто открывает её (п.16).
 *
 * Состояния кнопки (ТЗ п.15) — та же логика, что у «Подслушано Сахалин»
 * и «Где купить»:
 *  none      — темы нет:        «Обсудить на форуме» (создание по POST);
 *  open      — тема открыта:    «Обсуждается на форуме»;
 *  closed    — тема закрыта:    «Тема закрыта»;
 *  archived  — тема в архиве/удалена: «Тема в архиве».
 *
 * Тема создаётся в разделе форума (ТЗ п.17):
 *   Форум → «Обсуждение сообщений из блоков» → «Где дешевле».
 * Первое сообщение темы содержит исходный вопрос и ссылку
 * «Источник: Где дешевле» обратно на публикацию (двусторонняя связь).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import { restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction } from "@/lib/moderation/sanctions";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Родительская рубрика для обсуждений из самостоятельных блоков (ТЗ п.17). */
export const BLOCKS_RUBRIC_NAME = "Обсуждение сообщений из блоков";
export const BLOCKS_RUBRIC_SLUG = "blocks-discuss";
/** Дочерняя рубрика раздела «Где дешевле» (ТЗ п.17). */
export const CD_RUBRIC_NAME = "Где дешевле";
export const CD_RUBRIC_SLUG = "gdedeshevle-discuss";

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

/** Текущее состояние связи вопроса с темой (обновление страницы). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const post = await db.cheapPost.findUnique({ where: { id } });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Вопрос не найден" }, { status: 404 });
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

    // Общий механизм сайта: активное ограничение аккаунта блокирует действие.
    const restriction = await getActiveRestriction(user.id);
    if (restriction) {
      return NextResponse.json(
        { error: restrictionBlockMessage(restriction), restricted: true, restriction },
        { status: 403 }
      );
    }

    // Защита от массового создания связанных форумных тем (ТЗ п.17).
    if (!rateLimit(`gdedeshevle-discuss:${user.id}`, 12, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Слишком много действий за час. Попробуйте позже." },
        { status: 429 }
      );
    }

    const createOrOpen = async () => {
      return db.$transaction(async (tx) => {
        const post = await tx.cheapPost.findUnique({ where: { id } });
        if (!post || post.isDeleted) {
          return { http: 404 as const, payload: { error: "Вопрос не найден" } };
        }
        // Скрытый ИИ вопрос не обсуждается, пока модерация не решит его судьбу.
        if (post.isHiddenByAi) {
          return { http: 403 as const, payload: { error: "Вопрос скрыт модерацией — обсуждение недоступно" } };
        }

        // Уже есть тема — идемпотентный ответ (повторное нажатие/гонка/двойной клик).
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

        // Рубрики раздела (ТЗ п.17): родитель «Обсуждение сообщений из блоков»
        // → ребёнок «Где дешевле». Создаются один раз, идемпотентно.
        let parent = await tx.rubric.findFirst({ where: { OR: [{ slug: BLOCKS_RUBRIC_SLUG }, { name: BLOCKS_RUBRIC_NAME }] } });
        if (!parent) {
          parent = await tx.rubric.create({
            data: { name: BLOCKS_RUBRIC_NAME, slug: BLOCKS_RUBRIC_SLUG, isService: true },
          });
        }
        let rubric = await tx.rubric.findFirst({ where: { OR: [{ slug: CD_RUBRIC_SLUG }, { name: CD_RUBRIC_NAME, parentId: parent.id }] } });
        if (!rubric) {
          rubric = await tx.rubric.create({
            data: { name: CD_RUBRIC_NAME, slug: CD_RUBRIC_SLUG, isService: true, parentId: parent.id },
          });
        }

        // Автор темы — автор вопроса (обсуждается его вопрос);
        // если аккаунт автора удалён, тему создаёт от себя нажавший пользователь.
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
            // ТЗ п.16: связь «один вопрос = максимум одна тема».
            cheapPost: { connect: { id: post.id } },
          },
        });

        // Первое сообщение темы: исходный вопрос + ссылка на источник (ТЗ п.17/24/25).
        // Первое сообщение темы: только заголовок и текст публикации.
        // 2026-10-01: ТЗ — убрать все описательные блоки. Тема форума —
        // самостоятельная сущность, без обратной ссылки на исходную публикацию.
        const firstBody = `${post.title}\n\n${post.text}`.slice(0, 20000);

        await tx.message.create({
          data: {
            topicId: topic.id,
            num: 1,
            authorName: tAuthor.nickname,
            authorId: tAuthor.id,
            body: firstBody,
          },
        });

        await tx.cheapPost.update({ where: { id: post.id }, data: { topicId: topic.id } });

        return {
          http: 200 as const,
          payload: { ok: true, created: true, topicId: topic.id, state: "open", note: "Тема обсуждения создана на форуме" },
        };
      });
    };

    // Попытки создания: гонка нескольких одновременных нажатий может дать
    // не только P2002 (уникальный индекс), но и ошибку блокировки SQLite
    // у проигравшей транзакции. На любую из них: перечитываем состояние —
    // если тему создал параллельный запрос, возвращаем её; иначе повторяем
    // попытку (не более 3 раз). Дубликаты тем исключены (ТЗ п.16).
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
        const post = await db.cheapPost.findUnique({ where: { id } });
        if (post?.topicId) {
          const t = await db.topic.findUnique({
            where: { id: post.topicId },
            select: { id: true, isClosed: true, isArchived: true, deletedAt: true },
          });
          // Тему создал параллельный запрос — идемпотентный ответ, новой темы нет (ТЗ п.16).
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
      const post = await db.cheapPost.findUnique({ where: { id } });
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
