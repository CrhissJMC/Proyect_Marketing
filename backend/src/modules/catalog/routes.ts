import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { notFound } from "../../lib/errors.js";
import { pagination } from "../../lib/validation.js";
import { serializeProduct } from "./serializers.js";

export const catalogRouter = Router();

catalogRouter.get("/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: [{ line: "asc" }, { sortOrder: "asc" }],
    include: { _count: { select: { products: { where: { isActive: true } } } } },
  });
  res.json({
    categories: categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description,
      line: c.line,
      productCount: c._count.products,
    })),
  });
});

const listQuery = pagination.extend({
  line: z.enum(["CAFETERIA", "EMPACADO"]).optional(),
  category: z.string().optional(),
  q: z.string().trim().max(60).optional(),
  featured: z.enum(["true", "false"]).optional(),
  sort: z.enum(["featured", "name", "price_asc", "price_desc", "newest"]).default("featured"),
});

async function ratingsFor(productIds: string[]) {
  const groups = await prisma.review.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds }, isPublished: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(
    groups.map((g) => [
      g.productId,
      { average: g._avg.rating ? Math.round(g._avg.rating * 10) / 10 : null, count: g._count._all },
    ]),
  );
}

catalogRouter.get("/products", async (req, res) => {
  const q = listQuery.parse(req.query);
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    line: q.line,
    category: q.category ? { slug: q.category } : undefined,
    isFeatured: q.featured ? q.featured === "true" : undefined,
    OR: q.q
      ? [
          { name: { contains: q.q, mode: "insensitive" } },
          { shortDescription: { contains: q.q, mode: "insensitive" } },
          { tags: { has: q.q.toLowerCase() } },
        ]
      : undefined,
  };
  const products = await prisma.product.findMany({
    where,
    include: { category: true, variants: true },
    orderBy:
      q.sort === "name"
        ? { name: "asc" }
        : q.sort === "newest"
          ? { createdAt: "desc" }
          : [{ isFeatured: "desc" }, { name: "asc" }],
  });

  let serialized = products.map((p) => serializeProduct(p));
  // El orden por precio se hace en memoria porque el precio vive en las variantes.
  if (q.sort === "price_asc") serialized.sort((a, b) => (a.priceFrom ?? 0) - (b.priceFrom ?? 0));
  if (q.sort === "price_desc") serialized.sort((a, b) => (b.priceFrom ?? 0) - (a.priceFrom ?? 0));

  const total = serialized.length;
  serialized = serialized.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
  const ratings = await ratingsFor(serialized.map((p) => p.id));
  res.json({
    products: serialized.map((p) => ({ ...p, rating: ratings.get(p.id) ?? { average: null, count: 0 } })),
    pagination: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) },
  });
});

catalogRouter.get("/products/:slug", async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { slug: req.params.slug },
    include: { category: true, variants: true },
  });
  if (!product || !product.isActive) throw notFound("Producto");
  const ratings = await ratingsFor([product.id]);
  const related = await prisma.product.findMany({
    where: { categoryId: product.categoryId, isActive: true, id: { not: product.id } },
    include: { variants: true },
    take: 4,
  });
  res.json({
    product: serializeProduct(product, ratings.get(product.id) ?? { average: null, count: 0 }),
    related: related.map((p) => serializeProduct(p)),
  });
});

catalogRouter.get("/products/:slug/reviews", async (req, res) => {
  const q = pagination.parse(req.query);
  const product = await prisma.product.findUnique({ where: { slug: req.params.slug } });
  if (!product) throw notFound("Producto");
  const where = { productId: product.id, isPublished: true };
  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.review.count({ where }),
  ]);
  res.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      rating: r.rating,
      comment: r.comment,
      verifiedPurchase: true,
      createdAt: r.createdAt,
    })),
    pagination: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) },
  });
});
