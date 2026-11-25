import { z } from "zod";

export const email = z.string().trim().toLowerCase().email("Correo inválido").max(120);
export const phonePe = z
  .string()
  .trim()
  .regex(/^9\d{8}$/, "El celular debe tener 9 dígitos y empezar con 9");
export const docType = z.enum(["DNI", "CE", "PASAPORTE", "RUC"]);

/** Valida número de documento según su tipo. */
export function checkDocument(type: string, number: string) {
  switch (type) {
    case "DNI":
      return /^\d{8}$/.test(number);
    case "RUC":
      return /^(10|15|17|20)\d{9}$/.test(number);
    case "CE":
      return /^[A-Za-z0-9]{9,12}$/.test(number);
    default:
      return /^[A-Za-z0-9]{6,12}$/.test(number);
  }
}

export const password = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(72)
  .regex(/[A-Za-z]/, "Debe incluir al menos una letra")
  .regex(/\d/, "Debe incluir al menos un número");

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const addressSchema = z.object({
  recipient: z.string().trim().min(3).max(100),
  phone: phonePe,
  line1: z.string().trim().min(5).max(160),
  reference: z.string().trim().max(160).optional(),
  district: z.string().trim().min(2).max(60),
  province: z.string().trim().min(2).max(60),
  department: z.string().trim().min(2).max(60),
});

/** Normaliza texto para comparar (sin tildes, minúsculas). */
export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
