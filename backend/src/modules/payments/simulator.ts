/**
 * Pasarela de pagos SIMULADA. No se conecta con ningún banco ni billetera.
 * Reproduce las respuestas típicas de una pasarela para demostrar el flujo de compra.
 */

export interface SimulationResult {
  approved: boolean;
  code: string;
  message: string;
  cardBrand?: string;
  cardLast4?: string;
  walletPhoneMasked?: string;
}

/** Tarjetas de prueba aceptadas por el simulador (no son tarjetas reales). */
export const TEST_CARDS = [
  { number: "4111111111111111", brand: "VISA", result: "APPROVED", description: "Visa aprobada" },
  { number: "5555555555554444", brand: "MASTERCARD", result: "APPROVED", description: "Mastercard aprobada" },
  { number: "378282246310005", brand: "AMEX", result: "APPROVED", description: "American Express aprobada" },
  { number: "4000000000000002", brand: "VISA", result: "INSUFFICIENT_FUNDS", description: "Rechazada: fondos insuficientes" },
  { number: "4000000000000069", brand: "VISA", result: "CARD_BLOCKED", description: "Rechazada: tarjeta bloqueada" },
  { number: "4000000000000119", brand: "VISA", result: "PROCESSOR_ERROR", description: "Error del procesador" },
] as const;

/** Códigos de aprobación de prueba para Yape / Plin. */
export const TEST_WALLET_CODES = [
  { code: "123456", result: "APPROVED", description: "Cualquier código de 6 dígitos se aprueba" },
  { code: "000000", result: "DECLINED", description: "Rechazado por la billetera" },
  { code: "111111", result: "EXPIRED_CODE", description: "Código de aprobación vencido" },
] as const;

const MESSAGES: Record<string, string> = {
  APPROVED: "Pago aprobado",
  INSUFFICIENT_FUNDS: "Tarjeta rechazada: fondos insuficientes",
  CARD_BLOCKED: "Tarjeta rechazada: comunícate con tu banco",
  PROCESSOR_ERROR: "No pudimos procesar el pago. Intenta nuevamente",
  CARD_NOT_ENABLED: "Tarjeta no habilitada en el simulador. Usa una tarjeta de prueba",
  INVALID_NUMBER: "Número de tarjeta inválido",
  EXPIRED_CARD: "La tarjeta está vencida",
  INVALID_CVV: "Código de seguridad inválido",
  DECLINED: "La billetera rechazó el pago",
  EXPIRED_CODE: "El código de aprobación venció. Genera uno nuevo en tu app",
};

const fail = (code: string, extra: Partial<SimulationResult> = {}): SimulationResult => ({
  approved: false,
  code,
  message: MESSAGES[code],
  ...extra,
});

export function luhnValid(number: string) {
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i--) {
    let d = Number(number[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return number.length >= 13 && sum % 10 === 0;
}

export function detectBrand(number: string) {
  if (/^4/.test(number)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(number)) return "MASTERCARD";
  if (/^3[47]/.test(number)) return "AMEX";
  if (/^3(0[0-5]|[68])/.test(number)) return "DINERS";
  return "DESCONOCIDA";
}

export function simulateCard(input: {
  number: string;
  expMonth: number;
  expYear: number;
  cvv: string;
}, now = new Date()): SimulationResult {
  const number = input.number.replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(number) || !luhnValid(number)) return fail("INVALID_NUMBER");
  const brand = detectBrand(number);
  const last4 = number.slice(-4);
  const base = { cardBrand: brand, cardLast4: last4 };

  const year = input.expYear < 100 ? 2000 + input.expYear : input.expYear;
  const expiresAt = new Date(Date.UTC(year, input.expMonth, 1)); // primer día del mes siguiente
  if (expiresAt <= now) return fail("EXPIRED_CARD", base);
  const cvvLength = brand === "AMEX" ? 4 : 3;
  if (!new RegExp(`^\\d{${cvvLength}}$`).test(input.cvv)) return fail("INVALID_CVV", base);

  const test = TEST_CARDS.find((c) => c.number === number);
  if (!test) return fail("CARD_NOT_ENABLED", base);
  if (test.result !== "APPROVED") return fail(test.result, base);
  return { approved: true, code: "APPROVED", message: MESSAGES.APPROVED, ...base };
}

export function simulateWallet(input: { phone: string; approvalCode: string }): SimulationResult {
  const walletPhoneMasked = `${input.phone.slice(0, 3)}***${input.phone.slice(-3)}`;
  const test = TEST_WALLET_CODES.find((c) => c.code === input.approvalCode);
  if (test && test.result !== "APPROVED") return fail(test.result, { walletPhoneMasked });
  return { approved: true, code: "APPROVED", message: MESSAGES.APPROVED, walletPhoneMasked };
}
