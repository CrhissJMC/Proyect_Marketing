import type { MovementType } from "@prisma/client";
import type { Db, Tx } from "../../lib/prisma.js";
import { AppError, notFound } from "../../lib/errors.js";
import { limaParts } from "../../lib/time.js";
import { logger } from "../../lib/logger.js";

/**
 * Descuenta stock de forma atómica: la condición `stock >= cantidad` dentro del UPDATE
 * evita la sobreventa aunque dos clientes compren el último postre al mismo tiempo.
 */
export async function reserveStock(
  tx: Tx,
  items: { variantId: string; quantity: number; label: string }[],
  orderId: string,
) {
  const failed: string[] = [];
  for (const item of items) {
    const variant = await tx.productVariant.findUniqueOrThrow({ where: { id: item.variantId } });
    if (!variant.trackStock) continue;
    const updated = await tx.productVariant.updateMany({
      where: { id: item.variantId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });
    if (!updated.count) {
      failed.push(item.label);
      continue;
    }
    await tx.inventoryMovement.create({
      data: {
        variantId: item.variantId,
        type: "SALE",
        quantity: -item.quantity,
        stockAfter: variant.stock - item.quantity,
        orderId,
        reason: "Venta en tienda virtual",
      },
    });
  }
  if (failed.length) {
    throw new AppError(409, "OUT_OF_STOCK", `Sin stock suficiente: ${failed.join(", ")}`, { items: failed });
  }
}

/** Devuelve al inventario las unidades de un pedido (cancelación o devolución). */
export async function releaseStock(
  tx: Tx,
  orderId: string,
  type: Extract<MovementType, "RELEASE" | "RETURN">,
  reason: string,
  only?: { orderItemId: string; quantity: number }[],
  userId?: string,
) {
  const items = await tx.orderItem.findMany({ where: { orderId }, include: { variant: true } });
  for (const item of items) {
    if (!item.variant.trackStock) continue;
    const qty = only ? (only.find((o) => o.orderItemId === item.id)?.quantity ?? 0) : item.quantity;
    if (qty <= 0) continue;
    const v = await tx.productVariant.update({
      where: { id: item.variantId },
      data: { stock: { increment: qty } },
    });
    await tx.inventoryMovement.create({
      data: { variantId: item.variantId, type, quantity: qty, stockAfter: v.stock, orderId, reason, userId },
    });
  }
}

export async function adjustStock(
  tx: Tx,
  variantId: string,
  input: { delta?: number; setTo?: number; type: Extract<MovementType, "RESTOCK" | "ADJUSTMENT">; reason: string },
  userId?: string,
) {
  const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw notFound("Variante");
  const target = input.setTo ?? variant.stock + (input.delta ?? 0);
  if (target < 0) throw new AppError(400, "NEGATIVE_STOCK", "El stock no puede quedar en negativo");
  const updated = await tx.productVariant.update({ where: { id: variantId }, data: { stock: target } });
  await tx.inventoryMovement.create({
    data: {
      variantId,
      type: input.type,
      quantity: target - variant.stock,
      stockAfter: target,
      reason: input.reason,
      userId,
    },
  });
  return updated;
}

/** Repone a su cantidad diaria los productos con stock diario (postres). */
export async function resetDailyStock(db: Db, userId?: string) {
  const variants = await db.productVariant.findMany({ where: { dailyStock: { not: null } } });
  let count = 0;
  for (const v of variants) {
    if (v.dailyStock == null || v.stock === v.dailyStock) continue;
    await db.productVariant.update({ where: { id: v.id }, data: { stock: v.dailyStock } });
    await db.inventoryMovement.create({
      data: {
        variantId: v.id,
        type: "DAILY_RESET",
        quantity: v.dailyStock - v.stock,
        stockAfter: v.dailyStock,
        reason: "Reposición diaria de producción",
        userId,
      },
    });
    count++;
  }
  return count;
}

/** Ejecuta la reposición diaria una vez por día, a partir de las 6:00 a. m. (hora de Lima). */
export async function dailyResetIfDue(db: Db) {
  const now = new Date();
  const { hour } = limaParts(now);
  if (hour < 6) return;
  const today = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(now).replaceAll("-", ""),
  );
  const last = await db.counter.findUnique({ where: { name: "daily-stock-reset" } });
  if (last?.value === today) return;
  await db.counter.upsert({
    where: { name: "daily-stock-reset" },
    create: { name: "daily-stock-reset", value: today },
    update: { value: today },
  });
  const count = await resetDailyStock(db);
  logger.info({ count }, "Reposición diaria de stock ejecutada");
}
