const { PrismaClient } = require('@prisma/client');
const WorkoutGenerator = require('../utils/workoutGenerator');
const prisma = new PrismaClient();
const { sendResponse } = require('../utils/response.utils');
const AnalyticsCore = require('../services/AnalyticsCore');


const logSession = async (req, res) => {
    try {
        const { sessionId, status, difficulty, duration, notes } = req.body;
        const userId = req.user.userId;

        // Security: Verify Session Ownership
        const session = await prisma.workoutSession.findUnique({
            where: { id: sessionId },
            include: { plan: true }
        });

        if (!session || session.plan.userId !== userId) {
            return sendResponse(res, 403, 'Unauthorized access to this session');
        }

        const clampedDifficulty = difficulty ? Math.min(10, Math.max(1, parseInt(difficulty))) : null;
        const clampedDuration = duration ? Math.max(0, parseInt(duration)) : null;

        const log = await prisma.workoutSessionLog.create({
            data: {
                sessionId,
                perceivedDifficulty: clampedDifficulty,
                durationMinutes: clampedDuration,
                notes
            }
        });

        // REMOVED: Completion logic moved to submitSessionResult to prevent duplicate logging/race conditions.
        // if (status === 'COMPLETED') { ... }

        sendResponse(res, 200, 'Session logged successfully', { log });

    } catch (error) {
        sendResponse(res, 500, 'Failed to log session', null, error.message);
    }
};

const logPerformance = async (req, res) => {
    try {
        const { workoutExerciseId, sets } = req.body;
        const userId = req.user.userId;

        // Security: Verify Exercise Ownership
        const workoutExercise = await prisma.workoutExercise.findUnique({
            where: { id: workoutExerciseId },
            include: { session: { include: { plan: true } } }
        });

        if (!workoutExercise || workoutExercise.session.plan.userId !== userId) {
            return sendResponse(res, 403, 'Unauthorized access to this exercise');
        }

        const logs = await Promise.all(sets.map((set, index) =>
            prisma.exercisePerformanceLog.create({
                data: {
                    workoutExerciseId,
                    setNumber: index + 1,
                    weight: parseFloat(set.weight),
                    actualReps: parseInt(set.reps),
                    rpe: Math.min(10, Math.max(1, parseInt(set.rpe) || 0)),
                    volume: (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0),
                    completed: true
                }
            })
        ));

        await prisma.workoutExercise.update({
            where: { id: workoutExerciseId },
            data: { isCompleted: true }
        });

        sendResponse(res, 200, 'Performance logged successfully', { logs });

    } catch (error) {
        sendResponse(res, 500, 'Failed to log performance', null, error.message);
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

        sendResponse(res, 200, 'Feedback submitted successfully', { feedback });

    } catch (error) {
        sendResponse(res, 500, 'Failed to submit feedback', null, error.message);
    }
};

const logRecovery = async (req, res) => {
    try {
        const { readiness, sleep, fatigue, soreness, muscleFatigues } = req.body;
        const userId = req.user.userId;

        // Validation: Clamp values
        const clamp = (val, min, max) => Math.min(max, Math.max(min, val || 0));

        const safeReadiness = clamp(readiness, 0, 100);
        const safeSleep = Math.max(0, parseFloat(sleep) || 0);
        const safeFatigue = clamp(fatigue, 0, 10);
        const safeSoreness = clamp(soreness, 0, 10);

        // Use a more robust way to define "today" for the unique date check
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const daily = await prisma.dailyRecoveryLog.upsert({
            where: { userId_createdAt: { userId, createdAt: today } },
            where: { userId_createdAt: { userId, createdAt: today } },
            update: { readinessScore: safeReadiness, sleepHours: safeSleep, systemicFatigue: safeFatigue, sorenessLevel: safeSoreness },
            create: { userId, readinessScore: safeReadiness, sleepHours: safeSleep, systemicFatigue: safeFatigue, sorenessLevel: safeSoreness, createdAt: today }
        });

        if (muscleFatigues) {
            for (const mf of muscleFatigues) {
                const safeLevel = clamp(mf.level, 0, 10);
                await prisma.muscleRecoveryLog.upsert({
                    where: { userId_muscleId: { userId, muscleId: mf.muscleId } },
                    update: { fatigueLevel: safeLevel },
                    create: { userId, muscleId: mf.muscleId, fatigueLevel: safeLevel }
                });
            }
        }

        sendResponse(res, 200, 'Recovery logged successfully', { daily });

    } catch (error) {
        sendResponse(res, 500, 'Failed to log recovery', null, error.message);
    }
};

