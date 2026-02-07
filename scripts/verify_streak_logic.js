const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { format } = require('date-fns');

async function checkDates() {
    try {
        const completedSessions = await prisma.workoutSession.findMany({
            where: { isCompleted: true },
            orderBy: { completedAt: 'desc' },
            select: { completedAt: true }
        });

        console.log('--- Completed Sessions Dates ---');
        completedSessions.forEach(s => {
            console.log(format(s.completedAt, 'yyyy-MM-dd HH:mm:ss'));
        });

        // Test the controller's logic
        const sessionDates = [...new Set(completedSessions.map(s => format(s.completedAt, 'yyyy-MM-dd')))];
        const today = format(new Date(), 'yyyy-MM-dd');
        const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');

        let currentStreak = 0;
        if (sessionDates.length > 0) {
            console.log(`Dates: ${sessionDates.join(', ')}`);
            console.log(`Today: ${today}, Yesterday: ${yesterday}`);

            if (sessionDates[0] === today || sessionDates[0] === yesterday) {
                currentStreak = 1;
                for (let i = 0; i < sessionDates.length - 1; i++) {
                    const d1 = new Date(sessionDates[i]);
                    const d2 = new Date(sessionDates[i + 1]);
                    const diff = Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
                    if (diff === 1) {
                        currentStreak++;
                    } else {
                        break;
                    }
                }
            }
        }
        console.log(`Calculated Streak: ${currentStreak}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDates();
