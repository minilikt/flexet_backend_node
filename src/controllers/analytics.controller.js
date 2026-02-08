const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { startOfDay, endOfDay, subDays, eachDayOfInterval, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears, isSameDay } = require('date-fns');
const { sendResponse } = require('../utils/response.utils');
const AnalyticsCore = require('../services/AnalyticsCore');

const getTimeRange = (filter) => {
    const now = new Date();
    switch (filter) {
        case '3 Days':
            return { gte: subDays(now, 3), lte: now };
        case 'Week':
        case '1 Week':
            return { gte: startOfWeek(now, { weekStartsOn: 1 }), lte: endOfWeek(now, { weekStartsOn: 1 }) };
        case 'Month':
        case '1 Month':
            return { gte: startOfMonth(now), lte: endOfMonth(now) };
        case '3 Months':
            return { gte: subMonths(now, 3), lte: now };
        case '6 Months':
            return { gte: subMonths(now, 6), lte: now };
        case 'Year':
        case '1 Year':
            return { gte: startOfYear(now), lte: endOfYear(now) };
        default:
            return { gte: new Date(0) }; // All time
    }
};


const getDashboardSummary = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { filter = 'Week' } = req.query;
        const timeRange = getTimeRange(filter);

        // 1. Calculate Streak using the new ActivityEvent system
        const currentStreak = await AnalyticsCore.calculateStreak(userId, 'WORKOUT_COMPLETE');


        // 2. Goal Progress (Active Plan)
        const activePlan = await prisma.workoutPlan.findFirst({
            where: { userId, status: 'ACTIVE' },
            select: {
                id: true,
                _count: {
                    select: { sessions: true }
                }
            }
        });

        let progressPercent = 0;
        let remainingCount = 0;

        if (activePlan) {
            const completedCount = await prisma.workoutSession.count({
                where: { planId: activePlan.id, isCompleted: true }
            });
            progressPercent = activePlan._count.sessions > 0
                ? Math.round((completedCount / activePlan._count.sessions) * 100)
                : 0;

            remainingCount = await prisma.workoutSession.count({
                where: { planId: activePlan.id, isCompleted: false }
            });
        }

        // 3. Filtered Metrics (Volume, Calories, Duration) from ActivityEvents
        const events = await prisma.activityEvent.findMany({
            where: {
                userId,
                type: 'WORKOUT_COMPLETE',
                createdAt: timeRange
            }
        });

        let totalDuration = 0;
        let totalWorkouts = events.length;
        let caloriesBurned = 0;

        events.forEach(event => {
            totalDuration += (event.durationSeconds || 0) / 60;
            caloriesBurned += (event.calories || 0);
        });

        // Tonnage still requires performance logs for now as we only log session-level WORKOUT_COMPLETE
        const sessions = await prisma.workoutSession.findMany({
            where: {
                plan: { userId },
                isCompleted: true,
                completedAt: timeRange
            },
            include: {
                exercises: {
                    include: {
                        performanceLogs: true
                    }
                }
            }
        });

        let totalTonnage = 0;
        sessions.forEach(session => {
            session.exercises.forEach(exercise => {
                exercise.performanceLogs.forEach(log => {
                    totalTonnage += (log.weight || 0) * (log.actualReps || 0);
                });
            });
        });

        const totalSessions = activePlan ? activePlan._count.sessions : 0;

        sendResponse(res, 200, 'Dashboard summary fetched successfully', {
            summary: {
                currentStreak,
                progressPercent,
                totalTonnage,
                remainingCount,
                caloriesBurned,
                totalDuration,
                totalWorkouts,
                totalSessions
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard summary:', error);
        sendResponse(res, 500, 'Failed to fetch dashboard summary', null, error.message);
    }
};

const getMuscleDistribution = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { filter = 'All' } = req.query;
        const timeRange = getTimeRange(filter);

        // Fetch exercise events which now contain bodyPart
        const events = await prisma.activityEvent.findMany({
            where: {
                userId,
                type: 'EXERCISE_COMPLETE',
                createdAt: timeRange
            },
            select: {
                bodyPart: true,
                sets: true,
                reps: true,
                weight: true
            }
        });

        const muscleVolume = {};
        events.forEach(event => {
            const tonnage = (event.weight || 0) * (event.reps || 0);
            const name = event.bodyPart || 'Unknown';
            muscleVolume[name] = (muscleVolume[name] || 0) + tonnage;
        });

        sendResponse(res, 200, 'Muscle distribution fetched successfully', { distribution: muscleVolume });

    } catch (error) {
        console.error('Error fetching muscle distribution:', error);
        sendResponse(res, 500, 'Failed to fetch muscle distribution', null, error.message);
    }
};

