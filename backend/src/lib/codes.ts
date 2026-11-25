import { randomBytes, createHash } from "node:crypto";
import type { Db } from "./prisma.js";

/** Incrementa de forma atómica un contador correlativo y devuelve el nuevo valor. */
export async function nextCounter(db: Db, name: string) {
  const counter = await db.counter.upsert({
    where: { name },
    create: { name, value: 1 },
    update: { value: { increment: 1 } },
  });
  return counter.value;
}

const pad = (n: number, size: number) => String(n).padStart(size, "0");

/** APU-2026-000123, LR-2026-000004, DV-2026-000010, CT-2026-000002 */
export async function nextCode(db: Db, prefix: string) {
  const year = new Date().getFullYear();
  const n = await nextCounter(db, `${prefix}-${year}`);
  return `${prefix}-${year}-${pad(n, 6)}`;
}

/** Serie del comprobante: B001-00000001 (boleta) o F001-00000001 (factura). */
export async function nextReceiptNumber(db: Db, type: "BOLETA" | "FACTURA") {
  const serie = type === "BOLETA" ? "B001" : "F001";
  const n = await nextCounter(db, `receipt-${serie}`);
  return `${serie}-${pad(n, 8)}`;
}

export const randomToken = (bytes = 24) => randomBytes(bytes).toString("base64url");
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
