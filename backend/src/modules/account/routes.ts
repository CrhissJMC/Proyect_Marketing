import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { addressSchema, checkDocument, docType, password, pagination, phonePe } from "../../lib/validation.js";
import { publicUser } from "../auth/routes.js";
import { STATUS_LABELS } from "../orders/orders.service.js";
import { toSoles } from "../../lib/money.js";
import { audit } from "../../lib/audit.js";
import { sha256 } from "../../lib/codes.js";

/** Cuenta del cliente y derechos ARCO (acceso, rectificación, cancelación, oposición). */
export const accountRouter = Router();
accountRouter.use(requireAuth);

const profileSchema = z
  .object({
    fullName: z.string().trim().min(3).max(100).optional(),
    phone: phonePe.optional(),
    docType: docType.optional(),
    docNumber: z.string().trim().optional(),
  })
  .refine((d) => !d.docType || (d.docNumber && checkDocument(d.docType, d.docNumber)), {
    message: "Número de documento inválido",
    path: ["docNumber"],
  });

// Rectificación
accountRouter.patch("/", async (req, res) => {
  const data = profileSchema.parse(req.body);
  const user = await prisma.user.update({ where: { id: req.user!.id }, data });
  res.json({ user: publicUser(user) });
});

accountRouter.post("/password", async (req, res) => {
  const d = z.object({ currentPassword: z.string().min(1), newPassword: password }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!(await bcrypt.compare(d.currentPassword, user.passwordHash))) {
    throw badRequest("WRONG_PASSWORD", "La contraseña actual no es correcta");
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(d.newPassword, 10) } });
  await audit(prisma, req, "user.password_change", "User", user.id);
  res.json({ ok: true });
});

// Oposición / consentimiento de publicidad
accountRouter.patch("/consents", async (req, res) => {
  const { marketingConsent } = z.object({ marketingConsent: z.boolean() }).parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { marketingConsent, marketingConsentAt: marketingConsent ? new Date() : null },
  });
  await audit(prisma, req, marketingConsent ? "consent.granted" : "consent.revoked", "User", user.id);
  res.json({ user: publicUser(user) });
});

// ─────────────────────────────── Direcciones ───────────────────────────────

const addressBody = addressSchema.extend({
  label: z.string().trim().min(2).max(30).default("Casa"),
  isDefault: z.boolean().default(false),
});

accountRouter.get("/addresses", async (req, res) => {
  const addresses = await prisma.address.findMany({
    where: { userId: req.user!.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  res.json({ addresses });
});

accountRouter.post("/addresses", async (req, res) => {
  const d = addressBody.parse(req.body);
  const address = await prisma.$transaction(async (tx) => {
    if (d.isDefault) await tx.address.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
    return tx.address.create({ data: { ...d, userId: req.user!.id } });
  });
  res.status(201).json({ address });
});

accountRouter.patch("/addresses/:id", async (req, res) => {
  const d = addressBody.partial().parse(req.body);
  const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!existing) throw notFound("Dirección");
  const address = await prisma.$transaction(async (tx) => {
    if (d.isDefault) await tx.address.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
    return tx.address.update({ where: { id: existing.id }, data: d });
  });
  res.json({ address });
});

accountRouter.delete("/addresses/:id", async (req, res) => {
  const deleted = await prisma.address.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
  if (!deleted.count) throw notFound("Dirección");
  res.status(204).end();
});

// ─────────────────────────────── Pedidos ───────────────────────────────

accountRouter.get("/orders", async (req, res) => {
  const q = pagination.parse(req.query);
  const where = { userId: req.user!.id };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { items: { select: { productName: true, quantity: true } } },
    }),
    prisma.order.count({ where }),
  ]);
  res.json({
    orders: orders.map((o) => ({
      code: o.code,
      status: o.status,
      statusLabel: STATUS_LABELS[o.status],
      total: toSoles(o.totalCents),
      itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
      preview: o.items.slice(0, 3).map((i) => i.productName),
      shippingMethod: o.shippingMethod,
      createdAt: o.createdAt,
    })),
    pagination: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) },
  });
});

// ─────────────────────────────── Derechos sobre los datos ───────────────────────────────

/** Derecho de acceso: descarga de todos los datos personales de la cuenta. */
accountRouter.get("/data-export", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    include: {
      addresses: true,
      orders: { include: { items: true } },
      reviews: true,
      returns: true,
    },
  });
  const { passwordHash: _omit, ...data } = user;
  await audit(prisma, req, "privacy.export", "User", user.id);
  res.setHeader("Content-Disposition", `attachment; filename="mis-datos-apu.json"`);
  res.json({ exportedAt: new Date(), legalBasis: "Ley N.° 29733 - derecho de acceso", data });
});

/**
 * Derecho de cancelación: anonimiza la cuenta. Los pedidos se conservan sin datos de contacto
 * porque los comprobantes de pago deben mantenerse por obligación tributaria.
 */
accountRouter.delete("/", async (req, res) => {
  const { password: pwd } = z.object({ password: z.string().min(1) }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!(await bcrypt.compare(pwd, user.passwordHash))) throw badRequest("WRONG_PASSWORD", "Contraseña incorrecta");
  const anonEmail = `eliminado-${sha256(user.id).slice(0, 12)}@anonimo.invalid`;
  await prisma.$transaction(async (tx) => {
    await tx.address.deleteMany({ where: { userId: user.id } });
    await tx.cart.deleteMany({ where: { userId: user.id } });
    await tx.order.updateMany({
      where: { userId: user.id },
      data: { customerEmail: anonEmail, customerPhone: "000000000", customerName: "Cliente eliminado", shippingAddress: Prisma.DbNull },
    });
    await tx.review.updateMany({ where: { userId: user.id }, data: { authorName: "Cliente APU" } });
    await tx.user.update({
      where: { id: user.id },
      data: {
        email: anonEmail,
        fullName: "Cliente eliminado",
        phone: null,
        docNumber: null,
        docType: null,
        passwordHash: "!",
        marketingConsent: false,
        marketingConsentAt: null,
        anonymizedAt: new Date(),
      },
    });
  });
  await audit(prisma, req, "privacy.delete_account", "User", user.id);
  res.json({ ok: true, message: "Tu cuenta fue eliminada y tus datos personales anonimizados." });
});
