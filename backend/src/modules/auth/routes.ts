import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { badRequest, unauthorized } from "../../lib/errors.js";
import { requireAuth, signToken } from "../../middleware/auth.js";
import { checkDocument, docType, email, password, phonePe } from "../../lib/validation.js";
import { PRIVACY_POLICY_VERSION } from "../../config/store.js";
import { audit } from "../../lib/audit.js";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Demasiados intentos. Intenta nuevamente en unos minutos." } },
});

const registerSchema = z
  .object({
    email,
    password,
    fullName: z.string().trim().min(3).max(100),
    phone: phonePe.optional(),
    docType: docType.optional(),
    docNumber: z.string().trim().optional(),
    acceptPrivacy: z.literal(true, {
      errorMap: () => ({ message: "Debes aceptar la política de privacidad" }),
    }),
    marketingConsent: z.boolean().default(false),
  })
  .refine((d) => !d.docType || (d.docNumber && checkDocument(d.docType, d.docNumber)), {
    message: "Número de documento inválido",
    path: ["docNumber"],
  });

export const publicUser = (u: {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  docType: string | null;
  docNumber: string | null;
  role: string;
  marketingConsent: boolean;
  createdAt: Date;
}) => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  phone: u.phone,
  docType: u.docType,
  docNumber: u.docNumber,
  role: u.role,
  marketingConsent: u.marketingConsent,
  createdAt: u.createdAt,
});

authRouter.post("/register", authLimiter, async (req, res) => {
  const data = registerSchema.parse(req.body);
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw badRequest("EMAIL_TAKEN", "Ya existe una cuenta con este correo");
  const now = new Date();
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash: await bcrypt.hash(data.password, 10),
      fullName: data.fullName,
      phone: data.phone,
      docType: data.docType,
      docNumber: data.docNumber,
      privacyAcceptedAt: now,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      marketingConsent: data.marketingConsent,
      marketingConsentAt: data.marketingConsent ? now : null,
    },
  });
  await audit(prisma, req, "user.register", "User", user.id);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

authRouter.post("/login", authLimiter, async (req, res) => {
  const data = z.object({ email, password: z.string().min(1).max(72) }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  // Misma respuesta para correo inexistente y contraseña errada (evita enumeración).
  if (!user || user.anonymizedAt || !(await bcrypt.compare(data.password, user.passwordHash))) {
    throw unauthorized("Correo o contraseña incorrectos");
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  res.json({ user: publicUser(user) });
});
