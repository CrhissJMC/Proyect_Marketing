export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);
export const unauthorized = (message = "Debes iniciar sesión") =>
  new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "No tienes permiso para esta acción") =>
  new AppError(403, "FORBIDDEN", message);
export const notFound = (what: string) =>
  new AppError(404, "NOT_FOUND", `${what} no encontrado`);
export const conflict = (code: string, message: string, details?: unknown) =>
  new AppError(409, code, message, details);
