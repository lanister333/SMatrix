/**
 * ШАГ 18. «Где купить» — самостоятельный раздел вопросов о конкретных товарах
 * (отдельная страница /gde-kupit). Не форум, не «Подслушано», не «Нужна помощь»
 * и не рекламная площадка (ТЗ п.1/27).
 *
 * GET  — публичная лента: порядок отображения «Ищу → Нашёл → Неактуально»,
 *        внутри каждой группы новые сверху (ТЗ п.8); стабильные позиции и
 *        пагинация ?page=N&pageSize=N (ТЗ п.1/25, не бесконечная лента);
 *        простой поиск ?q= по заголовку и тексту, частичное совпадение,
 *        поддержка русского и поиска по модели/артикулу (ТЗ п.24);
 *        ?place= — компактный фильтр по месту (ТЗ п.19);
 *        ?mine=1&token=… — «Мои публикации» автора.
 * POST — создание вопроса (только зарегистрированные, гости могут читать —
 *        ТЗ п.19; п.4 — проверка конкретности товара; п.7 — предупреждение о
 *        похожих вопросах с возможностью продолжить; п.17 — защита от спама,
 *        повторов и слишком частой публикации; п.14/16 — ИИ-проверка рекламы).
 *        Тему форума при создании НЕ создаёт — тему создаёт кнопка
 *        «Обсудить на форуме» (/api/wheretobuy/[id]/discuss).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import { restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction, handleConfirmedViolation } from "@/lib/moderation/sanctions";
import { moderateNewWhereToBuyText } from "@/lib/moderation/wheretobuy";
import {
  WTB_SPECIFIC_HINT,
  WTB_SIMILAR_HINT,
  WTB_STATUS_RANK,
  isTooGeneric,
  normalizedTitle,
  questionsSimilar,
  significantTokens,
} from "@/lib/wheretobuy";

export const runtime = "nodejs";
export const maxDuration = 60;

const PAGE_SIZE_DEFAULT = 15;
const PAGE_SIZE_MAX = 50;
/** Разумное ограничение частоты публикации (ТЗ п.17) — не мешает обычному пользователю. */
const CREATE_LIMIT_PER_HOUR = 6;

/** Публичный вид вопроса. */
function publicShape(p: {
  id: string;
  title: string;
  text: string;
  place: string;
  status: string;
  authorId: string;
  authorName: string;
  editedAt: Date | null;
  createdAt: Date;
  topicId: number | null;
  answerText: string;
  answerAuthorName: string;
  answeredAt: Date | null;
  answers?: Array<{ id: string; authorName: string; text: string; createdAt: Date }>;
  author?: { gender: string | null } | null;
}) {
  return {
    id: p.id,
    title: p.title,
    text: p.text,
    place: p.place,
    status: p.status,
    authorId: p.authorId,
    authorName: p.authorName,
    authorGender: p.author?.gender ?? "unspecified",
    editedAt: p.editedAt,
    createdAt: p.createdAt,
    topicId: p.topicId,
    // ТЗ 2026-09-23 «Ответить»: ПЛОСКИЙ СПИСОК ответов на карточке —
    // сколько угодно ответов, хронологический порядок, без вложенности.
    answers: (p.answers ?? []).map((a) => ({
      id: a.id,
      authorName: a.authorName,
      text: a.text,
      createdAt: a.createdAt,
    })),
    // Legacy-поля прежнего одиночного ответа — для совместимости старых клиентов.
    answerText: p.answerText,
    answerAuthorName: p.answerAuthorName,
    answeredAt: p.answeredAt,
  };
}

