import { pino } from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // Nunca registrar credenciales, datos de tarjeta ni tokens.
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers['x-order-token']",
      "req.headers.cookie",
      "*.password",
      "*.card",
      "*.cvv",
      "*.approvalCode",
    ],
    censor: "[OCULTO]",
  },
});
