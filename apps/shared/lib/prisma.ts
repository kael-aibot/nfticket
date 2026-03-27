import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __nfticketPrisma__: PrismaClient | undefined;
}

export function getPrismaClient() {
  if (!global.__nfticketPrisma__) {
    global.__nfticketPrisma__ = new PrismaClient();
  }

  return global.__nfticketPrisma__;
}
