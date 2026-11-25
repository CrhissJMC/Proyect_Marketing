import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { optionalAuth } from "../../middleware/auth.js";
import { AppError, badRequest } from "../../lib/errors.js";
import { randomToken } from "../../lib/codes.js";
import { phonePe } from "../../lib/validation.js";
import { audit } from "../../lib/audit.js";
import { toSoles } from "../../lib/money.js";
import {
  getOrderById,
  getOrderForRequester,
  markPaid,
  nextStepFor,
  serializeOrder,
} from "../orders/orders.service.js";
import { simulateCard, simulateWallet, type SimulationResult } from "./simulator.js";

export const paymentsRouter = Router({ mergeParams: true });
paymentsRouter.use(optionalAuth);

const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Demasiados intentos de pago. Intenta más tarde." } },
});

const paymentSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("CARD"),
    card: z.object({
      number: z.string().trim().min(13).max(23),
      holderName: z.string().trim().min(3).max(60),
      expMonth: z.number().int().min(1).max(12),
      expYear: z.number().int().min(24).max(2100),
      cvv: z.string().trim().min(3).max(4),
    }),
  }),
  z.object({
    method: z.enum(["YAPE", "PLIN"]),
    phone: phonePe,
    approvalCode: z.string().regex(/^\d{6}$/, "El código de aprobación tiene 6 dígitos"),
  }),
]);

/**
 * Paga un pedido con el simulador. Encabezados:
 *  - Idempotency-Key (opcional): evita cobros duplicados si el cliente reintenta.
 *  - X-Order-Token: obligatorio para pedidos de invitado.
 */
paymentsRouter.post("/", paymentLimiter, async (req, res) => {
  const order = await getOrderForRequester(String(req.params.code), req);
  const idempotencyKey = req.header("idempotency-key")?.slice(0, 80);

  if (idempotencyKey) {
    const previous = await prisma.payment.findUnique({ where: { idempotencyKey } });
    if (previous) {
      if (previous.orderId !== order.id) throw badRequest("IDEMPOTENCY_CONFLICT", "Clave de idempotencia ya utilizada");
      const current = await getOrderById(order.id);
      res.status(previous.status === "APPROVED" ? 200 : 402).json({
        replayed: true,
        payment: { status: previous.status, message: previous.failureMessage ?? "Pago aprobado" },
        order: serializeOrder(current),
        nextStep: nextStepFor(current),
      });
      return;
    }
  }

  const input = paymentSchema.parse(req.body);
  if (order.status !== "PENDING_PAYMENT") {
    throw new AppError(409, "ORDER_NOT_PAYABLE", order.paymentStatus === "PAID" ? "Este pedido ya fue pagado" : "Este pedido no admite pagos");
  }
  if (order.expiresAt && order.expiresAt < new Date()) {
    throw new AppError(409, "PAYMENT_WINDOW_EXPIRED", "El plazo de pago venció. El pedido será cancelado.");
  }

  const result: SimulationResult =
    input.method === "CARD"
      ? simulateCard(input.card)
      : simulateWallet({ phone: input.phone, approvalCode: input.approvalCode });

  const payment = await prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
    if (fresh.status !== "PENDING_PAYMENT") throw new AppError(409, "ORDER_NOT_PAYABLE", "Este pedido ya fue procesado");
    const created = await tx.payment.create({
      data: {
        orderId: order.id,
        method: input.method,
        status: result.approved ? "APPROVED" : "DECLINED",
        amountCents: fresh.totalCents,
        providerRef: `SIM-${randomToken(9).toUpperCase()}`,
        cardBrand: result.cardBrand,
        cardLast4: result.cardLast4,
        walletPhoneMasked: result.walletPhoneMasked,
        failureCode: result.approved ? null : result.code,
        failureMessage: result.approved ? null : result.message,
        idempotencyKey,
        processedAt: new Date(),
      },
    });
    if (result.approved) {
      // El cliente puede cambiar de medio de pago en línea antes de pagar.
      const withMethod = await tx.order.update({ where: { id: order.id }, data: { paymentMethod: input.method } });
      await markPaid(
        tx,
        withMethod,
        `Pago aprobado (simulado) por S/ ${toSoles(fresh.totalCents).toFixed(2)} con ${input.method === "CARD" ? `${result.cardBrand} ****${result.cardLast4}` : input.method}`,
        req.user?.id,
      );
    }
    return created;
  });

  await audit(prisma, req, result.approved ? "payment.approved" : "payment.declined", "Payment", payment.id, {
    order: order.code,
    method: input.method,
    code: result.code,
  });

  const current = await getOrderById(order.id);
  res.status(result.approved ? 201 : 402).json({
    payment: {
      id: payment.id,
      status: payment.status,
      code: result.code,
      message: result.message,
      reference: payment.providerRef,
      cardBrand: payment.cardBrand,
      cardLast4: payment.cardLast4,
      walletPhone: payment.walletPhoneMasked,
      simulated: true,
    },
    order: serializeOrder(current),
    nextStep: nextStepFor(current),
  });
});
