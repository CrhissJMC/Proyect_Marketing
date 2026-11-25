import type { Coupon, ShippingMethod } from "@prisma/client";
import type { Db } from "../../lib/prisma.js";
import { AppError, badRequest } from "../../lib/errors.js";
import { SHIPPING } from "../../config/store.js";
import { limaParts } from "../../lib/time.js";
import { normalize } from "../../lib/validation.js";
import { availability } from "../catalog/serializers.js";
import { toSoles } from "../../lib/money.js";

export const MAX_QTY_PER_LINE = 20;

export interface PricedLine {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantName: string;
  sku: string;
  line: "CAFETERIA" | "EMPACADO";
  perishable: boolean;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  available: boolean;
  availabilityLabel: string;
  /** Stock disponible (null = se prepara al momento). */
  stock: number | null;
  trackStock: boolean;
}

export async function loadCartLines(db: Db, cartId: string): Promise<PricedLine[]> {
  const items = await db.cartItem.findMany({
    where: { cartId },
    include: { variant: { include: { product: true } } },
    orderBy: { addedAt: "asc" },
  });
  return items.map(({ variant, quantity }) => {
    const a = availability(variant);
    const productActive = variant.product.isActive;
    const enoughStock = !variant.trackStock || variant.stock >= quantity;
    return {
      variantId: variant.id,
      productId: variant.productId,
      productSlug: variant.product.slug,
      productName: variant.product.name,
      variantName: variant.name,
      sku: variant.sku,
      line: variant.product.line,
      perishable: variant.product.perishable,
      imageUrl: variant.product.imageUrl,
      unitPriceCents: variant.priceCents,
      quantity,
      lineTotalCents: variant.priceCents * quantity,
      available: productActive && a.available && enoughStock,
      availabilityLabel: !productActive
        ? "No disponible"
        : a.available && !enoughStock
          ? `Solo quedan ${variant.stock}`
          : a.label,
      stock: a.stock,
      trackStock: variant.trackStock,
    };
  });
}

// ─────────────────────────────── Cupones ───────────────────────────────

export interface CouponContext {
  email?: string;
  userId?: string;
  now?: Date;
}

function eligibleUnits(coupon: Coupon, lines: PricedLine[]) {
  const eligible = coupon.productId ? lines.filter((l) => l.productId === coupon.productId) : lines;
  const units: number[] = [];
  for (const l of eligible) for (let i = 0; i < l.quantity; i++) units.push(l.unitPriceCents);
  return { eligible, units };
}

export function couponDiscount(coupon: Coupon, lines: PricedLine[]) {
  const { eligible, units } = eligibleUnits(coupon, lines);
  const eligibleSubtotal = eligible.reduce((s, l) => s + l.lineTotalCents, 0);
  switch (coupon.type) {
    case "PERCENT":
      return Math.floor((eligibleSubtotal * coupon.value) / 100);
    case "FIXED":
      return Math.min(coupon.value, eligibleSubtotal);
    case "BUY_X_GET_Y": {
      const buy = coupon.buyQty ?? 1;
      const get = coupon.getQty ?? 1;
      const freeUnits = Math.floor(units.length / (buy + get)) * get;
      // Se regalan las unidades más baratas.
      return units
        .sort((a, b) => a - b)
        .slice(0, freeUnits)
        .reduce((s, p) => s + p, 0);
    }
    case "FREE_ITEM":
      return units.length ? Math.min(...units) : 0;
  }
}

/** Valida el cupón y devuelve el descuento. Lanza AppError con el motivo si no aplica. */
export async function evaluateCoupon(
  db: Db,
  rawCode: string,
  lines: PricedLine[],
  subtotalCents: number,
  ctx: CouponContext,
) {
  const code = rawCode.trim().toUpperCase();
  const now = ctx.now ?? new Date();
  const coupon = await db.coupon.findUnique({ where: { code }, include: { product: true } });
  const fail = (reason: string) => new AppError(400, "COUPON_INVALID", reason, { code });

  if (!coupon || !coupon.isActive) throw fail("El código no existe o no está vigente");
  if (coupon.startsAt && now < coupon.startsAt) throw fail("La promoción aún no ha comenzado");
  if (coupon.endsAt && now > coupon.endsAt) throw fail("La promoción ya terminó");
  if (coupon.hourFrom != null && coupon.hourTo != null) {
    const { hour } = limaParts(now);
    if (hour < coupon.hourFrom || hour >= coupon.hourTo) {
      throw fail(`Este código solo es válido de ${coupon.hourFrom}:00 a ${coupon.hourTo}:00`);
    }
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    throw fail("La promoción alcanzó su límite de usos");
  }
  if (coupon.minSubtotalCents != null && subtotalCents < coupon.minSubtotalCents) {
    throw fail(`Compra mínima de S/ ${toSoles(coupon.minSubtotalCents).toFixed(2)} para usar este código`);
  }
  if (coupon.requiresLogin && !ctx.userId) throw fail("Inicia sesión para usar este código");
  if (coupon.perCustomerLimit != null && (ctx.email || ctx.userId)) {
    const used = await db.couponRedemption.count({
      where: {
        couponId: coupon.id,
        order: { status: { not: "CANCELLED" } },
        OR: [
          ...(ctx.email ? [{ customerEmail: ctx.email }] : []),
          ...(ctx.userId ? [{ userId: ctx.userId }] : []),
        ],
      },
    });
    if (used >= coupon.perCustomerLimit) throw fail("Ya usaste este código el máximo de veces permitido");
  }

  const discountCents = Math.min(couponDiscount(coupon, lines), subtotalCents);
  if (discountCents <= 0) {
    if (coupon.type === "BUY_X_GET_Y") {
      const need = (coupon.buyQty ?? 1) + (coupon.getQty ?? 1);
      throw fail(`Agrega al menos ${need} unidades de ${coupon.product?.name ?? "los productos de la promoción"}`);
    }
    throw fail(`Agrega ${coupon.product?.name ?? "un producto participante"} para usar este código`);
  }
  return { coupon, discountCents };
}

