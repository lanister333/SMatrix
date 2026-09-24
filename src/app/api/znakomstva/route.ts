/**
 * ШАГ 26. «Знакомства» (/znakomstva) — самостоятельный раздел, единственный
 * публично анонимный раздел SakhMatrix.
 * GET  — публичная лента: актуальные → неактуальные (новые сверху внутри групп);
 *        неактуальные не удаляются и находятся поиском; скрытые ИИ не видны.
 *        ?category=m4w|w4m — фильтр по одной из двух категорий;
 *        ?q=… — поиск по заголовку и тексту (частичное совпадение, е/ё);
 *        ?place=… — фильтр по городу (частичное совпадение, без регистра;
 *        ТЗ 2026-09-23 «Love Sakh», блок «Место» левой колонки);
 *        ?mine=1&token=… — «Мои объявления» автора (включая скрытые ИИ с
 *        причинами; автору видно его же объявление с действиями).
 *        АНОНИМНОСТЬ: authorId/authorName публично НИКОГДА не отдаются.
 * POST — создание объявления: только зарегистрированные (гости могут читать);
 *        ровно ЧЕТЫРЕ вкладки; город + один текст с любыми контактами;
 *        лексика + ИИ-модерация; фото ≤ 5.
 *        ТЗ 2026-09-23: публикация НАПРЯМУЮ — СМС-шаг снят (спам-защита:
 *        лимиты попыток/созданий в час + модерация).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import { restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction, handleConfirmedViolation } from "@/lib/moderation/sanctions";
import { moderateNewDatingText } from "@/lib/moderation/znakomstva";
import {
  DATING_CATEGORIES,
  DATING_MAX_PHOTOS,
  DATING_TITLE_MIN,
  DATING_TITLE_MAX,
  DATING_BODY_MIN,
  DATING_BODY_MAX,
  isDatingCategory,
  datingMatchesQuery,
  normalizedDatingTitle,
  feedOrder,
} from "@/lib/znakomstva";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Публичный вид объявления (ТЗ 2026-09-23: ник автора показывается
 *  без аватара — прежняя полная анонимность отменена новой доской). */
function publicShape(
  p: {
    id: string;
    category: string;
    title: string;
    body: string;
    place?: string;
    authorName?: string;
    status: string;
    statusAt: Date;
    editedAt: Date | null;
    createdAt: Date;
    photos?: { id: string; url: string }[];
    isHiddenByAi?: boolean;
    hiddenReason?: string;
    needHuman?: boolean;
  },
  viewerId?: string
) {
  return {
    id: p.id,
    category: p.category,
    title: p.title,
    body: p.body,
    /* Flat 2.0 (ТЗ 2026-09-22): город отдельным полем — карточка
       показывает «город · дата · текст». */
    place: p.place ?? "",
    /* ТЗ 2026-09-23 «Знакомства»: ник автора без аватара
       (АНОНИМНОСТЬ прежнего ТЗ отменена — народная доска с никами). */
    nick: p.authorName ?? "",
    status: p.status,
    statusAt: p.statusAt,
    editedAt: p.editedAt,
    createdAt: p.createdAt,
    photos: (p.photos ?? []).map((ph) => ({ id: ph.id, url: ph.url })),
  };
}

/** Фильтр по городу: частичное совпадение без регистра (как у «Рекомендую»). */
function matchesPlace(p: { place: string }, place: string): boolean {
  if (!place) return true;
  return p.place.toLowerCase().includes(place.toLowerCase());
}

type FeedRow = {
  id: string;
  category: string;
  title: string;
  body: string;
  place?: string;
  authorName?: string;
  status: string;
  statusAt: Date;
  editedAt: Date | null;
  createdAt: Date;
  authorId: string;
  isHiddenByAi: boolean;
  hiddenReason: string;
  needHuman: boolean;
};

