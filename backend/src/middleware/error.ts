import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: "ROUTE_NOT_FOUND", message: `Ruta no encontrada: ${req.method} ${req.path}` } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Revisa los datos enviados",
        details: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      },
    });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    res.status(409).json({ error: { code: "DUPLICATE", message: "El registro ya existe", details: err.meta } });
    return;
  }
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: { code: "INVALID_JSON", message: "El cuerpo de la petición no es JSON válido" } });
    return;
  }
  logger.error({ err, path: req.path }, "Error no controlado");
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Ocurrió un error inesperado" } });
}