// ─────────────────────────────── Envío ───────────────────────────────

export interface ShippingAddressInput {
  district: string;
  province?: string;
  department?: string;
}

export function evaluateShipping(
  method: ShippingMethod,
  lines: PricedLine[],
  merchandiseCents: number,
  address?: ShippingAddressInput | null,
) {
  const rule = SHIPPING[method];
  const problems: string[] = [];
  const perishables = lines.filter((l) => l.perishable);
  if (!rule.allowsPerishables && perishables.length) {
    problems.push(
      `${rule.label} no incluye bebidas ni postres: ${[...new Set(perishables.map((l) => l.productName))].join(", ")}`,
    );
  }
  if (merchandiseCents < rule.minSubtotalCents) {
    problems.push(`${rule.label} requiere un pedido mínimo de S/ ${toSoles(rule.minSubtotalCents).toFixed(2)}`);
  }
  if (rule.requiresAddress && address && rule.allowedDistricts.length) {
    const d = normalize(address.district);
    if (!rule.allowedDistricts.some((a) => d.includes(a))) {
      problems.push(`${rule.label} solo cubre: ${rule.allowedDistricts.join(", ")}`);
    }
  }
  const free = rule.freeFromCents != null && merchandiseCents >= rule.freeFromCents;
  return {
    method,
    label: rule.label,
    estimatedTime: rule.estimatedTime,
    costCents: free ? 0 : rule.costCents,
    freeShippingApplied: free && rule.costCents > 0,
    available: problems.length === 0,
    problems,
    paymentMethods: rule.paymentMethods,
  };
}

// ─────────────────────────────── Cotización completa ───────────────────────────────

export interface QuoteInput {
  lines: PricedLine[];
  couponCode?: string | null;
  shippingMethod?: ShippingMethod | null;
  address?: ShippingAddressInput | null;
  ctx: CouponContext;
  /** true = checkout: cualquier problema lanza error. false = carrito: se informa. */
  strict: boolean;
}

export async function buildQuote(db: Db, input: QuoteInput) {
  const { lines, strict } = input;
  const subtotalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
  const unavailable = lines.filter((l) => !l.available);
  if (strict) {
    if (!lines.length) throw badRequest("CART_EMPTY", "Tu carrito está vacío");
    if (unavailable.length) {
      throw new AppError(409, "OUT_OF_STOCK", "Algunos productos ya no están disponibles", {
        items: unavailable.map((l) => ({ sku: l.sku, name: `${l.productName} (${l.variantName})`, reason: l.availabilityLabel })),
      });
    }
  }

  let discountCents = 0;
  let coupon: { code: string; description: string; discount: number } | null = null;
  let couponError: string | null = null;
  let couponId: string | null = null;
  if (input.couponCode) {
    try {
      const r = await evaluateCoupon(db, input.couponCode, lines, subtotalCents, input.ctx);
      discountCents = r.discountCents;
      couponId = r.coupon.id;
      coupon = { code: r.coupon.code, description: r.coupon.description, discount: toSoles(discountCents) };
    } catch (e) {
      if (strict || !(e instanceof AppError)) throw e;
      couponError = e.message;
    }
  }

  const merchandiseCents = subtotalCents - discountCents;
  const shippingOptions = (Object.keys(SHIPPING) as ShippingMethod[]).map((m) =>
    evaluateShipping(m, lines, merchandiseCents, m === input.shippingMethod ? input.address : null),
  );
  const selected = input.shippingMethod
    ? shippingOptions.find((o) => o.method === input.shippingMethod)!
    : null;
  if (strict && selected && !selected.available) {
    throw badRequest("SHIPPING_NOT_AVAILABLE", selected.problems.join(". "));
  }
  const shippingCents = selected?.costCents ?? 0;
  const totalCents = merchandiseCents + shippingCents;

  return {
    lines,
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents,
    couponId,
    summary: {
      itemCount: lines.reduce((s, l) => s + l.quantity, 0),
      subtotal: toSoles(subtotalCents),
      discount: toSoles(discountCents),
      shipping: toSoles(shippingCents),
      total: toSoles(totalCents),
      currency: "PEN",
      taxNote: "Precios con IGV incluido",
    },
    coupon,
    couponError,
    shipping: selected,
    shippingOptions: shippingOptions.map((o) => ({ ...o, cost: toSoles(o.costCents) })),
    warnings: unavailable.map((l) => `${l.productName} (${l.variantName}): ${l.availabilityLabel}`),
  };
}

export function serializeLines(lines: PricedLine[]) {
  return lines.map((l) => ({
    variantId: l.variantId,
    sku: l.sku,
    productSlug: l.productSlug,
    productName: l.productName,
    variantName: l.variantName,
    line: l.line,
    perishable: l.perishable,
    imageUrl: l.imageUrl,
    unitPrice: toSoles(l.unitPriceCents),
    quantity: l.quantity,
    lineTotal: toSoles(l.lineTotalCents),
    available: l.available,
    availabilityLabel: l.availabilityLabel,
  }));
}

export type Quote = Awaited<ReturnType<typeof buildQuote>>;

export function serializeQuote(q: Quote) {
  return {
    items: serializeLines(q.lines),
    summary: q.summary,
    coupon: q.coupon,
    couponError: q.couponError,
    shipping: q.shipping ? { ...q.shipping, cost: toSoles(q.shipping.costCents) } : null,
    shippingOptions: q.shippingOptions,
    warnings: q.warnings,
  };
}