/** Простой поиск (ТЗ п.24): каждое слово запроса должно частично совпасть. */
function matchesQuery(p: { title: string; text: string }, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${p.title}\n${p.text}`.toLowerCase();
  return words.every((w) => haystack.includes(w));
}

/** Компактный фильтр по месту (ТЗ п.19): подстрока без учёта регистра. */
function matchesPlace(p: { place: string }, place: string): boolean {
  if (!place) return true;
  return p.place.toLowerCase().includes(place.toLowerCase());
}

/** Состояние связанной темы форума для кнопки (ТЗ п.10). */
export function topicStateOf(t: { isClosed: boolean; isArchived: boolean; deletedAt: Date | null } | null): string {
  if (!t || t.deletedAt) return "archived"; // тема удалена — «Тема в архиве», к «Обсудить» не возвращаемся
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

    // Порядок отображения (ТЗ п.8): группы Ищу → Нашёл → Неактуально,
    // внутри каждой группы новые сверху; позиции стабильные (п.25).
    const statusRank = (s: string) => WTB_STATUS_RANK[s] ?? 0;
    const feedOrder = (a: { status: string; createdAt: Date; id: string }, b: { status: string; createdAt: Date; id: string }) => {
      const ra = statusRank(a.status);
      const rb = statusRank(b.status);
      if (ra !== rb) return ra - rb;
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      if (ta !== tb) return tb - ta;
      return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    };

    if (mine) {
      const user = await userByToken(token);
      if (!user) {
        return NextResponse.json({ error: "Мои публикации доступны только зарегистрированным пользователям" }, { status: 401 });
      }
      const rows = await db.whereToBuyPost.findMany({
        where: { authorId: user.id, isDeleted: false },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 300,
        include: { answers: { orderBy: { createdAt: "asc" } }, author: { select: { gender: true } } },
      });
      rows.sort(feedOrder);
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

    // Публичная лента. Поиск поддерживает частичное совпадение и русский регистр
    // (SQLite LIKE регистрочувствителен для кириллицы) — фильтруем в JS.
    const rows = await db.whereToBuyPost.findMany({
      where: { isDeleted: false, isHiddenByAi: false },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1000,
      include: { answers: { orderBy: { createdAt: "asc" } }, author: { select: { gender: true } } },
    });
    const filtered = rows.filter((r) => matchesQuery(r, q) && matchesPlace(r, place));
    filtered.sort(feedOrder);
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
    const { token, confirmSimilar } = body;
    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json(
        { error: "Задавать вопросы в «Где купить» могут только зарегистрированные пользователи. Гости могут читать." },
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

    // Грубая защита от флуда попытками (включая неудачные) — ТЗ п.17.
    if (!rateLimit(`wheretobuy-try:${user.id}`, 30, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Слишком много попыток за час. Попробуйте позже." },
        { status: 429 }
      );
    }

    const title = String(body.title ?? "").trim();
    const text = String(body.text ?? body.body ?? "").trim();
    const place = String(body.place ?? "").trim().slice(0, 80);

    if (title.length < 5 || title.length > 150) {
      return NextResponse.json(
        { error: "Заголовок должен быть от 5 до 150 символов — кратко назовите конкретный товар" },
        { status: 400 }
      );
    }
    if (text.length < 10 || text.length > 8000) {
      return NextResponse.json(
        { error: "Напишите текст вопроса: от 10 до 8000 символов" },
        { status: 400 }
      );
    }
    // Место — необязательное поле (ТЗ п.5). Отдельного поля «Контакты» нет:
    // автор по желанию указывает контакты прямо в тексте (ТЗ п.5).

    // Проверка конкретности товара (ТЗ п.4): не публикуем молча слишком
    // общий вопрос — показываем подсказку и даём отредактировать.
    if (isTooGeneric(title, text)) {
      return NextResponse.json(
        { needsSpecific: true, hint: WTB_SPECIFIC_HINT },
        { status: 422 }
      );
    }

    // Защита от повторной публикации одного и того же вопроса (ТЗ п.17).
    const myPosts = await db.whereToBuyPost.findMany({
      where: { authorId: user.id, isDeleted: false },
      select: { id: true, title: true },
      take: 200,
    });
    const norm = normalizedTitle(title);
    const exactDup = myPosts.find((p) => normalizedTitle(p.title) === norm);
    if (exactDup) {
      return NextResponse.json(
        { error: "Вы уже публиковали точно такой же вопрос. Измените формулировку или проверьте ответы в своём вопросе." },
        { status: 400 }
      );
    }

    // Предупреждение о похожих вопросах (ТЗ п.7). Не запрещаем создавать
    // автоматически — пользователь может продолжить (confirmSimilar).
    if (!confirmSimilar) {
      const candidates = await db.whereToBuyPost.findMany({
        where: { isDeleted: false, isHiddenByAi: false },
        select: { id: true, title: true, status: true, createdAt: true },
        take: 1000,
        orderBy: { createdAt: "desc" },
      });
      const newTokens = significantTokens(`${title}\n${text}`);
      const similar = candidates
        .filter((c) => questionsSimilar(newTokens, significantTokens(`${c.title}`)))
        .slice(0, 5);
      if (similar.length > 0) {
        return NextResponse.json(
          {
            similar: true,
            hint: WTB_SIMILAR_HINT,
            similarPosts: similar.map((s) => ({ id: s.id, title: s.title, status: s.status, createdAt: s.createdAt })),
          },
          { status: 200 }
        );
      }
    }

    // Строгая защита от слишком частого создания публикаций (ТЗ п.17):
    // считаются только попытки, дошедшие до модерации — черновики с
    // подсказками конкретности и предупреждениями о похожих её не расходуют.
    if (!rateLimit(`wheretobuy:${user.id}`, CREATE_LIMIT_PER_HOUR, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: `Слишком много вопросов за час (не больше ${CREATE_LIMIT_PER_HOUR}). Это защита от спама — попробуйте позже.` },
        { status: 429 }
      );
    }

    // Проверка текста: лексика + ИИ-модерация раздела «Где купить»
    // (реклама/скрытая реклама/спам; упоминание магазина или цены в вопросе
    // о конкретном товаре — не нарушение, ТЗ п.15/16).
    const outcome = await moderateNewWhereToBuyText(title, text, place);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    const created = await db.whereToBuyPost.create({
      data: {
        title,
        text,
        place,
        status: "seeking",
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
    // Подозрение само по себе пользователя не блокирует (ТЗ п.16).
    let sanction: Record<string, unknown> | null = null;
    if (outcome.action === "hide" && outcome.source === "ai") {
      const violation = await handleConfirmedViolation({
        userId: user.id,
        category: outcome.category ?? "other",
        reason: outcome.hiddenReason ?? "нарушение правил раздела «Где купить»",
      });
      sanction = { ...violation.sanction, note: violation.note, needsHumanDecision: violation.needsHumanDecision };
    }

    const note =
      outcome.action === "hide"
        ? `Вопрос скрыт ИИ-модерацией: ${outcome.hiddenReason ?? "нарушение правил"}. Его проверит человек-модератор.`
        : outcome.needHuman
          ? "Вопрос отправлен на дополнительную проверку человеку-модератору."
          : "Вопрос опубликован. Спасибо!";

    return NextResponse.json({
      ok: true,
      id: created.id,
      hidden: outcome.action === "hide",
      needHuman: outcome.needHuman,
      note,
      sanction,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
