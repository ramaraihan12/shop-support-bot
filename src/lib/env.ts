import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value?.trim() ? value.trim() : undefined));

const envSchema = z.object({
  DATABASE_URL: z.url(),
  AI_PROVIDER: z.enum(["ollama", "openai", "google", "anthropic"]).default("ollama"),
  AI_MODEL: optionalString,
  EMBEDDING_PROVIDER: z.enum(["ollama", "openai", "google"]).default("ollama"),
  EMBEDDING_MODEL: optionalString,
  OLLAMA_BASE_URL: z.url().default("http://localhost:11434/api"),
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_WEBHOOK_SECRET: optionalString,
  ADMIN_USER: z.string().default("admin"),
  ADMIN_PASSWORD: optionalString,
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

// Parsed lazily so `next build` works without a database configured.
export function getEnv(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const problems = parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new Error(`Invalid environment: ${problems}`);
    }
    cached = parsed.data;
  }
  return cached;
}
