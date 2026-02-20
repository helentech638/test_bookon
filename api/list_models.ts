import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const keys = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$'));
    console.log('Available models in prisma:', keys.join(', '));
    await prisma.$disconnect();
}
main().catch(console.error);
