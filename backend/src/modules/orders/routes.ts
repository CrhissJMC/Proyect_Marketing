import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { optionalAuth } from "../../middleware/auth.js";
import { email } from "../../lib/validation.js";
import { notFound } from "../../lib/errors.js";
import { audit } from "../../lib/audit.js";
import {
  STATUS_LABELS,
  cancelOrder,
  checkoutSchema,
  createOrder,
  getOrderById,
  getOrderForRequester,
  nextStepFor,
  serializeOrder,
} from "./orders.service.js";
import { SHIPPING } from "../../config/store.js";

export const ordersRouter = Router();
ordersRouter.use(optionalAuth);

const checkoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Demasiados pedidos en poco tiempo. Intenta más tarde." } },
});

/** Checkout: convierte el carrito en un pedido. Funciona con o sin cuenta. */
ordersRouter.post("/", checkoutLimiter, async (req, res) => {
  const input = checkoutSchema.parse(req.body);
  const { order, guestToken } = await createOrder(input, req.user, req);
  await audit(prisma, req, "order.create", "Order", order.id, { code: order.code, total: order.totalCents });
  res.status(201).json({
    order: serializeOrder(order),
    // Guárdalo en el navegador: permite al invitado consultar y pagar este pedido.
    orderToken: guestToken,
    nextStep: nextStepFor(order),
  });
});

/** Seguimiento público con código y correo (sin exponer datos personales). */
ordersRouter.get("/track", async (req, res) => {
  const q = z.object({ code: z.string().trim().toUpperCase(), email }).parse(req.query);
  const order = await prisma.order.findFirst({
    where: { code: q.code, customerEmail: q.email },
    include: { history: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) throw notFound("Pedido");
  res.json({
    code: order.code,
    status: order.status,
    statusLabel: STATUS_LABELS[order.status],
    shippingMethod: SHIPPING[order.shippingMethod].label,
    estimatedTime: SHIPPING[order.shippingMethod].estimatedTime,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    timeline: order.history.map((h) => ({ status: h.toStatus, label: STATUS_LABELS[h.toStatus], note: h.note, at: h.createdAt })),
  });
});

ordersRouter.get("/:code", async (req, res) => {
  const order = await getOrderForRequester(req.params.code, req);
  res.json({ order: serializeOrder(order), nextStep: nextStepFor(order) });
});

ordersRouter.post("/:code/cancel", async (req, res) => {
  const order = await getOrderForRequester(req.params.code, req);
  const { reason } = z.object({ reason: z.string().trim().min(3).max(200).default("Cancelado por el cliente") }).parse(req.body ?? {});
  const isStaff = req.user?.role === "ADMIN" || req.user?.role === "STAFF";
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
    await cancelOrder(tx, fresh, reason, { actorId: req.user?.id, byStaff: isStaff });
  });
  await audit(prisma, req, "order.cancel", "Order", order.id, { reason });
  res.json({ order: serializeOrder(await getOrderById(order.id)) });
});
