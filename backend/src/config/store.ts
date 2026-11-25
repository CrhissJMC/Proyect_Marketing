/**
 * Decisiones de negocio de la tienda virtual de Cafetería APU.
 * Los valores son REFERENCIALES (prototipo académico) y se pueden ajustar aquí
 * sin tocar la lógica de la aplicación.
 */
import type { PaymentMethod, ShippingMethod } from "@prisma/client";

export const PRIVACY_POLICY_VERSION = "2026-11";

export const STORE = {
  name: "Cafetería APU",
  tagline: "Tu pausa tiene sabor a APU",
  description:
    "Cafetería de la marca APU, vinculada a la cooperativa CENFROCAFE, con café de productores de Jaén y San Ignacio.",
  address: "Pasaje Bracamoros N.° 137, Jaén, Cajamarca",
  disclaimer:
    "Prototipo académico de comercio electrónico. No se procesan pedidos ni pagos reales; los precios y datos de contacto son referenciales.",
  // Número ficticio: el prototipo no debe recibir pedidos reales.
  whatsapp: "+51 900 000 000",
  email: "atencion@apu-demo.test",
  social: {
    instagram: "@cafeteria_apu",
    hashtags: ["#TuPausaTieneSaborAPU", "#MiMomentoAPU"],
  },
  /** Horario referencial (hora de Lima). weekday: 0 = domingo. */
  hours: [
    { weekday: 0, open: "08:00", close: "21:00" },
    { weekday: 1, open: "07:00", close: "21:00" },
    { weekday: 2, open: "07:00", close: "21:00" },
    { weekday: 3, open: "07:00", close: "21:00" },
    { weekday: 4, open: "07:00", close: "21:00" },
    { weekday: 5, open: "07:00", close: "21:00" },
    { weekday: 6, open: "08:00", close: "21:00" },
  ],
} as const;

export interface ShippingRule {
  method: ShippingMethod;
  label: string;
  description: string;
  costCents: number;
  freeFromCents: number | null;
  minSubtotalCents: number;
  /** Si es false, no acepta productos perecibles (bebidas y postres). */
  allowsPerishables: boolean;
  requiresAddress: boolean;
  /** Distritos aceptados (vacío = cualquiera). */
  allowedDistricts: string[];
  estimatedTime: string;
  paymentMethods: PaymentMethod[];
}

export const SHIPPING: Record<ShippingMethod, ShippingRule> = {
  PICKUP: {
    method: "PICKUP",
    label: "Recojo en tienda",
    description: "Recoge tu pedido en Pasaje Bracamoros 137, Jaén.",
    costCents: 0,
    freeFromCents: null,
    minSubtotalCents: 0,
    allowsPerishables: true,
    requiresAddress: false,
    allowedDistricts: [],
    estimatedTime: "Listo en 15 a 20 minutos",
    paymentMethods: ["CARD", "YAPE", "PLIN", "PAY_AT_STORE"],
  },
  DELIVERY_LOCAL: {
    method: "DELIVERY_LOCAL",
    label: "Delivery en Jaén",
    description: "Reparto propio en la zona urbana de Jaén.",
    costCents: 400,
    freeFromCents: null,
    minSubtotalCents: 1500,
    allowsPerishables: true,
    requiresAddress: true,
    allowedDistricts: ["jaen"],
    estimatedTime: "30 a 45 minutos",
    paymentMethods: ["CARD", "YAPE", "PLIN", "CASH_ON_DELIVERY"],
  },
  NATIONAL: {
    method: "NATIONAL",
    label: "Envío nacional",
    description: "Solo café empacado y artículos, mediante agencia de transporte.",
    costCents: 1200,
    freeFromCents: 10000,
    minSubtotalCents: 0,
    allowsPerishables: false,
    requiresAddress: true,
    allowedDistricts: [],
    estimatedTime: "2 a 5 días hábiles",
    paymentMethods: ["CARD", "YAPE", "PLIN"],
  },
};

export const PAYMENT_METHODS: Record<PaymentMethod, { label: string; online: boolean }> = {
  CARD: { label: "Tarjeta de crédito o débito", online: true },
  YAPE: { label: "Yape", online: true },
  PLIN: { label: "Plin", online: true },
  CASH_ON_DELIVERY: { label: "Efectivo contra entrega", online: false },
  PAY_AT_STORE: { label: "Pago al recoger en tienda", online: false },
};

/** Plazos de posventa. */
export const RETURNS = {
  perishableWindowHours: 2,
  packagedWindowDays: 7,
};

/** Plazo de respuesta del Libro de Reclamaciones (días hábiles). */
export const COMPLAINT_RESPONSE_BUSINESS_DAYS = 15;

export const ATTRIBUTION_SOURCES = [
  "INSTAGRAM",
  "FACEBOOK",
  "TIKTOK",
  "GOOGLE",
  "TRIPADVISOR",
  "INFLUENCER",
  "EMAIL",
  "RECOMENDACION",
  "OTRO",
] as const;

export const POLICIES = {
  shipping: [
    "Recojo en tienda sin costo, listo en 15 a 20 minutos.",
    "Delivery en la zona urbana de Jaén: S/ 4.00, pedido mínimo S/ 15.00, entrega en 30 a 45 minutos.",
    "Envío nacional solo para café empacado y artículos: S/ 12.00, gratis desde S/ 100.00, de 2 a 5 días hábiles.",
    "Las bebidas y postres no se envían fuera de Jaén para conservar su calidad e inocuidad.",
  ],
  returns: [
    "Bebidas y postres: si el producto llegó en mal estado o no corresponde al pedido, repórtalo dentro de las 2 horas posteriores a la entrega. Lo reponemos o devolvemos el importe.",
    "Café empacado y artículos: puedes solicitar la devolución dentro de los 7 días posteriores a la entrega si el empaque está cerrado. Si llegó dañado, lo cambiamos.",
    "Los reembolsos se realizan por el mismo medio de pago.",
  ],
  privacy: [
    "Tratamos tus datos conforme a la Ley N.° 29733 y su Reglamento (D.S. N.° 016-2024-JUS).",
    "Usamos tus datos solo para gestionar tu pedido, el comprobante y la atención posventa.",
    "Solo te enviaremos promociones si lo autorizas expresamente; la casilla nunca viene marcada.",
    "Puedes descargar tus datos, actualizar tus consentimientos o eliminar tu cuenta desde tu perfil.",
    "No almacenamos el número completo de tu tarjeta ni el código de seguridad.",
  ],
  consumer: [
    "Precios en soles con IGV incluido.",
    "Cumplimos el Código de Protección y Defensa del Consumidor (Ley N.° 29571).",
    "Libro de Reclamaciones virtual disponible; respuesta en un plazo máximo de 15 días hábiles.",
    "Sin suscripciones automáticas ni opciones preseleccionadas (D. Leg. N.° 1729).",
  ],
};
