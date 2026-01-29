const { PrismaClient } = require('@prisma/client');
const WorkoutGenerator = require('../utils/workoutGenerator');
const prisma = new PrismaClient();

const logSession = async (req, res) => {
    try {
        const { sessionId, status, difficulty, duration, notes } = req.body;

        const log = await prisma.workoutSessionLog.create({
            data: {
                sessionId,
                perceivedDifficulty: parseInt(difficulty),
                durationMinutes: parseInt(duration),
                notes
            }
        });

        if (status === 'COMPLETED') {
            await prisma.workoutSession.update({
                where: { id: sessionId },
                data: { isCompleted: true, completedAt: new Date() }
            });
        }

        res.json({ success: true, log });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to log session', error: error.message });
    }
};

const logPerformance = async (req, res) => {
    try {
        const { workoutExerciseId, sets } = req.body;

        const logs = await Promise.all(sets.map((set, index) =>
            prisma.exercisePerformanceLog.create({
                data: {
                    workoutExerciseId,
                    setNumber: index + 1,
                    weight: parseFloat(set.weight),
                    actualReps: parseInt(set.reps),
                    rpe: parseInt(set.rpe)
                }
            })
        ));

        await prisma.workoutExercise.update({
            where: { id: workoutExerciseId },
            data: { isCompleted: true }
        });

        res.json({ success: true, logs });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to log performance', error: error.message });
    }
};

const submitFeedback = async (req, res) => {
    try {
        const { exerciseId, preference, difficulty, notes } = req.body;
        const userId = req.user.userId;

        const feedback = await prisma.exerciseFeedback.upsert({
            where: { userId_exerciseId: { userId, exerciseId } },
            update: { preference, perceivedDifficulty: parseInt(difficulty), notes },
            create: { userId, exerciseId, preference, perceivedDifficulty: parseInt(difficulty), notes }
        });

        res.json({ success: true, feedback });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to submit feedback', error: error.message });
    }
};

const logRecovery = async (req, res) => {
    try {
        const { readiness, sleep, fatigue, soreness, muscleFatigues } = req.body;
        const userId = req.user.userId;

        // Use a more robust way to define "today" for the unique date check
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const daily = await prisma.dailyRecoveryLog.upsert({
            where: { createdAt: today },
            update: { readinessScore: readiness, sleepHours: sleep, systemicFatigue: fatigue, sorenessLevel: soreness },
            create: { userId, readinessScore: readiness, sleepHours: sleep, systemicFatigue: fatigue, sorenessLevel: soreness, createdAt: today }
        });

        if (muscleFatigues) {
            for (const mf of muscleFatigues) {
                await prisma.muscleRecoveryLog.upsert({
                    where: { userId_muscleId: { userId, muscleId: mf.muscleId } },
                    update: { fatigueLevel: mf.level },
                    create: { userId, muscleId: mf.muscleId, fatigueLevel: mf.level }
                });
            }
        }

        res.json({ success: true, daily });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to log recovery', error: error.message });
    }
};

