export const soles = (n: number | null | undefined) =>
  n == null ? "—" : `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const dateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Lima" })
    : "";

export const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Lima" }) : "";

export const time = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("es-PE", { hour: "numeric", minute: "2-digit", timeZone: "America/Lima" }) : "";

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
