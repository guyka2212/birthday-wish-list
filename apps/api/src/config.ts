import { z } from "zod";

const b64Key = (bytes: number) =>
  z.string().refine((s) => {
    try {
      return Buffer.from(s, "base64").length === bytes;
    } catch {
      return false;
    }
  }, `must be ${bytes} bytes, base64`);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DB_MODE: z.enum(["local", "remote", "memory"]).default("local"),
  LOCAL_DB_URL: z.string().default("file:local.db"),
  TURSO_DATABASE_URL: z.string().optional(),
  TURSO_AUTH_TOKEN: z.string().optional(),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: b64Key(32),
  BLIND_INDEX_KEY: b64Key(32),
  ALLOWED_ORIGINS: z.string().default("http://localhost:5173,http://localhost:5174"),
  PUBLIC_GUEST_URL: z.string().default("http://localhost:5173"),
  PUBLIC_SHOP_URL: z.string().default("http://localhost:5174"),
  API_PUBLIC_URL: z.string().default("http://localhost:4000"),
  AUTO_VERIFY_PARENT: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  RESEND_API_KEY: z.string().optional(),
  // SMTP (e.g. Gmail + App Password). When SMTP_USER and SMTP_PASS are set, real emails are sent this way.
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default("Birthday Wish List <onboarding@resend.dev>"),
});

export type Config = z.infer<typeof schema> & { allowedOrigins: string[] };

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid API configuration (check apps/api/.env):\n${issues}`);
  }
  const c = parsed.data;
  if (c.DB_MODE === "remote" && (!c.TURSO_DATABASE_URL || !c.TURSO_AUTH_TOKEN)) {
    throw new Error("DB_MODE=remote needs TURSO_DATABASE_URL and TURSO_AUTH_TOKEN");
  }
  return {
    ...c,
    allowedOrigins: c.ALLOWED_ORIGINS.split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean),
  };
}
