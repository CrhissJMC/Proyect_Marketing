import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import type { Db } from "./prisma.js";

export async function audit(
  db: Db,
  req: Request | null,
  action: string,
  entity: string,
  entityId?: string,
  data?: Prisma.InputJsonValue,
) {
  await db.auditLog.create({
    data: {
      action,
      entity,
      entityId,
      data,
      userId: req?.user?.id,
      ip: req?.ip,
    },
  });
}
