/**
 * ШАГ 23. «Где дешевле» — самостоятельный раздел сравнения цен на конкретные
 * товары (отдельная страница /gde-deshevle). Не форум, не «Подслушано»,
 * не «Где купить» и не рекламная площадка (ТЗ п.1/30).
 *
 * GET  — публичная лента: порядок «Сравниваю → Нашёл дешевле → Неактуально»,
 *        внутри каждой группы новые сверху (ТЗ п.13); стабильные позиции и
 *        пагинация ?page=N&pageSize=N (ТЗ п.1/25, не бесконечная лента);
 *        простой поиск ?q= по заголовку, тексту, модели и артикулу,
 *        частичное совпадение (ТЗ п.27); ?place= — фильтр по месту (ТЗ п.22);
 *        ?mine=1&token=… — «Мои публикации» автора.
 * POST — создание вопроса (только зарегистрированные, гости могут читать —
 *        ТЗ п.22; п.2/3 — проверка конкретности и защита от нескольких
 *        товаров в одном вопросе; п.11 — предупреждение о похожих вопросах
 *        с возможностью продолжить; п.17 — защита от спама и повторов;
 *        п.18/20 — ИИ-проверка рекламы).
 *        Тему форума при создании НЕ создаёт — тему создаёт кнопка
 *        «Обсудить на форуме» (/api/gdedeshevle/[id]/discuss).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import { restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction, handleConfirmedViolation } from "@/lib/moderation/sanctions";
import { moderateNewGdedeshevleText } from "@/lib/moderation/gdedeshevle";
import {
  CD_SPECIFIC_HINT,
  CD_MULTIPLE_HINT,
  CD_SIMILAR_HINT,
  CD_STATUS_RANK,
  isMultipleProducts,
  isTooGeneric,
  normalizedTitle,
  questionsSimilar,
  significantTokens,
} from "@/lib/gdedeshevle";

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
}) {
  return {
    id: p.id,
    title: p.title,
    text: p.text,
    place: p.place,
    status: p.status,
    authorId: p.authorId,
    authorName: p.authorName,
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

/** Простой поиск (ТЗ п.27): каждое слово запроса должно частично совпасть. */
function matchesQuery(p: { title: string; text: string }, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${p.title}\n${p.text}`.toLowerCase();
  return words.every((w) => haystack.includes(w));
}

/** Компактный фильтр по месту (ТЗ п.22): подстрока без учёта регистра. */
function matchesPlace(p: { place: string }, place: string): boolean {
  if (!place) return true;
  return p.place.toLowerCase().includes(place.toLowerCase());
}

/** Состояние связанной темы форума для кнопки (ТЗ п.15). */
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

    // Порядок отображения (ТЗ п.13): группы Сравниваю → Нашёл дешевле →
    // Неактуально, внутри каждой группы новые сверху; позиции стабильные (п.25).
    const statusRank = (s: string) => CD_STATUS_RANK[s] ?? 0;
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
        return NextResponse.json({ error: "Войдите в аккаунт, чтобы увидеть свои публикации." }, { status: 401 });
      }
      const rows = await db.cheapPost.findMany({
        where: { authorId: user.id, isDeleted: false },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 300,
        include: { answers: { orderBy: { createdAt: "asc" } } },
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
    const rows = await db.cheapPost.findMany({
      where: { isDeleted: false, isHiddenByAi: false },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1000,
      include: { answers: { orderBy: { createdAt: "asc" } } },
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
        { error: "Чтобы задать вопрос — войдите в аккаунт." },
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
    if (!rateLimit(`gdedeshevle-try:${user.id}`, 30, 60 * 60 * 1000)) {
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

    // Проверка конкретности товара (ТЗ п.2/3): не публикуем молча слишком
    // общий вопрос — показываем подсказку и даём отредактировать.
    if (isTooGeneric(title, text)) {
      return NextResponse.json(
        { needsSpecific: true, hint: CD_SPECIFIC_HINT },
        { status: 422 }
      );
    }

    // Несколько разных товаров в одном вопросе (ТЗ п.3/4) — не публикуем
    // молча: «правильно создать отдельные вопросы».
    if (isMultipleProducts(title, text)) {
      return NextResponse.json(
        { needsSpecific: true, hint: CD_MULTIPLE_HINT, multiple: true },
        { status: 422 }
      );
    }

    // Защита от повторной публикации одного и того же вопроса (ТЗ п.31.14).
    const myPosts = await db.cheapPost.findMany({
      where: { authorId: user.id, isDeleted: false },
      select: { id: true, title: true },
      take: 200,
    });
    const norm = normalizedTitle(title);
    const exactDup = myPosts.find((p) => normalizedTitle(p.title) === norm);
    if (exactDup) {
      return NextResponse.json(
        { error: "Вы уже публиковали точно такой же вопрос. Измените формулировку или проверьте сравнение цен в своём вопросе." },
        { status: 400 }
      );
    }

    // Предупреждение о похожих вопросах (ТЗ п.11). Не запрещаем создавать
    // автоматически — пользователь может продолжить (confirmSimilar).
    if (!confirmSimilar) {
      const candidates = await db.cheapPost.findMany({
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
            hint: CD_SIMILAR_HINT,
            similarPosts: similar.map((s) => ({ id: s.id, title: s.title, status: s.status, createdAt: s.createdAt })),
          },
          { status: 200 }
        );
      }
    }

    // Строгая защита от слишком частого создания публикаций (ТЗ п.17):
    // считаются только попытки, дошедшие до модерации — черновики с
    // подсказками конкретности и предупреждениями о похожих её не расходуют.
    if (!rateLimit(`gdedeshevle:${user.id}`, CREATE_LIMIT_PER_HOUR, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: `Слишком много вопросов за час (не больше ${CREATE_LIMIT_PER_HOUR}). Это защита от спама — попробуйте позже.` },
        { status: 429 }
      );
    }

    // Проверка текста: лексика + ИИ-модерация раздела «Где дешевле»
    // (реклама/скрытая реклама/спам; упоминание магазина или цены в вопросе
    // о конкретном товаре — не нарушение, ТЗ п.19).
    const outcome = await moderateNewGdedeshevleText(title, text, place);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    const created = await db.cheapPost.create({
      data: {
        title,
        text,
        place,
        status: "comparing",
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
    // Подозрение само по себе пользователя не блокирует (ТЗ п.20).
    let sanction: Record<string, unknown> | null = null;
    if (outcome.action === "hide" && outcome.source === "ai") {
      const violation = await handleConfirmedViolation({
        userId: user.id,
        category: outcome.category ?? "other",
        reason: outcome.hiddenReason ?? "нарушение правил раздела «Где дешевле»",
      });
      sanction = { ...violation.sanction, note: violation.note, needsHumanDecision: violation.needsHumanDecision };
    }

    const note =
      outcome.action === "hide"
        ? `Вопрос скрыт модерацией: ${outcome.hiddenReason ?? "нарушение правил"}. Его проверит человек-модератор.`
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
