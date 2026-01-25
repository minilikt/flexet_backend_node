const WorkoutGenerator = require('../utils/workoutGenerator');
const fs = require('fs');
const path = require('path');

const generateWorkout = async (req, res) => {
    try {
        const specs = req.body;

        // Load exercise data
        const exerciseData = JSON.parse(
            fs.readFileSync(path.join(__dirname, '../../public/exercises.json'), 'utf8')
        );

        const generator = new WorkoutGenerator(exerciseData);
        const plan = generator.generatePlan(specs);

        res.status(200).json({
            success: true,
            plan
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

module.exports = {
    generateWorkout
};