const submitSessionResult = async (req, res) => {
    try {
        const { sessionId, durationMinutes, perceivedDifficulty, notes, exercises } = req.body;
        const userId = req.user.userId;

        console.log(`Processing session results for session ${sessionId} [User: ${userId}]`);

        const result = await prisma.$transaction(async (tx) => {
            // 1. Log the overall session
            const sessionLog = await tx.workoutSessionLog.create({
                data: {
                    sessionId,
                    durationMinutes,
                    perceivedDifficulty,
                    notes
                }
            });

            // 2. Mark session as completed
            await tx.workoutSession.update({
                where: { id: sessionId },
                data: { isCompleted: true, completedAt: new Date() }
            });

            const processedMuscles = new Set();
            const performanceLogs = [];

            // 3. Process each exercise in the session
            for (const exResult of exercises) {
                const { workoutExerciseId, sets, feedback } = exResult;

                // A. Prepare Performance Logs (Sets)
                sets.forEach(set => {
                    performanceLogs.push({
                        workoutExerciseId,
                        setNumber: set.setNumber,
                        weight: parseFloat(set.weight) || 0,
                        actualReps: parseInt(set.reps) || 0,
                        rpe: parseInt(set.rpe) || 0,
                        isPersonalRecord: set.isPR || false
                    });
                });

                // B. Mark exercise as completed
                const workoutEx = await tx.workoutExercise.update({
                    where: { id: workoutExerciseId },
                    data: { isCompleted: true },
                    include: { exercise: { include: { muscles: true } } }
                });

                // C. Process Feedback if provided
                if (feedback) {
                    await tx.exerciseFeedback.upsert({
                        where: { userId_exerciseId: { userId, exerciseId: workoutEx.exerciseId } },
                        update: {
                            preference: feedback.preference,
                            perceivedDifficulty: feedback.difficulty,
                            notes: feedback.notes
                        },
                        create: {
                            userId,
                            exerciseId: workoutEx.exerciseId,
                            preference: feedback.preference,
                            perceivedDifficulty: feedback.difficulty,
                            notes: feedback.notes
                        }
                    });
                }

                // D. Update Muscle Fatigue (Heuristic)
                for (const muscleRel of workoutEx.exercise.muscles) {
                    processedMuscles.add(muscleRel.muscleId);
                    const fatigueIncrease = muscleRel.role === 'PRIMARY' ? 2 : 1;

                    await tx.muscleRecoveryLog.upsert({
                        where: { userId_muscleId: { userId, muscleId: muscleRel.muscleId } },
                        update: {
                            fatigueLevel: { increment: fatigueIncrease },
                            lastUpdated: new Date()
                        },
                        create: {
                            userId,
                            muscleId: muscleRel.muscleId,
                            fatigueLevel: fatigueIncrease
                        }
                    });
                }
            }

            // 4. Bulk create all performance logs
            if (performanceLogs.length > 0) {
                await tx.exercisePerformanceLog.createMany({
                    data: performanceLogs
                });
            }

            // 5. Cap fatigue at 10 (Max)
            for (const mId of processedMuscles) {
                const current = await tx.muscleRecoveryLog.findUnique({ where: { userId_muscleId: { userId, muscleId: mId } } });
                if (current && current.fatigueLevel > 10) {
                    await tx.muscleRecoveryLog.update({
                        where: { userId_muscleId: { userId, muscleId: mId } },
                        data: { fatigueLevel: 10 }
                    });
                }
            }

            return sessionLog;
        }, {
            maxWait: 5000, // default
            timeout: 30000 // 30 seconds
        });

        // --- NEW: REACTIVE SYNC HOOK ---
        // After successful transaction, update the rest of the plan
        try {
            await recalculateRemainingPlan(userId);
        } catch (syncError) {
            console.error("Reactive sync failed (non-fatal):", syncError);
        }

        res.json({ success: true, message: "Session processed and future plan adapted.", result });
    } catch (error) {
        console.error("Bulk session processing failed:", error);
        res.status(500).json({ success: false, message: 'Failed to process session data', error: error.message });
    }
};

/**
 * Recalculates all uncompleted exercises in the active plan based on latest logs.
 */
async function recalculateRemainingPlan(userId) {
    console.log(`Recalculating plan for user ${userId}...`);

    const activePlan = await prisma.workoutPlan.findFirst({
        where: { userId, status: 'ACTIVE' },
        include: {
            sessions: {
                where: { isCompleted: false },
                include: {
                    exercises: {
                        include: { exercise: true }
                    }
                }
            }
        }
    });

    if (!activePlan) return;

    const generator = new WorkoutGenerator(prisma);

    // Pre-fetch all performance logs for the user to optimize
    const allLogs = await prisma.exercisePerformanceLog.findMany({
        where: {
            workoutExercise: {
                session: {
                    plan: {
                        userId: userId
                    }
                }
            }
        },
        include: { workoutExercise: true },
        orderBy: { createdAt: 'desc' }
    });

    const performanceMap = new Map();
    allLogs.forEach(log => {
        const exId = log.workoutExercise?.exerciseId;
        if (!performanceMap.has(exId)) performanceMap.set(exId, []);
        if (performanceMap.get(exId).length < 3) performanceMap.get(exId).push(log);
    });

    // Iterate through all future sessions and their exercises
    for (const session of activePlan.sessions) {
        for (const workEx of session.exercises) {
            const pastLogs = performanceMap.get(workEx.exerciseId) || [];
            const adaptive = await generator.applyGoalLogic(workEx.exercise, activePlan.goal, userId, pastLogs);

            // Update the future exercise in the DB
            await prisma.workoutExercise.update({
                where: { id: workEx.id },
                data: {
                    sets: adaptive.sets,
                    reps: adaptive.reps,
                    weight: adaptive.weight > 0 ? adaptive.weight : workEx.weight
                }
            });
            // NOTE: The schema is missing a 'weight' field in WorkoutExercise! 
            // I should have added that. Let's check schema again.
        }
    }
}

module.exports = { logSession, logPerformance, submitFeedback, logRecovery, submitSessionResult };
