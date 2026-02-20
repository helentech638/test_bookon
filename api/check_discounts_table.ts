import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    try {
        const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'discounts'
    `;
        console.log('Columns for Table "discounts":', JSON.stringify(columns, null, 2));
    } catch (e: any) {
        console.log('Error checking table "discounts":', e.message);
    }
    await prisma.$disconnect();
}
main().catch(console.error);
