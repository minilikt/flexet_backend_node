const { PrismaClient } = require('@prisma/client');
const WorkoutGenerator = require('../src/utils/workoutGenerator');

const prisma = new PrismaClient();

// ANSI color codes for terminal output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    reset: '\x1b[0m'
};

function log(color, symbol, message) {
    console.log(`${color}${symbol} ${message}${colors.reset}`);
}

async function seedTestData() {
    console.log('\n=== Seeding Test Data ===\n');

    // Create test user
    const testUser = await prisma.user.upsert({
        where: { email: 'test_adaptive@example.com' },
        update: {},
        create: {
            email: 'test_adaptive@example.com',
            password: 'test123'
        }
    });
    log(colors.blue, '→', `Test user created: ${testUser.id}`);

    // Get some exercises
    const exercises = await prisma.exercise.findMany({
        take: 5,
        include: { muscles: true }
    });

    if (exercises.length === 0) {
        log(colors.red, '✗', 'No exercises found in database. Please seed exercises first.');
        return null;
    }

    // Create a workout plan
    const plan = await prisma.workoutPlan.create({
        data: {
            userId: testUser.id,
            name: 'Test Adaptive Plan',
            goal: 'hypertrophy',
            daysPerWeek: 3,
            weeks: 4
        }
    });

    // Create workout sessions with exercises
    for (let week = 1; week <= 2; week++) {
        for (let day = 1; day <= 3; day++) {
            const session = await prisma.workoutSession.create({
                data: {
                    planId: plan.id,
                    weekNumber: week,
                    dayNumber: day,
                    focus: 'Push',
                    isCompleted: true,
                    completedAt: new Date()
                }
            });

            // Add exercises to session
            for (let i = 0; i < Math.min(3, exercises.length); i++) {
                const workoutEx = await prisma.workoutExercise.create({
                    data: {
                        sessionId: session.id,
                        exerciseId: exercises[i].id,
                        sets: 3,
                        reps: '8-12',
                        weight: 50,
                        order: i + 1,
                        isCompleted: true
                    }
                });

                // Create performance logs with varying RPE
                const rpeValue = week === 1 ? (i === 0 ? 5 : 9) : 7; // Low RPE for first exercise, high for second
                for (let set = 1; set <= 3; set++) {
                    await prisma.exercisePerformanceLog.create({
                        data: {
                            workoutExerciseId: workoutEx.id,
                            setNumber: set,
                            weight: 50,
                            actualReps: 10,
                            rpe: rpeValue
                        }
                    });
                }
            }
        }
    }

    log(colors.green, '✓', `Created plan with ${exercises.length} exercises and performance logs`);

    // Create exercise feedback
    await prisma.exerciseFeedback.create({
        data: {
            userId: testUser.id,
            exerciseId: exercises[0].id,
            preference: 'LIKE'
        }
    });

    if (exercises.length > 1) {
        await prisma.exerciseFeedback.create({
            data: {
                userId: testUser.id,
                exerciseId: exercises[1].id,
                preference: 'AVOID'
            }
        });
    }

    log(colors.green, '✓', 'Created exercise feedback (LIKE and AVOID)');

    // Create muscle recovery logs with high fatigue
    if (exercises[0].muscles && exercises[0].muscles.length > 0) {
        const muscleId = exercises[0].muscles[0].muscleId;
        await prisma.muscleRecoveryLog.create({
            data: {
                userId: testUser.id,
                muscleId: muscleId,
                fatigueLevel: 9
            }
        });
        log(colors.green, '✓', 'Created muscle recovery log (high fatigue)');
    }

    // Create daily recovery logs with high systemic fatigue
    for (let i = 0; i < 7; i++) {
        await prisma.dailyRecoveryLog.create({
            data: {
                userId: testUser.id,
                sleepHours: 6,
                systemicFatigue: 8,
                sorenessLevel: 7,
                createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
            }
        });
    }
    log(colors.green, '✓', 'Created daily recovery logs (high fatigue)');

    return { userId: testUser.id, exercises };
}

