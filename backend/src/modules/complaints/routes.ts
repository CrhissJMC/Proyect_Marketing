import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { Complaint } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { notFound } from "../../lib/errors.js";
import { nextCode } from "../../lib/codes.js";
import { addBusinessDays } from "../../lib/time.js";
import { checkDocument, docType, email, phonePe } from "../../lib/validation.js";
import { COMPLAINT_RESPONSE_BUSINESS_DAYS, STORE } from "../../config/store.js";
import { toSoles } from "../../lib/money.js";
import { audit } from "../../lib/audit.js";

/** Libro de Reclamaciones virtual (Ley N.° 29571). */
export const complaintsRouter = Router();

const limiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false });

const complaintSchema = z
  .object({
    type: z.enum(["RECLAMO", "QUEJA"]),
    consumerName: z.string().trim().min(3).max(100),
    docType,
    docNumber: z.string().trim(),
    email,
    phone: phonePe,
    address: z.string().trim().min(5).max(200),
    isMinor: z.boolean().default(false),
    guardianName: z.string().trim().min(3).max(100).optional(),
    goodType: z.enum(["PRODUCTO", "SERVICIO"]),
    goodDescription: z.string().trim().min(3).max(200),
    amount: z.number().nonnegative().max(100000).optional(),
    orderCode: z.string().trim().toUpperCase().max(20).optional(),
    detail: z.string().trim().min(20).max(2000),
    consumerRequest: z.string().trim().min(5).max(1000),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: "Debes declarar que la información es verdadera" }) }),
  })
  .superRefine((d, ctx) => {
    if (!checkDocument(d.docType, d.docNumber)) {
      ctx.addIssue({ code: "custom", path: ["docNumber"], message: "Número de documento inválido" });
    }
    if (d.isMinor && !d.guardianName) {
      ctx.addIssue({ code: "custom", path: ["guardianName"], message: "Si eres menor de edad, indica el nombre de tu padre, madre o apoderado" });
    }
  });

export function serializeComplaint(c: Complaint) {
  return {
    code: c.code,
    type: c.type,
    typeDescription:
      c.type === "RECLAMO"
        ? "Disconformidad relacionada con el producto o servicio"
        : "Malestar respecto a la atención, sin relación directa con el producto",
    consumerName: c.consumerName,
    email: c.email,
    goodType: c.goodType,
    goodDescription: c.goodDescription,
    amount: c.amountCents != null ? toSoles(c.amountCents) : null,
    orderCode: c.orderCode,
    detail: c.detail,
    consumerRequest: c.consumerRequest,
    status: c.status,
    response: c.response,
    respondedAt: c.respondedAt,
    dueAt: c.dueAt,
    createdAt: c.createdAt,
  };
}

complaintsRouter.post("/", limiter, async (req, res) => {
  const d = complaintSchema.parse(req.body);
  const now = new Date();
  const complaint = await prisma.$transaction(async (tx) =>
    tx.complaint.create({
      data: {
        code: await nextCode(tx, "LR"),
        type: d.type,
        consumerName: d.consumerName,
        docType: d.docType,
        docNumber: d.docNumber,
        email: d.email,
        phone: d.phone,
        address: d.address,
        isMinor: d.isMinor,
        guardianName: d.guardianName,
        goodType: d.goodType,
        goodDescription: d.goodDescription,
        amountCents: d.amount != null ? Math.round(d.amount * 100) : null,
        orderCode: d.orderCode,
        detail: d.detail,
        consumerRequest: d.consumerRequest,
        dueAt: addBusinessDays(now, COMPLAINT_RESPONSE_BUSINESS_DAYS),
      },
    }),
  );
  await audit(prisma, req, "complaint.create", "Complaint", complaint.id);
  res.status(201).json({
    complaint: serializeComplaint(complaint),
    // La hoja de reclamación se debe entregar al consumidor (en producción, por correo).
    sheet: {
      provider: STORE.name,
      address: STORE.address,
      note: `Hoja N.° ${complaint.code}. Responderemos en un plazo máximo de ${COMPLAINT_RESPONSE_BUSINESS_DAYS} días hábiles. La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.`,
      emailSimulated: `Copia enviada (simulado) a ${complaint.email}`,
    },
  });
});

complaintsRouter.get("/:code", async (req, res) => {
  const q = z.object({ email }).parse(req.query);
  const complaint = await prisma.complaint.findFirst({
    where: { code: req.params.code.toUpperCase(), email: q.email },
  });
  if (!complaint) throw notFound("Reclamo");
  res.json({ complaint: serializeComplaint(complaint) });
});
