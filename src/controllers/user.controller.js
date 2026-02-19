const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendResponse } = require('../utils/response.utils');


const updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const {
            name,
            fullName,
            age,
            gender,
            height,
            weight,
            goalWeight,
            goal,
            trainingLevel,
            activityLevel,
            equipment,
            workoutDays,
            sleepHours,
            waterIntake,
            profileImage
        } = req.body;
        console.log('Incoming Goal:', goal);
        const validGoals = ['STRENGTH', 'HYPERTROPHY', 'ENDURANCE', 'MAINTENANCE', 'WEIGHT_LOSS'];
        const validLevels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

        const normGoal = (goal ? goal.toUpperCase().replace(' ', '_') : undefined);
        const finalGoal = validGoals.includes(normGoal) ? normGoal : undefined;

        const normLevel = (trainingLevel ? trainingLevel.toUpperCase() : undefined);
        const finalLevel = validLevels.includes(normLevel) ? normLevel : undefined;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                name,
                fullName,
                age: age ? parseInt(age) : undefined,
                gender,
                height: height ? parseFloat(height) : undefined,
                weight: weight ? parseFloat(weight) : undefined,
                goalWeight: goalWeight ? parseFloat(goalWeight) : undefined,
                goal: finalGoal,
                trainingLevel: finalLevel,
                activityLevel,
                equipment,
                workoutDays,
                sleepHours: sleepHours ? parseFloat(sleepHours) : undefined,
                waterIntake: waterIntake ? parseFloat(waterIntake) : undefined,
                profileImage
            }
        });

        // Remove password from response
        const { password, ...userProfile } = updatedUser;

        sendResponse(res, 200, 'Profile updated successfully', { user: userProfile });


    } catch (error) {
        console.error('Update profile error:', error);
        sendResponse(res, 500, 'Error updating profile', null, error.message);
    }
};

const getProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return sendResponse(res, 404, 'User not found');
        }

        const { password, ...userProfile } = user;
        sendResponse(res, 200, 'Profile fetched successfully', { user: userProfile });


    } catch (error) {
        console.error('Get profile error:', error);
        sendResponse(res, 500, 'Error fetching profile', null, error.message);
    }
};

module.exports = {
    updateProfile,
    getProfile
};
