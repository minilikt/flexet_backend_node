const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const USER_ID = 'fb16c549-ea69-4208-82d2-7119a4a38410';

async function main() {
    let output = `\n=== Checking Status for User ${USER_ID} ===\n\n`;
    const logOut = (msg) => { output += msg + '\n'; console.log(msg); };

    try {
        // 1. Check Muscle Recovery Logs (Raw)
        logOut('Querying MuscleRecoveryLog...');
        const fatigue = await prisma.muscleRecoveryLog.findMany({
            where: { userId: USER_ID }
        });
        logOut(`Found ${fatigue.length} fatigue logs.`);

        logOut('--- Muscle Fatigue Levels (Raw) ---');
        fatigue.forEach(item => {
            logOut(`MuscleID ${item.muscleId}: ${item.fatigueLevel}/10`);
        });

        // 2. Check Exercise Feedback
        logOut('\nQuerying ExerciseFeedback...');
        const avoid = await prisma.exerciseFeedback.findMany({
            where: {
                userId: USER_ID,
                preference: 'AVOID'
            }
        });
        logOut(`Found ${avoid.length} avoided exercises.`);
        avoid.forEach(f => logOut(`- ExerciseID: ${f.exerciseId}`));

        fs.writeFileSync('user_status_final.txt', output);
        console.log('Written to user_status_final.txt');

    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
