import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";

export const runtime = "nodejs";

const SECTIONS = ["ads", "info", "directory"] as const;
type Section = (typeof SECTIONS)[number];

/**
 * ШАГ 12. Публичное содержимое разделов «Объявления», «Практическая
 * информация», «Справочник» — только опубликованные записи.
 */
export async function GET(req: NextRequest) {
  try {
    const s = String(req.nextUrl.searchParams.get("section") ?? "");
    if (!(SECTIONS as readonly string[]).includes(s)) {
      return NextResponse.json({ error: "Неизвестный раздел" }, { status: 400 });
    }
    const section = s as Section;
    const items = await db.contentItem.findMany({
      where: { section, status: "published" },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return NextResponse.json({
      items: items.map((i) => ({
        id: i.id,
        title: i.title,
        body: i.body,
        contact: i.contact,
        updatedAt: i.updatedAt,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
