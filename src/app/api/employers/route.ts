/**
 * ТЗ 2026-09-23 «О работодателях» (Flat 2.0, Пункты 5/6/8/20 ТЗ №2) —
 * самостоятельный раздел фиксации СУХОГО, изолированного трудового опыта
 * жителей Сахалина и Курил (отдельная страница /o-rabotodatelyah).
 * НЕ «чёрные списки», не форум, не доска вакансий и не рекламная площадка.
 *
 * GET  — публичная лента трудовых фактов: новые сверху; пагинация;
 *        ?q= — поиск по организации («Название компании или ИП», частичное
 *        совпадение по компании и опыту); ?city= — фильтр по городам
 *        (Южно-Сахалинск, Холмск, Корсаков…); ?mine=1&token=… — свои карточки.
 * POST — создание карточки опыта (только зарегистрированные, гости могут
 *        только читать ленту): компания/ИП, город, период работы, личный
 *        опыт — обязательные; «Особое упоминание человека» — необязательное
 *        (принцип «Человек ≠ Организация», Пункты 5/6 ТЗ №2).
 *        Бездоказательные лозунги отклоняет ИИ-фильтр (Пункт 8 ТЗ №2) —
 *        ответ 400 + rewrite:true, текст в форме сохраняется.
 *        Тему форума при создании НЕ создаёт — кнопка «Обсудить на форуме»
 *        ведёт в рубрику «Карьера, бизнес ▸ Работодатели» (78), а связанную
 *        тему при необходимости обрабатывает /api/employers/[id]/discuss.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import { restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction, handleConfirmedViolation } from "@/lib/moderation/sanctions";
import { moderateNewEmployersText } from "@/lib/moderation/employers";
import {
  EP_EMPLOYER_HINT,
  EP_SIMILAR_HINT,
  normalizedEmployer,
  normalizedExperience,
  questionsSimilar,
  significantTokens,
} from "@/lib/employers";

export const runtime = "nodejs";
export const maxDuration = 60;

const PAGE_SIZE_DEFAULT = 15;
const PAGE_SIZE_MAX = 50;
/** Разумное ограничение частоты публикации — не мешает обычному пользователю. */
const CREATE_LIMIT_PER_HOUR = 6;

/** Публичный вид карточки трудового опыта (ТЗ Flat 2.0). */
function publicShape(p: {
  id: string;
  employer: string;
  city: string;
  workPeriod: string;
  experience: string;
  personMention: string;
  authorId: string;
  authorName: string;
  editedAt: Date | null;
  createdAt: Date;
  topicId: number | null;
}) {
  return {
    id: p.id,
    employer: p.employer,
    city: p.city,
    workPeriod: p.workPeriod,
    experience: p.experience,
    personMention: p.personMention,
    authorId: p.authorId,
    authorName: p.authorName,
    editedAt: p.editedAt,
    createdAt: p.createdAt,
    topicId: p.topicId,
  };
}

