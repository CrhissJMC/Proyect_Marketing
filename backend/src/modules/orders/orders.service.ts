import type { Request } from "express";
import type {
  Order,
  OrderItem,
  OrderStatus,
  OrderStatusHistory,
  Payment,
  PaymentMethod,
  Prisma,
  ShippingMethod,
} from "@prisma/client";
import { z } from "zod";
import { prisma, type Tx } from "../../lib/prisma.js";
import { AppError, badRequest, forbidden, notFound } from "../../lib/errors.js";
import { nextCode, nextReceiptNumber, randomToken, sha256 } from "../../lib/codes.js";
import { addressSchema, checkDocument, docType, email, phonePe } from "../../lib/validation.js";
import { ATTRIBUTION_SOURCES, PAYMENT_METHODS, SHIPPING } from "../../config/store.js";
import { env } from "../../config/env.js";
import { addMinutes, limaParts } from "../../lib/time.js";
import { toSoles } from "../../lib/money.js";
import { buildQuote, loadCartLines } from "../pricing/pricing.service.js";
import { releaseStock, reserveStock } from "../inventory/inventory.service.js";
import { STORE } from "../../config/store.js";
import type { AuthUser } from "../../middleware/auth.js";

// ─────────────────────────────── Checkout ───────────────────────────────

