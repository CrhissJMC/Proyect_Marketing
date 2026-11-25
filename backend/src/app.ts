import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { corsOrigins, env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { authRouter } from "./modules/auth/routes.js";
import { accountRouter } from "./modules/account/routes.js";
import { catalogRouter } from "./modules/catalog/routes.js";
import { cartRouter } from "./modules/cart/routes.js";
import { ordersRouter } from "./modules/orders/routes.js";
import { paymentsRouter } from "./modules/payments/routes.js";
import { postsaleRouter } from "./modules/postsale/routes.js";
import { complaintsRouter } from "./modules/complaints/routes.js";
import { b2bRouter } from "./modules/b2b/routes.js";
import { storeRouter } from "./modules/store/routes.js";
import { adminRouter } from "./modules/admin/routes.js";

export function createApp() {
  const app = express();

  // Detrás del túnel de Cloudflare: confiar en el proxy para obtener la IP real.
  app.set("trust proxy", env.TRUST_PROXY);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => {
        // Sin origen = curl/servidor; *.trycloudflare.com = túnel rápido de Cloudflare.
        if (!origin || corsOrigins.includes(origin) || /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin)) {
          cb(null, true);
        } else {
          cb(null, false);
        }
      },
      allowedHeaders: ["Content-Type", "Authorization", "X-Order-Token", "Idempotency-Key"],
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/api/health" },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
    }),
  );
  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: { code: "TOO_MANY_REQUESTS", message: "Demasiadas solicitudes" } },
    }),
  );

  app.get("/api/health", async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "ok", time: new Date().toISOString() });
  });

  app.use("/api/store", storeRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/me", accountRouter);
  app.use("/api", catalogRouter);
  app.use("/api/cart", cartRouter);
  app.use("/api/orders/:code/payments", paymentsRouter);
  app.use("/api/orders/:code", postsaleRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/complaints", complaintsRouter);
  app.use("/api/corporate-quotes", b2bRouter);
  app.use("/api/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
