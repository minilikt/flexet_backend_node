const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        // Get total counts
        const totalExercises = await prisma.exercise.count();

        // Get counts by split
        const splits = await prisma.split.findMany({
            include: {
                _count: {
                    select: { exercises: true }
                }
            }
        });

        console.log('\n=== Exercise Database Analysis ===\n');
        console.log(`Total Exercises: ${totalExercises}\n`);

        console.log('Breakdown by Split:');
        splits.forEach(split => {
            console.log(`  ${split.name}: ${split._count.exercises} exercises`);
        });

        // Get Pull exercises specifically
        const pullExercises = await prisma.exercise.findMany({
            where: {
                split: { name: 'Pull' }
            },
            include: {
                equipment: {
                    include: { equipment: true }
                }
            }
        });

        console.log(`\n=== Pull Exercises Detail (${pullExercises.length} total) ===\n`);

        // Group by equipment requirements
        const equipmentGroups = {};
        pullExercises.forEach(ex => {
            const equipNames = ex.equipment.map(e => e.equipment.name).join(', ') || 'Bodyweight';
            if (!equipmentGroups[equipNames]) {
                equipmentGroups[equipNames] = [];
            }
            equipmentGroups[equipNames].push(ex.name);
        });

        Object.keys(equipmentGroups).sort().forEach(equipKey => {
            console.log(`\n${equipKey} (${equipmentGroups[equipKey].length} exercises):`);
            equipmentGroups[equipKey].forEach(name => {
                console.log(`  - ${name}`);
            });
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
