import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const rubrics = await db.rubric.findMany({
      where: { parentId: null },
      orderBy: { id: "asc" },
      include: { children: { orderBy: { id: "asc" } } },
    });
    const [topics, messages, settingsRows] = await Promise.all([
      db.topic.count(),
      db.message.count(),
      db.siteSetting.findMany(),
    ]);
    // ШАГ 12: настройки сайта для шапки (слоган/подзаголовок/описание).
    const settings = Object.fromEntries(settingsRows.map((s) => [s.key, s.value]));
    return NextResponse.json({
      rubrics: rubrics.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        isService: r.isService,
        children: r.children.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          isService: c.isService,
          children: [],
        })),
      })),
      stats: { topics, messages },
      settings: {
        siteSlogan: settings.siteSlogan || "Спроси у города — город ответит.",
        siteSubtitle: settings.siteSubtitle || "Сахалинская матрица взаимопомощи",
        siteDescription: settings.siteDescription || "",
        footerNote: settings.footerNote || "",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
