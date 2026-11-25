import { Router } from "express";
import { z } from "zod";
import { OrderStatus, MovementType, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { requireRole } from "../../middleware/auth.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { pagination } from "../../lib/validation.js";
import { toSoles } from "../../lib/money.js";
import { audit } from "../../lib/audit.js";
import { addDays } from "../../lib/time.js";
import {
  STATUS_LABELS,
  getOrderById,
  refundPayments,
  serializeOrder,
  transitionOrder,
} from "../orders/orders.service.js";
import { adjustStock, releaseStock, resetDailyStock } from "../inventory/inventory.service.js";
import { serializeProduct } from "../catalog/serializers.js";
import { serializeReturn } from "../postsale/routes.js";
import { serializeComplaint } from "../complaints/routes.js";
import { serializeQuote } from "../b2b/routes.js";

export const adminRouter = Router();
const staff = requireRole("STAFF", "ADMIN");
const admin = requireRole("ADMIN");

const page = (q: { page: number; pageSize: number }) => ({ skip: (q.page - 1) * q.pageSize, take: q.pageSize });
const pageInfo = (q: { page: number; pageSize: number }, total: number) => ({
  page: q.page,
  pageSize: q.pageSize,
  total,
  totalPages: Math.ceil(total / q.pageSize),
});

// ─────────────────────────────── Dashboard ───────────────────────────────

adminRouter.get("/dashboard", staff, async (req, res) => {
  const q = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() }).parse(req.query);
  const to = q.to ?? new Date();
  const from = q.from ?? addDays(to, -30);
  const range = { gte: from, lte: to };
  const paidWhere: Prisma.OrderWhereInput = { createdAt: range, paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED"] } };

  const [byStatus, paidAgg, carts, byLine, topProducts, byShipping, byPayment, bySource, redemptions, lowStock, openReturns, openComplaints, newQuotes] =
    await Promise.all([
      prisma.order.groupBy({ by: ["status"], where: { createdAt: range }, _count: { _all: true } }),
      prisma.order.aggregate({ where: paidWhere, _sum: { totalCents: true, refundedCents: true, discountCents: true }, _count: { _all: true } }),
      prisma.cart.count({ where: { createdAt: range } }),
      prisma.orderItem.groupBy({ by: ["line"], where: { order: paidWhere }, _sum: { lineTotalCents: true, quantity: true } }),
      prisma.orderItem.groupBy({
        by: ["productName"],
        where: { order: paidWhere },
        _sum: { quantity: true, lineTotalCents: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      prisma.order.groupBy({ by: ["shippingMethod"], where: paidWhere, _count: { _all: true }, _sum: { totalCents: true } }),
      prisma.order.groupBy({ by: ["paymentMethod"], where: paidWhere, _count: { _all: true }, _sum: { totalCents: true } }),
      prisma.order.groupBy({ by: ["source"], where: { createdAt: range }, _count: { _all: true } }),
      prisma.couponRedemption.findMany({
        where: { createdAt: range, order: { status: { not: "CANCELLED" } } },
        include: { coupon: { select: { code: true, channel: true } } },
      }),
      prisma.productVariant.findMany({
        where: { trackStock: true, isActive: true },
        select: { stock: true, lowStockThreshold: true },
      }),
      prisma.returnRequest.count({ where: { status: "OPEN" } }),
      prisma.complaint.count({ where: { status: { not: "ANSWERED" } } }),
      prisma.corporateQuote.count({ where: { status: "NEW" } }),
    ]);

  const paidOrders = paidAgg._count._all;
  const gross = paidAgg._sum.totalCents ?? 0;
  const refunded = paidAgg._sum.refundedCents ?? 0;
  const ordersCreated = byStatus.reduce((s, g) => s + g._count._all, 0);
  const couponStats = new Map<string, { code: string; channel: string; uses: number; discount: number }>();
  for (const r of redemptions) {
    const s = couponStats.get(r.coupon.code) ?? { code: r.coupon.code, channel: r.coupon.channel, uses: 0, discount: 0 };
    s.uses++;
    s.discount += r.discountCents;
    couponStats.set(r.coupon.code, s);
  }

  res.json({
    range: { from, to },
    sales: {
      paidOrders,
      grossRevenue: toSoles(gross),
      refunded: toSoles(refunded),
      netRevenue: toSoles(gross - refunded),
      discounts: toSoles(paidAgg._sum.discountCents ?? 0),
      averageTicket: paidOrders ? toSoles(Math.round(gross / paidOrders)) : 0,
    },
    funnel: {
      cartsCreated: carts,
      ordersCreated,
      ordersPaid: paidOrders,
      cartToOrderRate: carts ? Math.round((ordersCreated / carts) * 1000) / 10 : null,
      orderToPaidRate: ordersCreated ? Math.round((paidOrders / ordersCreated) * 1000) / 10 : null,
    },
    ordersByStatus: byStatus.map((g) => ({ status: g.status, label: STATUS_LABELS[g.status], count: g._count._all })),
    salesByLine: byLine.map((g) => ({ line: g.line, units: g._sum.quantity ?? 0, revenue: toSoles(g._sum.lineTotalCents ?? 0) })),
    topProducts: topProducts.map((g) => ({ product: g.productName, units: g._sum.quantity ?? 0, revenue: toSoles(g._sum.lineTotalCents ?? 0) })),
    byShippingMethod: byShipping.map((g) => ({ method: g.shippingMethod, orders: g._count._all, revenue: toSoles(g._sum.totalCents ?? 0) })),
    byPaymentMethod: byPayment.map((g) => ({ method: g.paymentMethod, orders: g._count._all, revenue: toSoles(g._sum.totalCents ?? 0) })),
    // Atribución: conecta las ventas con las estrategias del plan de marketing.
    attribution: {
      bySource: bySource.map((g) => ({ source: g.source ?? "SIN_DATO", orders: g._count._all })),
      byCoupon: [...couponStats.values()].map((s) => ({ ...s, discount: toSoles(s.discount) })),
    },
    alerts: {
      lowStockVariants: lowStock.filter((v) => v.stock <= v.lowStockThreshold).length,
      openReturns,
      pendingComplaints: openComplaints,
      newCorporateQuotes: newQuotes,
    },
  });
});

// ─────────────────────────────── Pedidos ───────────────────────────────

adminRouter.get("/orders", staff, async (req, res) => {
  const q = pagination
    .extend({
      status: z.string().optional(),
      shippingMethod: z.enum(["PICKUP", "DELIVERY_LOCAL", "NATIONAL"]).optional(),
      q: z.string().trim().max(60).optional(),
    })
    .parse(req.query);
  const statuses = q.status
    ? z.array(z.nativeEnum(OrderStatus)).parse(q.status.split(",").filter(Boolean))
    : undefined;
  const where: Prisma.OrderWhereInput = {
    status: statuses?.length ? { in: statuses } : undefined,
    shippingMethod: q.shippingMethod,
    OR: q.q
      ? [
          { code: { contains: q.q, mode: "insensitive" } },
          { customerName: { contains: q.q, mode: "insensitive" } },
          { customerEmail: { contains: q.q, mode: "insensitive" } },
        ]
      : undefined,
  };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, ...page(q), include: { items: true } }),
    prisma.order.count({ where }),
  ]);
  res.json({
    orders: orders.map((o) => ({
      code: o.code,
      status: o.status,
      statusLabel: STATUS_LABELS[o.status],
      customerName: o.customerName,
      shippingMethod: o.shippingMethod,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      total: toSoles(o.totalCents),
      items: o.items.map((i) => `${i.quantity}× ${i.productName} (${i.variantName})`),
      createdAt: o.createdAt,
    })),
    pagination: pageInfo(q, total),
  });
});

