const path = require('path');

class WorkoutGenerator {
    constructor(prisma) {
        this.prisma = prisma;
    }

    /**
     * Filters exercises based on available equipment.
     */
    async filterByEquipment(availableEquipment, userId = null, pool = null) {
        // Expand user equipment with common synonyms and fuzzy matches
        const userEquip = availableEquipment.map(e => e.toLowerCase());
        const expandedSet = new Set(userEquip);

        // Synonyms and fuzzy expansion
        userEquip.forEach(eq => {
            if (eq.includes('weights')) { expandedSet.add('dumbbells'); expandedSet.add('barbell'); expandedSet.add('plates'); }
            if (eq.includes('bench')) { expandedSet.add('flat bench'); expandedSet.add('incline bench'); expandedSet.add('decline bench'); }
            if (eq.includes('dumbbell')) expandedSet.add('dumbbells');
            if (eq.includes('dumbbells')) expandedSet.add('dumbbell');
            if (eq.includes('barbell')) expandedSet.add('barbells');
            if (eq.includes('barbells')) expandedSet.add('barbell');
        });

        expandedSet.add('bodyweight');
        expandedSet.add('floor');
        expandedSet.add('none');
        expandedSet.add('open space');

        const expandedArray = Array.from(expandedSet);
        console.log(`Filtering with expanded equipment: ${expandedArray.join(', ')}`);

        // --- ADAPTIVE LOGIC: GET USER DATA ---
        let feedbackMap = new Map();
        let fatigueMap = new Map();

        if (userId) {
            const feedbacks = await this.prisma.exerciseFeedback.findMany({ where: { userId } });
            feedbacks.forEach(f => feedbackMap.set(f.exerciseId, f.preference));

            const recoveries = await this.prisma.muscleRecoveryLog.findMany({ where: { userId } });
            recoveries.forEach(r => fatigueMap.set(r.muscleId, r.fatigueLevel));
        }

        const exercises = pool || await this.prisma.exercise.findMany({
            include: {
                equipment: { include: { equipment: true } },
                split: true,
                muscles: true
            }
        });

        return exercises.filter(ex => {
            // 1. Equipment Filter
            const reqs = ex.equipment.map(ee => ee.equipment.name.toLowerCase());
            const hasEquip = reqs.length === 0 || reqs.every(req => expandedArray.some(avail => req.includes(avail) || avail.includes(req)));
            if (!hasEquip) return false;

            // 2. Adaptive Filtering (Preferences)
            const preference = feedbackMap.get(ex.id);
            if (preference === 'AVOID') return false;
            // We can choose to deprioritize DISLIKE later in shuffle/sort, but for now we allow them if necessary

            // 3. Adaptive Filtering (Recovery/Fatigue)
            // If any primary muscle is > 8 fatigue, avoid this exercise if possible
            const highFatigue = ex.muscles.some(m => m.role === 'PRIMARY' && (fatigueMap.get(m.muscleId) || 0) >= 8);
            if (highFatigue) return false;

            return true;
        });
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    applyGoalLogic(exercise, goal) {
        const setsReps = {
            sets: exercise.defaultSets || 3,
            reps: exercise.defaultReps || "8-12",
            restMin: exercise.restMin,
            restMax: exercise.restMax
        };

        if (setsReps.reps !== "AMRAP") {
            switch (goal.toLowerCase()) {
                case 'strength':
                    setsReps.sets = 4;
                    setsReps.reps = "3-5";
                    setsReps.restMin = Math.max(setsReps.restMin || 2, 3);
                    setsReps.restMax = Math.max(setsReps.restMax || 3, 5);
                    break;
                case 'endurance':
                    setsReps.sets = 3;
                    setsReps.reps = "15-20";
                    setsReps.restMin = 0.5;
                    setsReps.restMax = 1;
                    break;
                case 'hypertrophy':
                default:
                    setsReps.sets = 3;
                    setsReps.reps = "8-12";
                    break;
            }
        }

        return {
            exerciseId: exercise.id,
            name: exercise.name,
            ...setsReps
        };
    }

    async generatePlan(specs, userId = null) {
        const {
            goal,
            days_per_week,
            available_equipment,
            exercises_per_day = 6,
            weeks = 1
        } = specs;

        const MIN_EXERCISES = 4;
        const TARGET_EXERCISES = Math.max(exercises_per_day, MIN_EXERCISES);

        const daysPerWeek = parseInt(days_per_week);
        console.log(`Generating adaptive plan for User ${userId}`);

        const filtered = await this.filterByEquipment(available_equipment, userId);
        console.log(`Filtered exercises pool size: ${filtered.length}`);

        if (filtered.length < MIN_EXERCISES) {
            throw new Error(`Only ${filtered.length} exercises match your equipment. We need at least ${MIN_EXERCISES}. Please add more equipment like 'Dumbbells' or 'Barbell'.`);
        }

        const fullPlan = [];
        const splitMap = this.getSplitMap(daysPerWeek);

        for (let week = 1; week <= weeks; week++) {
            const weekPlan = { week, sessions: [] };
            const usedInWeek = new Set();

            for (let day = 1; day <= daysPerWeek; day++) {
                const targetSplits = splitMap[day] || ['Push', 'Pull', 'Legs'];
                console.log(`Day ${day} Split: ${targetSplits.join('/')}`);

                // Stage 1: Unique exercises within the split
                let selected = filtered.filter(ex =>
                    targetSplits.includes(ex.split?.name) && !usedInWeek.has(ex.id)
                );
                this.shuffle(selected);
                selected = selected.slice(0, TARGET_EXERCISES);

                // Stage 2: If not enough, allow duplicates from the same split (already used this week)
                if (selected.length < TARGET_EXERCISES) {
                    const remaining = TARGET_EXERCISES - selected.length;
                    let repeats = filtered.filter(ex =>
                        targetSplits.includes(ex.split?.name) && !selected.find(s => s.id === ex.id)
                    );
                    this.shuffle(repeats);
                    selected.push(...repeats.slice(0, remaining));
                }

                // Stage 3: If still not enough, take related exercises (Full Body)
                if (selected.length < TARGET_EXERCISES) {
                    const remaining = TARGET_EXERCISES - selected.length;
                    let fullBodyFallbacks = filtered.filter(ex =>
                        (ex.split?.name === 'Full Body' || ex.split?.name === 'Abs') &&
                        !selected.find(s => s.id === ex.id)
                    );
                    this.shuffle(fullBodyFallbacks);
                    selected.push(...fullBodyFallbacks.slice(0, remaining));
                }

                // Stage 4: Absolute final fallback - take anything from the filtered pool to hit MIN_EXERCISES
                if (selected.length < MIN_EXERCISES) {
                    const remaining = MIN_EXERCISES - selected.length;
                    let anyFallback = filtered.filter(ex => !selected.find(s => s.id === ex.id));
                    this.shuffle(anyFallback);
                    selected.push(...anyFallback.slice(0, remaining));
                }

                console.log(`Day ${day} final count: ${selected.length}`);

                weekPlan.sessions.push({
                    dayNumber: day,
                    focus: targetSplits.join(' / '),
                    exercises: selected.map(ex => {
                        usedInWeek.add(ex.id);
                        return this.applyGoalLogic(ex, goal);
                    })
                });
            }
            fullPlan.push(weekPlan);
        }

        return fullPlan;
    }

    getSplitMap(days) {
        const p = ['Push'];
        const pl = ['Pull'];
        const l = ['Legs'];
        const fb = ['Push', 'Pull', 'Legs'];
        const u = ['Push', 'Pull'];

        const maps = {
            1: { 1: fb },
            2: { 1: u, 2: l },
            3: { 1: p, 2: pl, 3: l },
            4: { 1: p, 2: pl, 3: l, 4: fb },
            5: { 1: p, 2: pl, 3: l, 4: u, 5: l },
            6: { 1: p, 2: pl, 3: l, 4: p, 5: pl, 6: l },
            7: { 1: p, 2: pl, 3: l, 4: p, 5: pl, 6: l, 7: fb }
        };

        return maps[days] || maps[3]; // Fallback to 3-day PPL
    }
}

module.exports = WorkoutGenerator;
