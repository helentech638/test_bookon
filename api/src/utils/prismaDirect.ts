import { PrismaClient } from '@prisma/client';

// Separate Prisma client for migrations and seeding using direct URL
const createDirectPrismaClient = () => {
  return new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env['DATABASE_DIRECT_URL'] || '',
      },
    },
    errorFormat: 'minimal',
  });
};

// Create a global direct Prisma client instance
const globalForDirectPrisma = globalThis as unknown as {
  prismaDirect: PrismaClient | undefined;
};

export const prismaDirect = globalForDirectPrisma.prismaDirect ?? createDirectPrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForDirectPrisma.prismaDirect = prismaDirect;
}

export default prismaDirect;