/** Поиск по организации: каждое слово запроса должно частично совпасть. */
function matchesQuery(p: { employer: string; city: string; workPeriod: string; experience: string; personMention: string }, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${p.employer}\n${p.city}\n${p.workPeriod}\n${p.experience}\n${p.personMention}`.toLowerCase();
  return words.every((w) => haystack.includes(w));
}

/** Фильтр по городам: точное совпадение выбранного города. */
function matchesCity(p: { city: string }, city: string): boolean {
  if (!city) return true;
  return p.city.trim().toLowerCase() === city.trim().toLowerCase();
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
    const city = (sp.get("city") || "").trim().slice(0, 80);
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(sp.get("pageSize") || String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT));

    // Порядок ленты: новые трудовые факты сверху (ТЗ: «вся живая жизнь… —
    // в привязанной рубрике форума, на главной только сухой факт»).
    const feedOrder = (a: { createdAt: Date; id: string }, b: { createdAt: Date; id: string }) => {
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
      const rows = await db.empPost.findMany({
        where: { authorId: user.id, isDeleted: false },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 300,
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

    // Публичная лента. Поиск поддерживает частичное совпадение и русский регистр.
    const rows = await db.empPost.findMany({
      where: { isDeleted: false, isHiddenByAi: false },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1000,
    });
    const filtered = rows.filter((r) => matchesQuery(r, q) && matchesCity(r, city));
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
        { error: "Оставлять отзывы о работодателях могут только зарегистрированные пользователи. Гости сайта могут только читать ленту" },
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
    if (!rateLimit(`employers-try:${user.id}`, 30, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Слишком много попыток за час. Попробуйте позже." },
        { status: 429 }
      );
    }

    const employer = String(body.employer ?? "").trim().slice(0, 120);
    const city = String(body.city ?? "").trim().slice(0, 80);
    const workPeriod = String(body.workPeriod ?? "").trim().slice(0, 120);
    const experience = String(body.experience ?? body.text ?? body.body ?? "").trim();
    const personMention = String(body.personMention ?? "").trim().slice(0, 2000);

    if (employer.length < 2) {
      return NextResponse.json(
        { needsEmployer: true, hint: EP_EMPLOYER_HINT },
        { status: 422 }
      );
    }
    if (city.length < 2) {
      return NextResponse.json(
        { error: "Укажите город, где находится организация (Южно-Сахалинск, Холмск, Корсаков…)" },
        { status: 400 }
      );
    }
    if (workPeriod.length < 2) {
      return NextResponse.json(
        { error: "Укажите период работы (например: май – август 2026 г.)" },
        { status: 400 }
      );
    }
    if (experience.length < 10 || experience.length > 8000) {
      return NextResponse.json(
        { error: "Опишите личный опыт работы: от 10 до 8000 символов — конкретно, с чем столкнулись" },
        { status: 400 }
      );
    }

    // Защита от повторной публикации одной и той же карточки.
    const myPosts = await db.empPost.findMany({
      where: { authorId: user.id, isDeleted: false },
      select: { id: true, experience: true },
      take: 200,
    });
    const norm = normalizedExperience(experience);
    const exactDup = myPosts.find((p) => normalizedExperience(p.experience) === norm);
    if (exactDup) {
      return NextResponse.json(
        { error: "Вы уже публиковали точно такой же опыт. Измените формулировку или дополните свою историю." },
        { status: 400 }
      );
    }

    // Предупреждение о похожих карточках. Не запрещаем создавать автоматически.
    if (!confirmSimilar) {
      const candidates = await db.empPost.findMany({
        where: { isDeleted: false, isHiddenByAi: false },
        select: { id: true, employer: true, experience: true, createdAt: true },
        take: 1000,
        orderBy: { createdAt: "desc" },
      });
      const newTokens = significantTokens(`${normalizedEmployer(employer)}\n${experience}`);
      const similar = candidates
        .filter((c) => questionsSimilar(newTokens, significantTokens(`${normalizedEmployer(c.employer)}\n${c.experience}`)))
        .slice(0, 5);
      if (similar.length > 0) {
        return NextResponse.json(
          {
            similar: true,
            hint: EP_SIMILAR_HINT,
            similarPosts: similar.map((s) => ({ id: s.id, employer: s.employer, createdAt: s.createdAt })),
          },
          { status: 200 }
        );
      }
    }

    // Строгая защита от слишком частого создания публикаций.
    if (!rateLimit(`employers:${user.id}`, CREATE_LIMIT_PER_HOUR, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: `Слишком много публикаций за час (не больше ${CREATE_LIMIT_PER_HOUR}). Это защита от спама — попробуйте позже.` },
        { status: 429 }
      );
    }

    // Проверка текста: лексика → ИИ-фильтр лозунгов (Пункт 8 ТЗ №2) →
    // ИИ-модерация раздела («Человек ≠ Организация»; личные данные физлиц,
    // вакансии/реклама найма, заказные отзывы — нарушение; негативный опыт
    // о работодателе — НЕ нарушение).
    const outcome = await moderateNewEmployersText(employer, city, workPeriod, experience, personMention);
    if (outcome.action === "block") {
      return NextResponse.json(
        { error: outcome.blockMessage, rewrite: outcome.source === "slogan" },
        { status: 400 }
      );
    }

    const created = await db.empPost.create({
      data: {
        employer,
        city,
        workPeriod,
        experience,
        personMention,
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
        reason: outcome.hiddenReason ?? "нарушение правил раздела «О работодателях»",
      });
      sanction = { ...violation.sanction, note: violation.note, needsHumanDecision: violation.needsHumanDecision };
    }

    const note =
      outcome.action === "hide"
        ? `Публикация скрыта ИИ-модерацией: ${outcome.hiddenReason ?? "нарушение правил"}. Её проверит человек-модератор.`
        : outcome.needHuman
          ? "Публикация отправлена на дополнительную проверку человеку-модератору."
          : "Опыт опубликован. Спасибо!";

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
