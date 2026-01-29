const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const WorkoutGenerator = require('../utils/workoutGenerator');

const generateWorkout = async (req, res) => {
    try {
        const specs = req.body;
        const userId = req.user.userId;

        // --- VALIDATION ---
        if (!specs.goal) {
            return res.status(400).json({ success: false, message: 'Goal is required' });
        }

        const daysPerWeek = parseInt(specs.days_per_week);
        if (isNaN(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7) {
            return res.status(400).json({ success: false, message: 'Invalid days_per_week. Must be 1-7.' });
        }

        const weeks = parseInt(specs.weeks) || 4;
        if (weeks < 1 || weeks > 12) {
            return res.status(400).json({ success: false, message: 'Invalid weeks. Must be 1-12.' });
        }

        // Fetch user profile to get workoutDays if not provided in specs
        let workoutDays = specs.workoutDays;
        if (!workoutDays || workoutDays.length === 0) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { workoutDays: true }
            });
            workoutDays = user?.workoutDays || [];
        }

        const generator = new WorkoutGenerator(prisma);
        const fullPlan = await generator.generatePlan({
            ...specs,
            weeks,
            days_per_week: daysPerWeek,
            workoutDays
        }, userId);

        // Check for existing ACTIVE plan
        const existingPlan = await prisma.workoutPlan.findFirst({
            where: { userId, status: 'ACTIVE' }
        });

        let savedPlan;

        const transactionOptions = {
            maxWait: 10000, // Increased for safety
            timeout: 30000
        };

        if (existingPlan) {
            console.log(`Updating existing plan: ${existingPlan.id}`);
            savedPlan = await prisma.$transaction(async (tx) => {
                await tx.workoutSession.deleteMany({ where: { planId: existingPlan.id } });

                return await tx.workoutPlan.update({
                    where: { id: existingPlan.id },
                    data: {
                        name: specs.name || `Plan - ${specs.goal}`,
                        goal: specs.goal,
                        level: specs.level || null,
                        splitType: specs.split_type || 'Dynamic',
                        daysPerWeek: daysPerWeek,
                        weeks: weeks,
                        sessions: {
                            create: fullPlan.flatMap(week => week.sessions.map(session => ({
                                weekNumber: week.week,
                                dayNumber: session.dayNumber,
                                dayLabel: session.dayLabel,
                                focus: session.focus,
                                exercises: {
                                    create: session.exercises.map((ex, index) => ({
                                        exerciseId: ex.exerciseId,
                                        sets: ex.sets,
                                        reps: ex.reps,
                                        weight: ex.weight,
                                        restMin: ex.restMin,
                                        restMax: ex.restMax,
                                        order: index
                                    }))
                                }
                            })))
                        }
                    },
                    include: {
                        sessions: { include: { exercises: { include: { exercise: true } } } }
                    }
                });
            }, transactionOptions);
        } else {
            savedPlan = await prisma.workoutPlan.create({
                data: {
                    userId,
                    name: specs.name || `Plan - ${specs.goal}`,
                    goal: specs.goal,
                    level: specs.level || null,
                    splitType: specs.split_type || 'Dynamic',
                    daysPerWeek: daysPerWeek,
                    weeks: weeks,
                    sessions: {
                        create: fullPlan.flatMap(week => week.sessions.map(session => ({
                            weekNumber: week.week,
                            dayNumber: session.dayNumber,
                            dayLabel: session.dayLabel,
                            focus: session.focus,
                            exercises: {
                                create: session.exercises.map((ex, index) => ({
                                    exerciseId: ex.exerciseId,
                                    sets: ex.sets,
                                    reps: ex.reps,
                                    weight: ex.weight,
                                    restMin: ex.restMin,
                                    restMax: ex.restMax,
                                    order: index
                                }))
                            }
                        })))
                    }
                },
                include: {
                    sessions: {
                        include: {
                            exercises: {
                                include: {
                                    exercise: true
                                }
                            }
                        }
                    }
                }
            });
        }

        res.status(200).json({
            success: true,
            plan: savedPlan
        });
    } catch (error) {
        console.error('Error generating workout:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate workout plan',
            error: error.message
        });
    }
};

const getUserPlans = async (req, res) => {
    try {
        const userId = req.user.userId;
        const plans = await prisma.workoutPlan.findMany({
            where: { userId },
            include: {
                sessions: {
                    include: {
                        exercises: {
                            include: {
                                exercise: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, plans });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch plans', error: error.message });
    }
};

const getPerformanceTrends = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Fetch all performance logs for the user, grouped by exercise
        const logs = await prisma.exercisePerformanceLog.findMany({
            where: {
                workoutExercise: {
                    userId: userId
                }
            },
            include: {
                workoutExercise: {
                    include: {
                        exercise: true
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Group by exercise name and calculate volume (weight * reps)
        const trends = logs.reduce((acc, log) => {
            const exName = log.workoutExercise.exercise.name;
            if (!acc[exName]) acc[exName] = [];

            acc[exName].push({
                date: log.createdAt,
                volume: (log.weight || 0) * (log.actualReps || 0),
                rpe: log.rpe,
                isPR: log.isPersonalRecord
            });
            return acc;
        }, {});

        // Also get fatigue trends
        const fatigue = await prisma.muscleRecoveryLog.findMany({
            where: { userId },
            include: { muscle: true }
        });

        res.json({
            success: true,
            trends,
            fatigue: fatigue.map(f => ({
                muscle: f.muscle.name,
                level: f.fatigueLevel,
                lastUpdated: f.lastUpdated
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch trends', error: error.message });
    }
};

module.exports = {
    generateWorkout,
    getUserPlans,
    getPerformanceTrends
};
