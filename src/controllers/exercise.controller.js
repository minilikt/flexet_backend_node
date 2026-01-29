const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getExercises = async (req, res) => {
    try {
        const { search, muscle, equipment, category, difficulty } = req.query;

        const where = {};

        if (search) {
            where.name = {
                contains: search,
                mode: 'insensitive'
            };
        }

        if (muscle) {
            where.muscles = {
                some: {
                    muscle: {
                        name: muscle
                    }
                }
            };
        }

        if (equipment) {
            where.equipment = {
                some: {
                    equipment: {
                        name: equipment
                    }
                }
            };
        }

        if (category) {
            where.category = {
                name: category
            };
        }

        const exercises = await prisma.exercise.findMany({
            where,
            include: {
                muscles: {
                    include: {
                        muscle: true
                    }
                },
                equipment: {
                    include: {
                        equipment: true
                    }
                },
                category: true,
                split: true
            },
            take: 50
        });

        res.json({
            success: true,
            count: exercises.length,
            exercises
        });

    } catch (error) {
        console.error('Error fetching exercises:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch exercises',
            error: error.message
        });
    }
};

const getFilterMetadata = async (req, res) => {
    try {
        const [muscles, equipment, categories] = await Promise.all([
            prisma.muscle.findMany({ select: { name: true } }),
            prisma.equipment.findMany({ select: { name: true } }),
            prisma.category.findMany({ select: { name: true } })
        ]);

        res.json({
            success: true,
            metadata: {
                muscles: muscles.map(m => m.name),
                equipment: equipment.map(e => e.name),
                categories: categories.map(c => c.name)
            }
        });

    } catch (error) {
        console.error('Error fetching filter metadata:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch filter metadata'
        });
    }
};

module.exports = {
    getExercises,
    getFilterMetadata
};
