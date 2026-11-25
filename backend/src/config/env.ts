import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("12h"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  /// Minutos que un pedido con pago en línea espera antes de cancelarse.
  PAYMENT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  /// Si es "true", solo se aceptan pedidos locales dentro del horario de atención.
  ENFORCE_STORE_HOURS: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  TRUST_PROXY: z.coerce.number().int().default(1),
});

export const env = schema.parse(process.env);

export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
