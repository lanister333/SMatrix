/**
 * ШАГ 22 (восстановление). «Объявления» — доска объявлений жителей Сахалина
 * (отдельная страница /obyavleniya). Не форум: связь покупателя и продавца —
 * напрямую по контактам из объявления. РОВНО ВОСЕМЬ рубрик: Продам,
 * Куплю, Отдам даром, Услуги, Работа, Недвижимость, Транспорт, Разное.
 *
 * GET  — публичная лента: актуальные сверху, снятые с публикации — ниже
 *        серым (остаются для истории); внутри каждой группы новые сверху;
 *        стабильные позиции и пагинация ?page=N&pageSize=N; поиск ?q= по
 *        заголовку, тексту и цене, частичное совпадение; ?rubric= — фильтр
 *        по рубрике; ?place= — фильтр по месту; ?mine=1&token=… — «Мои
 *        объявления» (автор видит и скрытые ИИ — с причиной).
 * POST — создание объявления (только зарегистрированные, гости могут
 *        читать; проверка рубрики, защита от перечисления разных брендов,
 *        точного повтора, предупреждение о похожих с возможностью продолжить,
 *        лимиты от спама, ИИ-модерация). Форумной темы НЕ создаёт.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import { restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction, handleConfirmedViolation } from "@/lib/moderation/sanctions";
import { moderateNewAdListingText } from "@/lib/moderation/obyavleniya";
import { verifySmsCode } from "@/lib/sms";
import {
  AD_ONE_HINT,
  AD_RUBRIC_KEYS,
  adRubricLabel,
  adMatchesPlace,
  adMatchesQuery,
  isMultipleGoods,
  listingsSimilar,
  normalizedTitle,
  significantTokens,
} from "@/lib/obyavleniya";
import { safeAuthorGender } from "@/lib/nick-gender";

export const runtime = "nodejs";
export const maxDuration = 60;

const PAGE_SIZE_DEFAULT = 15;
const PAGE_SIZE_MAX = 50;
/** Разумное ограничение частоты публикации — не мешает обычному пользователю. */
const CREATE_LIMIT_PER_HOUR = 6;

/** Публичный вид объявления. */
function publicShape(p: {
  id: string;
  rubric: string;
  title: string;
  text: string;
  price: string;
  contact: string;
  place: string;
  status: string;
  authorId: string;
  authorName: string;
  editedAt: Date | null;
  createdAt: Date;
  media?: { url: string; mime: string }[];
}) {
  return {
    id: p.id,
    rubric: p.rubric,
    rubricLabel: adRubricLabel(p.rubric),
    title: p.title,
    text: p.text,
    price: p.price,
    contact: p.contact,
    place: p.place,
    status: p.status,
    authorId: p.authorId,
    authorName: p.authorName,
    authorGender: safeAuthorGender(p.authorName, p.author as { nickname: string; gender: string | null } | null),
    editedAt: p.editedAt,
    createdAt: p.createdAt,
    media: (p.media ?? []).map((m) => ({ url: m.url, mime: m.mime })),
  };
}

