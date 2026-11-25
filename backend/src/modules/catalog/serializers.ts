import type { Category, Product, ProductVariant } from "@prisma/client";
import { toSoles } from "../../lib/money.js";

export type ProductWithRelations = Product & {
  category?: Category;
  variants: ProductVariant[];
};

export function availability(v: ProductVariant) {
  if (!v.isActive) return { available: false, stock: 0, label: "No disponible" };
  if (!v.trackStock) return { available: true, stock: null, label: "Preparado al momento" };
  if (v.stock <= 0) return { available: false, stock: 0, label: "Agotado" };
  if (v.stock <= v.lowStockThreshold) return { available: true, stock: v.stock, label: `¡Quedan ${v.stock}!` };
  return { available: true, stock: v.stock, label: "Disponible" };
}

export function serializeVariant(v: ProductVariant) {
  const a = availability(v);
  return {
    id: v.id,
    sku: v.sku,
    name: v.name,
    price: toSoles(v.priceCents),
    priceCents: v.priceCents,
    available: a.available,
    stock: a.stock,
    availabilityLabel: a.label,
  };
}

export function serializeProduct(
  p: ProductWithRelations,
  rating?: { average: number | null; count: number },
) {
  const variants = p.variants
    .filter((v) => v.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(serializeVariant);
  const prices = variants.map((v) => v.priceCents);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription,
    description: p.description,
    line: p.line,
    perishable: p.perishable,
    imageUrl: p.imageUrl,
    tags: p.tags,
    attributes: p.attributes,
    isFeatured: p.isFeatured,
    category: p.category ? { slug: p.category.slug, name: p.category.name } : undefined,
    priceFrom: prices.length ? toSoles(Math.min(...prices)) : null,
    available: variants.some((v) => v.available),
    variants,
    rating: rating ?? undefined,
  };
}