adminRouter.get("/orders/:code", staff, async (req, res) => {
  const order = await prisma.order.findUnique({ where: { code: String(req.params.code) } });
  if (!order) throw notFound("Pedido");
  const full = await getOrderById(order.id);
  const returns = await prisma.returnRequest.findMany({ where: { orderId: order.id } });
  res.json({ order: serializeOrder(full), returns: returns.map(serializeReturn) });
});

adminRouter.patch("/orders/:code/status", staff, async (req, res) => {
  const d = z
    .object({
      status: z.enum(["CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "SHIPPED", "DELIVERED"]),
      note: z.string().trim().max(200).optional(),
      carrier: z.string().trim().max(60).optional(),
      trackingNumber: z.string().trim().max(60).optional(),
    })
    .parse(req.body);
  const order = await prisma.order.findUnique({ where: { code: String(req.params.code) } });
  if (!order) throw notFound("Pedido");
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
    await transitionOrder(tx, fresh, d.status, { ...d, actorId: req.user!.id });
  });
  await audit(prisma, req, "order.status", "Order", order.id, { to: d.status });
  res.json({ order: serializeOrder(await getOrderById(order.id)) });
});

// ─────────────────────────────── Catálogo ───────────────────────────────

const variantInput = z.object({
  sku: z.string().trim().min(3).max(40).toUpperCase(),
  name: z.string().trim().min(1).max(60),
  price: z.number().positive().max(10000),
  trackStock: z.boolean().default(true),
  stock: z.number().int().min(0).default(0),
  dailyStock: z.number().int().min(0).nullable().optional(),
  lowStockThreshold: z.number().int().min(0).default(5),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const productInput = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  name: z.string().trim().min(2).max(100),
  shortDescription: z.string().trim().min(5).max(160),
  description: z.string().trim().min(10).max(2000),
  line: z.enum(["CAFETERIA", "EMPACADO"]),
  categorySlug: z.string(),
  imageUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string().trim().toLowerCase()).default([]),
  attributes: z.record(z.unknown()).nullable().optional(),
  perishable: z.boolean(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

adminRouter.get("/products", staff, async (req, res) => {
  const q = z.object({ includeInactive: z.enum(["true", "false"]).default("true") }).parse(req.query);
  const products = await prisma.product.findMany({
    where: q.includeInactive === "true" ? {} : { isActive: true },
    include: { category: true, variants: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ line: "asc" }, { name: "asc" }],
  });
  res.json({
    products: products.map((p) => ({
      ...serializeProduct(p),
      isActive: p.isActive,
      variants: p.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        name: v.name,
        price: toSoles(v.priceCents),
        trackStock: v.trackStock,
        stock: v.stock,
        dailyStock: v.dailyStock,
        lowStockThreshold: v.lowStockThreshold,
        isActive: v.isActive,
      })),
    })),
  });
});