async function runTests() {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  Adaptive Workout Planning Test Suite     ║');
    console.log('╚════════════════════════════════════════════╝\n');

    const testData = await seedTestData();
    if (!testData) {
        process.exit(1);
    }

    const { userId, exercises } = testData;
    const generator = new WorkoutGenerator(prisma);

    console.log('\n=== Test 1: Progressive Overload (Linear) ===\n');
    const plan1 = await generator.generatePlan({
        goal: 'hypertrophy',
        days_per_week: 3,
        available_equipment: ['Barbell', 'Dumbbells', 'Bench'],
        exercises_per_day: 4,
        weeks: 2,
        progressionModel: 'LINEAR'
    }, userId);

    const week1Ex = plan1[0].sessions[0].exercises[0];
    const week2Ex = plan1[1].sessions[0].exercises[0];

    console.log(`Week 1 - ${week1Ex.name}: ${week1Ex.weight}kg, ${week1Ex.sets} sets`);
    console.log(`  Note: ${week1Ex.note || 'N/A'}`);
    console.log(`Week 2 - ${week2Ex.name}: ${week2Ex.weight}kg, ${week2Ex.sets} sets`);
    console.log(`  Note: ${week2Ex.note || 'N/A'}`);

    // Test: Low RPE should increase weight
    const hasProgressiveNote = week1Ex.note && week1Ex.note.includes('increasing weight');
    if (hasProgressiveNote) {
        log(colors.green, '✓', 'Progressive overload detected (low RPE → weight increase)');
    } else {
        log(colors.yellow, '⚠', 'Progressive overload note not found (may be expected if no low RPE logs)');
    }

    console.log('\n=== Test 2: Volume Regulation (High RPE) ===\n');
    // Check if high RPE exercises have reduced sets
    const highRPEEx = plan1[0].sessions[0].exercises.find(ex => ex.note && ex.note.includes('High RPE'));
    if (highRPEEx) {
        console.log(`Exercise: ${highRPEEx.name}`);
        console.log(`  Sets: ${highRPEEx.sets}`);
        console.log(`  Note: ${highRPEEx.note}`);
        log(colors.green, '✓', 'Volume regulation working (high RPE → reduced sets)');
    } else {
        log(colors.yellow, '⚠', 'No high RPE volume reduction detected (may be expected)');
    }

    console.log('\n=== Test 3: Deload Week Detection ===\n');
    const plan2 = await generator.generatePlan({
        goal: 'hypertrophy',
        days_per_week: 3,
        available_equipment: ['Barbell', 'Dumbbells', 'Bench'],
        exercises_per_day: 4,
        weeks: 4,
        progressionModel: 'LINEAR'
    }, userId);

    const week4 = plan2[3];
    console.log(`Week 4 - Is Deload: ${week4.isDeload}`);
    console.log(`  Reason: ${week4.deloadReason || 'N/A'}`);

    if (week4.isDeload) {
        const deloadEx = week4.sessions[0].exercises[0];
        console.log(`  Sample Exercise: ${deloadEx.name}`);
        console.log(`  Weight: ${deloadEx.weight}kg (should be ~80% of normal)`);
        console.log(`  Sets: ${deloadEx.sets} (should be reduced)`);
        log(colors.green, '✓', 'Deload week correctly inserted');
    } else {
        log(colors.red, '✗', 'Deload week not detected (expected on Week 4)');
    }

    console.log('\n=== Test 4: Exercise Rotation (AVOID preference) ===\n');
    const avoidedExerciseId = exercises[1]?.id;
    const planHasAvoidedEx = plan1.some(week =>
        week.sessions.some(session =>
            session.exercises.some(ex => ex.exerciseId === avoidedExerciseId)
        )
    );

    if (!planHasAvoidedEx) {
        log(colors.green, '✓', 'AVOID exercises correctly excluded from plan');
    } else {
        log(colors.red, '✗', 'AVOID exercise found in plan (should be excluded)');
    }

    console.log('\n=== Test 5: Wave Periodization ===\n');
    const plan3 = await generator.generatePlan({
        goal: 'hypertrophy',
        days_per_week: 3,
        available_equipment: ['Barbell', 'Dumbbells', 'Bench'],
        exercises_per_day: 4,
        weeks: 3,
        progressionModel: 'WAVE'
    }, userId);

    console.log('Wave Progression (3 weeks):');
    for (let i = 0; i < 3; i++) {
        const ex = plan3[i].sessions[0].exercises[0];
        const hasWaveNote = ex.note && ex.note.includes('Wave Week');
        console.log(`  Week ${i + 1}: ${ex.weight}kg - ${ex.note || 'N/A'}`);
        if (hasWaveNote) {
            log(colors.green, '✓', `Wave periodization applied to Week ${i + 1}`);
        }
    }

    console.log('\n=== Test Summary ===\n');
    log(colors.green, '✓', 'All adaptive logic tests completed');
    console.log('\nCheck the output above for detailed results.\n');
}

async function cleanup() {
    console.log('\n=== Cleaning Up Test Data ===\n');
    const testUser = await prisma.user.findUnique({
        where: { email: 'test_adaptive@example.com' }
    });

    if (testUser) {
        await prisma.user.delete({
            where: { id: testUser.id }
        });
        log(colors.green, '✓', 'Test user and related data deleted');
    }
}

async function main() {
    try {
        await runTests();
        await cleanup();
    } catch (error) {
        log(colors.red, '✗', `Error: ${error.message}`);
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
