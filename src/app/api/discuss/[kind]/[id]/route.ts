/**
 * ТЗ 2026-09-24 «Обсудить на форуме — авто-создание темы»:
 * универсальный POST-эндпоинт для 5 разделов сайта.
 *
 * URL: POST /api/discuss/[kind]/[id]
 * Body: { token: string }
 * Response: { redirect: "/forum/topic/<id>" } — куда вести браузер.
 *
 * Логика:
 *  1. Принимаем kind (recommend / wheretobuy / gdedeshevle / employers / gkh)
 *     и id (cuid публикации).
 *  2. Требуем token залогиненного пользователя — тема создаётся от его
 *     имени (это безопаснее, чем системный бот: пользователь явно знает,
 *     что тема создалась от него, и может её редактировать/удалять).
 *     Гостю вернём { needAuth: true } — клиент откроет AuthModal.
 *  3. Находим публикацию в соответствующей таблице (RecPost / WhereToBuyPost
 *     / CheapPost / EmpPost / GkhProblem). Удалённая → 404, скрытая ИИ → 410.
 *  4. Если у публикации уже есть topicId — возвращаем ссылку на СУЩЕСТВУЮЩУЮ
 *     тему (не создаём дубликат, как требует ТЗ).
 *  5. Если topicId === null — формируем заголовок и текст по правилам блока,
 *     добавляем ссылку-источник, прогоняем модерацию, создаём Topic + первое
 *     Message, привязываем тему к публикации (update topicId).
 *  6. Возвращаем { redirect: "/forum/topic/<newId>" } — клиент делает
 *     window.location.href = redirect, пользователь попадает в тему.
 *
 * Рубрика-назначение берётся из единой карты SECTION_FORUM (forum-links.ts):
 *   recommend   → «Товары и услуги ▸ Отзывы и рекомендации»  (121)
 *   wheretobuy  → «Товары и услуги ▸ Где купить»              (118)
 *   gdedeshevle → «Товары и услуги ▸ Цены»                    (120)
 *   employers   → «Карьера, бизнес ▸ Работодатели»            (78)
 *   gkh         → «Недвижимость ▸ ЖКХ и управляющие компании» (104)
 *
 * Форматирование тела темы зависит от блока:
 *   • recommend / wheretobuy / gdedeshevle / gkh — title + text (стандарт);
 *   • employers — собирается из employer + city + workPeriod + experience
 *     + personMention (т.к. в EmpPost нет title/text в новом Flat 2.0).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { moderateNewText } from "@/lib/moderation";
import { SECTION_FORUM } from "@/lib/forum-links";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Конфигурация типов публикаций: prisma-модель, ключ SECTION_FORUM,
 * путь страницы-источника (для ссылки в конце текста темы) и формат
 * заголовка/текста.
 */
interface KindConfig {
  /** Имя prisma-модели для db.<model>.findUnique — RecPost, WhereToBuyPost и т.д. */
  prismaModel: "recPost" | "whereToBuyPost" | "cheapPost" | "empPost" | "gkhProblem" | "helpPublication";
  /** Ключ в карте SECTION_FORUM — для получения slug рубрики-назначения. */
  sectionKey: "recommend" | "wheretobuy" | "gdedeshevle" | "employers" | "gkh" | "help";
  /** Относительный URL страницы-источника с якорем на публикацию. */
  sourcePath: (id: string) => string;
}

const KINDS: Record<string, KindConfig> = {
  recommend: {
    prismaModel: "recPost",
    sectionKey: "recommend",
    sourcePath: (id) => `/rekomenduyu#rec-${id}`,
  },
  wheretobuy: {
    prismaModel: "whereToBuyPost",
    sectionKey: "wheretobuy",
    sourcePath: (id) => `/gde-kupit#wb-${id}`,
  },
  gdedeshevle: {
    prismaModel: "cheapPost",
    sectionKey: "gdedeshevle",
    sourcePath: (id) => `/gde-deshevle#gd-${id}`,
  },
  employers: {
    prismaModel: "empPost",
    sectionKey: "employers",
    sourcePath: (id) => `/o-rabotodatelyah#emp-${id}`,
  },
  gkh: {
    prismaModel: "gkhProblem",
    sectionKey: "gkh",
    sourcePath: (id) => `/gkh#gkh-${id}`,
  },
  help: {
    prismaModel: "helpPublication",
    sectionKey: "help",
    sourcePath: (id) => `/help#help-${id}`,
  },
};