adminRouter.post("/products", admin, async (req, res) => {
  const d = productInput.extend({ variants: z.array(variantInput).min(1) }).parse(req.body);
  const category = await prisma.category.findUnique({ where: { slug: d.categorySlug } });
  if (!category) throw notFound("Categoría");
  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        slug: d.slug,
        name: d.name,
        shortDescription: d.shortDescription,
        description: d.description,
        line: d.line,
        categoryId: category.id,
        imageUrl: d.imageUrl,
        tags: d.tags,
        attributes: (d.attributes ?? undefined) as Prisma.InputJsonValue | undefined,
        perishable: d.perishable,
        isActive: d.isActive,
        isFeatured: d.isFeatured,
      },
    });
    for (const v of d.variants) {
      const { price, ...rest } = v;
      const variant = await tx.productVariant.create({ data: { ...rest, priceCents: Math.round(price * 100), productId: created.id } });
      if (variant.trackStock && variant.stock > 0) {
        await tx.inventoryMovement.create({
          data: { variantId: variant.id, type: "INITIAL", quantity: variant.stock, stockAfter: variant.stock, reason: "Stock inicial", userId: req.user!.id },
        });
      }
    }
    return created;
  });
  await audit(prisma, req, "product.create", "Product", product.id);
  res.status(201).json({ id: product.id, slug: product.slug });
});

