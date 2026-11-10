import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Нормализация улицы:
 * — удаляет типы (ул., пр., пер., б-р, ш. и т.д.)
 * — удаляет точки, запятые, двойные пробелы
 * — lower для поиска в базе
 */
function normalizeStreet(raw: string): string {
  let s = raw.trim().toLowerCase();
  // Удаляем сокращения и слова типов улиц
  const types = [
    "улица", "ул", "проспект", "пр-т", "пр",
    "переулок", "пер", "бульвар", "б-р",
    "шоссе", "ш", "проезд", "пр-зд",
    "набережная", "наб",
  ];
  for (const t of types) {
    s = s.replace(new RegExp(`\\b${t}\\.?\\b`, "g"), " ");
  }
  // Удаляем точки, запятые
  s = s.replace(/[.,]/g, " ");
  // Удаляем двойные пробелы
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Нормализация номера дома:
 * — удаляет «д.», «дом»
 * — «15 а» → «15а» (слитно)
 * — lower для поиска
 */
function normalizeHouseNumber(raw: string): string {
  let s = raw.trim().toLowerCase();
  // Удаляем «д.», «дом»
  s = s.replace(/\bд(?:ом)?\.?\b/g, " ");
  // Удаляем точки, запятые
  s = s.replace(/[.,]/g, " ");
  // Удаляем двойные пробелы
  s = s.replace(/\s+/g, " ").trim();
  // Слитно: «15 а» → «15а», «15 б» → «15б»
  s = s.replace(/(\d)\s+([а-я])/gi, "$1$2");
  return s;
}

/**
 * GET /api/houses?q=...
 * — Поиск уже созданных домов по строке (город / улица / номер).
 */
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";
    const where = q
      ? {
          OR: [
            { city: { contains: q } },
            { street: { contains: q } },
            { houseNumber: { contains: q } },
          ],
        }
      : {};

    const houses = await db.houseBlock.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        _count: { select: { houseBranches: true } },
      },
    });

    return NextResponse.json({
      houses: houses.map((h) => ({
        id: h.id,
        city: h.city,
        street: h.street,
        houseNumber: h.houseNumber,
        createdAt: h.createdAt,
        branchesCount: h._count.houseBranches,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * POST /api/houses
 * Body: { token, city, street, houseNumber }
 *
 * On-demand генерация с нормализацией и лимитами:
 * 1. Нормализация (trim + lower + очистка типов улиц и «д.»)
 * 2. Проверка лимитов: max 3 дома за всё время, max 1 за 24 часа
 * 3. Проверка существования дома
 * 4. Если есть → редирект + анти-вахтер
 * 5. Если нет → создаём дом + 3 ветки + модератора
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await userByToken(body.token);
    if (!user) {
      return NextResponse.json(
        { error: "Нужно войти на форум, чтобы создать или открыть чат дома" },
        { status: 401 },
      );
    }

    const city = String(body.city || "").trim().toLowerCase();
    const street = normalizeStreet(String(body.street || ""));
    const houseNumber = normalizeHouseNumber(String(body.houseNumber || ""));

    if (!city || !street || !houseNumber) {
      return NextResponse.json(
        { error: "Заполните город, улицу и номер дома" },
        { status: 400 },
      );
    }

    // 1. Проверяем, есть ли уже такой дом
    const existing = await db.houseBlock.findFirst({
      where: { city, street, houseNumber },
      include: {
        houseModerators: true,
        houseBranches: true,
      },
    });

    if (existing) {
      // Анти-вахтер: проверяем активность модераторов
      const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;
      const nowSec = Math.floor(Date.now() / 1000);
      const activeMods = existing.houseModerators.filter(
        (m) => nowSec - m.lastActionAt < THIRTY_DAYS_SEC,
      );

      if (activeMods.length === 0) {
        const alreadyMod = existing.houseModerators.find(
          (m) => m.userId === user.id,
        );
        if (!alreadyMod) {
          await db.houseModerator.create({
            data: {
              userId: user.id,
              houseId: existing.id,
              isCreator: 0,
              canPin: 1,
              canDelete: 1,
              canClose: 1,
              lastActionAt: nowSec,
            },
          });
        } else {
          await db.houseModerator.update({
            where: { userId_houseId: { userId: user.id, houseId: existing.id } },
            data: { lastActionAt: nowSec },
          });
        }
      }

      // Обновляем lastActionAt текущего модератора
      const myMod = existing.houseModerators.find((m) => m.userId === user.id);
      if (myMod) {
        await db.houseModerator.update({
          where: { userId_houseId: { userId: user.id, houseId: existing.id } },
          data: { lastActionAt: nowSec },
        });
      }

      return NextResponse.json({
        action: "found",
        houseId: existing.id,
        city: existing.city,
        street: existing.street,
        houseNumber: existing.houseNumber,
        branches: existing.houseBranches.map((b) => ({ id: b.id, title: b.title })),
      });
    }

    // 2. Проверка лимитов создания
    // Max 3 дома за всё время
    const createdCount = await db.houseBlock.count({
      where: { creatorId: user.id },
    });
    if (createdCount >= 3) {
      return NextResponse.json(
        { error: "Вы уже создали 3 дома — это максимум для одного аккаунта. Если нужно больше — обратитесь к администратору." },
        { status: 403 },
      );
    }

    // Max 1 дом за 24 часа
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await db.houseBlock.count({
      where: {
        creatorId: user.id,
        createdAt: { gte: oneDayAgo },
      },
    });
    if (recentCount >= 1) {
      return NextResponse.json(
        { error: "Можно создать только один дом в сутки. Попробуйте завтра." },
        { status: 429 },
      );
    }

    // 3. Дома нет → создаём
    const STANDARD_BRANCHES = [
      "ЖКХ и Управляющая компания",
      "Благоустройство и Наш двор",
      "Свободный чат жителей",
    ];

    const newHouse = await db.$transaction(async (tx) => {
      // Race condition check
      const raceCheck = await tx.houseBlock.findFirst({
        where: { city, street, houseNumber },
      });
      if (raceCheck) return { race: true, id: raceCheck.id };

      const house = await tx.houseBlock.create({
        data: { city, street, houseNumber, creatorId: user.id },
      });

      await tx.houseBranch.createMany({
        data: STANDARD_BRANCHES.map((title) => ({
          houseId: house.id,
          title,
        })),
      });

      await tx.houseModerator.create({
        data: {
          userId: user.id,
          houseId: house.id,
          isCreator: 1,
          canPin: 1,
          canDelete: 1,
          canClose: 1,
          lastActionAt: Math.floor(Date.now() / 1000),
        },
      });

      return { race: false, id: house.id };
    });

    if (newHouse.race) {
      return NextResponse.json({
        action: "found",
        houseId: newHouse.id,
      });
    }

    const branches = await db.houseBranch.findMany({
      where: { houseId: newHouse.id },
    });

    return NextResponse.json({
      action: "created",
      houseId: newHouse.id,
      city,
      street,
      houseNumber,
      branches: branches.map((b) => ({ id: b.id, title: b.title })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
