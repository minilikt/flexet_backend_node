const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const exercises = await prisma.exercise.count();
        const categories = await prisma.category.count();
        const equipment = await prisma.equipment.count();
        const muscles = await prisma.muscle.count();
        const tags = await prisma.tag.count();
        
        console.log({
            exercises,
            categories,
            equipment,
            muscles,
            tags
        });
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
