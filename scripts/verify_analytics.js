const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const AnalyticsCore = require('../src/services/AnalyticsCore');
const { subDays, format } = require('date-fns');

async function verifyAnalytics() {
    console.log('--- Starting Analytics Verification ---');

    // 1. Find or create a test user
    let user = await prisma.user.findFirst();
    if (!user) {
        console.log('No user found. Creating dummy user...');
        user = await prisma.user.create({
            data: {
                email: 'test@example.com',
                password: 'hashed_password'
            }
        });
    }
    const userId = user.id;
    console.log(`Using User ID: ${userId}`);

    // 2. Clear previous test events to ensure clean slate (optional but recommended for local testing)
    await prisma.activityEvent.deleteMany({
        where: { userId, type: 'VERIFICATION_TEST' }
    });

    // 3. Log a 3-day streak
    console.log('Logging a 3-day streak...');
    const dates = [0, 1, 2].map(d => subDays(new Date(), d));

    for (const date of dates) {
        await prisma.activityEvent.create({
            data: {
                userId,
                type: 'WORKOUT_COMPLETE',
                durationSeconds: 3600,
                calories: 400,
                createdAt: date
            }
        });
        console.log(`Logged workout for: ${format(date, 'yyyy-MM-dd')}`);
    }

    // 4. Calculate Streak
    const streak = await AnalyticsCore.calculateStreak(userId, 'WORKOUT_COMPLETE');
    console.log(`Calculated Streak: ${streak}`);

    if (streak >= 3) {
        console.log('✅ Streak calculation verified successfully!');
    } else {
        console.log('❌ Streak calculation failed.');
    }

    // 5. Test Volume calculation
    const volume = await AnalyticsCore.calculateVolume(userId, 'WORKOUT_COMPLETE', 7);
    console.log(`Calculated Volume (generic value): ${volume}`);

    // Clean up test data if desired
    console.log('\n--- Verification Finished ---');
    await prisma.$disconnect();
}

verifyAnalytics().catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
});