const submitSessionResult = async (req, res) => {
    try {
        const { sessionId, durationMinutes, perceivedDifficulty, notes, exercises } = req.body;
        const userId = req.user.userId;

        // Security: Verify Session Ownership
        const session = await prisma.workoutSession.findUnique({
            where: { id: sessionId },
            include: { plan: true }
        });

        if (!session || session.plan.userId !== userId) {
            return sendResponse(res, 403, 'Unauthorized access to this session');
        }

        // Validation: Clamp session values
        const safeDuration = Math.max(0, parseInt(durationMinutes) || 0);
        const safeDifficulty = perceivedDifficulty ? Math.min(10, Math.max(1, parseInt(perceivedDifficulty))) : null;

        console.log(`Processing session results for session ${sessionId} [User: ${userId}]`);

        const result = await prisma.$transaction(async (tx) => {
            console.log(`Bulk processing ${exercises.length} exercises...`);

            // 1. Log overall session and mark as completed
            const resultSessionLog = tx.workoutSessionLog.create({
                data: { sessionId, durationMinutes: safeDuration, perceivedDifficulty: safeDifficulty, notes }
            });
            const resultSessionUpdate = tx.workoutSession.update({
                where: { id: sessionId },
                data: { isCompleted: true, completedAt: new Date() }
            });

            // 2. Pre-fetch all workout exercises to get exerciseIds and muscle roles
            const workoutExerciseIds = exercises.map(e => e.workoutExerciseId);
            const workoutExercisesMap = await tx.workoutExercise.findMany({
                where: { id: { in: workoutExerciseIds } },
                include: {
                    exercise: {
                        select: {
                            id: true,
                            muscles: { select: { muscleId: true, role: true } }
                        }
                    }
                }
            });

            const weMap = new Map(workoutExercisesMap.map(we => [we.id, we]));

            const muscleFatigueChanges = new Map(); // muscleId -> increment
            const performanceLogs = [];
            const feedbackUpserts = [];
            const exerciseUpdates = [];

            // 3. Prepare all operations in memory
            for (const exResult of exercises) {
                const { workoutExerciseId, sets, feedback } = exResult;
                const workoutEx = weMap.get(workoutExerciseId);

                if (!workoutEx) {
                    console.warn(`WorkoutExercise ${workoutExerciseId} not found, skipping.`);
                    continue;
                }

                // A. Performance Logs
                sets.forEach(set => {
                    performanceLogs.push({
                        workoutExerciseId,
                        setNumber: set.setNumber,
                        weight: parseFloat(set.weight) || 0,
                        actualReps: parseInt(set.reps) || 0,
                        rpe: Math.min(10, Math.max(1, parseInt(set.rpe) || 0)),
                        volume: (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0),
                        isPersonalRecord: set.isPR || false,
                        completed: true
                    });
                });

                // B. Batch Exercise Updates
                exerciseUpdates.push(tx.workoutExercise.update({
                    where: { id: workoutExerciseId },
                    data: { isCompleted: true }
                }));

                // C. Feedback
                if (feedback) {
                    let normPreference = feedback.preference ? feedback.preference.toUpperCase() : null;
                    const validPreferences = ['LIKE', 'DISLIKE', 'AVOID'];
                    if (!validPreferences.includes(normPreference)) {
                        normPreference = null;
                    }

                    feedbackUpserts.push(tx.exerciseFeedback.upsert({
                        where: { userId_exerciseId: { userId, exerciseId: workoutEx.exerciseId } },
                        update: { preference: normPreference, perceivedDifficulty: feedback.difficulty, notes: feedback.notes },
                        create: { userId, exerciseId: workoutEx.exerciseId, preference: normPreference, perceivedDifficulty: feedback.difficulty, notes: feedback.notes }
                    }));
                }

                // D. Aggregate Fatigue
                if (workoutEx.exercise && workoutEx.exercise.muscles) {
                    for (const m of workoutEx.exercise.muscles) {
                        const inc = m.role === 'PRIMARY' ? 2 : 1;
                        muscleFatigueChanges.set(m.muscleId, (muscleFatigueChanges.get(m.muscleId) || 0) + inc);
                    }
                }
            }

            // 4. Batch Execute Everything
            const [sessionLog] = await Promise.all([
                resultSessionLog,
                resultSessionUpdate,
                ...exerciseUpdates,
                ...feedbackUpserts,
                tx.exercisePerformanceLog.createMany({ data: performanceLogs })
            ]);

            // 5. Apply Fatigue (concurrently)
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

        // --- EMIT EVENTS AFTER TRANSACTION TO REDUCE LOCK TIME ---
        try {
            // 1. Log overall workout
            await AnalyticsCore.logEvent(userId, 'WORKOUT_COMPLETE', {
                workoutId: sessionId,
                durationSeconds: (durationMinutes || 0) * 60,
                calories: (durationMinutes || 0) * 6,
                metadata: { notes }
            });

            // 2. Log per-exercise stats
            // Fetch updated exercise details (with specific primary muscles)
            const workoutExerciseIds = exercises.map(e => e.workoutExerciseId);
            const exerciseDetails = await prisma.workoutExercise.findMany({
                where: { id: { in: workoutExerciseIds } },
                include: { exercise: { include: { muscles: { where: { role: 'PRIMARY' }, include: { muscle: true } } } } }
            });
            const exMap = new Map(exerciseDetails.map(e => [e.id, e]));

            for (const exResult of exercises) {
                const { workoutExerciseId, sets } = exResult;
                const workEx = exMap.get(workoutExerciseId);

                if (workEx) {
                    const primaryMuscle = workEx.exercise.muscles[0]?.muscle.name || 'Unknown';
                    const totalReps = sets.reduce((sum, s) => sum + (parseInt(s.reps) || 0), 0);
                    // Use max weight instead of average for PR tracking (and general "heaviest set")
                    const maxWeight = sets.length > 0 ? Math.max(...sets.map(s => parseFloat(s.weight) || 0)) : 0;

                    // PR Detection
                    const previousBest = await prisma.exercisePerformanceLog.findFirst({
                        where: {
                            workoutExercise: {
                                exerciseId: workEx.exerciseId,
                                session: {
                                    plan: { userId },
                                    completedAt: { lt: new Date() } // Look at past sessions
                                }
                            }
                        },
                        orderBy: { weight: 'desc' },
                        select: { weight: true }
                    });

                    const isPR = !previousBest || maxWeight > previousBest.weight;
                    const prWeight = isPR ? maxWeight : (previousBest?.weight || 0);

                    await AnalyticsCore.logEvent(userId, 'EXERCISE_COMPLETE', {
                        workoutId: sessionId,
                        exerciseId: workEx.exerciseId,
                        exerciseName: workEx.exercise.name, // Denormalized name
                        bodyPart: primaryMuscle,
                        sets: sets.length,
                        reps: totalReps,
                        weight: maxWeight, // Store max weight for history display
                        isPR,
                        prWeight,
                        metadata: {
                            workoutExerciseId,
                            denormalizedData: {
                                sets: sets.length,
                                maxWeight,
                                totalReps
                            }
                        }
                    });
                }
            }
        } catch (eventError) {
            console.error("Event logging failed (non-fatal):", eventError);
        }

        // --- NEW: REACTIVE SYNC HOOK ---
        // After successful transaction, update the rest of the plan
        try {
            await recalculateRemainingPlan(userId);
        } catch (syncError) {
            console.error("Reactive sync failed (non-fatal):", syncError);
        }

        sendResponse(res, 200, "Session processed and future plan adapted.", { result });

    } catch (error) {
        console.error("Bulk session processing failed:", error);
        sendResponse(res, 500, 'Failed to process session data', null, error.message);
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
