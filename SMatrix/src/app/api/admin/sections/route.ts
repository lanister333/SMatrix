import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userByToken } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { isOwnerRole, logAdminAction } from "@/lib/admin";

export const runtime = "nodejs";

const SECTIONS = ["ads", "info", "directory"] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_LABELS: Record<Section, string> = {
  ads: "Объявления",
  info: "Практическая информация",
  directory: "Справочник",
};

function parseSection(v: unknown): Section | null {
  const s = String(v ?? "");
  return (SECTIONS as readonly string[]).includes(s) ? (s as Section) : null;
}

/**
 * ШАГ 12. Разделы «Объявления», «Практическая информация», «Справочник».
 * Управляет только Главный администратор / Владелец.
 *
 * GET  ?section=ads  — все записи раздела (включая скрытые).
 * POST — action: create | update | delete | toggle.
 */
export async function GET(req: NextRequest) {
  try {
    const staff = await userByToken(req.nextUrl.searchParams.get("token"));
    if (!staff) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    if (!isOwnerRole(staff.role)) {
      return NextResponse.json({ error: "Разделы сайта доступны только Главному администратору (Владельцу)" }, { status: 403 });
    }
    const section = parseSection(req.nextUrl.searchParams.get("section"));
    if (!section) {
      return NextResponse.json({ error: "Неизвестный раздел" }, { status: 400 });
    }
    const items = await db.contentItem.findMany({
      where: { section },
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
    });
    return NextResponse.json({ items });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const staff = await userByToken(body.token);
    if (!staff) {
      return NextResponse.json({ error: "Требуется вход на форум" }, { status: 401 });
    }
    if (!isOwnerRole(staff.role)) {
      return NextResponse.json({ error: "Разделы сайта доступны только Главному администратору (Владельцу)" }, { status: 403 });
    }
    const section = parseSection(body.section);
    if (!section) {
      return NextResponse.json({ error: "Неизвестный раздел" }, { status: 400 });
    }
    const action = String(body.action ?? "");

    if (action === "create") {
      const title = String(body.title ?? "").trim();
      if (title.length < 3 || title.length > 150) {
        return NextResponse.json({ error: "Заголовок — от 3 до 150 символов" }, { status: 400 });
      }
      const item = await db.contentItem.create({
        data: {
          section,
          title,
          body: String(body.body ?? "").trim().slice(0, 5000),
          contact: String(body.contact ?? "").trim().slice(0, 200),
          status: "published",
        },
      });
      await logAdminAction({ actor: staff.nickname, actorRole: staff.role, action: "section.create", targetType: "section_item", targetLabel: `${SECTION_LABELS[section]}: «${title}»` });
      return NextResponse.json({ ok: true, note: "Запись добавлена", item });
    }

    if (action === "update") {
      const item = await db.contentItem.findUnique({ where: { id: String(body.id ?? "") } });
      if (!item) {
        return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
      }
      const title = String(body.title ?? item.title).trim();
      if (title.length < 3 || title.length > 150) {
        return NextResponse.json({ error: "Заголовок — от 3 до 150 символов" }, { status: 400 });
      }
      await db.contentItem.update({
        where: { id: item.id },
        data: {
          title,
          body: String(body.body ?? item.body).trim().slice(0, 5000),
          contact: String(body.contact ?? item.contact).trim().slice(0, 200),
        },
      });
      await logAdminAction({ actor: staff.nickname, actorRole: staff.role, action: "section.update", targetType: "section_item", targetLabel: `${SECTION_LABELS[item.section as Section] ?? item.section}: «${title}»` });
      return NextResponse.json({ ok: true, note: "Запись сохранена" });
    }

    if (action === "toggle") {
      const item = await db.contentItem.findUnique({ where: { id: String(body.id ?? "") } });
      if (!item) {
        return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
      }
      const status = item.status === "published" ? "hidden" : "published";
      await db.contentItem.update({ where: { id: item.id }, data: { status } });
      await logAdminAction({ actor: staff.nickname, actorRole: staff.role, action: "section.toggle", targetType: "section_item", targetLabel: `${SECTION_LABELS[item.section as Section] ?? item.section}: «${item.title}» → ${status === "published" ? "опубликовано" : "скрыто"}` });
      return NextResponse.json({ ok: true, note: status === "published" ? "Запись опубликована" : "Запись скрыта" });
    }

    if (action === "delete") {
      const item = await db.contentItem.findUnique({ where: { id: String(body.id ?? "") } });
      if (!item) {
        return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
      }
      await db.contentItem.delete({ where: { id: item.id } });
      await logAdminAction({ actor: staff.nickname, actorRole: staff.role, action: "section.delete", targetType: "section_item", targetLabel: `${SECTION_LABELS[item.section as Section] ?? item.section}: «${item.title}»` });
      return NextResponse.json({ ok: true, note: "Запись удалена" });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (e) {
    return handleApiError(e);
  }
}