/**
 * Извлекает из данных публикации заголовок и текст темы по правилам блока.
 * Для employers собирается из нескольких полей Flat 2.0; для остальных —
 * стандартные title + text (с fallback на subject для recommend).
 */
function buildTopicTitleBody(kind: string, post: Record<string, unknown>): { title: string; body: string } {
  if (kind === "employers") {
    // Заголовок = «<employer> (<city>)» — как в карточке.
    const city = post.city ? ` (${post.city})` : "";
    const title = `${post.employer || ""}${city}`.slice(0, 150).trim();
    // Тело = период + личный опыт + упоминание человека.
    const parts: string[] = [];
    if (post.workPeriod) parts.push(`Период работы: ${post.workPeriod}`);
    if (post.experience) parts.push(`Личный опыт:\n${post.experience}`);
    if (post.personMention) parts.push(`Отдельно хочу отметить человека:\n${post.personMention}`);
    return { title, body: parts.join("\n\n") };
  }
  if (kind === "gkh") {
    // ЖКХ — заголовок = title (например, «Южно-Сахалинск, ул. Емельянова, д. 21»),
    // тело = описание проблемы + предпринятые действия (actions — поле в GkhProblem,
    // ТЗ №2 от 2026-09-23: «Подана коллективная заявка в УК №10 от 16.09…»).
    const title = String(post.title || "").slice(0, 150);
    const parts: string[] = [];
    if (post.text) parts.push(`Проблема:\n${post.text}`);
    if (post.actions) parts.push(`Действия:\n${post.actions}`);
    return { title, body: parts.join("\n\n") };
  }
  if (kind === "help") {
    // 2026-10-01: «Нужна помощь» — заголовок темы = title публикации
    // (например, «Помочь найти кота»), тело = описание просьбы (text).
    // Контакт contactData не дублируем в тему — он остаётся в карточке
    // помощи (зелёная плашка «📞 Связь:»).
    const title = String(post.title || "").slice(0, 150);
    const body = String(post.text || "");
    return { title, body };
  }
  // recommend / wheretobuy / gdedeshevle — стандартные title + text.
  // У RecPost есть ещё поле subject — используем его как fallback для заголовка.
  const title = String(post.title || post.subject || "").slice(0, 150);
  const body = String(post.text || "");
  return { title, body };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ kind: string; id: string }> }) {
  try {
    const { kind, id } = await ctx.params;

    // Шаг 1: валидация kind.
    const cfg = KINDS[kind];
    if (!cfg) {
      return NextResponse.json({ error: "Неизвестный тип публикации" }, { status: 400 });
    }

    // Шаг 2: авторизация — тема создаётся от имени текущего пользователя.
    // Гостю возвращаем needAuth — клиент откроет AuthModal и повторит запрос.
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? "");
    const user = token ? await userByToken(token) : null;
    if (!user) {
      return NextResponse.json(
        { error: "Войдите, чтобы создать тему для обсуждения", needAuth: true },
        { status: 401 },
      );
    }

    // Шаг 3: находим рубрику-назначение по slug из SECTION_FORUM.
    const sectionData = SECTION_FORUM[cfg.sectionKey];
    if (!sectionData) {
      return NextResponse.json({ error: "Карта рубрик не настроена" }, { status: 500 });
    }
    const rubric = await db.rubric.findUnique({ where: { slug: sectionData.rubricSlug } });
    if (!rubric) {
      return NextResponse.json({ error: "Рубрика-назначение не найдена" }, { status: 500 });
    }

    // Шаг 4: находим публикацию. Универсальные поля (id, topicId, isDeleted,
    // isHiddenByAi) есть во всех 5 моделях. Специфичные поля (subject для RecPost,
    // employer/city/workPeriod/experience/personMention для EmpPost, actions для
    // GkhProblem) добавляем по kind — иначе Prisma упадёт с Unknown field.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseSelect: Record<string, true> = {
      id: true,
      topicId: true,
      isDeleted: true,
      isHiddenByAi: true,
      title: true,
      text: true,
    };
    // place есть НЕ во всех моделях (HelpPublication без place) — добавляем
    // только для kinds, у которых это поле есть в схеме.
    if (kind !== "help") baseSelect.place = true;
    if (kind === "recommend") baseSelect.subject = true;
    if (kind === "employers") {
      baseSelect.employer = true;
      baseSelect.city = true;
      baseSelect.workPeriod = true;
      baseSelect.experience = true;
      baseSelect.personMention = true;
    }
    if (kind === "gkh") {
      baseSelect.actions = true;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const post: Record<string, unknown> | null = await (db[cfg.prismaModel] as any).findUnique({
      where: { id },
      select: baseSelect,
    });
    if (!post || post.isDeleted) {
      return NextResponse.json({ error: "Публикация не найдена" }, { status: 404 });
    }
    if (post.isHiddenByAi) {
      return NextResponse.json({ error: "Публикация недоступна" }, { status: 410 });
    }

    // Шаг 5: если уже есть topicId — возвращаем существующую тему (без дубликата).
    if (post.topicId != null) {
      return NextResponse.json({ redirect: `/forum/topic/${post.topicId}` });
    }

    // Шаг 6: формируем заголовок и текст темы.
    const { title, body: topicBody } = buildTopicTitleBody(kind, post);
    if (title.trim().length < 5) {
      return NextResponse.json(
        { error: "Заголовок публикации слишком короткий для темы (минимум 5 символов)" },
        { status: 400 },
      );
    }
    if (!topicBody.trim()) {
      return NextResponse.json(
        { error: "Текст публикации пуст — не из чего создать тему" },
        { status: 400 },
      );
    }

    // Шаг 7: 29.09.2026 — ссылка-источник «— из публикации: ...»
    // БОЛЬШЕ НЕ ДОБАВЛЯЕТСЯ в текст темы. По запросу пользователя
    // тема форума должна быть самостоятельной сущностью, без обратной
    // ссылки на исходную публикацию в разделе.
    // Раньше здесь было:
    //   const sourceUrl = `${origin}${cfg.sourcePath(id)}`;
    //   const fullBody = `${topicBody}\n\n— из публикации: ${sourceUrl}`.slice(0, 20000);
    const fullBody = topicBody.slice(0, 20000);

    // Шаг 8: прогоняем модерацию (как в /api/topics POST).
    const outcome = await moderateNewText(`${title}\n${fullBody}`);
    if (outcome.action === "block") {
      return NextResponse.json({ error: outcome.blockMessage }, { status: 400 });
    }

    // Шаг 9: создаём тему. number — следующий по счёту (как в /api/topics).
    const last = await db.topic.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    const number = (last?.number ?? 0) + 1;

    const topic = await db.topic.create({
      data: {
        number,
        title,
        authorName: user.nickname,
        authorId: user.id,
        rubricId: rubric.id,
        lastAuthorName: user.nickname,
      },
    });

    // Шаг 10: создаём первое сообщение (тело темы).
    await db.message.create({
      data: {
        topicId: topic.id,
        num: 1,
        authorName: user.nickname,
        authorId: user.id,
        body: fullBody,
        aiStatus: outcome.action === "hide" ? "hidden" : outcome.action === "human" ? "human" : "ok",
        aiNote: outcome.aiNote ?? "",
        needHuman: outcome.needHuman,
        isHiddenByAi: outcome.action === "hide",
        hiddenReason: outcome.hiddenReason ?? "",
      },
    });

    // Шаг 11: привязываем тему к публикации (update topicId).
    // Это гарантирует, что следующий клик «Обсудить» не создаст дубликат.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db[cfg.prismaModel] as any).update({
      where: { id },
      data: { topicId: topic.id },
    });

    // Шаг 12: возвращаем URL для редиректа.
    return NextResponse.json({ redirect: `/forum/topic/${topic.id}` });
  } catch (e) {
    return handleApiError(e);
  }
}
