import { NextResponse } from "next/server";
import { createCaptcha } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const captcha = await createCaptcha();
    return NextResponse.json(captcha);
  } catch (e) {
    return handleApiError(e);
  }
}
