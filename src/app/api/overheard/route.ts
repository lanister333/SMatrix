/**
 * ШАГ 17. «Подслушано Сахалин» — самостоятельная городская лента слухов,
 * наблюдений и сообщений жителей (отдельная страница /podslyshano).
 * Не форум и не «Нужна помощь» — своя сущность OverheardPost.
 *
 * GET  — публичная лента: хронологический порядок, новые сверху (ТЗ п.10);
 *        стабильное положение публикаций (сортировка createdAt+id, ТЗ п.20);
 *        нормальная пагинация ?page=N&pageSize=N (не бесконечная лента);
 *        простой поиск ?q= по словам заголовка и текста с частичным
 *        совпадением и поддержкой русского языка (ТЗ п.14), без сложных
 *        фильтров по автору/дате/рейтингу/просмотрам/реакциям;
 *        ?place= — компактный фильтр по месту (ТЗ п.8, необязательный);
 *        ?mine=1&token=… — «Мои публикации» автора (включая скрытые ИИ).
 * POST — создание сообщения (только зарегистрированные, гости могут читать —
 *        ТЗ п.12; проверка лексики + ИИ-модерация раздела, ТЗ п.16).
 *        Тему форума при создании НЕ создаёт — тему создаёт только кнопка
 *        «Обсудить на форуме» (/api/overheard/[id]/discuss).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import { restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction, handleConfirmedViolation } from "@/lib/moderation/sanctions";
import { moderateNewOverheardText } from "@/lib/moderation/overheard";

export const runtime = "nodejs";
export const maxDuration = 60;

const PAGE_SIZE_DEFAULT = 15;
const PAGE_SIZE_MAX = 50;

/** Публичный вид сообщения. */
function publicShape(p: {
  id: string;
  title: string;
  text: string;
  place: string;
  authorId: string;
  authorName: string;
  editedAt: Date | null;
  createdAt: Date;
  topicId: number | null;
}) {
  return {
    id: p.id,
    title: p.title,
    text: p.text,
    place: p.place,
    authorId: p.authorId,
    authorName: p.authorName,
    editedAt: p.editedAt,
    createdAt: p.createdAt,
    topicId: p.topicId,
  };
}

/**
 * Простой поиск (ТЗ п.14): каждое слово запроса должно частично совпасть
 * (подстрока) с заголовком или текстом; регистр и кириллица учитываются
 * корректно (сравнение в нижнем регистре средствами JS).
 */
