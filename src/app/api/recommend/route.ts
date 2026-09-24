/**
 * ШАГ 20. «Рекомендую / Не рекомендую» — самостоятельный раздел личного опыта
 * об организациях, компаниях, сервисах и местах (отдельная страница
 * /rekomenduyu). Не форум и не рекламная площадка: заказные рекомендации,
 * спам и продвижение бизнеса скрывает ИИ-модерация.
 *
 * GET  — публичная лента: порядок «Рекомендую → Не рекомендую», внутри каждой
 *        группы новые сверху; пагинация ?page=N&pageSize=N; простой поиск ?q=
 *        по субъекту, заголовку и тексту (частичное совпадение); ?place= —
 *        фильтр по месту; ?mine=1&token=… — «Мои публикации».
 * POST — создание публикации (только зарегистрированные, гости могут читать):
 *        субъект обязателен (2–120), позиция recommend|notrecommend;
 *        предупреждение о похожих публикациях с возможностью продолжить;
 *        защита от спама и повторов; ИИ-проверка рекламы.
 *        Тему форума при создании НЕ создаёт — тему создаёт кнопка
 *        «Обсудить на форуме» (/api/recommend/[id]/discuss).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import { restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction, handleConfirmedViolation } from "@/lib/moderation/sanctions";
import { moderateNewRecommendText } from "@/lib/moderation/recommend";
// ТЗ 2026-09-22: первая линия автоматической пре-модерации (ярлыки/личные
// данные → вернуть автору с подсказкой; капслок/мат/угрозы → блок).
import { premoderateReviewText } from "@/lib/moderation/premoderation";
import {
  RC_SIMILAR_HINT,
  RC_STANCE_RANK,
  RC_SUBJECT_HINT,
  normalizedTitle,
  questionsSimilar,
  significantTokens,
} from "@/lib/recommend";

export const runtime = "nodejs";
export const maxDuration = 60;

const PAGE_SIZE_DEFAULT = 15;
const PAGE_SIZE_MAX = 50;
/** Разумное ограничение частоты публикации — не мешает обычному пользователю. */
const CREATE_LIMIT_PER_HOUR = 6;

/** Публичный вид публикации (ТЗ 2026-09-21: + выделение человека, официальный ответ, полезность). */
function publicShape(p: {
  id: string;
  subject: string;
  stance: string;
  title: string;
  text: string;
  place: string;
  humanHighlight: string;
  orgResponseText: string;
  orgResponseAt: Date | null;
  orgResponseByName: string;
  authorId: string;
  authorName: string;
  editedAt: Date | null;
  createdAt: Date;
  topicId: number | null;
  _count?: { usefulVotes: number };
}) {
  return {
    id: p.id,
    subject: p.subject,
    stance: p.stance,
    title: p.title,
    text: p.text,
    place: p.place,
    humanHighlight: p.humanHighlight,
    orgResponseText: p.orgResponseText,
    orgResponseAt: p.orgResponseAt,
    orgResponseByName: p.orgResponseByName,
    authorId: p.authorId,
    authorName: p.authorName,
    editedAt: p.editedAt,
    createdAt: p.createdAt,
    topicId: p.topicId,
    usefulCount: p._count?.usefulVotes ?? 0,
  };
}

/** ТЗ 2026-09-24 (пользователь): кнопки «Рекомендую»/«Не рекомендую» рядом
 * с «Обсудить на форуме» — счётчики по видам голосов и голос текущего
 * зрителя (myVote) для подсветки выбранной кнопки. Legacy-голоса
 * ("useful", кнопка «Полезный отзыв» удалена) в счётчики кнопок не входят. */
async function voteMapsFor(ids: string[], viewerId: string | null) {
  const grouped = await db.recUsefulVote.groupBy({
    by: ["postId", "kind"],
    where: { postId: { in: ids }, kind: { in: ["recommend", "notrecommend"] } },
    _count: { _all: true },
  });
  const rec = new Map<string, number>();
  const nrec = new Map<string, number>();
  for (const g of grouped) {
    if (g.kind === "recommend") rec.set(g.postId, g._count._all);
    else nrec.set(g.postId, g._count._all);
  }
  const mine = viewerId
    ? await db.recUsefulVote.findMany({
        where: { postId: { in: ids }, userId: viewerId },
        select: { postId: true, kind: true },
      })
    : [];
  const myVote = new Map(mine.map((v) => [v.postId, v.kind]));
  return { rec, nrec, myVote };
}

