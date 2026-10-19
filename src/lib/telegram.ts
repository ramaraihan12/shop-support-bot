import { z } from "zod";
import { replies } from "@/lib/chat/replies";
import { respond, type RespondDeps } from "@/lib/chat/respond";

const TELEGRAM_MAX_TEXT = 4096;

// Only the fields the bot reads. Anything else in the update is ignored.
export const telegramUpdateSchema = z.object({
  update_id: z.number(),
  message: z
    .object({
      message_id: z.number(),
      chat: z.object({ id: z.number(), type: z.string() }),
      text: z.string().optional(),
    })
    .optional(),
});

export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;

export type TelegramApi = {
  sendMessage(chatId: number, text: string): Promise<void>;
  sendTyping(chatId: number): Promise<void>;
};

export function createTelegramApi(token: string, fetchFn: typeof fetch = fetch): TelegramApi {
  const call = async (method: string, body: Record<string, unknown>) => {
    const response = await fetchFn(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Telegram ${method} failed with ${response.status}: ${detail}`);
    }
  };

  return {
    sendMessage: (chatId, text) => call("sendMessage", { chat_id: chatId, text: text.slice(0, TELEGRAM_MAX_TEXT) }),
    sendTyping: (chatId) => call("sendChatAction", { chat_id: chatId, action: "typing" }),
  };
}

/**
 * Handles one update from the webhook. Telegram gets the full answer in one
 * message, since editing a message for every streamed token hits rate limits.
 */
export async function handleTelegramUpdate(deps: RespondDeps, api: TelegramApi, update: TelegramUpdate) {
  const message = update.message;
  // Group chats are out of scope: order details should stay in a private chat.
  if (!message?.text || message.chat.type !== "private") return;

  const chatId = message.chat.id;
  if (message.text.startsWith("/start")) {
    await api.sendMessage(chatId, replies.telegramStart);
    return;
  }

  await api.sendTyping(chatId);
  const reply = await respond(deps, { channel: "telegram", externalId: String(chatId), text: message.text });

  if (reply.kind !== "model") {
    await api.sendMessage(chatId, reply.text);
    return;
  }

  let answer = "";
  try {
    answer = (await reply.result.text).trim();
  } catch (error) {
    console.error("telegram model reply failed", error);
  }
  await api.sendMessage(chatId, answer || replies.modelFailed(reply.language));
}
