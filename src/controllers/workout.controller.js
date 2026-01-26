const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const WorkoutGenerator = require('../utils/workoutGenerator');

const generateWorkout = async (req, res) => {
    try {
        const specs = req.body;
        const userId = req.user.userId;

        const generator = new WorkoutGenerator(prisma);
        const fullPlan = await generator.generatePlan(specs, userId);

        // Check for existing ACTIVE plan
        const existingPlan = await prisma.workoutPlan.findFirst({
            where: { userId, status: 'ACTIVE' }
        });

        let savedPlan;

        if (existingPlan) {
            console.log(`Updating existing plan: ${existingPlan.id}`);
            // Use a transaction to delete old sessions and add new ones to the same plan
            savedPlan = await prisma.$transaction(async (tx) => {
                // Delete existing sessions (cascades to exercises)
                await tx.workoutSession.deleteMany({ where: { planId: existingPlan.id } });

                return await tx.workoutPlan.update({
                    where: { id: existingPlan.id },
                    data: {
                        name: specs.name || `Plan - ${specs.goal}`,
                        goal: specs.goal,
                        level: specs.level || null,
                        splitType: specs.split_type || 'Dynamic',
                        daysPerWeek: parseInt(specs.days_per_week),
                        weeks: parseInt(specs.weeks) || 4,
                        sessions: {
                            create: fullPlan.flatMap(week => week.sessions.map(session => ({
                                weekNumber: week.week,
                                dayNumber: session.dayNumber,
                                focus: session.focus,
                                exercises: {
                                    create: session.exercises.map((ex, index) => ({
                                        exerciseId: ex.exerciseId,
                                        sets: ex.sets,
                                        reps: ex.reps,
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
            });
        } else {
            // Create brand new plan
            savedPlan = await prisma.workoutPlan.create({
                data: {
                    userId,
                    name: specs.name || `Plan - ${specs.goal}`,
                    goal: specs.goal,
                    level: specs.level || null,
                    splitType: specs.split_type || 'Dynamic',
                    daysPerWeek: parseInt(specs.days_per_week),
                    weeks: parseInt(specs.weeks) || 4,
                    sessions: {
                        create: fullPlan.flatMap(week => week.sessions.map(session => ({
                            weekNumber: week.week,
                            dayNumber: session.dayNumber,
                            focus: session.focus,
                            exercises: {
                                create: session.exercises.map((ex, index) => ({
                                    exerciseId: ex.exerciseId,
                                    sets: ex.sets,
                                    reps: ex.reps,
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

module.exports = {
    generateWorkout,
    getUserPlans
};
