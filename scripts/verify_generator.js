const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const WorkoutGenerator = require('../src/utils/workoutGenerator');

async function testGenerator() {
    console.log('--- Starting Workout Generator Test ---');
    const generator = new WorkoutGenerator(prisma);

    // Find a test user or create one if needed (assuming at least one user exists)
    const user = await prisma.user.findFirst();
    if (!user) {
        console.error('No user found in database for testing.');
        process.exit(1);
    }

    console.log(`Testing with User ID: ${user.id}`);

    const specs = {
        goal: 'strength',
        days_per_week: 3,
        workoutDays: ['Monday', 'Wednesday', 'Friday'],
        available_equipment: ['gym', 'barbell', 'dumbbells'],
        exercises_per_day: 6,
        weeks: 4,
        progressionModel: 'LINEAR'
    };

    console.time('Generation Time');
    try {
        const plan = await generator.generatePlan(specs, user.id);
        console.timeEnd('Generation Time');

        console.log(`Plan generated with ${plan.length} weeks.`);
        console.log(`First session of first week:`, JSON.stringify(plan[0].sessions[0], null, 2).slice(0, 500) + '...');

        // Check if day labels are correct
        const dayLabels = plan[0].sessions.map(s => s.dayLabel);
        console.log('Generated Day Labels:', dayLabels);

        if (dayLabels.join(',') === specs.workoutDays.join(',')) {
            console.log('✅ Day labels correctly mapped!');
        } else {
            console.warn('⚠️ Day labels mismatch:', dayLabels);
        }

        // Verify batch fetching effectiveness (indirectly by time)
        console.log('Test completed successfully.');
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testGenerator();
