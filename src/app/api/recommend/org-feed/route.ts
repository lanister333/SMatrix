/**
 * ТЗ 2026-09-22. Кабинет представителя организации (.matrix-business-cabinet):
 * список отзывов жителей о СВОЕЙ организации + единственный официальный ответ
 * (Пункт 13 Манифеста, паттерн ЖКХ).
 *
 * Правила:
 *  — лента доступна ТОЛЬКО подтверждённому представителю (User.orgRep,
 *    статус устанавливает администратор);
 *  — в кабинет попадают отзывы, субъект которых совпадает с названием
 *    организации представителя (User.orgName);
 *  — показываются только публично видимые отзывы (не удалены, не скрыты ИИ);
 *  — ответ публикуется через существующий POST /api/recommend/[id]/org-response
 *    (модерация + «ровно один ответ» там же).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";

export const runtime = "nodejs";

/** Нормализация названия: к нижнему регистру, без кавычек и лишних пробелов —
 * «Сервисный центр «Цифра»» и «сервисный центр цифра» — одна организация. */
function normOrg(s: string): string {
  return (s || "").toLowerCase().replace(/[«»"'`]/g, "").replace(/\s+/g, " ").trim();
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token") ?? "";
    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json({ error: "Кабинет доступен только зарегистрированным пользователям" }, { status: 401 });
    }
    if (!user.orgRep || !user.orgName.trim()) {
      return NextResponse.json(
        { error: "Кабинет доступен только подтверждённым представителям организаций. Статус представителя подтверждается администратором." },
        { status: 403 }
      );
    }

    const org = normOrg(user.orgName);
    const all = await db.recPost.findMany({
      where: { isDeleted: false, isHiddenByAi: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        subject: true,
        stance: true,
        title: true,
        text: true,
        place: true,
        authorName: true,
        createdAt: true,
        orgResponseText: true,
        orgResponseAt: true,
        orgResponseByName: true,
      },
    });

    // Совпадение субъекта с организацией: точное после нормализации либо
    // вхождение (короткие названия в составе длинных субъектов).
    const posts = all.filter((p) => {
      const s = normOrg(p.subject);
      if (!s) return false;
      return s === org || (org.length >= 4 && s.includes(org)) || (s.length >= 4 && org.includes(s));
    });

    // Сначала отзывы без ответа (требуют внимания — как в макете заказчика),
    // внутри групп — от новых к старым.
    posts.sort((a, b) => {
      const pa = a.orgResponseAt ? 1 : 0;
      const pb = b.orgResponseAt ? 1 : 0;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({ orgName: user.orgName, posts });
  } catch (e) {
    console.error("org-feed error:", e);
    return NextResponse.json({ error: "Не удалось загрузить кабинет" }, { status: 500 });
  }
}