/** Простой поиск: каждое слово запроса должно частично совпасть. */
function matchesQuery(p: { subject: string; title: string; text: string }, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${p.subject}\n${p.title}\n${p.text}`.toLowerCase();
  return words.every((w) => haystack.includes(w));
}

/** Компактный фильтр по месту: подстрока без учёта регистра. */
function matchesPlace(p: { place: string }, place: string): boolean {
  if (!place) return true;
  return p.place.toLowerCase().includes(place.toLowerCase());
}

/** Состояние связанной темы форума для кнопки. */
export function topicStateOf(t: { isClosed: boolean; isArchived: boolean; deletedAt: Date | null } | null): string {
  if (!t || t.deletedAt) return "archived";
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

    // Порядок отображения: группы Рекомендую → Не рекомендую, внутри новые сверху.
    const stanceRank = (s: string) => RC_STANCE_RANK[s] ?? 0;
    const feedOrder = (a: { stance: string; createdAt: Date; id: string }, b: { stance: string; createdAt: Date; id: string }) => {
      const ra = stanceRank(a.stance);
      const rb = stanceRank(b.stance);
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
      const rows = await db.recPost.findMany({
        where: { authorId: user.id, isDeleted: false },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 300,
        include: { _count: { select: { usefulVotes: true } } },
      });
      rows.sort(feedOrder);
      const topicIds = [...new Set(rows.map((r) => r.topicId).filter((v): v is number => v != null))];
      const topics = topicIds.length
        ? await db.topic.findMany({ where: { id: { in: topicIds } }, select: { id: true, isClosed: true, isArchived: true, deletedAt: true } })
        : [];
      const tmap = new Map(topics.map((t) => [t.id, t]));
      // В «Моих публикациях» автор видит и скрытые ИИ — с объяснением причины.
      const vm = await voteMapsFor(rows.map((r) => r.id), user.id);
      return NextResponse.json({
        posts: rows.map((r) => ({
          ...publicShape(r),
          topicState: r.topicId ? topicStateOf(tmap.get(r.topicId) ?? null) : "none",
          isHiddenByAi: r.isHiddenByAi,
          hiddenReason: r.hiddenReason,
          needHuman: r.needHuman,
          recommendCount: vm.rec.get(r.id) ?? 0,
          notrecommendCount: vm.nrec.get(r.id) ?? 0,
          myVote: vm.myVote.get(r.id) ?? null,
        })),
      });
    }

    // Публичная лента. Поиск поддерживает частичное совпадение и русский регистр.
    const rows = await db.recPost.findMany({
      where: { isDeleted: false, isHiddenByAi: false },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1000,
      include: { _count: { select: { usefulVotes: true } } },
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

    // ТЗ 2026-09-24: голоса читателей + голос зрителя (токен необязателен).
    const viewer = token ? await userByToken(token) : null;
    const vm = await voteMapsFor(pageRows.map((r) => r.id), viewer?.id ?? null);

    return NextResponse.json({
      posts: pageRows.map((r) => ({
        ...publicShape(r),
        topicState: r.topicId ? topicStateOf(tmap.get(r.topicId) ?? null) : "none",
        recommendCount: vm.rec.get(r.id) ?? 0,
        notrecommendCount: vm.nrec.get(r.id) ?? 0,
        myVote: vm.myVote.get(r.id) ?? null,
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
        { error: "Публиковать в «Рекомендую / Не рекомендую» могут только зарегистрированные пользователи. Гости могут читать." },
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
    if (!rateLimit(`recommend-try:${user.id}`, 30, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Слишком много попыток за час. Попробуйте позже." },
        { status: 429 }
      );
    }

    const subject = String(body.subject ?? "").trim().slice(0, 120);
    const stance = String(body.stance ?? "recommend") === "notrecommend" ? "notrecommend" : "recommend";
    const title = String(body.title ?? "").trim();
    const text = String(body.text ?? body.body ?? "").trim();
    const place = String(body.place ?? "").trim().slice(0, 80);
    // ТЗ 2026-09-21 (Пункт 6 Манифеста): необязательное выделение конкретного человека.
    const humanHighlight = String(body.humanHighlight ?? "").trim().slice(0, 600);

    if (subject.length < 2) {
      return NextResponse.json(
        { needsSubject: true, hint: RC_SUBJECT_HINT },
        { status: 422 }
      );
    }
    if (title.length < 5 || title.length > 150) {
      return NextResponse.json(
        { error: "Заголовок должен быть от 5 до 150 символов — кратко скажите, о чём опыт" },
        { status: 400 }
      );
    }
    if (text.length < 10 || text.length > 8000) {
      return NextResponse.json(
        { error: "Расскажите о своём опыте: от 10 до 8000 символов" },
        { status: 400 }
      );
    }

    // ТЗ 2026-09-22: ПЕРВАЯ ЛИНИЯ автоматической пре-модерации —
    // п.1 ярлыки → СТОП (вернуть автору с точной подсказкой заказчика),
    // п.2 личные данные физлиц → СТОП (вернуть с требованием удалить),
    // п.3 капслок/мат/угрозы → БЛОК. Фактурный негатив — пропустить.
    const pre = premoderateReviewText({ subject, title, text, place, humanHighlight });
    if (pre.verdict === "return") {
      return NextResponse.json(
        { premoderation: "return", rule: pre.rule, hint: pre.message, error: pre.message },
        { status: 422 }
      );
    }
    if (pre.verdict === "block") {
      return NextResponse.json(
        { premoderation: "block", rule: pre.rule, error: pre.message },
        { status: 400 }
      );
    }

    // Защита от повторной публикации одного и того же.
    const myPosts = await db.recPost.findMany({
      where: { authorId: user.id, isDeleted: false },
      select: { id: true, title: true },
      take: 200,
    });
    const norm = normalizedTitle(title);
    const exactDup = myPosts.find((p) => normalizedTitle(p.title) === norm);
    if (exactDup) {
      return NextResponse.json(
        { error: "Вы уже публиковали точно такую же запись. Измените формулировку или дополните свою историю." },
        { status: 400 }
      );
    }

    // Предупреждение о похожих публикациях. Не запрещаем создавать
    // автоматически — пользователь может продолжить (confirmSimilar).
    if (!confirmSimilar) {
      const candidates = await db.recPost.findMany({
        where: { isDeleted: false, isHiddenByAi: false },
        select: { id: true, subject: true, stance: true, title: true, createdAt: true },
        take: 1000,
        orderBy: { createdAt: "desc" },
      });
      const newTokens = significantTokens(`${subject}\n${title}\n${text}`);
      const similar = candidates
        .filter((c) => questionsSimilar(newTokens, significantTokens(`${c.subject}\n${c.title}`)))
        .slice(0, 5);
      if (similar.length > 0) {
        return NextResponse.json(
          {
            similar: true,
            hint: RC_SIMILAR_HINT,
            similarPosts: similar.map((s) => ({ id: s.id, subject: s.subject, title: s.title, stance: s.stance, createdAt: s.createdAt })),
          },
          { status: 200 }
        );
      }
    }

    // Строгая защита от слишком частого создания публикаций.
    if (!rateLimit(`recommend:${user.id}`, CREATE_LIMIT_PER_HOUR, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: `Слишком много публикаций за час (не больше ${CREATE_LIMIT_PER_HOUR}). Это защита от спама — попробуйте позже.` },
        { status: 429 }
      );
    }

    // Проверка текста: лексика + ИИ-модерация раздела
    // (реклама/заказные рекомендации/спам; негативный опыт — не нарушение).
    const outcome = await moderateNewRecommendText(subject, stance, title, text, place, humanHighlight);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    const created = await db.recPost.create({
      data: {
        subject,
        stance,
        title,
        text,
        place,
        humanHighlight,
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
        reason: outcome.hiddenReason ?? "нарушение правил раздела «Рекомендую / Не рекомендую»",
      });
      sanction = { ...violation.sanction, note: violation.note, needsHumanDecision: violation.needsHumanDecision };
    }

    const note =
      outcome.action === "hide"
        ? `Публикация скрыта ИИ-модерацией: ${outcome.hiddenReason ?? "нарушение правил"}. Её проверит человек-модератор.`
        : outcome.needHuman
          ? "Публикация отправлена на дополнительную проверку человеку-модератору."
          : "Публикация опубликована. Спасибо!";

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
