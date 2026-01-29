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

        let normPreference = preference ? preference.toUpperCase() : null;
        const validPreferences = ['LIKE', 'DISLIKE', 'AVOID'];
        if (!validPreferences.includes(normPreference)) {
            normPreference = null;
        }

        const feedback = await prisma.exerciseFeedback.upsert({
            where: { userId_exerciseId: { userId, exerciseId } },
            update: { preference: normPreference, perceivedDifficulty: parseInt(difficulty), notes },
            create: { userId, exerciseId, preference: normPreference, perceivedDifficulty: parseInt(difficulty), notes }
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
            console.log(`Bulk processing ${exercises.length} exercises...`);
            // 1. Log overall session and mark as completed
            const [sessionLog] = await Promise.all([
                tx.workoutSessionLog.create({
                    data: { sessionId, durationMinutes, perceivedDifficulty, notes }
                }),
                tx.workoutSession.update({
                    where: { id: sessionId },
                    data: { isCompleted: true, completedAt: new Date() }
                })
            ]);

            const muscleFatigueChanges = new Map(); // muscleId -> increment
            const performanceLogs = [];
            const feedbackUpserts = [];
            const exerciseUpdates = [];

            // 2. Accumulate data in-memory
            for (const exResult of exercises) {
                const { workoutExerciseId, sets, feedback } = exResult;

                // A. Performance Logs
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

                // B. Batch Exercise Updates & Fatigue mapping
                const workoutEx = await tx.workoutExercise.update({
                    where: { id: workoutExerciseId },
                    data: { isCompleted: true },
                    include: { exercise: { select: { id: true, muscles: { select: { muscleId: true, role: true } } } } }
                });

                // C. Feedback
                if (feedback) {
                    let normPreference = feedback.preference ? feedback.preference.toUpperCase() : null;
                    const validPreferences = ['LIKE', 'DISLIKE', 'AVOID'];
                    if (!validPreferences.includes(normPreference)) {
                        normPreference = null; // Map NEUTRAL or others to null
                    }

                    feedbackUpserts.push(tx.exerciseFeedback.upsert({
                        where: { userId_exerciseId: { userId, exerciseId: workoutEx.exerciseId } },
                        update: { preference: normPreference, perceivedDifficulty: feedback.difficulty, notes: feedback.notes },
                        create: { userId, exerciseId: workoutEx.exerciseId, preference: normPreference, perceivedDifficulty: feedback.difficulty, notes: feedback.notes }
                    }));
                }

                // D. Aggregate Fatigue
                for (const m of workoutEx.exercise.muscles) {
                    const inc = m.role === 'PRIMARY' ? 2 : 1;
                    muscleFatigueChanges.set(m.muscleId, (muscleFatigueChanges.get(m.muscleId) || 0) + inc);
                }
            }

            // 3. Serialized Batch Updates (Prisma doesn't support aggregate upsert, but we've reduced calls)
            if (performanceLogs.length > 0) {
                await tx.exercisePerformanceLog.createMany({ data: performanceLogs });
            }

            if (feedbackUpserts.length > 0) {
                await Promise.all(feedbackUpserts);
            }

            // E. Apply and Cap Fatigue
            const fatiguePromises = [];
            for (const [muscleId, inc] of muscleFatigueChanges.entries()) {
                fatiguePromises.push((async () => {
                    const current = await tx.muscleRecoveryLog.upsert({
                        where: { userId_muscleId: { userId, muscleId } },
                        update: { fatigueLevel: { increment: inc }, lastUpdated: new Date() },
                        create: { userId, muscleId, fatigueLevel: inc }
                    });

                    if (current.fatigueLevel > 10) {
                        return tx.muscleRecoveryLog.update({
                            where: { id: current.id },
                            data: { fatigueLevel: 10 }
                        });
                    }
                })());
            }
            await Promise.all(fatiguePromises);

            return sessionLog;
        }, {
            maxWait: 10000,
            timeout: 30000
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

    if (!activePlan || !activePlan.sessions.length) return;

    const generator = new WorkoutGenerator(prisma);

    // 1. Batch fetch all logs once (Optimized)
    const allLogs = await prisma.exercisePerformanceLog.findMany({
        where: {
            workoutExercise: {
                session: { plan: { userId } }
            }
        },
        select: {
            weight: true,
            actualReps: true,
            rpe: true,
            workoutExercise: {
                select: { exerciseId: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    const performanceMap = new Map();
    allLogs.forEach(log => {
        const exId = log.workoutExercise?.exerciseId;
        if (!exId) return;
        if (!performanceMap.has(exId)) performanceMap.set(exId, []);
        if (performanceMap.get(exId).length < 3) performanceMap.get(exId).push(log);
    });

    // 2. Prepare all adaptive logic (In-memory loop is fast)
    const updatePromises = [];
    for (const session of activePlan.sessions) {
        for (const workEx of session.exercises) {
            const pastLogs = performanceMap.get(workEx.exerciseId) || [];
            // We can resolve these concurrently but since generators might hit DB (alternatives),
            // let's at least batch the final writes.
            updatePromises.push((async () => {
                const adaptive = await generator.applyGoalLogic(workEx.exercise, activePlan.goal, userId, pastLogs);
                return prisma.workoutExercise.update({
                    where: { id: workEx.id },
                    data: {
                        sets: adaptive.sets,
                        reps: adaptive.reps,
                        weight: adaptive.weight > 0 ? adaptive.weight : workEx.weight
                    }
                });
            })());
        }
    }

    // 3. Execute all updates in parallel (or consider transaction)
    if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        console.log(`Successfully batch updated ${updatePromises.length} future exercises.`);
    }
}

module.exports = { logSession, logPerformance, submitFeedback, logRecovery, submitSessionResult };
