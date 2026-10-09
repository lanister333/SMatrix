/**
 * ШАГ 24 (восстановление). API «Полезного» — справочный раздел из пяти
 * сервисов для жителей Сахалина.
 *
 * GET            — список сервисов (короткие карточки: ключ, название,
 *                  описание, число пунктов).
 * GET ?service=k — полное содержание одного сервиса (все пункты + заметка).
 *
 * Контент редактируется вместе с сайтом: публикаций, жалоб, модерации и
 * авторизации в разделе нет. API нужен для клиентского UI и приёмочных
 * проверок содержания.
 */

import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { POLEZNOE_SERVICES, poleznoeServiceByKey } from "@/lib/poleznoe";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const key = sp.get("service");

    if (key) {
      const service = poleznoeServiceByKey(key);
      return NextResponse.json({ service });
    }

    return NextResponse.json({
      services: POLEZNOE_SERVICES.map((s) => ({
        key: s.key,
        title: s.title,
        description: s.description,
        entryCount: s.entries.length,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