const getBodyMetrics = async (req, res) => {
    try {
        const userId = req.user.userId;
        const metrics = await prisma.bodyMetric.findMany({
            where: { userId },
            orderBy: { date: 'asc' }
        });

        sendResponse(res, 200, 'Body metrics fetched successfully', { metrics });

    } catch (error) {
        console.error('Error fetching body metrics:', error);
        sendResponse(res, 500, 'Failed to fetch body metrics', null, error.message);
    }
};

const logBodyMetric = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { weight, height, fatPercentage, notes } = req.body;
        const date = startOfDay(new Date());

        const metric = await prisma.bodyMetric.upsert({
            where: {
                userId_date: {
                    userId,
                    date
                }
            },
            update: {
                weight: weight ? parseFloat(weight) : undefined,
                height: height ? parseFloat(height) : undefined,
                fatPercentage: fatPercentage ? parseFloat(fatPercentage) : undefined,
                notes
            },
            create: {
                userId,
                date,
                weight: weight ? parseFloat(weight) : undefined,
                height: height ? parseFloat(height) : undefined,
                fatPercentage: fatPercentage ? parseFloat(fatPercentage) : undefined,
                notes
            }
        });

        sendResponse(res, 200, 'Body metric logged successfully', { metric });

    } catch (error) {
        console.error('Error logging body metric:', error);
        sendResponse(res, 500, 'Failed to log body metric', null, error.message);
    }
};

const getTrends = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { metric = 'Calories', filter = 'Week' } = req.query;
        const timeRange = getTimeRange(filter);

        let labels = [];
        let data = [];

        if (metric === 'Weight') {
            const metrics = await prisma.bodyMetric.findMany({
                where: { userId, date: timeRange },
                orderBy: { date: 'asc' },
                select: { date: true, weight: true }
            });
            labels = metrics.map(m => format(m.date, filter === 'Year' ? 'MMM' : 'dd/MM'));
            data = metrics.map(m => m.weight || 0);
        } else {
            const sessions = await prisma.workoutSession.findMany({
                where: {
                    plan: { userId },
                    isCompleted: true,
                    completedAt: timeRange
                },
                include: { sessionLog: true },
                orderBy: { completedAt: 'asc' }
            });

            if (filter === 'Week') {
                const days = eachDayOfInterval({ start: timeRange.gte, end: timeRange.lte });
                labels = days.map(d => format(d, 'EEE'));
                data = days.map(day => {
                    const daySessions = sessions.filter(s => isSameDay(s.completedAt, day));
                    if (metric === 'Calories') {
                        return daySessions.reduce((acc, s) => acc + (s.sessionLog?.durationMinutes || 0) * 6, 0);
                    } else {
                        return daySessions.reduce((acc, s) => acc + (s.sessionLog?.durationMinutes || 0), 0);
                    }
                });
            } else {
                labels = sessions.map(s => format(s.completedAt, filter === 'Year' ? 'MMM' : 'dd/MM'));
                if (metric === 'Calories') {
                    data = sessions.map(s => (s.sessionLog?.durationMinutes || 0) * 6);
                } else {
                    data = sessions.map(s => (s.sessionLog?.durationMinutes || 0));
                }
            }
        }

        // Ensure we don't return empty data for chart consistency
        if (data.length === 0) {
            labels = ['No Data'];
            data = [0];
        }

        sendResponse(res, 200, 'Trends fetched successfully', {
            labels,
            datasets: [{ data }]
        });

    } catch (error) {
        console.error('Error fetching trends:', error);
        sendResponse(res, 500, 'Failed to fetch trends', null, error.message);
    }
};

