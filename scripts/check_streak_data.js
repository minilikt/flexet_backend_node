const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
    try {
        const sessionCount = await prisma.workoutSession.count();
        const completedSessions = await prisma.workoutSession.count({ where: { isCompleted: true } });
        const metricEvents = await prisma.metricEvent.count();
        const summaries = await prisma.analyticsSummary.findMany();

        console.log('--- Database Check ---');
        console.log(`Total Workout Sessions: ${sessionCount}`);
        console.log(`Completed Sessions: ${completedSessions}`);
        console.log(`Metric Events: ${metricEvents}`);
        console.log(`Analytics Summaries: ${summaries.length}`);

        if (completedSessions > 0) {
            const lastSession = await prisma.workoutSession.findFirst({
                where: { isCompleted: true },
                orderBy: { completedAt: 'desc' }
            });
            console.log(`Last Completed Session: ${lastSession.completedAt}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