adminRouter.patch("/products/:id", admin, async (req, res) => {
  const d = productInput.partial().parse(req.body);
  const { categorySlug, attributes, ...rest } = d;
  let categoryId: string | undefined;
  if (categorySlug) {
    const category = await prisma.category.findUnique({ where: { slug: categorySlug } });
    if (!category) throw notFound("Categoría");
    categoryId = category.id;
  }
  const product = await prisma.product.update({
    where: { id: String(req.params.id) },
    data: { ...rest, categoryId, attributes: attributes === undefined ? undefined : (attributes as Prisma.InputJsonValue) },
  });
  await audit(prisma, req, "product.update", "Product", product.id, d as Prisma.InputJsonValue);
  res.json({ id: product.id, slug: product.slug });
});

adminRouter.post("/products/:id/variants", admin, async (req, res) => {
  const { price, ...rest } = variantInput.parse(req.body);
  const variant = await prisma.productVariant.create({
    data: { ...rest, priceCents: Math.round(price * 100), productId: String(req.params.id) },
  });
  await audit(prisma, req, "variant.create", "ProductVariant", variant.id);
  res.status(201).json({ id: variant.id, sku: variant.sku });
});

adminRouter.patch("/variants/:id", admin, async (req, res) => {
  // El stock se modifica solo con /stock para dejar trazabilidad.
  const { price, ...rest } = variantInput.omit({ stock: true, sku: true }).partial().parse(req.body);
  const variant = await prisma.productVariant.update({
    where: { id: String(req.params.id) },
    data: { ...rest, priceCents: price != null ? Math.round(price * 100) : undefined },
  });
  await audit(prisma, req, "variant.update", "ProductVariant", variant.id, { price, ...rest } as Prisma.InputJsonValue);
  res.json({ id: variant.id, price: toSoles(variant.priceCents) });
});

// ─────────────────────────────── Inventario ───────────────────────────────

adminRouter.post("/variants/:id/stock", staff, async (req, res) => {
  const d = z
    .object({
      type: z.enum(["RESTOCK", "ADJUSTMENT"]),
      delta: z.number().int().optional(),
      setTo: z.number().int().min(0).optional(),
      reason: z.string().trim().min(3).max(200),
    })
    .refine((v) => (v.delta != null) !== (v.setTo != null), { message: "Envía delta o setTo (solo uno)" })
    .parse(req.body);
  const variant = await prisma.$transaction((tx) => adjustStock(tx, String(req.params.id), d, req.user!.id));
  await audit(prisma, req, "stock.adjust", "ProductVariant", variant.id, d);
  res.json({ id: variant.id, sku: variant.sku, stock: variant.stock });
});

adminRouter.get("/inventory/low-stock", staff, async (_req, res) => {
  const variants = await prisma.productVariant.findMany({
    where: { trackStock: true, isActive: true },
    include: { product: { select: { name: true, line: true } } },
    orderBy: { stock: "asc" },
  });
  res.json({
    variants: variants
      .filter((v) => v.stock <= v.lowStockThreshold)
      .map((v) => ({ id: v.id, sku: v.sku, product: v.product.name, variant: v.name, stock: v.stock, threshold: v.lowStockThreshold, dailyStock: v.dailyStock })),
  });
});