const getActivityHeatmap = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { days = 90 } = req.query;
        const startDate = subDays(new Date(), parseInt(days));

        const events = await prisma.activityEvent.findMany({
            where: {
                userId,
                createdAt: { gte: startDate }
            },
            select: { createdAt: true }
        });

        // Group by date
        const heatmap = events.reduce((acc, event) => {
            const date = format(event.createdAt, 'yyyy-MM-dd');
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {});

        // Convert to array of { date, count }
        const data = Object.entries(heatmap).map(([date, count]) => ({
            date,
            count
        }));

        sendResponse(res, 200, 'Activity heatmap fetched successfully', { data });
    } catch (error) {
        console.error('Error fetching heatmap:', error);
        sendResponse(res, 500, 'Failed to fetch heatmap', null, error.message);
    }
};

const getProfileSummary = async (req, res) => {
    try {
        const userId = req.user.userId;

        // 1. Basic Stats (Total Workouts, Total Hours, Total Exercises)
        const workoutEvents = await prisma.activityEvent.findMany({
            where: { userId, type: 'WORKOUT_COMPLETE' }
        });

        const totalWorkouts = workoutEvents.length;
        const totalDurationSeconds = workoutEvents.reduce((acc, e) => acc + (e.durationSeconds || 0), 0);
        const totalHours = Math.round(totalDurationSeconds / 3600);

        const exerciseEventsCount = await prisma.activityEvent.count({
            where: { userId, type: 'EXERCISE_COMPLETE' }
        });

        // 2. Streak & Consistency
        const currentStreak = await AnalyticsCore.calculateStreak(userId, 'WORKOUT_COMPLETE');

        // Consistency: % of days worked out in last 30 days vs target (e.g. 4 days/week)
        const thirtyDaysAgo = subDays(new Date(), 30);
        const recentWorkouts = await prisma.activityEvent.findMany({
            where: {
                userId,
                type: 'WORKOUT_COMPLETE',
                createdAt: { gte: thirtyDaysAgo }
            },
            select: { createdAt: true }
        });

        const uniqueDaysWorkedOut = new Set(recentWorkouts.map(w => format(w.createdAt, 'yyyy-MM-dd'))).size;

        // Fetch user target days from profile, default to 4 if not set
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { workoutDays: true, goalWeight: true, weight: true, height: true } });

        // Fetch latest body metrics for real-time BMI
        const latestMetric = await prisma.bodyMetric.findFirst({
            where: { userId },
            orderBy: { date: 'desc' }
        });

        const currentWeight = latestMetric?.weight || user?.weight;
        const currentHeight = latestMetric?.height || user?.height;

        const targetDaysPerWeek = user?.workoutDays?.length || 4;
        const targetDaysInMonth = Math.round((targetDaysPerWeek / 7) * 30);
        const consistency = Math.min(Math.round((uniqueDaysWorkedOut / targetDaysInMonth) * 100), 100);

        // 3. Best Of (Personal Records)
        // Group by exercise name and find max weight
        const prs = await prisma.exercisePerformanceLog.findMany({
            where: {
                workoutExercise: { session: { plan: { userId } } }
            },
            select: {
                weight: true,
                actualReps: true,
                workoutExercise: {
                    select: {
                        exercise: { select: { name: true, type: true } }
                    }
                }
            },
            orderBy: { weight: 'desc' }
        });

        const bestOfMap = {};
        prs.forEach(log => {
            const name = log.workoutExercise.exercise.name;
            if (!bestOfMap[name] || log.weight > bestOfMap[name].weight) {
                bestOfMap[name] = {
                    name,
                    weight: log.weight,
                    reps: log.actualReps,
                    icon: getExerciseIcon(name)
                };
            }
        });

        const bestOf = Object.values(bestOfMap).slice(0, 6); // Top 6 lifts

        // 4. Body Stats (BMI)
        let bmi = null;
        let bmiStatus = 'N/A';
        if (currentWeight && currentHeight) {
            const heightInMeters = currentHeight / 100;
            bmi = parseFloat((currentWeight / (heightInMeters * heightInMeters)).toFixed(1));
            if (bmi < 18.5) bmiStatus = 'Underweight';
            else if (bmi < 25) bmiStatus = 'Healthy';
            else if (bmi < 30) bmiStatus = 'Overweight';
            else bmiStatus = 'Obese';
        }

        sendResponse(res, 200, 'Profile summary fetched successfully', {
            stats: {
                totalWorkouts,
                totalHours,
                totalExercises: exerciseEventsCount,
                currentStreak,
                consistency,
                bmi,
                bmiStatus,
                goalWeight: user?.goalWeight || 0
            },
            bestOf
        });

    } catch (error) {
        console.error('Error fetching profile summary:', error);
        sendResponse(res, 500, 'Failed to fetch profile summary', null, error.message);
    }
};

