import { after } from "next/server";
import { safeEqual } from "@/lib/auth";
import { getRespondDeps } from "@/lib/chat/deps";
import { getEnv } from "@/lib/env";
import { createTelegramApi, handleTelegramUpdate, telegramUpdateSchema } from "@/lib/telegram";

export const maxDuration = 120;

export async function POST(request: Request) {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_WEBHOOK_SECRET: secret } = getEnv();
  if (!token || !secret) {
    return new Response("Telegram is not configured", { status: 404 });
  }

  // Telegram echoes the secret given to setWebhook in this header.
  const received = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!safeEqual(received, secret)) {
    return new Response("Forbidden", { status: 403 });
  }

  const parsed = telegramUpdateSchema.safeParse(await request.json().catch(() => null));
  // Anything else gets a 200 too, otherwise Telegram keeps redelivering it.
  if (!parsed.success) {
    return new Response(null, { status: 200 });
  }

  // Answer the webhook right away and reply through the Bot API afterwards,
  // so a slow local model doesn't make Telegram retry the update.
  after(async () => {
    try {
      await handleTelegramUpdate(getRespondDeps(), createTelegramApi(token), parsed.data);
    } catch (error) {
      console.error("telegram update failed", error);
    }
  });

  return new Response(null, { status: 200 });
}
