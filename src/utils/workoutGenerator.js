const fs = require('fs');
const path = require('path');

class WorkoutGenerator {
    constructor(exerciseData) {
        this.exercises = exerciseData;
    }

    /**
     * Filters exercises based on available equipment.
     * Allows partial matches (e.g., if user has "Dumbbells", they can do "Dumbbell Bench Press").
     * If an exercise requires multiple items (e.g., "Barbell", "Flat Bench"), user MUST have all.
     */
    filterByEquipment(availableEquipment) {
        const equipmentSet = new Set(availableEquipment.map(e => e.toLowerCase()));

        // Always include Bodyweight
        equipmentSet.add('bodyweight');
        equipmentSet.add('floor');

        return this.exercises.filter(ex => {
            const reqs = ex.requirements.equipment.map(e => e.toLowerCase());
            return reqs.every(req => {
                // Check if any available equipment matches the requirement
                return Array.from(equipmentSet).some(avail => avail.includes(req) || req.includes(avail));
            });
        });
    }

    /**
     * Shuffles an array in place.
     */
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Adjusts programming based on goal.
     */
    applyGoalLogic(exercise, goal) {
        const programming = { ...exercise.programming };

        // Base logic for sets/reps if not already AMRAP
        if (programming.default_reps !== "AMRAP") {
            switch (goal.toLowerCase()) {
                case 'strength':
                    programming.default_sets = 4;
                    programming.default_reps = "3-5";
                    programming.rest_minutes.min = Math.max(programming.rest_minutes.min, 3);
                    programming.rest_minutes.max = Math.max(programming.rest_minutes.max, 5);
                    break;
                case 'endurance':
                    programming.default_sets = 3;
                    programming.default_reps = "15-20";
                    programming.rest_minutes.min = 0.5;
                    programming.rest_minutes.max = 1;
                    break;
                case 'hypertrophy':
                default:
                    // Keep defaults or slightly optimize
                    programming.default_sets = 3;
                    programming.default_reps = "8-12";
                    break;
            }
        }

        return {
            id: exercise.id,
            name: exercise.name,
            classification: exercise.classification,
            programming: programming,
            alternatives: exercise.logic_assets.alternatives
        };
    }

    /**
     * Generates a weekly plan.
     */
    generatePlan(specs) {
        const {
            goal,
            level,
            days_per_week,
            split_type,
            available_equipment,
            exercises_per_day = 6
        } = specs;

        let filtered = this.filterByEquipment(available_equipment);

        const plan = {};
        const usedExerciseIds = new Set();

        // Split Definitions
        const splitMap = this.getSplitMap(split_type, days_per_week);

        for (let day = 1; day <= days_per_week; day++) {
            const dayName = `Day ${day}`;
            const targetSplits = splitMap[day] || [];

            // Filter exercises for this day's splits
            let dayPool = filtered.filter(ex =>
                targetSplits.includes(ex.classification.split) && !usedExerciseIds.has(ex.id)
            );

            // If pool is too small, allow secondary/related or just reset used set if necessary 
            // (but requirement says avoid duplicates in the week)

            this.shuffle(dayPool);

            // Prioritize Compounds, then Isolations
            const compounds = dayPool.filter(ex => ex.classification.type === 'Compound');
            const isolations = dayPool.filter(ex => ex.classification.type === 'Isolation');

            const selected = [];

            // Aim for 2-3 compounds, rest isolations
            const compToTake = Math.min(compounds.length, 3);
            selected.push(...compounds.slice(0, compToTake));

            const remainingNeeded = exercises_per_day - selected.length;
            selected.push(...this.shuffle(isolations).slice(0, remainingNeeded));

            // If still not enough, take more compounds or whatever is left
            if (selected.length < exercises_per_day) {
                const moreNeeded = exercises_per_day - selected.length;
                const leftovers = dayPool.filter(ex => !selected.find(s => s.id === ex.id));
                selected.push(...leftovers.slice(0, moreNeeded));
            }

            plan[dayName] = {
                focus: targetSplits.join(' / '),
                exercises: selected.map(ex => {
                    usedExerciseIds.add(ex.id);
                    return this.applyGoalLogic(ex, goal);
                })
            };
        }

        return plan;
    }

    getSplitMap(type, days) {
        const maps = {
            'ppl': {
                3: { 1: ['Push'], 2: ['Pull'], 3: ['Legs'] },
                4: { 1: ['Push'], 2: ['Pull'], 3: ['Legs'], 4: ['Push'] },
                5: { 1: ['Push'], 2: ['Pull'], 3: ['Legs'], 4: ['Push'], 5: ['Pull'] },
                6: { 1: ['Push'], 2: ['Pull'], 3: ['Legs'], 4: ['Push'], 5: ['Pull'], 6: ['Legs'] }
            },
            'upper_lower': {
                2: { 1: ['Push', 'Pull'], 2: ['Legs'] }, // Approximation
                3: { 1: ['Push', 'Pull'], 2: ['Legs'], 3: ['Push', 'Pull'] },
                4: { 1: ['Push', 'Pull'], 2: ['Legs'], 3: ['Push', 'Pull'], 4: ['Legs'] },
                5: { 1: ['Push', 'Pull'], 2: ['Legs'], 3: ['Push', 'Pull'], 4: ['Legs'], 5: ['Push', 'Pull'] },
                6: { 1: ['Push', 'Pull'], 2: ['Legs'], 3: ['Push', 'Pull'], 4: ['Legs'], 5: ['Push', 'Pull'], 6: ['Legs'] }
            },
            'full_body': {
                3: { 1: ['Push', 'Pull', 'Legs'], 2: ['Push', 'Pull', 'Legs'], 3: ['Push', 'Pull', 'Legs'] },
                4: { 1: ['Push', 'Pull', 'Legs'], 2: ['Push', 'Pull', 'Legs'], 3: ['Push', 'Pull', 'Legs'], 4: ['Push', 'Pull', 'Legs'] },
                5: { 1: ['Push', 'Pull', 'Legs'], 2: ['Push', 'Pull', 'Legs'], 3: ['Push', 'Pull', 'Legs'], 4: ['Push', 'Pull', 'Legs'], 5: ['Push', 'Pull', 'Legs'] }
            }
        };

        const normalizedType = type.toLowerCase().replace(/[\/\s]/g, '_');
        return maps[normalizedType] ? maps[normalizedType][days] : maps['full_body'][days] || {};
    }
}

module.exports = WorkoutGenerator;
