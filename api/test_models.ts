import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    console.log('Checking models...');
    try {
        const discounts = await (prisma as any).discount.findMany({ take: 1 });
        console.log('✅ Discount model accessible');
    } catch (e: any) {
        console.log('❌ Discount model NOT accessible:', e.message);
    }
    try {
        const promoCodes = await (prisma as any).promo_codes.findMany({ take: 1 });
        console.log('✅ promo_codes model accessible');
    } catch (e: any) {
        console.log('❌ promo_codes model NOT accessible:', e.message);
    }
    try {
        const promoCodeUsages = await (prisma as any).promo_code_usages.findMany({ take: 1 });
        console.log('✅ promo_code_usages model accessible');
    } catch (e: any) {
        console.log('❌ promo_code_usages model NOT accessible:', e.message);
    }
    await prisma.$disconnect();
}
main().catch(console.error);
