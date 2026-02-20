import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    try {
        const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'promo_code_usages'
    `;
        console.log('Columns for Table "promo_code_usages":', JSON.stringify(columns, null, 2));
    } catch (e: any) {
        console.log('Error checking table "promo_code_usages":', e.message);
    }
    await prisma.$disconnect();
}
main().catch(console.error);
