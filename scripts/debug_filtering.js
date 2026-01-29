const { PrismaClient } = require('@prisma/client');
const WorkoutGenerator = require('../src/utils/workoutGenerator');
const prisma = new PrismaClient();

async function main() {
    const generator = new WorkoutGenerator(prisma);

    // Test Case: Common Home Gym Setup
    const testEquipment = ['Dumbbells', 'Barbell', 'Flat Bench'];
    const userId = null; // No user specific history/feedback for this test

    console.log(`\n=== Debugging Exercise Filtering ===`);
    console.log(`Test Equipment: ${testEquipment.join(', ')}`);

    const generatorExpandedSet = new Set(testEquipment.map(e => e.toLowerCase()));
    // Manually replicate expansion logic to show user what's happening
    testEquipment.forEach(eq => {
        const lower = eq.toLowerCase();
        if (lower.includes('dumbbells')) generatorExpandedSet.add('dumbbell');
        if (lower.includes('barbell')) generatorExpandedSet.add('barbells');
    });
    generatorExpandedSet.add('bodyweight');
    generatorExpandedSet.add('floor');
    generatorExpandedSet.add('none');

    console.log(`Expanded Keywords: ${Array.from(generatorExpandedSet).join(', ')}`);

    // Get ALL Pull exercises first
    const pullExercises = await prisma.exercise.findMany({
        where: { split: { name: 'Pull' } },
        include: { equipment: { include: { equipment: true } } }
    });

    console.log(`\nTotal Pull Exercises in DB: ${pullExercises.length}`);

    // Run standard filtering
    const filtered = await generator.filterByEquipment(testEquipment, userId);

    // Filter specifically for Pull to see what remains
    const pullFiltered = filtered.filter(ex => ex.split && ex.split.name === 'Pull');

    console.log(`Filtered Pull Exercises (Available): ${pullFiltered.length}`);
    pullFiltered.forEach(ex => console.log(`  ✓ ${ex.name}`));

    console.log(`\n--- REJECTED Pull Exercises ---`);
    const acceptedIds = new Set(pullFiltered.map(ex => ex.id));

    pullExercises.forEach(ex => {
        if (!acceptedIds.has(ex.id)) {
            const reqs = ex.equipment.map(e => e.equipment.name);
            console.log(`  ✗ ${ex.name} (Requires: ${reqs.join(', ')})`);

            // Analyze WHY it failed
            const reqsLower = reqs.map(r => r.toLowerCase());
            const missing = reqsLower.filter(req =>
                !Array.from(generatorExpandedSet).some(avail => req.includes(avail) || avail.includes(req))
            );
            if (missing.length > 0) {
                console.log(`     Missing match in expanded set for: "${missing.join(', ')}"`);
            }
        }
    });

    await prisma.$disconnect();
}

main();
