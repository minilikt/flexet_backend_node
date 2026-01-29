const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    let output = '';
    const log = (msg) => { output += msg + '\n'; };

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

        log('=== Exercise Database Analysis ===');
        log(`Total Exercises: ${totalExercises}`);

        log('Breakdown by Split:');
        splits.forEach(split => {
            log(`  ${split.name}: ${split._count.exercises} exercises`);
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

        log(`\n=== Pull Exercises Detail (${pullExercises.length} total) ===`);

        // Group by equipment requirements
        const equipmentGroups = {};
        pullExercises.forEach(ex => {
            // Sort equipment names to ensure consistent keys
            const equipmentList = ex.equipment.map(e => e.equipment.name).sort();
            const equipNames = equipmentList.length > 0 ? equipmentList.join(', ') : 'Bodyweight';

            if (!equipmentGroups[equipNames]) {
                equipmentGroups[equipNames] = [];
            }
            equipmentGroups[equipNames].push(ex.name);
        });

        Object.keys(equipmentGroups).sort().forEach(equipKey => {
            log(`\n[${equipKey}] (${equipmentGroups[equipKey].length} exercises):`);
            equipmentGroups[equipKey].forEach(name => {
                log(`  - ${name}`);
            });
        });

        fs.writeFileSync('pull_analysis_report.txt', output);
        console.log('Analysis written to pull_analysis_report.txt');

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