export const checkoutSchema = z
  .object({
    cartId: z.string().uuid(),
    customer: z.object({
      fullName: z.string().trim().min(3).max(100),
      email,
      phone: phonePe,
      docType,
      docNumber: z.string().trim(),
    }),
    shippingMethod: z.enum(["PICKUP", "DELIVERY_LOCAL", "NATIONAL"]),
    address: addressSchema.optional(),
    addressId: z.string().uuid().optional(),
    paymentMethod: z.enum(["CARD", "YAPE", "PLIN", "CASH_ON_DELIVERY", "PAY_AT_STORE"]),
    couponCode: z.string().trim().max(30).optional(),
    receiptType: z.enum(["BOLETA", "FACTURA"]).default("BOLETA"),
    businessName: z.string().trim().min(3).max(150).optional(),
    ruc: z.string().trim().optional(),
    notes: z.string().trim().max(300).optional(),
    source: z.enum(ATTRIBUTION_SOURCES).optional(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "Debes aceptar los términos y la política de privacidad" }),
    }),
    marketingConsent: z.boolean().default(false),
  })
  .superRefine((d, ctx) => {
    if (!checkDocument(d.customer.docType, d.customer.docNumber)) {
      ctx.addIssue({ code: "custom", path: ["customer", "docNumber"], message: "Número de documento inválido" });
    }
    if (d.receiptType === "FACTURA") {
      if (!d.ruc || !checkDocument("RUC", d.ruc)) {
        ctx.addIssue({ code: "custom", path: ["ruc"], message: "Para factura ingresa un RUC válido (11 dígitos)" });
      }
      if (!d.businessName) {
        ctx.addIssue({ code: "custom", path: ["businessName"], message: "Para factura ingresa la razón social" });
      }
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

function isStoreOpen(now = new Date()) {
  const { weekday, hour, minute } = limaParts(now);
  const today = STORE.hours.find((h) => h.weekday === weekday);
  if (!today) return false;
  const current = hour * 60 + minute;
  const [oh, om] = today.open.split(":").map(Number);
  const [ch, cm] = today.close.split(":").map(Number);
  return current >= oh * 60 + om && current < ch * 60 + cm;
}

export async function createOrder(input: CheckoutInput, user: AuthUser | undefined, req: Request) {
  const rule = SHIPPING[input.shippingMethod];
  if (!rule.paymentMethods.includes(input.paymentMethod)) {
    throw badRequest(
      "PAYMENT_NOT_ALLOWED",
      `${PAYMENT_METHODS[input.paymentMethod].label} no está disponible para ${rule.label}`,
    );
  }
  if (env.ENFORCE_STORE_HOURS && input.shippingMethod !== "NATIONAL" && !isStoreOpen()) {
    throw badRequest("STORE_CLOSED", "La cafetería está cerrada en este momento. Puedes comprar café empacado con envío nacional.");
  }

  // Dirección: guardada en la cuenta o enviada en el checkout.
  let address: z.infer<typeof addressSchema> | undefined = input.address;
  if (input.addressId) {
    if (!user) throw badRequest("ADDRESS_REQUIRES_LOGIN", "Inicia sesión para usar una dirección guardada");
    const saved = await prisma.address.findFirst({ where: { id: input.addressId, userId: user.id } });
    if (!saved) throw notFound("Dirección");
    address = {
      recipient: saved.recipient,
      phone: saved.phone,
      line1: saved.line1,
      reference: saved.reference ?? undefined,
      district: saved.district,
      province: saved.province,
      department: saved.department,
    };
  }
  if (rule.requiresAddress && !address) throw badRequest("ADDRESS_REQUIRED", "Ingresa la dirección de entrega");
  if (!rule.requiresAddress) address = undefined;

  const cart = await prisma.cart.findUnique({ where: { id: input.cartId } });
  if (!cart) throw notFound("Carrito");
  if (cart.userId && cart.userId !== user?.id) throw forbidden("Este carrito pertenece a otra cuenta");

  const online = PAYMENT_METHODS[input.paymentMethod].online;
  const guestToken = randomToken();

  const order = await prisma.$transaction(
    async (tx) => {
      const lines = await loadCartLines(tx, cart.id);
      const quote = await buildQuote(tx, {
        lines,
        couponCode: input.couponCode,
        shippingMethod: input.shippingMethod,
        address,
        ctx: { email: input.customer.email, userId: user?.id },
        strict: true,
      });

      const code = await nextCode(tx, "APU");
      const created = await tx.order.create({
        data: {
          code,
          userId: user?.id,
          customerName: input.customer.fullName,
          customerEmail: input.customer.email,
          customerPhone: input.customer.phone,
          // Para factura, el comprobante se emite al RUC de la empresa.
          customerDocType: input.receiptType === "FACTURA" ? "RUC" : input.customer.docType,
          customerDocNumber: input.receiptType === "FACTURA" ? input.ruc! : input.customer.docNumber,
          status: online ? "PENDING_PAYMENT" : "CONFIRMED",
          shippingMethod: input.shippingMethod,
          shippingAddress: address ? (address as Prisma.InputJsonValue) : undefined,
          paymentMethod: input.paymentMethod,
          receiptType: input.receiptType,
          businessName: input.receiptType === "FACTURA" ? input.businessName : null,
          subtotalCents: quote.subtotalCents,
          discountCents: quote.discountCents,
          shippingCents: quote.shippingCents,
          totalCents: quote.totalCents,
          couponCode: quote.coupon?.code,
          notes: input.notes,
          source: input.source,
          marketingConsent: input.marketingConsent,
          guestTokenHash: sha256(guestToken),
          expiresAt: online ? addMinutes(new Date(), env.PAYMENT_WINDOW_MINUTES) : null,
          items: {
            create: quote.lines.map((l) => ({
              variantId: l.variantId,
              productId: l.productId,
              productName: l.productName,
              variantName: l.variantName,
              sku: l.sku,
              line: l.line,
              perishable: l.perishable,
              unitPriceCents: l.unitPriceCents,
              quantity: l.quantity,
              lineTotalCents: l.lineTotalCents,
            })),
          },
          history: {
            create: {
              toStatus: online ? "PENDING_PAYMENT" : "CONFIRMED",
              note: online
                ? `Pedido registrado. Pago pendiente (${env.PAYMENT_WINDOW_MINUTES} minutos para completarlo).`
                : `Pedido confirmado. Pago con ${PAYMENT_METHODS[input.paymentMethod].label.toLowerCase()}.`,
              changedById: user?.id,
            },
          },
        },
      });

      await reserveStock(
        tx,
        quote.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, label: `${l.productName} (${l.variantName})` })),
        created.id,
      );

      if (quote.couponId) {
        await tx.coupon.update({ where: { id: quote.couponId }, data: { usedCount: { increment: 1 } } });
        await tx.couponRedemption.create({
          data: {
            couponId: quote.couponId,
            orderId: created.id,
            customerEmail: input.customer.email,
            userId: user?.id,
            discountCents: quote.discountCents,
          },
        });
      }

      if (!online) {
        await tx.payment.create({
          data: {
            orderId: created.id,
            method: input.paymentMethod,
            status: "PENDING",
            amountCents: quote.totalCents,
            providerRef: `OFF-${code}`,
          },
        });
      }

      if (user && input.marketingConsent) {
        await tx.user.update({
          where: { id: user.id },
          data: { marketingConsent: true, marketingConsentAt: new Date() },
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return created;
    },
    { timeout: 15_000 },
  );

  return { order: await getOrderById(order.id), guestToken };
}

// ─────────────────────────────── Estados ───────────────────────────────

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "SHIPPED", "CANCELLED"],
  READY_FOR_PICKUP: ["DELIVERED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

const METHOD_STATUS: Partial<Record<OrderStatus, ShippingMethod>> = {
  READY_FOR_PICKUP: "PICKUP",
  OUT_FOR_DELIVERY: "DELIVERY_LOCAL",
  SHIPPED: "NATIONAL",
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  CONFIRMED: "Confirmado",
  PREPARING: "En preparación",
  READY_FOR_PICKUP: "Listo para recoger",
  OUT_FOR_DELIVERY: "En camino",
  SHIPPED: "Enviado por agencia",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export function allowedNextStatuses(order: Pick<Order, "status" | "shippingMethod">) {
  return NEXT[order.status].filter((s) => !METHOD_STATUS[s] || METHOD_STATUS[s] === order.shippingMethod);
}

/** Marca el pedido como pagado y emite el número de comprobante. */
export async function markPaid(tx: Tx, order: Order, note: string, actorId?: string) {
  const receiptNumber = order.receiptNumber ?? (await nextReceiptNumber(tx, order.receiptType));
  const toStatus = order.status === "PENDING_PAYMENT" ? "CONFIRMED" : order.status;
  const updated = await tx.order.update({
    where: { id: order.id },
    data: { paymentStatus: "PAID", paidAt: new Date(), receiptNumber, status: toStatus, expiresAt: null },
  });
  if (toStatus !== order.status) {
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus, note, changedById: actorId },
    });
  }
  return updated;
}

export async function transitionOrder(
  tx: Tx,
  order: Order,
  to: OrderStatus,
  opts: { note?: string; actorId?: string; carrier?: string; trackingNumber?: string },
) {
  if (to === "CANCELLED") throw badRequest("USE_CANCEL", "Usa la acción de cancelar pedido");
  if (!allowedNextStatuses(order).includes(to)) {
    throw badRequest(
      "INVALID_TRANSITION",
      `No se puede pasar de "${STATUS_LABELS[order.status]}" a "${STATUS_LABELS[to]}"`,
      { allowed: allowedNextStatuses(order) },
    );
  }
  if (to === "PREPARING" && order.paymentStatus !== "PAID" && PAYMENT_METHODS[order.paymentMethod].online) {
    throw badRequest("NOT_PAID", "El pedido aún no tiene un pago aprobado");
  }
  if (to === "SHIPPED" && (!opts.carrier || !opts.trackingNumber)) {
    throw badRequest("TRACKING_REQUIRED", "Indica la agencia y el número de seguimiento");
  }

  let current = order;
  if (to === "DELIVERED" && current.paymentStatus !== "PAID") {
    // Contra entrega o pago en tienda: se registra el cobro al entregar.
    await tx.payment.updateMany({
      where: { orderId: order.id, status: "PENDING" },
      data: { status: "APPROVED", processedAt: new Date() },
    });
    current = await markPaid(tx, current, "Pago registrado al momento de la entrega", opts.actorId);
  }

  const updated = await tx.order.update({
    where: { id: order.id },
    data: {
      status: to,
      deliveredAt: to === "DELIVERED" ? new Date() : undefined,
      carrier: opts.carrier,
      trackingNumber: opts.trackingNumber,
    },
  });
  await tx.orderStatusHistory.create({
    data: {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: to,
      note: opts.note ?? (to === "SHIPPED" ? `Enviado con ${opts.carrier}, guía ${opts.trackingNumber}` : undefined),
      changedById: opts.actorId,
    },
  });
  return updated;
}

/** Simula el reembolso de los pagos aprobados por el mismo medio de pago. */
export async function refundPayments(tx: Tx, order: Order, amountCents: number) {
  let remaining = amountCents;
  const payments = await tx.payment.findMany({
    where: { orderId: order.id, status: "APPROVED" },
    orderBy: { createdAt: "asc" },
  });
  for (const p of payments) {
    if (remaining <= 0) break;
    const refundable = p.amountCents - p.refundedCents;
    const refund = Math.min(refundable, remaining);
    if (refund <= 0) continue;
    await tx.payment.update({
      where: { id: p.id },
      data: {
        refundedCents: { increment: refund },
        status: p.refundedCents + refund >= p.amountCents ? "REFUNDED" : "APPROVED",
      },
    });
    remaining -= refund;
  }
  const refunded = amountCents - remaining;
  if (refunded > 0) {
    const total = order.refundedCents + refunded;
    await tx.order.update({
      where: { id: order.id },
      data: {
        refundedCents: total,
        paymentStatus: total >= order.totalCents ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    });
  }
  return refunded;
}

export async function cancelOrder(
  tx: Tx,
  order: Order,
  reason: string,
  opts: { actorId?: string; byStaff: boolean },
) {
  const customerCancellable: OrderStatus[] = ["PENDING_PAYMENT", "CONFIRMED"];
  if (!NEXT[order.status].includes("CANCELLED")) {
    throw badRequest("NOT_CANCELLABLE", `Un pedido "${STATUS_LABELS[order.status]}" ya no se puede cancelar`);
  }
  if (!opts.byStaff && !customerCancellable.includes(order.status)) {
    throw badRequest(
      "NOT_CANCELLABLE",
      "Tu pedido ya está en preparación. Escríbenos por WhatsApp o inicia una solicitud de posventa.",
    );
  }
  await releaseStock(tx, order.id, "RELEASE", `Cancelación: ${reason}`, undefined, opts.actorId);
  if (order.couponCode) {
    await tx.coupon.updateMany({ where: { code: order.couponCode, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
  }
  await tx.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "CANCELLED" } });
  let refunded = 0;
  if (order.paymentStatus === "PAID") refunded = await refundPayments(tx, order, order.totalCents);
  await tx.order.update({
    where: { id: order.id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason, expiresAt: null },
  });
  await tx.orderStatusHistory.create({
    data: {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: "CANCELLED",
      note: refunded
        ? `${reason}. Reembolso simulado de S/ ${toSoles(refunded).toFixed(2)} al mismo medio de pago.`
        : reason,
      changedById: opts.actorId,
    },
  });
}

/** Cancela los pedidos cuyo plazo de pago venció y libera el stock. */
export async function expireUnpaidOrders() {
  const expired = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", expiresAt: { lt: new Date() } },
    take: 50,
  });
  for (const order of expired) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
      if (fresh.status !== "PENDING_PAYMENT") return;
      await cancelOrder(tx, fresh, "Plazo de pago vencido", { byStaff: true });
    });
  }
  return expired.length;
}

