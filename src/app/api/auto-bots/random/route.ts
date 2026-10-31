// /api/auto-bots/random — returns a random theatre bot for preview
import { NextRequest, NextResponse } from "next/server";
import { pickRandomBot } from "@/lib/auto-bots";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const bot = await pickRandomBot();
    if (!bot) {
      return NextResponse.json({ error: "No bots available" }, { status: 500 });
    }
    return NextResponse.json({
      id: bot.id,
      nickname: bot.nickname,
      gender: bot.gender,
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to pick bot" }, { status: 500 });
  }
}
