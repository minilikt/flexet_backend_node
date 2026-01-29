const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { startOfDay, subDays, format } = require('date-fns');

async function verifyAnalytics() {
    console.log('--- Verifying Analytics API Logic ---');
    try {
        const user = await prisma.user.findFirst();
        if (!user) {
            console.warn('! No user found for testing.');
            return;
        }

        console.log(`Testing for User: ${user.email}`);

        // 1. Check Body Metrics
        console.log('\n1. Testing Body Metrics...');
        const date = startOfDay(new Date());
        await prisma.bodyMetric.upsert({
            where: { userId_date: { userId: user.id, date } },
            update: { weight: 80 },
            create: { userId: user.id, date, weight: 80 }
        });
        const metrics = await prisma.bodyMetric.findMany({ where: { userId: user.id } });
        console.log(`- Successfully logged and retrieved ${metrics.length} metrics.`);

        // 2. Check Summary Aggregation
        console.log('\n2. Testing Summary Aggregation...');
        const activePlan = await prisma.workoutPlan.findFirst({
            where: { userId: user.id, status: 'ACTIVE' },
            include: { _count: { select: { sessions: true } } }
        });

        if (activePlan) {
            const completedCount = await prisma.workoutSession.count({
                where: { planId: activePlan.id, isCompleted: true }
            });
            console.log(`- Active Plan: ${activePlan.name}`);
            console.log(`- Progress: ${completedCount} / ${activePlan._count.sessions} sessions.`);
        } else {
            console.warn('! No active plan found.');
        }

        // 3. Tonnage Calculation
        console.log('\n3. Testing Tonnage Calculation...');
        const tonnageLogs = await prisma.exercisePerformanceLog.findMany({
            where: { workoutExercise: { session: { plan: { userId: user.id } } } }
        });
        const totalTonnage = tonnageLogs.reduce((acc, log) => acc + (log.weight * (log.actualReps || 0)), 0);
        console.log(`- Total Tonnage across all time: ${totalTonnage} kg.`);

        console.log('\n✅ Analytics Logic Verification Complete.');
    } catch (err) {
        console.error('❌ Verification failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

verifyAnalytics();