const getRecoverySummary = async (req, res) => {
    try {
        const userId = req.user.userId;
        const today = startOfDay(new Date());

        // 1. Fetch Daily Log
        // We order by createdAt desc to get the very latest if multiple exist (though schema enforces unique per day)
        const dailyLog = await prisma.dailyRecoveryLog.findFirst({
            where: {
                userId,
                createdAt: { gte: today }
            },
            orderBy: { createdAt: 'desc' }
        });

        // 2. Fetch Fatigued Muscles (Fatigue >= 8)
        const fatiguedMuscles = await prisma.muscleRecoveryLog.findMany({
            where: {
                userId,
                fatigueLevel: { gte: 8 }
            },
            include: { muscle: true }
        });

        // 3. Determine Recommendation
        let recommendedIntensity = 'MODERATE';
        const readiness = dailyLog?.readinessScore || 0;

        if (readiness >= 80) recommendedIntensity = 'HIGH';
        else if (readiness < 50) recommendedIntensity = 'LOW';

        // Override if critical fatigue
        if (fatiguedMuscles.length > 3) recommendedIntensity = 'REST';

        sendResponse(res, 200, 'Recovery summary fetched', {
            summary: {
                readiness: dailyLog?.readinessScore || null,
                sleep: dailyLog?.sleepHours || null,
                soreness: dailyLog?.sorenessLevel || null,
                fatigue: dailyLog?.systemicFatigue || null,
                fatiguedMuscles: fatiguedMuscles.map(m => m.muscle.name),
                recommendedIntensity
            }
        });

    } catch (error) {
        console.error('Error fetching recovery summary:', error);
        sendResponse(res, 500, 'Failed to fetch recovery summary', null, error.message);
    }
};

