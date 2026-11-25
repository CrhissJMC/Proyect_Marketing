import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { expireUnpaidOrders } from "./modules/orders/orders.service.js";
import { dailyResetIfDue } from "./modules/inventory/inventory.service.js";

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info(`API de Cafetería APU escuchando en http://localhost:${env.PORT}/api`);
});

/** Tareas periódicas: cancelar pedidos sin pagar y reponer stock diario. */
async function runJobs() {
  try {
    const expired = await expireUnpaidOrders();
    if (expired) logger.info({ expired }, "Pedidos con plazo de pago vencido cancelados");
    await dailyResetIfDue(prisma);
  } catch (err) {
    logger.error({ err }, "Error en tareas programadas");
  }
}
const jobs = setInterval(runJobs, 60_000);
void runJobs();

async function shutdown(signal: string) {
  logger.info(`${signal} recibido, cerrando...`);
  clearInterval(jobs);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
