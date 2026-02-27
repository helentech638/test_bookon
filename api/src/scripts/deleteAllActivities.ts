import { PrismaClient } from '@prisma/client';
import { activityService } from '../services/activityService';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching all activities...');
    const activities = await prisma.activity.findMany({ select: { id: true } });
    console.log(`Found ${activities.length} activities.`);

    for (const activity of activities) {
        console.log(`Deleting activity ${activity.id}...`);
        try {
            await activityService.deleteActivity(activity.id);
            console.log(`Successfully deleted activity ${activity.id}`);
        } catch (e) {
            console.error(`Failed to delete activity ${activity.id}:`, e);
        }
    }

    console.log('Finished deleting all activities.');
}

main()
    .then(async () => {
        await prisma.$disconnect();
        process.exit(0);
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
