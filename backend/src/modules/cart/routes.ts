import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import { optionalAuth, requireAuth } from "../../middleware/auth.js";
import { addressSchema, email } from "../../lib/validation.js";
import {
  MAX_QTY_PER_LINE,
  buildQuote,
  loadCartLines,
  serializeQuote,
} from "../pricing/pricing.service.js";

export const cartRouter = Router();
cartRouter.use(optionalAuth);

const shippingMethod = z.enum(["PICKUP", "DELIVERY_LOCAL", "NATIONAL"]);

/** Obtiene el carrito y verifica que pertenezca al usuario (si tiene dueño). */
async function getCart(req: Request) {
  const id = z.string().uuid("Carrito inválido").parse(req.params.cartId);
  const cart = await prisma.cart.findUnique({ where: { id } });
  if (!cart) throw notFound("Carrito");
  if (cart.userId && cart.userId !== req.user?.id) throw forbidden("Este carrito pertenece a otra cuenta");
  return cart;
}

async function respondWithCart(cartId: string, req: Request, extra?: {
  couponCode?: string;
  shippingMethod?: "PICKUP" | "DELIVERY_LOCAL" | "NATIONAL";
  address?: z.infer<typeof addressSchema>;
  email?: string;
}) {
  const lines = await loadCartLines(prisma, cartId);
  const quote = await buildQuote(prisma, {
    lines,
    couponCode: extra?.couponCode,
    shippingMethod: extra?.shippingMethod,
    address: extra?.address,
    ctx: { email: extra?.email ?? req.user?.email, userId: req.user?.id },
    strict: false,
  });
  return { cartId, ...serializeQuote(quote) };
}

cartRouter.post("/", async (req, res) => {
  const cart = await prisma.cart.create({ data: { userId: req.user?.id } });
  res.status(201).json(await respondWithCart(cart.id, req));
});

/** Último carrito de la cuenta (para recuperarlo en otro dispositivo). */
cartRouter.get("/mine", requireAuth, async (req, res) => {
  const cart =
    (await prisma.cart.findFirst({ where: { userId: req.user!.id }, orderBy: { updatedAt: "desc" } })) ??
    (await prisma.cart.create({ data: { userId: req.user!.id } }));
  res.json(await respondWithCart(cart.id, req));
});

cartRouter.get("/:cartId", async (req, res) => {
  const cart = await getCart(req);
  const q = z
    .object({ coupon: z.string().max(30).optional(), shipping: shippingMethod.optional() })
    .parse(req.query);
  res.json(await respondWithCart(cart.id, req, { couponCode: q.coupon, shippingMethod: q.shipping }));
});

/** Cotización completa antes del checkout (cupón + envío + dirección). */
cartRouter.post("/:cartId/quote", async (req, res) => {
  const cart = await getCart(req);
  const body = z
    .object({
      couponCode: z.string().max(30).optional(),
      shippingMethod: shippingMethod.optional(),
      address: addressSchema.optional(),
      email: email.optional(),
    })
    .parse(req.body);
  res.json(await respondWithCart(cart.id, req, body));
});

const itemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE),
});

async function checkVariant(variantId: string, quantity: number) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: true },
  });
  if (!variant || !variant.isActive || !variant.product.isActive) throw notFound("Producto");
  if (quantity > MAX_QTY_PER_LINE) {
    throw badRequest("QTY_LIMIT", `Máximo ${MAX_QTY_PER_LINE} unidades por producto. Para pedidos mayores usa la cotización corporativa.`);
  }
  if (variant.trackStock && variant.stock < quantity) {
    throw badRequest(
      "INSUFFICIENT_STOCK",
      variant.stock > 0 ? `Solo quedan ${variant.stock} unidades de ${variant.product.name}` : `${variant.product.name} está agotado`,
      { available: variant.stock },
    );
  }
}

cartRouter.post("/:cartId/items", async (req, res) => {
  const cart = await getCart(req);
  const body = itemSchema.parse(req.body);
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId: body.variantId } },
  });
  const quantity = (existing?.quantity ?? 0) + body.quantity;
  await checkVariant(body.variantId, quantity);
  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId: body.variantId } },
    create: { cartId: cart.id, variantId: body.variantId, quantity },
    update: { quantity },
  });
  await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
  res.status(201).json(await respondWithCart(cart.id, req));
});

cartRouter.patch("/:cartId/items/:variantId", async (req, res) => {
  const cart = await getCart(req);
  const variantId = z.string().uuid().parse(req.params.variantId);
  const { quantity } = z.object({ quantity: z.number().int().min(0).max(MAX_QTY_PER_LINE) }).parse(req.body);
  if (quantity === 0) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
  } else {
    await checkVariant(variantId, quantity);
    const updated = await prisma.cartItem.updateMany({ where: { cartId: cart.id, variantId }, data: { quantity } });
    if (!updated.count) throw notFound("Producto en el carrito");
  }
  res.json(await respondWithCart(cart.id, req));
});

cartRouter.delete("/:cartId/items/:variantId", async (req, res) => {
  const cart = await getCart(req);
  const variantId = z.string().uuid().parse(req.params.variantId);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
  res.json(await respondWithCart(cart.id, req));
});

cartRouter.delete("/:cartId/items", async (req, res) => {
  const cart = await getCart(req);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  res.json(await respondWithCart(cart.id, req));
});

/** Asocia un carrito de invitado a la cuenta después de iniciar sesión. */
cartRouter.post("/:cartId/claim", requireAuth, async (req, res) => {
  const cart = await getCart(req);
  await prisma.cart.update({ where: { id: cart.id }, data: { userId: req.user!.id } });
  res.json(await respondWithCart(cart.id, req));
});
