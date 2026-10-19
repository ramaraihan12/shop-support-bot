import { getEnv } from "@/lib/env";

// Points the bot at <public url>/api/telegram, e.g.
//   pnpm telegram:webhook https://abc123.ngrok-free.app
async function main() {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_WEBHOOK_SECRET: secret } = getEnv();
  if (!token || !secret) {
    throw new Error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in .env first");
  }
  // Telegram's own rule for secret_token.
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET may only contain letters, digits, _ and -");
  }

  const base = process.argv[2];
  if (!base?.startsWith("https://")) {
    throw new Error("Usage: pnpm telegram:webhook https://<public host>");
  }
  const url = new URL("/api/telegram", base).toString();

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url, secret_token: secret, allowed_updates: ["message"] }),
  });
  const body = (await response.json()) as { ok: boolean; description?: string };
  if (!body.ok) throw new Error(`setWebhook failed: ${body.description ?? response.status}`);

  console.log(`Webhook set to ${url}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