/** Фото выбранных объявлений одним запросом + анонимная выдача (своё — с флагами). */
async function withMeta(rows: FeedRow[], viewerId?: string) {
  const ids = rows.map((r) => r.id);
  const photos = ids.length
    ? await db.datingPhoto.findMany({
        where: { postId: { in: ids } },
        select: { id: true, url: true, postId: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const byPost = new Map<string, { id: string; url: string }[]>();
  for (const ph of photos) {
    if (!ph.postId) continue;
    const list = byPost.get(ph.postId) ?? [];
    list.push({ id: ph.id, url: ph.url });
    byPost.set(ph.postId, list);
  }
  return rows.map((r) => {
    const isMine = !!viewerId && r.authorId === viewerId;
    return {
      id: r.id,
      category: r.category,
      title: r.title,
      body: r.body,
      /* Flat 2.0 + ТЗ 2026-09-23: город и ник автора (без аватара)
         в карточке народной доски; пустой ник → «Аноним» на клиенте. */
      place: r.place ?? "",
      nick: r.authorName ?? "",
      status: r.status,
      statusAt: r.statusAt,
      editedAt: r.editedAt,
      createdAt: r.createdAt,
      photos: byPost.get(r.id) ?? [],
      isMine,
      ...(isMine ? { isHiddenByAi: r.isHiddenByAi, hiddenReason: r.hiddenReason, needHuman: r.needHuman } : {}),
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const mine = sp.get("mine") === "1";
    const token = sp.get("token");
    const q = sp.get("q") ?? "";
    const category = sp.get("category") ?? "";
    /* ТЗ 2026-09-23 «Love Sakh»: фильтр «Место» левой колонки —
       частичное совпадение без регистра (как у «Рекомендую»). */
    const place = (sp.get("place") || "").trim().slice(0, 80);
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(sp.get("pageSize") ?? "20", 10) || 20));

    const viewer = mine ? await userByToken(token) : null;

    if (mine) {
      if (!viewer) {
        return NextResponse.json(
          { error: "Мои объявления доступны только зарегистрированным пользователям" },
          { status: 401 }
        );
      }
      const rows = await db.datingPost.findMany({
        where: { authorId: viewer.id, isDeleted: false },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 300,
      });
      rows.sort(feedOrder);
      const out = await withMeta(rows, viewer.id);
      return NextResponse.json({ posts: out });
    }

    // Публичная лента: актуальные И неактуальные (не удаляются автоматически
    // и находятся поиском); скрытые ИИ не показываются.
    if (category && !isDatingCategory(category)) {
      return NextResponse.json(
        { error: "Такой вкладки не существует — в разделе четыре вкладки: МЖ / ЖМ / Дружба-Общение / Ищу человека" },
        { status: 400 }
      );
    }
    const rows = await db.datingPost.findMany({
      where: { isDeleted: false, isHiddenByAi: false },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1000,
    });
    // Простой поиск: заголовок и текст, частичное совпадение, е/ё + город.
    const filtered = rows.filter(
      (r) =>
        datingMatchesQuery(r, q) &&
        (!category || r.category === category) &&
        matchesPlace(r, place)
    );
    filtered.sort(feedOrder);
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const pageRows = filtered.slice(start, start + pageSize);
    const out = await withMeta(pageRows);

    return NextResponse.json({
      posts: out,
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
        { error: "Публиковать объявления могут только зарегистрированные пользователи. Гости могут читать." },
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

    // Грубая защита от флуда попытками (включая неудачные).
    if (!rateLimit(`dating-try:${user.id}`, 30, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Слишком много попыток за час. Попробуйте позже." },
        { status: 429 }
      );
    }

    const category = String(body.category ?? "").trim();
    const bodyText = String(body.body ?? body.text ?? "").trim();
    const photos: string[] = Array.isArray(body.photos) ? body.photos.map(String).slice(0, DATING_MAX_PHOTOS) : [];

    /* ТЗ Flat 2.0: заголовок больше не спрашиваем — выводим из текста
       (первая строка, до 60 символов), когда клиент его не прислал. */
    const deriveTitle = () => {
      const first = bodyText.split("\n")[0].trim().slice(0, 60);
      if (first.length >= DATING_TITLE_MIN) return first;
      return first.length > 0 ? first + "…" : "";
    };
    const rawTitle = String(body.title ?? "").trim();

    /* ТЗ Flat 2.0: город — отдельное поле.
       ТЗ 2026-09-23 «Знакомства»: авторизованный «публикует напрямую» —
       обязательная СМС-верификация (verifySmsCode) снята; спам-защита
       остаётся прежней: только зарегистрированные, лимит попыток
       (30/час) и созданий (6/час), лексика + ИИ-модерация текста. */
    const place = String(body.place ?? "").trim().slice(0, 80);

    // РОВНО ЧЕТЫРЕ категории (вкладки Flat 2.0: МЖ / ЖМ / Дружба / Поиск человека).
    const title = rawTitle || deriveTitle();
    if (!isDatingCategory(category)) {
      return NextResponse.json(
        { error: "Выберите вкладку объявления: МЖ / ЖМ / Дружба-Общение / Ищу человека" },
        { status: 400 }
      );
    }
    if (title.length < DATING_TITLE_MIN || title.length > DATING_TITLE_MAX) {
      return NextResponse.json(
        { error: "Текст объявления слишком короткий — начните с понятной первой строки (от 5 символов)" },
        { status: 400 }
      );
    }
    if (bodyText.length < DATING_BODY_MIN || bodyText.length > DATING_BODY_MAX) {
      return NextResponse.json(
        { error: "Напишите текст объявления: от 10 до 8000 символов" },
        { status: 400 }
      );
    }

    // Защита от повторной публикации одного и того же объявления.
    const myPosts = await db.datingPost.findMany({
      where: { authorId: user.id, isDeleted: false },
      select: { id: true, title: true },
      take: 200,
    });
    const norm = normalizedDatingTitle(title);
    const exactDup = myPosts.find((p) => normalizedDatingTitle(p.title) === norm);
    if (exactDup) {
      return NextResponse.json(
        { error: "Вы уже публиковали объявление с таким же заголовком." },
        { status: 400 }
      );
    }

    // Плавный лимит созданий (спам-защита): 6 объявлений в час.
    if (!rateLimit(`dating-create:${user.id}`, 6, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Лимит объявлений: не больше шести за час. Попробуйте позже." },
        { status: 429 }
      );
    }

    // Проверка текста: лексика + ИИ-модерация раздела «Знакомства».
    const outcome = await moderateNewDatingText(category, title, bodyText);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    const created = await db.datingPost.create({
      data: {
        category,
        title,
        body: bodyText,
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

    // Прикрепляем заранее загруженные фото (максимум 5, ТЗ «при желании фото»).
    if (photos.length) {
      const orphans = await db.datingPhoto.findMany({
        where: { id: { in: photos }, postId: null },
        select: { id: true },
      });
      if (orphans.length) {
        await db.datingPhoto.updateMany({
          where: { id: { in: orphans.map((o) => o.id) } },
          data: { postId: created.id },
        });
      }
    }

    // Очевидное нарушение скрыто — мягкая лестница санкций (общий механизм сайта).
    let sanction: Record<string, unknown> | null = null;
    if (outcome.action === "hide" && outcome.source === "ai") {
      const violation = await handleConfirmedViolation({
        userId: user.id,
        category: outcome.category ?? "other",
        reason: outcome.hiddenReason ?? "нарушение правил раздела «Знакомства»",
      });
      sanction = { ...violation.sanction, note: violation.note, needsHumanDecision: violation.needsHumanDecision };
    }

    const note =
      outcome.action === "hide"
        ? `Объявление скрыто ИИ-модерацией: ${outcome.hiddenReason ?? "нарушение правил"}. Его проверит человек-модератор.`
        : outcome.needHuman
          ? "Объявление отправлено на дополнительную проверку человеку-модератору."
          : "Объявление опубликовано. Спасибо!";

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