/** Порядок ленты: Актуально → Снято с публикации, внутри новые сверху. */
function feedOrder(a: { status: string; createdAt: Date; id: string }, b: { status: string; createdAt: Date; id: string }) {
  const ra = a.status === "active" ? 0 : 1;
  const rb = b.status === "active" ? 0 : 1;
  if (ra !== rb) return ra - rb;
  const ta = new Date(a.createdAt).getTime();
  const tb = new Date(b.createdAt).getTime();
  if (ta !== tb) return tb - ta;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const mine = sp.get("mine") === "1";
    const token = sp.get("token");
    const q = (sp.get("q") || "").trim().slice(0, 120);
    const rubric = (sp.get("rubric") || "").trim().slice(0, 20);
    const place = (sp.get("place") || "").trim().slice(0, 80);
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(sp.get("pageSize") || String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT));

    if (mine) {
      const user = await userByToken(token);
      if (!user) {
        return NextResponse.json({ error: "Войдите в аккаунт, чтобы увидеть свои объявления" }, { status: 401 });
      }
      const rows = await db.adListing.findMany({
        where: { authorId: user.id, isDeleted: false },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 300,
        include: { media: { select: { url: true, mime: true }, orderBy: { createdAt: "asc" } } },
      });
      rows.sort(feedOrder);
      // В «Моих объявлениях» автор видит и скрытые ИИ — с объяснением причины.
      return NextResponse.json({
        posts: rows.map((r) => ({
          ...publicShape(r),
          isHiddenByAi: r.isHiddenByAi,
          hiddenReason: r.hiddenReason,
          needHuman: r.needHuman,
        })),
      });
    }

    // Публичная лента. Поиск поддерживает частичное совпадение и русский регистр
    // (SQLite LIKE регистрочувствителен для кириллицы) — фильтруем в JS.
    const rows = await db.adListing.findMany({
      where: { isDeleted: false, isHiddenByAi: false },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1000,
      include: { media: { select: { url: true, mime: true }, orderBy: { createdAt: "asc" } } },
    });
    const filtered = rows.filter(
      (r) => adMatchesQuery(r, q) && adMatchesPlace(r, place) && (!rubric || (AD_RUBRIC_KEYS.has(rubric) && r.rubric === rubric))
    );
    filtered.sort(feedOrder);
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const pageRows = filtered.slice(start, start + pageSize);

    return NextResponse.json({
      posts: pageRows.map((r) => publicShape(r)),
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
    const { token, confirmSimilar, photoIds } = body;
    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json(
        { error: "Чтобы опубликовать объявление — войдите в аккаунт." },
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
    if (!rateLimit(`obyavleniya-try:${user.id}`, 30, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Слишком много попыток за час. Попробуйте позже." },
        { status: 429 }
      );
    }

    const rubric = String(body.rubric ?? "").trim();
    const text = String(body.text ?? body.body ?? "").trim();
    /* ТЗ Flat 2.0 (реставрация 2026-09-23): заголовок выводится из текста
       (первая строка), если клиент его не прислал; СМС-верификация
       обязательна для публикации на народной доске. */
    const deriveTitle = () => {
      const first = text.split("\n")[0].trim().slice(0, 60);
      return first.length >= 5 ? first : first.length > 0 ? first + "…" : "";
    };
    const title = String(body.title ?? "").trim() || deriveTitle();
    const price = String(body.price ?? "").trim().slice(0, 80);
    const contact = String(body.contact ?? "").trim().slice(0, 200);
    const place = String(body.place ?? "").trim().slice(0, 80);

    // СМС-верификация Flat 2.0 (двухшаговая форма).
    const smsCheck = verifySmsCode(String(body.smsPhone ?? ""), String(body.smsCode ?? ""));
    if (!smsCheck.ok) {
      return NextResponse.json({ error: smsCheck.error }, { status: 400 });
    }

    if (!AD_RUBRIC_KEYS.has(rubric)) {
      return NextResponse.json(
        { error: "Выберите вкладку: Отдам даром / Приму в дар / Бюро находок" },
        { status: 400 }
      );
    }
    if (title.length < 5 || title.length > 150) {
      return NextResponse.json(
        { error: "Текст объявления слишком короткий — начните с понятной первой строки (от 5 символов)" },
        { status: 400 }
      );
    }
    if (text.length < 10 || text.length > 8000) {
      return NextResponse.json(
        { error: "Напишите текст объявления: от 10 до 8000 символов" },
        { status: 400 }
      );
    }

    // Одно объявление — один товар/услуга: явное перечисление разных брендов
    // в заголовке — признак массовой перепродажи (спам).
    if (isMultipleGoods(title)) {
      return NextResponse.json(
        { needsSpecific: true, hint: AD_ONE_HINT, multiple: true },
        { status: 422 }
      );
    }

    // Защита от повторной публикации одного и того же объявления.
    const myPosts = await db.adListing.findMany({
      where: { authorId: user.id, isDeleted: false },
      select: { id: true, title: true },
      take: 200,
        include: { author: { select: { nickname: true, gender: true } } },
    });
    const norm = normalizedTitle(title);
    const exactDup = myPosts.find((p) => normalizedTitle(p.title) === norm);
    if (exactDup) {
      return NextResponse.json(
        { error: "Вы уже публиковали объявление с таким же заголовком. Измените формулировку или снимите старое объявление с публикации." },
        { status: 400 }
      );
    }

    // Предупреждение о похожих объявлениях. Не запрещаем создавать
    // автоматически — пользователь может продолжить (confirmSimilar).
    if (!confirmSimilar) {
      const candidates = await db.adListing.findMany({
        where: { isDeleted: false, isHiddenByAi: false, status: "active" },
        select: { id: true, title: true, price: true, createdAt: true },
        take: 1000,
        orderBy: { createdAt: "desc" },
      });
      const newTokens = significantTokens(`${title}\n${text}`);
      const similar = candidates
        .filter((c) => listingsSimilar(newTokens, significantTokens(c.title)))
        .slice(0, 5);
      if (similar.length > 0) {
        return NextResponse.json(
          {
            similar: true,
            hint: "Похожее объявление уже опубликовано. Возможно, то, что вы ищете, уже есть.",
            similarPosts: similar.map((s) => ({ id: s.id, title: s.title, price: s.price, createdAt: s.createdAt })),
          },
          { status: 200 }
        );
      }
    }

    // Строгая защита от слишком частого создания объявлений:
    // считаются только попытки, дошедшие до модерации.
    if (!rateLimit(`obyavleniya:${user.id}`, CREATE_LIMIT_PER_HOUR, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: `Слишком много объявлений за час (не больше ${CREATE_LIMIT_PER_HOUR}). Это защита от спама — попробуйте позже.` },
        { status: 429 }
      );
    }

    // Проверка текста: лексика + ИИ-модерация раздела «Объявления»
    // (мошенничество/запрещённые товары/спам; продажа своих товаров и услуг —
    // суть раздела, НЕ нарушение).
    const outcome = await moderateNewAdListingText(rubric, title, text, price, contact, place);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    // Прикрепление заранее загруженных фото (до 5).
    const ids: string[] = Array.isArray(photoIds)
      ? photoIds.filter((v: unknown): v is string => typeof v === "string").slice(0, 5)
      : [];

    const created = await db.adListing.create({
      data: {
        rubric,
        title,
        text,
        price,
        contact,
        place,
        status: "active",
        authorId: user.id,
        authorName: user.nickname,
        aiStatus: outcome.action === "hide" ? "hidden" : outcome.action === "human" ? "human" : "ok",
        aiNote: outcome.aiNote ?? "",
        isHiddenByAi: outcome.action === "hide",
        hiddenReason: outcome.hiddenReason ?? "",
        needHuman: outcome.needHuman,
        ...(ids.length
          ? { media: { connect: ids.map((id) => ({ id })) } }
          : {}),
      },
      include: { media: { select: { url: true, mime: true }, orderBy: { createdAt: "asc" } } },
    });

    // Очевидное нарушение скрыто — мягкая лестница санкций (общий механизм сайта).
    let sanction: Record<string, unknown> | null = null;
    if (outcome.action === "hide" && outcome.source === "ai") {
      const violation = await handleConfirmedViolation({
        userId: user.id,
        category: outcome.category ?? "other",
        reason: outcome.hiddenReason ?? "нарушение правил раздела «Объявления»",
      });
      sanction = { ...violation.sanction, note: violation.note, needsHumanDecision: violation.needsHumanDecision };
    }

    const note =
      outcome.action === "hide"
        ? `Объявление скрыто модерацией: ${outcome.hiddenReason ?? "нарушение правил"}. Его проверит человек-модератор.`
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
