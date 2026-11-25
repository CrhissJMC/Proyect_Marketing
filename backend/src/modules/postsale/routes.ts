import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { optionalAuth } from "../../middleware/auth.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { nextCode } from "../../lib/codes.js";
import { addDays, addHours } from "../../lib/time.js";
import { RETURNS } from "../../config/store.js";
import { toSoles } from "../../lib/money.js";
import { getOrderForRequester } from "../orders/orders.service.js";
import { audit } from "../../lib/audit.js";

/** Rutas anidadas en /api/orders/:code */
export const postsaleRouter = Router({ mergeParams: true });
postsaleRouter.use(optionalAuth);

// ─────────────────────────────── Devoluciones ───────────────────────────────

const returnSchema = z.object({
  type: z.enum(["REPLACEMENT", "REFUND"]),
  reason: z.enum(["MAL_ESTADO", "PRODUCTO_EQUIVOCADO", "INCOMPLETO", "DANADO_EN_ENVIO", "NO_LO_QUIERO", "OTRO"]),
  description: z.string().trim().min(10).max(500),
  productSealed: z.boolean().default(false),
  items: z
    .array(z.object({ orderItemId: z.string().uuid(), quantity: z.number().int().min(1) }))
    .min(1),
});

export function serializeReturn(r: Prisma.ReturnRequestGetPayload<object>) {
  return {
    code: r.code,
    type: r.type,
    reason: r.reason,
    description: r.description,
    items: r.items,
    productSealed: r.productSealed,
    status: r.status,
    resolution: r.resolution,
    refund: toSoles(r.refundCents),
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
  };
}

postsaleRouter.post("/returns", async (req, res) => {
  const order = await getOrderForRequester((req.params as { code: string }).code, req);
  const input = returnSchema.parse(req.body);
  if (order.status !== "DELIVERED" || !order.deliveredAt) {
    throw badRequest("NOT_DELIVERED", "Solo puedes solicitar posventa de pedidos entregados");
  }
  const open = await prisma.returnRequest.findFirst({ where: { orderId: order.id, status: "OPEN" } });
  if (open) throw conflict("RETURN_OPEN", `Ya tienes una solicitud en curso (${open.code})`);

  const now = new Date();
  for (const it of input.items) {
    const item = order.items.find((i) => i.id === it.orderItemId);
    if (!item) throw badRequest("ITEM_NOT_IN_ORDER", "Uno de los productos no pertenece a este pedido");
    if (it.quantity > item.quantity) throw badRequest("QTY_EXCEEDED", `Cantidad mayor a la comprada en ${item.productName}`);
    if (item.perishable) {
      const limit = addHours(order.deliveredAt, RETURNS.perishableWindowHours);
      if (now > limit) {
        throw badRequest("WINDOW_CLOSED", `${item.productName}: los reportes de bebidas y postres se aceptan hasta ${RETURNS.perishableWindowHours} horas después de la entrega`);
      }
      if (input.reason === "NO_LO_QUIERO") {
        throw badRequest("NOT_RETURNABLE", `${item.productName} es perecible: solo se atiende si llegó en mal estado o no corresponde al pedido`);
      }
    } else {
      const limit = addDays(order.deliveredAt, RETURNS.packagedWindowDays);
      if (now > limit) {
        throw badRequest("WINDOW_CLOSED", `${item.productName}: el plazo de devolución es de ${RETURNS.packagedWindowDays} días desde la entrega`);
      }
      if (input.reason === "NO_LO_QUIERO" && !input.productSealed) {
        throw badRequest("MUST_BE_SEALED", "Para devolver un producto por desistimiento, el empaque debe estar cerrado");
      }
    }
  }

  const created = await prisma.$transaction(async (tx) =>
    tx.returnRequest.create({
      data: {
        code: await nextCode(tx, "DV"),
        orderId: order.id,
        userId: req.user?.id,
        type: input.type,
        reason: input.reason,
        description: input.description,
        productSealed: input.productSealed,
        items: input.items,
      },
    }),
  );
  await audit(prisma, req, "return.create", "ReturnRequest", created.id);
  res.status(201).json({
    return: serializeReturn(created),
    message: "Recibimos tu solicitud. Te responderemos por WhatsApp o correo en un máximo de 24 horas.",
  });
});

postsaleRouter.get("/returns", async (req, res) => {
  const order = await getOrderForRequester((req.params as { code: string }).code, req);
  const returns = await prisma.returnRequest.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "desc" } });
  res.json({ returns: returns.map(serializeReturn) });
});

// ─────────────────────────────── Reseñas ───────────────────────────────

const reviewSchema = z.object({
  reviews: z
    .array(
      z.object({
        productSlug: z.string(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(500).optional(),
      }),
    )
    .min(1)
    .max(20),
});

postsaleRouter.post("/reviews", async (req, res) => {
  const order = await getOrderForRequester((req.params as { code: string }).code, req);
  if (order.status !== "DELIVERED") throw badRequest("NOT_DELIVERED", "Podrás opinar cuando recibas tu pedido");
  const input = reviewSchema.parse(req.body);
  const productIds = new Set(order.items.map((i) => i.productId));
  const firstName = order.customerName.split(" ")[0];
  const created = [];
  for (const r of input.reviews) {
    const product = await prisma.product.findUnique({ where: { slug: r.productSlug } });
    if (!product || !productIds.has(product.id)) throw notFound(`Producto ${r.productSlug} en este pedido`);
    const review = await prisma.review.upsert({
      where: { orderId_productId: { orderId: order.id, productId: product.id } },
      create: {
        orderId: order.id,
        productId: product.id,
        userId: order.userId,
        authorName: `${firstName} ${order.customerName.split(" ")[1]?.[0] ?? ""}.`.trim(),
        rating: r.rating,
        comment: r.comment,
      },
      update: { rating: r.rating, comment: r.comment },
    });
    created.push({ productSlug: r.productSlug, rating: review.rating, comment: review.comment });
  }
  res.status(201).json({ reviews: created, message: "¡Gracias por tu opinión!" });
});
