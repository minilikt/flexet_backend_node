const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const {
            age,
            gender,
            height,
            weight,
            goal,
            trainingLevel,
            activityLevel,
            equipment,
            workoutDays,
            sleepHours,
            waterIntake
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
                age: age ? parseInt(age) : undefined,
                gender,
                height: height ? parseFloat(height) : undefined,
                weight: weight ? parseFloat(weight) : undefined,
                goal: finalGoal,
                trainingLevel: finalLevel,
                activityLevel,
                equipment,
                workoutDays,
                sleepHours: sleepHours ? parseFloat(sleepHours) : undefined,
                waterIntake: waterIntake ? parseFloat(waterIntake) : undefined,
            }
        });

        // Remove password from response
        const { password, ...userProfile } = updatedUser;

        res.json({
            message: 'Profile updated successfully',
            user: userProfile
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Error updating profile' });
    }
};

const getProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const { password, ...userProfile } = user;
        res.json(userProfile);

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Error fetching profile' });
    }
};

module.exports = {
    updateProfile,
    getProfile
};
