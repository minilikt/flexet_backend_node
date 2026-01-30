const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { startOfDay, endOfDay, subDays, eachDayOfInterval, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears, isSameDay } = require('date-fns');
const { sendResponse } = require('../utils/response.utils');

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

        // 1. Calculate Streak (Always 60 days)
        const sixtyDaysAgo = subDays(new Date(), 60);
        const streakSessions = await prisma.workoutSession.findMany({
            where: {
                plan: { userId },
                isCompleted: true,
                completedAt: { gte: sixtyDaysAgo }
            },
            orderBy: { completedAt: 'desc' },
            select: { completedAt: true }
        });

        let currentStreak = 0;
        if (streakSessions.length > 0) {
            const sessionDates = [...new Set(streakSessions.map(s => format(s.completedAt, 'yyyy-MM-dd')))];
            const today = format(new Date(), 'yyyy-MM-dd');
            const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

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

        // 3. Filtered Metrics (Volume, Calories, Duration)
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
                },
                sessionLog: true
            }
        });

        let totalTonnage = 0;
        let totalDuration = 0;
        let totalWorkouts = sessions.length;

        sessions.forEach(session => {
            totalDuration += (session.sessionLog?.durationMinutes || 0);
            session.exercises.forEach(exercise => {
                exercise.performanceLogs.forEach(log => {
                    totalTonnage += (log.weight || 0) * (log.actualReps || 0);
                });
            });
        });

        // Simple calorie calculation: 6 calories per minute
        const caloriesBurned = totalDuration * 6;

        sendResponse(res, 200, 'Dashboard summary fetched successfully', {
            summary: {
                currentStreak,
                progressPercent,
                totalTonnage,
                remainingCount,
                caloriesBurned,
                totalDuration,
                totalWorkouts
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

        // Fetch logs with selective fields to reduce memory overhead
        const logs = await prisma.exercisePerformanceLog.findMany({
            where: {
                workoutExercise: {
                    session: {
                        plan: { userId },
                        completedAt: timeRange
                    }
                }
            },
            select: {
                weight: true,
                actualReps: true,
                workoutExercise: {
                    select: {
                        exercise: {
                            select: {
                                muscles: {
                                    where: { role: 'PRIMARY' },
                                    select: {
                                        muscle: {
                                            select: { name: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        const muscleVolume = {};
        logs.forEach(log => {
            const tonnage = (log.weight || 0) * (log.actualReps || 0);
            const primaryMuscles = log.workoutExercise.exercise.muscles;

            primaryMuscles.forEach(pm => {
                const name = pm.muscle.name;
                muscleVolume[name] = (muscleVolume[name] || 0) + tonnage;
            });
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

module.exports = {
    getDashboardSummary,
    getMuscleDistribution,
    getBodyMetrics,
    logBodyMetric,
    getTrends
};
