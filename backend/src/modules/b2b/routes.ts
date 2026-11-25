import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { CorporateQuote } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { nextCode } from "../../lib/codes.js";
import { checkDocument, email, phonePe } from "../../lib/validation.js";
import { toSoles } from "../../lib/money.js";
import { audit } from "../../lib/audit.js";

/** Canal B2B: cotizaciones para empresas (coffee break, eventos, café en volumen). */
export const b2bRouter = Router();

const limiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false });

export const QUOTE_TYPES = {
  COFFEE_BREAK: "Coffee break para reuniones o eventos",
  CAFE_VOLUMEN: "Café APU empacado por volumen",
  REGALOS_CORPORATIVOS: "Kits de regalo corporativo",
  ABASTECIMIENTO_OFICINA: "Abastecimiento mensual para oficina",
} as const;

const quoteSchema = z.object({
  companyName: z.string().trim().min(3).max(150),
  ruc: z.string().trim(),
  contactName: z.string().trim().min(3).max(100),
  email,
  phone: phonePe,
  requestType: z.enum(Object.keys(QUOTE_TYPES) as [keyof typeof QUOTE_TYPES, ...(keyof typeof QUOTE_TYPES)[]]),
  items: z
    .array(z.object({ description: z.string().trim().min(3).max(150), quantity: z.number().int().min(1).max(10000) }))
    .min(1)
    .max(30),
  eventDate: z.coerce.date().optional(),
  deliveryAddress: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export function serializeQuote(q: CorporateQuote) {
  return {
    code: q.code,
    companyName: q.companyName,
    ruc: q.ruc,
    contactName: q.contactName,
    email: q.email,
    phone: q.phone,
    requestType: q.requestType,
    requestTypeLabel: QUOTE_TYPES[q.requestType as keyof typeof QUOTE_TYPES] ?? q.requestType,
    items: q.items,
    eventDate: q.eventDate,
    deliveryAddress: q.deliveryAddress,
    notes: q.notes,
    status: q.status,
    quotedAmount: q.quotedAmountCents != null ? toSoles(q.quotedAmountCents) : null,
    validUntil: q.validUntil,
    createdAt: q.createdAt,
  };
}

b2bRouter.get("/types", (_req, res) => {
  res.json({ types: Object.entries(QUOTE_TYPES).map(([value, label]) => ({ value, label })) });
});

b2bRouter.post("/", limiter, async (req, res) => {
  const d = quoteSchema.parse(req.body);
  if (!checkDocument("RUC", d.ruc)) throw badRequest("INVALID_RUC", "RUC inválido (11 dígitos)");
  if (d.eventDate && d.eventDate < new Date()) throw badRequest("INVALID_DATE", "La fecha del evento debe ser futura");
  const quote = await prisma.$transaction(async (tx) =>
    tx.corporateQuote.create({ data: { ...d, code: await nextCode(tx, "CT") } }),
  );
  await audit(prisma, req, "quote.create", "CorporateQuote", quote.id);
  res.status(201).json({
    quote: serializeQuote(quote),
    message: "Recibimos tu solicitud. Un asesor te enviará la cotización en un máximo de 48 horas.",
  });
});

b2bRouter.get("/:code", async (req, res) => {
  const q = z.object({ email }).parse(req.query);
  const quote = await prisma.corporateQuote.findFirst({ where: { code: req.params.code.toUpperCase(), email: q.email } });
  if (!quote) throw notFound("Cotización");
  res.json({ quote: serializeQuote(quote) });
});
