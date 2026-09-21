import { PrismaClient } from "@/generated/prisma/client";

// Next.js hot-reloads modules in dev, which would otherwise open a new pool on
// every edit until Postgres refuses connections. Stash the client on globalThis.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