function matchesQuery(p: { title: string; text: string }, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${p.title}\n${p.text}`.toLowerCase();
  return words.every((w) => haystack.includes(w));
}

/** Компактный фильтр по месту (ТЗ п.8): подстрока без учёта регистра. */
function matchesPlace(p: { place: string }, place: string): boolean {
  if (!place) return true;
  return p.place.toLowerCase().includes(place.toLowerCase());
}

/** Состояние связанной темы форума для кнопки (ТЗ п.3/5). */
export function topicStateOf(t: { isClosed: boolean; isArchived: boolean; deletedAt: Date | null } | null): string {
  if (!t || t.deletedAt) return "archived"; // тема удалена — «Тема в архиве», кнопку не возвращаем к «Обсудить»
  if (t.isArchived) return "archived";
  if (t.isClosed) return "closed";
  return "open";
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const mine = sp.get("mine") === "1";
    const token = sp.get("token");
    const q = (sp.get("q") || "").trim().slice(0, 120);
    const place = (sp.get("place") || "").trim().slice(0, 80);
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(sp.get("pageSize") || String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT));

    if (mine) {
      const user = await userByToken(token);
      if (!user) {
        return NextResponse.json({ error: "Мои публикации доступны только зарегистрированным пользователям" }, { status: 401 });
      }
      const rows = await db.overheardPost.findMany({
        where: { authorId: user.id, isDeleted: false },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 300,
      });
      const topicIds = [...new Set(rows.map((r) => r.topicId).filter((v): v is number => v != null))];
      const topics = topicIds.length
        ? await db.topic.findMany({ where: { id: { in: topicIds } }, select: { id: true, isClosed: true, isArchived: true, deletedAt: true } })
        : [];
      const tmap = new Map(topics.map((t) => [t.id, t]));
      // В «Моих публикациях» автор видит и скрытые ИИ — с объяснением причины.
      return NextResponse.json({
        posts: rows.map((r) => ({
          ...publicShape(r),
          topicState: r.topicId ? topicStateOf(tmap.get(r.topicId) ?? null) : "none",
          isHiddenByAi: r.isHiddenByAi,
          hiddenReason: r.hiddenReason,
          needHuman: r.needHuman,
        })),
      });
    }

    // Публичная лента. Объём раздела умеренный — выбираем окно и фильтруем в JS,
    // чтобы поиск поддерживал частичное совпадение и русский регистр (SQLite
    // LIKE регистрочувствителен для кириллицы).
    const rows = await db.overheardPost.findMany({
      where: { isDeleted: false, isHiddenByAi: false },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1000,
    });
    const filtered = rows.filter((r) => matchesQuery(r, q) && matchesPlace(r, place));
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const pageRows = filtered.slice(start, start + pageSize);

    const topicIds = [...new Set(pageRows.map((r) => r.topicId).filter((v): v is number => v != null))];
    const topics = topicIds.length
      ? await db.topic.findMany({ where: { id: { in: topicIds } }, select: { id: true, isClosed: true, isArchived: true, deletedAt: true } })
      : [];
    const tmap = new Map(topics.map((t) => [t.id, t]));

    return NextResponse.json({
      posts: pageRows.map((r) => ({
        ...publicShape(r),
        topicState: r.topicId ? topicStateOf(tmap.get(r.topicId) ?? null) : "none",
      })),
      total,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;
    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json(
        { error: "Писать в «Подслушано» могут только зарегистрированные пользователи. Гости могут читать." },
        { status: 401 }
      );
    }

    // Общий механизм сайта: активное ограничение аккаунта блокирует публикацию.
    const restriction = await getActiveRestriction(user.id);
    if (restriction) {
      return NextResponse.json(
        { error: restrictionBlockMessage(restriction), restricted: true, restriction },
        { status: 403 }
      );
    }

    if (!rateLimit(`overheard:${user.id}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Слишком много сообщений за час. Попробуйте позже." },
        { status: 429 }
      );
    }

    const title = String(body.title ?? "").trim();
    const text = String(body.text ?? body.body ?? "").trim();
    const place = String(body.place ?? "").trim().slice(0, 80);

    if (title.length < 5 || title.length > 150) {
      return NextResponse.json(
        { error: "Заголовок должен быть от 5 до 150 символов — кратко передайте суть сообщения" },
        { status: 400 }
      );
    }
    if (text.length < 10 || text.length > 8000) {
      return NextResponse.json(
        { error: "Напишите текст сообщения: от 10 до 8000 символов" },
        { status: 400 }
      );
    }
    // Место — необязательное поле (ТЗ п.12).

    // Проверка текста: лексика + ИИ-модерация раздела «Подслушано»
    // (слух и критика сами по себе — не нарушение, ТЗ п.15/16).
    const outcome = await moderateNewOverheardText(title, text, place);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    const created = await db.overheardPost.create({
      data: {
        title,
        text,
        place,
        authorId: user.id,
        authorName: user.nickname,
        aiStatus: outcome.action === "hide" ? "hidden" : outcome.action === "human" ? "human" : "ok",
        aiNote: outcome.aiNote ?? "",
        isHiddenByAi: outcome.action === "hide",
        hiddenReason: outcome.hiddenReason ?? "",
        needHuman: outcome.needHuman,
      },
    });

    // Очевидное нарушение скрыто — мягкая лестница санкций (общий механизм сайта).
    let sanction: Record<string, unknown> | null = null;
    if (outcome.action === "hide" && outcome.source === "ai") {
      const violation = await handleConfirmedViolation({
        userId: user.id,
        category: outcome.category ?? "other",
        reason: outcome.hiddenReason ?? "нарушение правил раздела «Подслушано Сахалин»",
      });
      sanction = { ...violation.sanction, note: violation.note, needsHumanDecision: violation.needsHumanDecision };
    }

    const note =
      outcome.action === "hide"
        ? `Сообщение скрыто ИИ-модерацией: ${outcome.hiddenReason ?? "нарушение правил"}. Его проверит человек-модератор.`
        : outcome.needHuman
          ? "Сообщение отправлено на дополнительную проверку человеку-модератору."
          : "Сообщение опубликовано. Спасибо!";

    return NextResponse.json({ ok: true, id: created.id, hidden: outcome.action === "hide", note, sanction });
  } catch (e) {
    return handleApiError(e);
  }
}
