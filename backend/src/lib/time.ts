export const STORE_TZ = "America/Lima";

/** Día de la semana (0 = domingo) y hora/minuto en la zona horaria de la tienda. */
export function limaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TZ,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    weekday: days.indexOf(get("weekday")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

/** Suma días hábiles (lunes a viernes). No considera feriados. */
export function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = limaParts(d).weekday;
    if (wd !== 0 && wd !== 6) added++;
  }
  return d;
}

export const addMinutes = (from: Date, minutes: number) =>
  new Date(from.getTime() + minutes * 60_000);
export const addHours = (from: Date, hours: number) => addMinutes(from, hours * 60);
export const addDays = (from: Date, days: number) => addHours(from, days * 24);
