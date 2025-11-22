// src/lib/prisma.ts

// Solusi 1: Dynamic import untuk handle case ketika Prisma Client belum di-generate
let prisma: any;

try {
  // Coba import Prisma Client
  const { PrismaClient } = require("@prisma/client");
  prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    errorFormat: "pretty",
  });
} catch (error) {
  console.warn("Prisma Client not available yet. Run: npx prisma generate");
  // Fallback object untuk development
  prisma = {
    $connect: () => Promise.resolve(),
    $disconnect: () => Promise.resolve(),
    $queryRaw: () => Promise.resolve(),
    // Tambahkan method lainnya sesuai kebutuhan
  };
}

// Global instance untuk development
const globalForPrisma = global as unknown as { prisma: any };

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on("beforeExit", async () => {
  if (prisma && prisma.$disconnect) {
    await prisma.$disconnect();
  }
});

export default prisma;
