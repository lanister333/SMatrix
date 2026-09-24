/**
 * ШАГ 19. «ЖКХ и городские проблемы» — самостоятельная страница /gkh
 * (ТЗ из файла «Жкх.docx»). Не форум и не социальная сеть: жители
 * обозначают конкретные проблемы города, ЖКХ и инфраструктуры.
 *
 * GET  — публичная лента (ТЗ №2 от 2026-09-23 — Flat 2.0): все статусы
 *        карточки («В поиске решения»/«Передано в УК» — сверху, «Решено»/
 *        «Отклонено» — ниже, внутри групп новые сверху); скрытые ИИ и
 *        объединённые не видны; пагинация ?page=&pageSize=;
 *        поиск ?q= по заголовку, тексту, месту и текстам обновлений;
 *        фильтр ?place= по адресу; ?mine=1&token= — «Мои публикации».
 * POST — создание сигнала 3-шаговой формой (только зарегистрированные):
 *        1) «Что произошло?» — text (суть без лозунгов);
 *        2) «Точный адрес и время» — place + problemDate (обязательные);
 *        3) «Предпринятые действия» — actions (ОБЯЗАТЕЛЬНОЕ поле — без
 *        него публикация не проходит). Заголовок строится автоматически
 *        из текста (в карточке Flat 2.0 отдельного заголовка нет).
 *        Тема форума при создании НЕ создаётся — обсуждение по кнопке
 *        «Обсудить на форуме ЖКХ» ведёт в рубрику «Недвижимость ▸ ЖКХ
 *        и управляющие компании» (ТЗ №2).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError, rateLimit } from "@/lib/api";
import { restrictionBlockMessage } from "@/lib/moderation";
import { getActiveRestriction, handleConfirmedViolation } from "@/lib/moderation/sanctions";
import { moderateNewGkhText } from "@/lib/moderation/gkh";
import { significantTokens, questionsSimilar } from "@/lib/wheretobuy";
import {
  GKH_MAX_PHOTOS,
  GKH_STATUSES,
  GKH_STATUS_RANK,
  gkhMatchesPlace,
  gkhMatchesQuery,
  normalizedProblemTitle,
} from "@/lib/gkh";

export const runtime = "nodejs";
export const maxDuration = 60;

const PAGE_SIZE_DEFAULT = 15;
const PAGE_SIZE_MAX = 50;
/** Разумное ограничение частоты публикации (ТЗ п.28) — не мешает обычному жителю. */
const CREATE_LIMIT_PER_HOUR = 6;

/** Состояние связанной темы форума для кнопки (ТЗ п.13). */
export function topicStateOf(t: { isClosed: boolean; isArchived: boolean; deletedAt: Date | null } | null): string {
  if (!t || t.deletedAt) return "archived";
  if (t.isArchived) return "archived";
  if (t.isClosed) return "closed";
  return "open";
}

/** Сжатая публичная форма проблемы для ленты. */
function publicShape(p: {
  id: string;
  title: string;
  text: string;
  actions: string;
  place: string;
  problemDate: string;
  status: string;
  statusAt: Date;
  authorId: string;
  authorName: string;
  authorGender: string;
  organization: string;
  topicId: number | null;
  createdAt: Date;
  editedAt: Date | null;
  photoCount: number;
  hasVideo: boolean;
  updateCount: number;
  isMerged?: boolean;
  mergedIntoId?: string | null;
}) {
  return {
    id: p.id,
    title: p.title,
    text: p.text,
    actions: p.actions,
    place: p.place,
    problemDate: p.problemDate,
    status: p.status,
    statusAt: p.statusAt,
    authorId: p.authorId,
    authorName: p.authorName,
    authorGender: p.authorGender,
    organization: p.organization,
    topicId: p.topicId,
    createdAt: p.createdAt,
    editedAt: p.editedAt,
    photoCount: p.photoCount,
    hasVideo: p.hasVideo,
    updateCount: p.updateCount,
    isMerged: p.isMerged ?? false,
    mergedIntoId: p.mergedIntoId ?? null,
  };
}

/** Загрузить тексты видимых обновлений для группы проблем (поиск, ТЗ п.21). */
async function visibleUpdateTexts(problemIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (problemIds.length === 0) return map;
  const rows = await db.gkhUpdate.findMany({
    where: { problemId: { in: problemIds }, isDeleted: false, isHiddenByAi: false },
    select: { problemId: true, text: true },
    take: 5000,
  });
  for (const r of rows) {
    const arr = map.get(r.problemId) ?? [];
    arr.push(r.text);
    map.set(r.problemId, arr);
  }
  return map;
}