adminRouter.get("/inventory/movements", staff, async (req, res) => {
  const q = pagination
    .extend({ variantId: z.string().uuid().optional(), type: z.nativeEnum(MovementType).optional() })
    .parse(req.query);
  const where: Prisma.InventoryMovementWhereInput = { variantId: q.variantId, type: q.type };
  const [movements, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...page(q),
      include: { variant: { select: { sku: true, name: true, product: { select: { name: true } } } }, order: { select: { code: true } } },
    }),
    prisma.inventoryMovement.count({ where }),
  ]);
  res.json({
    movements: movements.map((m) => ({
      id: m.id,
      sku: m.variant.sku,
      product: `${m.variant.product.name} (${m.variant.name})`,
      type: m.type,
      quantity: m.quantity,
      stockAfter: m.stockAfter,
      reason: m.reason,
      orderCode: m.order?.code,
      createdAt: m.createdAt,
    })),
    pagination: pageInfo(q, total),
  });
});

adminRouter.post("/inventory/daily-reset", staff, async (req, res) => {
  const count = await resetDailyStock(prisma, req.user!.id);
  await audit(prisma, req, "stock.daily_reset", "ProductVariant", undefined, { count });
  res.json({ resetVariants: count });
});

// ─────────────────────────────── Cupones ───────────────────────────────

const couponInput = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,20}$/),
  description: z.string().trim().min(5).max(200),
  type: z.enum(["PERCENT", "FIXED", "BUY_X_GET_Y", "FREE_ITEM"]),
  value: z.number().int().min(0).default(0),
  buyQty: z.number().int().min(1).nullable().optional(),
  getQty: z.number().int().min(1).nullable().optional(),
  productSlug: z.string().nullable().optional(),
  minSubtotal: z.number().nonnegative().nullable().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  hourFrom: z.number().int().min(0).max(23).nullable().optional(),
  hourTo: z.number().int().min(1).max(24).nullable().optional(),
  maxUses: z.number().int().min(1).nullable().optional(),
  perCustomerLimit: z.number().int().min(1).nullable().optional(),
  requiresLogin: z.boolean().default(false),
  channel: z.string().trim().min(2).max(30),
  isActive: z.boolean().default(true),
});

async function couponData(d: Partial<z.infer<typeof couponInput>>) {
  const { productSlug, minSubtotal, ...rest } = d;
  let productId: string | null | undefined = undefined;
  if (productSlug !== undefined) {
    if (productSlug === null) productId = null;
    else {
      const p = await prisma.product.findUnique({ where: { slug: productSlug } });
      if (!p) throw notFound("Producto");
      productId = p.id;
    }
  }
  if (rest.type === "PERCENT" && rest.value != null && rest.value > 100) {
    throw badRequest("INVALID_PERCENT", "El porcentaje no puede superar 100");
  }
  return {
    ...rest,
    productId,
    minSubtotalCents: minSubtotal === undefined ? undefined : minSubtotal === null ? null : Math.round(minSubtotal * 100),
  };
}

adminRouter.get("/coupons", staff, async (_req, res) => {
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "asc" },
    include: { product: { select: { slug: true, name: true } }, _count: { select: { redemptions: true } } },
  });
  res.json({ coupons });
});

adminRouter.post("/coupons", admin, async (req, res) => {
  const d = couponInput.parse(req.body);
  const coupon = await prisma.coupon.create({ data: (await couponData(d)) as Prisma.CouponUncheckedCreateInput });
  await audit(prisma, req, "coupon.create", "Coupon", coupon.id);
  res.status(201).json({ coupon });
});

adminRouter.patch("/coupons/:id", admin, async (req, res) => {
  const d = couponInput.partial().parse(req.body);
  const coupon = await prisma.coupon.update({ where: { id: String(req.params.id) }, data: await couponData(d) });
  await audit(prisma, req, "coupon.update", "Coupon", coupon.id);
  res.json({ coupon });
});

// ─────────────────────────────── Posventa ───────────────────────────────

