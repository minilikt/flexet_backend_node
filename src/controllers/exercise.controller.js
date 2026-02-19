const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendResponse } = require('../utils/response.utils');


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

        sendResponse(res, 200, 'Exercises fetched successfully', {
            count: exercises.length,
            exercises
        });


    } catch (error) {
        console.error('Error fetching exercises:', error);
        sendResponse(res, 500, 'Failed to fetch exercises', null, error.message);
    }
};

const getFilterMetadata = async (req, res) => {
    try {
        const [muscles, equipment, categories] = await Promise.all([
            prisma.muscle.findMany({ select: { name: true } }),
            prisma.equipment.findMany({ select: { name: true } }),
            prisma.category.findMany({ select: { name: true } })
        ]);

        sendResponse(res, 200, 'Filter metadata fetched successfully', {
            metadata: {
                muscles: muscles.map(m => m.name),
                equipment: equipment.map(e => e.name),
                categories: categories.map(c => c.name)
            }
        });
    } catch (error) {
        console.error('Error fetching filter metadata:', error);
        sendResponse(res, 500, 'Failed to fetch filter metadata', null, error.message);
    }
};

module.exports = {
    getExercises,
    getFilterMetadata
};