/** Счётчики медиа и обновлений для ленты. */
async function feedCounters(problemIds: string[]): Promise<Map<string, { photos: number; video: boolean; updates: number }>> {
  const map = new Map<string, { photos: number; video: boolean; updates: number }>();
  if (problemIds.length === 0) return map;
  const [media, updates] = await Promise.all([
    db.gkhMedia.findMany({
      where: { problemId: { in: problemIds }, updateId: null },
      select: { problemId: true, kind: true },
    }),
    db.gkhUpdate.findMany({
      where: { problemId: { in: problemIds }, isDeleted: false, isHiddenByAi: false },
      select: { problemId: true },
    }),
  ]);
  for (const id of problemIds) map.set(id, { photos: 0, video: false, updates: 0 });
  for (const m of media) {
    if (m.problemId == null) continue; // отфильтровано where, но Prisma-тип допускает null
    const c = map.get(m.problemId);
    if (!c) continue;
    if (m.kind === "video") c.video = true;
    else c.photos++;
  }
  for (const u of updates) {
    const c = map.get(u.problemId);
    if (c) c.updates++;
  }
  return map;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const mine = sp.get("mine") === "1";
    const token = sp.get("token");
    const q = (sp.get("q") || "").trim().slice(0, 120);
    const place = (sp.get("place") || "").trim().slice(0, 120);
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(sp.get("pageSize") || String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT));

    const feedOrder = (a: { status: string; createdAt: Date; id: string }, b: { status: string; createdAt: Date; id: string }) => {
      const ra = GKH_STATUS_RANK[a.status] ?? 0;
      const rb = GKH_STATUS_RANK[b.status] ?? 0;
      if (ra !== rb) return ra - rb;
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      if (ta !== tb) return tb - ta;
      return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    };

    const withMeta = async (rows: Array<{
      id: string;
      title: string;
      text: string;
      actions: string;
      place: string;
      problemDate: string;
      status: string;
      statusAt: Date;
      authorId: string;
      authorName: string;
      organization: string;
      topicId: number | null;
      createdAt: Date;
      editedAt: Date | null;
      author?: { gender: string } | null;
      isMerged?: boolean;
      mergedIntoId?: string | null;
    }>) => {
      const ids = rows.map((r) => r.id);
      const [counters, updTexts, topicIds] = await Promise.all([
        feedCounters(ids),
        visibleUpdateTexts(ids),
        Promise.resolve([...new Set(rows.map((r) => r.topicId).filter((v): v is number => v != null))]),
      ]);
      const topics = topicIds.length
        ? await db.topic.findMany({ where: { id: { in: topicIds } }, select: { id: true, isClosed: true, isArchived: true, deletedAt: true } })
        : [];
      const tmap = new Map(topics.map((t) => [t.id, t]));
      return rows.map((r) => ({
        ...publicShape({
          ...r,
          authorGender: r.author?.gender ?? "unspecified",
          photoCount: counters.get(r.id)?.photos ?? 0,
          hasVideo: counters.get(r.id)?.video ?? false,
          updateCount: counters.get(r.id)?.updates ?? 0,
        }),
        topicState: r.topicId ? topicStateOf(tmap.get(r.topicId) ?? null) : "none",
      }));
    };

    if (mine) {
      const user = await userByToken(token);
      if (!user) {
        return NextResponse.json({ error: "Мои публикации доступны только зарегистрированным пользователям" }, { status: 401 });
      }
      const rows = await db.gkhProblem.findMany({
        where: { authorId: user.id, isDeleted: false },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 300,
        include: { author: { select: { gender: true } } },
      });
      rows.sort(feedOrder);
      const out = await withMeta(rows);
      return NextResponse.json({
        problems: out.map((r, i) => ({
          ...r,
          // В «Моих публикациях» автор видит и скрытые ИИ — с объяснением причины.
          isHiddenByAi: rows[i].isHiddenByAi,
          hiddenReason: rows[i].hiddenReason,
          needHuman: rows[i].needHuman,
        })),
      });
    }

    // Публичная лента Flat 2.0 (ТЗ №2 от 2026-09-23): все 4 статуса карточки —
    // активные выше, решённые/отклонённые ниже; скрытые ИИ и объединённые не видны.
    const rows = await db.gkhProblem.findMany({
      where: { isDeleted: false, isHiddenByAi: false, mergedIntoId: null, status: { in: [...GKH_STATUSES] } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1000,
      include: { author: { select: { gender: true } } },
    });
    // Поиск (ТЗ п.21): по заголовку, тексту, месту и текстам обновлений.
    const updTexts = await visibleUpdateTexts(rows.map((r) => r.id));
    const filtered = rows.filter((r) =>
      gkhMatchesQuery({ title: r.title, text: r.text, place: r.place }, updTexts.get(r.id) ?? [], q) &&
      gkhMatchesPlace(r.place, place)
    );
    filtered.sort(feedOrder);
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const pageRows = filtered.slice(start, start + pageSize);
    const out = await withMeta(pageRows);

    return NextResponse.json({
      problems: out,
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
        { error: "Публиковать в «ЖКХ и городские проблемы» могут только зарегистрированные пользователи. Гости могут читать." },
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

    // Грубая защита от флуда попытками (включая неудачные) — ТЗ п.28.
    if (!rateLimit(`gkh-try:${user.id}`, 30, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Слишком много попыток за час. Попробуйте позже." },
        { status: 429 }
      );
    }

    const text = String(body.text ?? body.body ?? "").trim();
    const actions = String(body.actions ?? "").trim();
    const place = String(body.place ?? "").trim().slice(0, 120);
    const problemDate = String(body.problemDate ?? "").trim().slice(0, 10);
    const photos: string[] = Array.isArray(body.photos) ? body.photos.map(String).slice(0, GKH_MAX_PHOTOS) : [];
    const video: string | null = body.video ? String(body.video) : null;

    // 3-шаговая форма (ТЗ №2 от 2026-09-23) — шаг 1 «Что произошло?»:
    // суть проблемы без лозунгов.
    if (text.length < 10 || text.length > 8000) {
      return NextResponse.json(
        { error: "Опишите суть проблемы: что именно не работает (от 10 до 8000 символов)" },
        { status: 400 }
      );
    }
    // Шаг 2 «Точный адрес и время» — адрес и дата начала обязательны.
    if (place.length < 5) {
      return NextResponse.json(
        { error: "Укажите точный адрес проблемы: район, улица, дом" },
        { status: 400 }
      );
    }
    if (!problemDate || !/^\d{4}-\d{2}-\d{2}$/.test(problemDate)) {
      return NextResponse.json(
        { error: "Укажите дату начала проблемы (с какого числа наблюдается)" },
        { status: 400 }
      );
    }
    // Шаг 3 «Предпринятые действия» — ОБЯЗАТЕЛЬНОЕ поле (ТЗ №2):
    // без него публикация не проходит.
    if (actions.length < 10 || actions.length > 2000) {
      return NextResponse.json(
        { error: "Опишите предпринятые действия: куда звонили или писали и какой статус. Поле обязательное — без него публикация не проходит" },
        { status: 400 }
      );
    }

    // В карточке Flat 2.0 отдельного заголовка нет — строим автоматически
    // из первого предложения текста (для поиска, защиты от повторов, админки).
    const firstSentence = text.split(/[.!?;\n]/)[0].trim();
    const titleBase = firstSentence.length >= 10 ? firstSentence : text;
    const title = titleBase.slice(0, 120).trim();

    // Защита от повторной публикации одного и того же (ТЗ п.28).
    const myPosts = await db.gkhProblem.findMany({
      where: { authorId: user.id, isDeleted: false },
      select: { id: true, title: true },
      take: 200,
    });
    const norm = normalizedProblemTitle(title);
    const exactDup = myPosts.find((p) => normalizedProblemTitle(p.title) === norm);
    if (exactDup) {
      return NextResponse.json(
        { error: "Вы уже публиковали проблему с таким же заголовком. Добавьте обновление к существующей публикации." },
        { status: 400 }
      );
    }

    // Похожие проблемы (ТЗ п.9, «по возможности»): мягкое предупреждение со
    // ссылками — житель может добавить обновление к существующей публикации
    // или всё равно опубликовать свою. Автоматически не запрещаем.
    if (!confirmSimilar) {
      const candidates = await db.gkhProblem.findMany({
        where: { isDeleted: false, isHiddenByAi: false, mergedIntoId: null, status: { not: "solved" } },
        select: { id: true, title: true, status: true, createdAt: true, place: true },
        take: 1000,
        orderBy: { createdAt: "desc" },
      });
      const newTokens = significantTokens(`${title}\n${text}\n${place}`);
      const similar = candidates
        .filter((c) => questionsSimilar(newTokens, significantTokens(`${c.title}\n${c.place}`)))
        .slice(0, 5);
      if (similar.length > 0) {
        return NextResponse.json(
          {
            similar: true,
            hint: "Похожая проблема уже опубликована. Возможно, стоит добавить обновление к существующей публикации.",
            similarProblems: similar.map((s) => ({
              id: s.id,
              title: s.title,
              place: s.place,
              status: s.status,
              createdAt: s.createdAt,
            })),
          },
          { status: 200 }
        );
      }
    }

    // Строгая защита от слишком частого создания публикаций (ТЗ п.28):
    // считаются только попытки, дошедшие до модерации.
    if (!rateLimit(`gkh:${user.id}`, CREATE_LIMIT_PER_HOUR, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: `Слишком много публикаций за час (не больше ${CREATE_LIMIT_PER_HOUR}). Это защита от спама — попробуйте позже.` },
        { status: 429 }
      );
    }

    // Проверка текста: лексика + ИИ-фильтр лозунгов (ТЗ №2 п.17) + ИИ-модерация
    // раздела («Не нравится ≠ нарушение», ТЗ п.18).
    const outcome = await moderateNewGkhText("публикацию о проблеме", title, text, place);
    if (outcome.action === "block") {
      // ИИ-фильтр лозунгов (source="slogan"): текст НЕ стирается — форма остаётся
      // с текстом автора, UI показывает Дословное сообщение ТЗ и предложение переписать.
      return NextResponse.json(
        { error: outcome.blockMessage, rewrite: outcome.source === "slogan" },
        { status: 400 }
      );
    }

    const mediaConnect = [
      ...photos.map((id) => ({ id })),
      ...(video ? [{ id: video }] : []),
    ];

    // Валидация медиа (ТЗ п.27): все файлы должны быть загружены самим
    // автором и ещё не привязаны к другой публикации/обновлению.
    if (mediaConnect.length > 0) {
      const mediaRows = await db.gkhMedia.findMany({
        where: { id: { in: mediaConnect.map((m) => m.id) } },
        select: { id: true, kind: true, problemId: true, updateId: true },
      });
      const byId = new Map(mediaRows.map((m) => [m.id, m]));
      for (const m of mediaConnect) {
        const row = byId.get(m.id);
        if (!row || row.problemId || row.updateId) {
          return NextResponse.json({ error: "Некорректное вложение (фото/видео). Загрузите файл заново." }, { status: 400 });
        }
      }
    }

    const created = await db.gkhProblem.create({
      data: {
        title,
        text,
        actions,
        place,
        problemDate,
        status: "active",
        authorId: user.id,
        authorName: user.nickname,
        aiStatus: outcome.action === "hide" ? "hidden" : outcome.action === "human" ? "human" : "ok",
        aiNote: outcome.aiNote ?? "",
        isHiddenByAi: outcome.action === "hide",
        hiddenReason: outcome.hiddenReason ?? "",
        needHuman: outcome.needHuman,
        ...(mediaConnect.length ? { media: { connect: mediaConnect } } : {}),
      },
    });

    // Очевидное нарушение скрыто — мягкая лестница санкций (общий механизм сайта).
    // Подозрение само по себе пользователя не блокирует (ТЗ п.18).
    let sanction: Record<string, unknown> | null = null;
    if (outcome.action === "hide" && outcome.source === "ai") {
      const violation = await handleConfirmedViolation({
        userId: user.id,
        category: outcome.category ?? "other",
        reason: outcome.hiddenReason ?? "нарушение правил раздела «ЖКХ и городские проблемы»",
      });
      sanction = { ...violation.sanction, note: violation.note, needsHumanDecision: violation.needsHumanDecision };
    }

    const note =
      outcome.action === "hide"
        ? `Публикация скрыта ИИ-модерацией: ${outcome.hiddenReason ?? "нарушение правил"}. Её проверит человек-модератор.`
        : outcome.needHuman
          ? "Публикация отправлена на дополнительную проверку человеку-модератору."
          : "Сигнал опубликован. Спасибо!";

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
