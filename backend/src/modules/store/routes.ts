import { Router } from "express";
import {
  ATTRIBUTION_SOURCES,
  COMPLAINT_RESPONSE_BUSINESS_DAYS,
  PAYMENT_METHODS,
  POLICIES,
  PRIVACY_POLICY_VERSION,
  RETURNS,
  SHIPPING,
  STORE,
} from "../../config/store.js";
import { toSoles } from "../../lib/money.js";
import { limaParts } from "../../lib/time.js";
import { TEST_CARDS, TEST_WALLET_CODES } from "../payments/simulator.js";
import { prisma } from "../../lib/prisma.js";

export const storeRouter = Router();

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function openNow() {
  const { weekday, hour, minute } = limaParts();
  const today = STORE.hours.find((h) => h.weekday === weekday);
  if (!today) return false;
  const t = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return t >= today.open && t < today.close;
}

/** Información pública de la tienda, políticas y medios de pago (para el frontend). */
storeRouter.get("/", (_req, res) => {
  res.json({
    name: STORE.name,
    tagline: STORE.tagline,
    description: STORE.description,
    address: STORE.address,
    disclaimer: STORE.disclaimer,
    contact: { whatsapp: STORE.whatsapp, email: STORE.email, ...STORE.social },
    openNow: openNow(),
    hours: STORE.hours.map((h) => ({ day: DAY_NAMES[h.weekday], ...h })),
    shippingMethods: Object.values(SHIPPING).map((s) => ({
      method: s.method,
      label: s.label,
      description: s.description,
      cost: toSoles(s.costCents),
      freeFrom: s.freeFromCents != null ? toSoles(s.freeFromCents) : null,
      minSubtotal: toSoles(s.minSubtotalCents),
      allowsPerishables: s.allowsPerishables,
      estimatedTime: s.estimatedTime,
      paymentMethods: s.paymentMethods,
    })),
    paymentMethods: Object.entries(PAYMENT_METHODS).map(([method, p]) => ({ method, ...p })),
    returns: RETURNS,
    complaintResponseDays: COMPLAINT_RESPONSE_BUSINESS_DAYS,
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    attributionSources: ATTRIBUTION_SOURCES,
    policies: POLICIES,
  });
});

/** Datos de prueba del simulador de pagos (visible porque todo es simulado). */
storeRouter.get("/payment-simulator", (_req, res) => {
  res.json({
    notice: "Pasarela simulada: no se realizan cargos reales. Usa estos datos de prueba.",
    cards: TEST_CARDS.map((c) => ({ ...c, expiry: "Cualquier fecha futura", cvv: c.brand === "AMEX" ? "4 dígitos" : "3 dígitos" })),
    wallets: {
      methods: ["YAPE", "PLIN"],
      phone: "Cualquier celular de 9 dígitos que empiece con 9",
      approvalCodes: TEST_WALLET_CODES,
    },
  });
});

/** Promociones vigentes para mostrar en la tienda. */
storeRouter.get("/promotions", async (_req, res) => {
  const now = new Date();
  const coupons = await prisma.coupon.findMany({
    where: {
      isActive: true,
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    include: { product: { select: { slug: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json({
    promotions: coupons
      .filter((c) => c.maxUses == null || c.usedCount < c.maxUses)
      .map((c) => ({
        code: c.code,
        description: c.description,
        type: c.type,
        product: c.product,
        schedule: c.hourFrom != null ? `De ${c.hourFrom}:00 a ${c.hourTo}:00` : null,
        minSubtotal: c.minSubtotalCents != null ? toSoles(c.minSubtotalCents) : null,
        requiresLogin: c.requiresLogin,
        endsAt: c.endsAt,
      })),
  });
});
