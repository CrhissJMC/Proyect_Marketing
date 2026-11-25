import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "../config/env.js";
import { forbidden, unauthorized } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  fullName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: { id: string; role: Role }) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

async function resolveUser(req: Request): Promise<AuthUser | undefined> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(header.slice(7), env.JWT_SECRET) as jwt.JwtPayload;
  } catch {
    throw unauthorized("Sesión inválida o expirada");
  }
  const user = await prisma.user.findUnique({
    where: { id: String(payload.sub) },
    select: { id: true, email: true, role: true, fullName: true, anonymizedAt: true },
  });
  if (!user || user.anonymizedAt) throw unauthorized("Sesión inválida o expirada");
  return { id: user.id, email: user.email, role: user.role, fullName: user.fullName };
}

/** Adjunta req.user si hay un token válido; permite invitados. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = await resolveUser(req);
  next();
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const user = await resolveUser(req);
  if (!user) throw unauthorized();
  req.user = user;
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    const user = await resolveUser(req);
    if (!user) throw unauthorized();
    if (!roles.includes(user.role)) throw forbidden();
    req.user = user;
    next();
  };