adminRouter.get("/returns", staff, async (req, res) => {
  const q = pagination.extend({ status: z.enum(["OPEN", "APPROVED", "REJECTED", "COMPLETED"]).optional() }).parse(req.query);
  const where = { status: q.status };
  const [returns, total] = await Promise.all([
    prisma.returnRequest.findMany({ where, orderBy: { createdAt: "desc" }, ...page(q), include: { order: { select: { code: true, customerName: true } } } }),
    prisma.returnRequest.count({ where }),
  ]);
  res.json({
    returns: returns.map((r) => ({ ...serializeReturn(r), orderCode: r.order.code, customerName: r.order.customerName })),
    pagination: pageInfo(q, total),
  });
});

adminRouter.patch("/returns/:code", staff, async (req, res) => {
  const d = z
    .object({
      status: z.enum(["APPROVED", "REJECTED", "COMPLETED"]),
      resolution: z.string().trim().min(5).max(500),
      refundAmount: z.number().nonnegative().optional(),
      restock: z.boolean().default(true),
    })
    .parse(req.body);
  const ret = await prisma.returnRequest.findUnique({ where: { code: String(req.params.code) }, include: { order: { include: { items: true } } } });
  if (!ret) throw notFound("Solicitud");
  if (ret.status === "REJECTED" || ret.status === "COMPLETED") throw badRequest("ALREADY_CLOSED", "La solicitud ya está cerrada");

  const updated = await prisma.$transaction(async (tx) => {
    let refundCents = ret.refundCents;
    if (d.status === "APPROVED" && ret.status === "OPEN") {
      const items = ret.items as { orderItemId: string; quantity: number }[];
      if (ret.type === "REFUND") {
        const itemsValue = items.reduce((s, it) => {
          const oi = ret.order.items.find((i) => i.id === it.orderItemId);
          return s + (oi ? oi.unitPriceCents * it.quantity : 0);
        }, 0);
        const requested = d.refundAmount != null ? Math.round(d.refundAmount * 100) : itemsValue;
        const order = await tx.order.findUniqueOrThrow({ where: { id: ret.orderId } });
        refundCents = await refundPayments(tx, order, Math.min(requested, order.totalCents - order.refundedCents));
      }
      // Solo vuelve al inventario el producto empacado y cerrado.
      const restockable = items.filter((it) => {
        const oi = ret.order.items.find((i) => i.id === it.orderItemId);
        return oi && !oi.perishable;
      });
      if (d.restock && ret.productSealed && restockable.length) {
        await releaseStock(tx, ret.orderId, "RETURN", `Devolución ${ret.code}`, restockable, req.user!.id);
      }
    }
    return tx.returnRequest.update({
      where: { id: ret.id },
      data: { status: d.status, resolution: d.resolution, refundCents, resolvedAt: d.status === "APPROVED" ? undefined : new Date() },
    });
  });
  await audit(prisma, req, "return.resolve", "ReturnRequest", ret.id, { status: d.status });
  res.json({ return: serializeReturn(updated) });
});

adminRouter.get("/reviews", staff, async (req, res) => {
  const q = pagination.parse(req.query);
  const [reviews, total] = await Promise.all([
    prisma.review.findMany({ orderBy: { createdAt: "desc" }, ...page(q), include: { product: { select: { name: true } }, order: { select: { code: true } } } }),
    prisma.review.count(),
  ]);
  res.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      product: r.product.name,
      orderCode: r.order.code,
      authorName: r.authorName,
      rating: r.rating,
      comment: r.comment,
      isPublished: r.isPublished,
      createdAt: r.createdAt,
    })),
    pagination: pageInfo(q, total),
  });
});

adminRouter.patch("/reviews/:id", staff, async (req, res) => {
  const { isPublished } = z.object({ isPublished: z.boolean() }).parse(req.body);
  const review = await prisma.review.update({ where: { id: String(req.params.id) }, data: { isPublished } });
  await audit(prisma, req, "review.moderate", "Review", review.id, { isPublished });
  res.json({ id: review.id, isPublished: review.isPublished });
});