// ─────────────────────────────── Acceso y serialización ───────────────────────────────

const orderInclude = {
  items: true,
  payments: { orderBy: { createdAt: "asc" } },
  history: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderInclude;

export type FullOrder = Order & { items: OrderItem[]; payments: Payment[]; history: OrderStatusHistory[] };

export async function getOrderById(id: string) {
  return prisma.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
}

/** Devuelve el pedido si quien consulta es el dueño, personal de la tienda o tiene el token de invitado. */
export async function getOrderForRequester(code: string, req: Request) {
  const order = await prisma.order.findUnique({ where: { code }, include: orderInclude });
  if (!order) throw notFound("Pedido");
  const user = req.user;
  if (user && (user.role === "ADMIN" || user.role === "STAFF")) return order;
  if (user && order.userId === user.id) return order;
  const token = req.header("x-order-token");
  if (token && order.guestTokenHash && sha256(token) === order.guestTokenHash) return order;
  throw new AppError(404, "NOT_FOUND", "Pedido no encontrado");
}

function serializePayment(p: Payment) {
  return {
    id: p.id,
    method: p.method,
    methodLabel: PAYMENT_METHODS[p.method].label,
    status: p.status,
    amount: toSoles(p.amountCents),
    refunded: toSoles(p.refundedCents),
    reference: p.providerRef,
    cardBrand: p.cardBrand,
    cardLast4: p.cardLast4,
    walletPhone: p.walletPhoneMasked,
    failureCode: p.failureCode,
    failureMessage: p.failureMessage,
    createdAt: p.createdAt,
    processedAt: p.processedAt,
    simulated: true,
  };
}

export function serializeOrder(o: FullOrder) {
  return {
    code: o.code,
    status: o.status,
    statusLabel: STATUS_LABELS[o.status],
    nextStatuses: allowedNextStatuses(o),
    customer: {
      name: o.customerName,
      email: o.customerEmail,
      phone: o.customerPhone,
      docType: o.customerDocType,
      docNumber: o.customerDocNumber,
    },
    shipping: {
      method: o.shippingMethod,
      label: SHIPPING[o.shippingMethod].label,
      estimatedTime: SHIPPING[o.shippingMethod].estimatedTime,
      address: o.shippingAddress,
      carrier: o.carrier,
      trackingNumber: o.trackingNumber,
    },
    payment: {
      method: o.paymentMethod,
      methodLabel: PAYMENT_METHODS[o.paymentMethod].label,
      status: o.paymentStatus,
      expiresAt: o.expiresAt,
      attempts: o.payments.map(serializePayment),
    },
    receipt: {
      type: o.receiptType,
      number: o.receiptNumber,
      businessName: o.businessName,
    },
    items: o.items.map((i) => ({
      id: i.id,
      sku: i.sku,
      productName: i.productName,
      variantName: i.variantName,
      line: i.line,
      perishable: i.perishable,
      unitPrice: toSoles(i.unitPriceCents),
      quantity: i.quantity,
      lineTotal: toSoles(i.lineTotalCents),
    })),
    summary: {
      subtotal: toSoles(o.subtotalCents),
      discount: toSoles(o.discountCents),
      shipping: toSoles(o.shippingCents),
      total: toSoles(o.totalCents),
      refunded: toSoles(o.refundedCents),
      couponCode: o.couponCode,
      currency: "PEN",
    },
    notes: o.notes,
    source: o.source,
    timeline: o.history.map((h) => ({
      status: h.toStatus,
      label: STATUS_LABELS[h.toStatus],
      note: h.note,
      at: h.createdAt,
    })),
    createdAt: o.createdAt,
    paidAt: o.paidAt,
    deliveredAt: o.deliveredAt,
    cancelledAt: o.cancelledAt,
    cancelReason: o.cancelReason,
  };
}

export function nextStepFor(o: Order) {
  if (o.status === "PENDING_PAYMENT") {
    return {
      type: "PAY_ONLINE" as const,
      message: `Completa el pago antes de ${env.PAYMENT_WINDOW_MINUTES} minutos o el pedido se cancelará automáticamente.`,
      expiresAt: o.expiresAt,
      endpoint: `/api/orders/${o.code}/payments`,
    };
  }
  return {
    type: "NONE" as const,
    message:
      o.paymentMethod === "CASH_ON_DELIVERY"
        ? "Pedido confirmado. Paga en efectivo al recibirlo."
        : o.paymentMethod === "PAY_AT_STORE"
          ? "Pedido confirmado. Paga al recogerlo en la tienda."
          : "Pedido confirmado.",
  };
}

export type { PaymentMethod };
