/** Convierte céntimos a soles con 2 decimales (para respuestas de la API). */
export const toSoles = (cents: number) => Math.round(cents) / 100;

/** Texto legible: S/ 27.50 */
export const formatSoles = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;
