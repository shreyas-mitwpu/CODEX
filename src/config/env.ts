import "dotenv/config";
import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .default("true")
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: booleanString,
  API_KEY: z.string().min(24),
  CRON_SECRET: z.string().min(24),
  PUBLIC_BASE_URL: z.string().url(),
  TWILIO_ACCOUNT_SID: z.string().startsWith("AC"),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_WHATSAPP_FROM: z.string().startsWith("whatsapp:+"),
  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-"),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  AI_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.65),
  USAGE_WINDOW_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  REPORT_RETENTION_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  ALLOWED_ORIGINS: z.string().default("")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

export const env = {
  ...parsed.data,
  allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
};
