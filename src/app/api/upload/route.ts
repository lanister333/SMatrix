import { NextRequest, NextResponse } from "next/server";
import { userByToken } from "@/lib/auth";
import { rateLimit } from "@/lib/api";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    // Только залогиненные пользователи
    const token = req.nextUrl.searchParams.get("token") || "";
    const user = await userByToken(token);
    if (!user) {
      return NextResponse.json(
        { error: "Чтобы загрузить фото — войдите в аккаунт." },
        { status: 401 }
      );
    }

    // Rate limit: 20 загрузок в час
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (!rateLimit(`upload:${user.id}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Слишком много загрузок. Попробуйте позже." },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Файл не получен." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Только JPG, PNG, WebP, GIF." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Файл больше 5 МБ." },
        { status: 400 }
      );
    }

    // Папка по месяцам: public/uploads/2026-10/
    const now = new Date();
    const monthDir = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", monthDir);
    await mkdir(uploadDir, { recursive: true });

    // Уникальное имя файла: <userId>-<timestamp>-<rand>.jpg
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
    const hash = crypto.randomBytes(6).toString("hex");
    const filename = `${user.id.slice(-8)}-${Date.now().toString(36)}-${hash}.${safeExt}`;
    const filepath = path.join(uploadDir, filename);

    // Сохранить файл
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    // URL для клиента
    const url = `/uploads/${monthDir}/${filename}`;

    // Записать в лог (для админа — кто что грузил)
    try {
      await db.adminLog.create({
        data: {
          actor: user.nickname,
          actorRole: user.role,
          action: "upload.image",
          targetType: "upload",
          targetLabel: `Загрузка фото ${url} (${file.size} байт) аккаунтом ${user.nickname}`,
          details: JSON.stringify({ url, size: file.size, type: file.type }),
        },
      });
    } catch {
      // Не критично
    }

    return NextResponse.json({ ok: true, url });
  } catch (e) {
    console.error("[upload] error:", e);
    return NextResponse.json(
      { error: "Не удалось загрузить файл. Попробуйте ещё раз." },
      { status: 500 }
    );
  }
}
