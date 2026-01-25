const WorkoutGenerator = require('../src/utils/workoutGenerator');
const path = require('path');

// ==========================================
// USER SPECIFICATIONS
// ==========================================
const userSpecs = {
    goal: 'hypertrophy',            // strength | hypertrophy | endurance
    level: 'intermediate',           // beginner | intermediate | advanced
    days_per_week: 4,               // 3 - 6
    split_type: 'upper_lower',      // push/pull/legs | upper/lower | full body
    available_equipment: [
        'Barbell',
        'Dumbbells',
        'Flat Bench',
        'Rack',
        'Cable Machine'
    ],
    time_per_session_minutes: 60,
    exercises_per_day: 6
};

// ==========================================
// EXECUTION
// ==========================================

const exerciseData = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/exercises.json'), 'utf8'));
const generator = new WorkoutGenerator(exerciseData);

console.log('--- Generating Workout Plan ---');
console.log('Specs:', JSON.stringify(userSpecs, null, 2));
console.log('-------------------------------\n');

try {
    const plan = generator.generatePlan(userSpecs);

    Object.keys(plan).forEach(day => {
        console.log(`\n=== ${day} (${plan[day].focus}) ===`);
        plan[day].exercises.forEach((ex, idx) => {
            console.log(`${idx + 1}. ${ex.name}`);
            console.log(`   [Type: ${ex.classification.type}]`);
            console.log(`   [Sets: ${ex.programming.default_sets} | Reps: ${ex.programming.default_reps} | Rest: ${ex.programming.rest_minutes.min}-${ex.programming.rest_minutes.max}m]`);
            console.log(`   [Load: ${ex.programming.load_formula}]`);
            if (ex.alternatives && ex.alternatives.length > 0) {
                console.log(`   [Alternatives ID: ${ex.alternatives.join(', ')}]`);
            }
            console.log('');
        });
    });

    console.log('\n--- Plan Generation Complete ---');
} catch (error) {
    console.error('Error generating plan:', error.message);
}