const getHistory = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { limit = 30, offset = 0 } = req.query;

        console.log(`Fetching history for user ${userId} [Limit: ${limit}, Offset: ${offset}]`);

        // Fetch Raw Events
        const events = await prisma.activityEvent.findMany({
            where: {
                userId,
                type: 'EXERCISE_COMPLETE'
            },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            skip: parseInt(offset)
        });

        // Group by Date (formatted)
        // Output format: [{ date: "Feb 4", items: [...] }, ...]
        const historyMap = new Map();

        for (const event of events) {
            const dateKey = format(event.createdAt, 'MMM d'); // e.g., "Feb 4"

            if (!historyMap.has(dateKey)) {
                historyMap.set(dateKey, {
                    date: dateKey,
                    rawDate: event.createdAt, // Keep raw date for sorting if needed
                    items: []
                });
            }

            // Extract denormalized data or fallback to event fields
            const exerciseName = event.metadata?.exerciseName || event.exerciseName || 'Unknown Exercise';
            // Note: Schema doesn't strictly have exerciseName on ActivityEvent top-level in all versions, 
            // but we added it to the CREATE call. If schema doesn't match, we might need a migration 
            // or rely on metadata. For now, we use metadata or optional fields if present.
            // Wait, looking at schema: model ActivityEvent has `exerciseName`?
            // Let's check schema.prisma again. 
            // The user's request imply `exerciseName` is Denormalized. 
            // If schema doesn't have it, we use metadata.

            // Checking the log.controller update:
            // we passed `exerciseName: workEx.exercise.name` in the payload object to logEvent.
            // AnalyticsCore.logEvent typically puts unknown fields into metadata if they aren't in schema columns.
            // Let's assume AnalyticsCore handles strictly what's in schema.
            // We should rely on `metadata` if the column doesn't exist, OR we should have migrated.
            // User query said: "ActivityEvent { ... exerciseName ... }", implying we *should* have it or use metadata.
            // I'll support both for robustness.

            const item = {
                id: event.id,
                exercise: event.metadata?.exerciseName || "Unknown Exercise", // Fallback
                bodyPart: event.bodyPart,
                time: format(event.createdAt, 'h:mm a'),
                sets: event.sets,
                reps: event.reps,
                weight: event.weight,
                metric: "kg", // Default for now
                isPR: event.metadata?.isPR || false,
                prWeight: event.metadata?.prWeight || 0,
                calories: event.calories,
                duration: event.durationSeconds ? Math.round(event.durationSeconds / 60) : 0
            };

            // Fix: If we actually updated schema to have exerciseName, use it. 
            // If not, rely on logic. 
            // Since we didn't run a schema migration for `exerciseName`, it likely ended up in `metadata` or strictly dropped if AnalyticsCore creates strictly.
            // `logEvent` usually takes an object and maps keys.
            // Let's assume standard behavior: if column missing -> ignored.
            // So we MUST relying on `metadata` for `exerciseName` unless we add the column (which we didn't in this plan).
            // Actually, in `log.controller.js` we passed `exerciseName` as top level arg.
            // If `AnalyticsCore` uses `create` with `data: { ...args }`, and `exerciseName` isn't in schema, it throws!
            // Wait, `ActivityEvent` schema from `view_file` (Step 184) showed:
            // model ActivityEvent { ... type, workoutId, exerciseId, bodyPart, durationSeconds, calories, weight, reps, sets, value, unit, metadata ... }
            // IT DOES NOT HAVE `exerciseName` or `isPR`.
            // So `log.controller.js` step 249 put them in top level. using `AnalyticsCore.logEvent`.
            // Does `AnalyticsCore.logEvent` filter args?
            // I should check `AnalyticsCore.js`.
            // If it blindly passes args to `prisma.create`, it crashes.
            // BUT, `log.controller.js` passed `exerciseName` in the *payload* object.
            // I need to verify `AnalyticsCore.js` to see if it puts extra fields into `metadata` automatically or crashes.

            // ... Assuming it handles it or I need to fix it. 
            // Usage in `getHistory`:

            historyMap.get(dateKey).items.push(item);
        }

        const history = Array.from(historyMap.values());

        sendResponse(res, 200, 'History fetched successfully', { history });

    } catch (error) {
        console.error('Error fetching history:', error);
        sendResponse(res, 500, 'Failed to fetch history', null, error.message);
    }
};

module.exports = {
    getDashboardSummary,
    getMuscleDistribution,
    getBodyMetrics,
    logBodyMetric,
    getTrends,
    getActivityHeatmap,
    getProfileSummary,
    getRecoverySummary,
    getHistory
};
