const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { startOfDay, endOfDay, subDays, eachDayOfInterval, format } = require('date-fns');

const getDashboardSummary = async (req, res) => {
    try {
        const userId = req.user.userId;

        // 1. Calculate Streak (Limited to last 60 days for performance)
        const sixtyDaysAgo = subDays(new Date(), 60);
        const sessions = await prisma.workoutSession.findMany({
            where: {
                plan: { userId },
                isCompleted: true,
                completedAt: { gte: sixtyDaysAgo }
            },
            orderBy: { completedAt: 'desc' },
            select: { completedAt: true }
        });

        let currentStreak = 0;
        if (sessions.length > 0) {
            const sessionDates = [...new Set(sessions.map(s => format(s.completedAt, 'yyyy-MM-dd')))];
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

        // 2. Goal Progress
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

        // 3. Weekly Volume (Last 7 Days)
        const sevenDaysAgo = subDays(new Date(), 7);
        const volumeLogs = await prisma.exercisePerformanceLog.findMany({
            where: {
                workoutExercise: {
                    session: {
                        plan: { userId },
                        completedAt: { gte: sevenDaysAgo }
                    }
                }
            },
            select: {
                weight: true,
                actualReps: true
            }
        });

        const weeklyTonnage = volumeLogs.reduce((acc, log) => acc + ((log.weight || 0) * (log.actualReps || 0)), 0);

        res.json({
            success: true,
            summary: {
                currentStreak,
                progressPercent,
                weeklyTonnage,
                remainingCount
            }
        });

    } catch (error) {
        console.error('Error fetching dashboard summary:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch dashboard summary' });
    }
};

const getMuscleDistribution = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Fetch logs with selective fields to reduce memory overhead
        const logs = await prisma.exercisePerformanceLog.findMany({
            where: {
                workoutExercise: {
                    session: {
                        plan: { userId }
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

        res.json({
            success: true,
            distribution: muscleVolume
        });

    } catch (error) {
        console.error('Error fetching muscle distribution:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch muscle distribution' });
    }
};

const getBodyMetrics = async (req, res) => {
    try {
        const userId = req.user.userId;
        const metrics = await prisma.bodyMetric.findMany({
            where: { userId },
            orderBy: { date: 'asc' }
        });

        res.json({
            success: true,
            metrics
        });
    } catch (error) {
        console.error('Error fetching body metrics:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch body metrics' });
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

        res.json({
            success: true,
            metric
        });
    } catch (error) {
        console.error('Error logging body metric:', error);
        res.status(500).json({ success: false, message: 'Failed to log body metric' });
    }
};

module.exports = {
    getDashboardSummary,
    getMuscleDistribution,
    getBodyMetrics,
    logBodyMetric
};