// ─────────────────────────────── Libro de Reclamaciones ───────────────────────────────

adminRouter.get("/complaints", staff, async (req, res) => {
  const q = pagination.extend({ status: z.enum(["RECEIVED", "IN_PROGRESS", "ANSWERED"]).optional() }).parse(req.query);
  const where = { status: q.status };
  const [complaints, total] = await Promise.all([
    prisma.complaint.findMany({ where, orderBy: { dueAt: "asc" }, ...page(q) }),
    prisma.complaint.count({ where }),
  ]);
  const now = new Date();
  res.json({
    complaints: complaints.map((c) => ({ ...serializeComplaint(c), overdue: c.status !== "ANSWERED" && c.dueAt < now })),
    pagination: pageInfo(q, total),
  });
});

adminRouter.patch("/complaints/:code", staff, async (req, res) => {
  const d = z
    .object({ status: z.enum(["IN_PROGRESS", "ANSWERED"]), response: z.string().trim().min(10).max(2000).optional() })
    .refine((v) => v.status !== "ANSWERED" || v.response, { message: "Incluye la respuesta al consumidor", path: ["response"] })
    .parse(req.body);
  const complaint = await prisma.complaint.update({
    where: { code: String(req.params.code) },
    data: { status: d.status, response: d.response, respondedAt: d.status === "ANSWERED" ? new Date() : undefined },
  });
  await audit(prisma, req, "complaint.update", "Complaint", complaint.id, { status: d.status });
  res.json({ complaint: serializeComplaint(complaint) });
});

// ─────────────────────────────── B2B ───────────────────────────────

adminRouter.get("/quotes", staff, async (req, res) => {
  const q = pagination.extend({ status: z.enum(["NEW", "QUOTED", "ACCEPTED", "REJECTED"]).optional() }).parse(req.query);
  const where = { status: q.status };
  const [quotes, total] = await Promise.all([
    prisma.corporateQuote.findMany({ where, orderBy: { createdAt: "desc" }, ...page(q) }),
    prisma.corporateQuote.count({ where }),
  ]);
  res.json({ quotes: quotes.map((x) => ({ ...serializeQuote(x), adminNotes: x.adminNotes })), pagination: pageInfo(q, total) });
});

adminRouter.patch("/quotes/:code", staff, async (req, res) => {
  const d = z
    .object({
      status: z.enum(["QUOTED", "ACCEPTED", "REJECTED"]),
      quotedAmount: z.number().positive().optional(),
      validDays: z.number().int().min(1).max(60).default(15),
      adminNotes: z.string().trim().max(1000).optional(),
    })
    .refine((v) => v.status !== "QUOTED" || v.quotedAmount, { message: "Indica el monto cotizado", path: ["quotedAmount"] })
    .parse(req.body);
  const quote = await prisma.corporateQuote.update({
    where: { code: String(req.params.code) },
    data: {
      status: d.status,
      quotedAmountCents: d.quotedAmount != null ? Math.round(d.quotedAmount * 100) : undefined,
      validUntil: d.status === "QUOTED" ? addDays(new Date(), d.validDays) : undefined,
      adminNotes: d.adminNotes,
    },
  });
  await audit(prisma, req, "quote.update", "CorporateQuote", quote.id, { status: d.status });
  res.json({ quote: serializeQuote(quote) });
});

// ─────────────────────────────── Auditoría ───────────────────────────────

adminRouter.get("/audit-logs", admin, async (req, res) => {
  const q = pagination.extend({ entity: z.string().optional(), action: z.string().optional() }).parse(req.query);
  const where: Prisma.AuditLogWhereInput = { entity: q.entity, action: q.action ? { startsWith: q.action } : undefined };
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, ...page(q), include: { user: { select: { email: true, role: true } } } }),
    prisma.auditLog.count({ where }),
  ]);
  res.json({ logs, pagination: pageInfo(q, total) });
});
