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

    /**
     * Determines if a deload week should be inserted based on recovery data.
     */
    async getDeloadStatus(userId, weekNumber) {
        if (!userId) return { shouldDeload: false, reason: '' };

        // Check for systemic fatigue from DailyRecoveryLog
        const recentLogs = await this.prisma.dailyRecoveryLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 7
        });

        if (recentLogs.length >= 3) {
            const avgFatigue = recentLogs.reduce((acc, log) => acc + (log.systemicFatigue || 0), 0) / recentLogs.length;
            const avgSoreness = recentLogs.reduce((acc, log) => acc + (log.sorenessLevel || 0), 0) / recentLogs.length;

            if (avgFatigue >= 7 || avgSoreness >= 8) {
                return {
                    shouldDeload: true,
                    reason: `High systemic fatigue (${avgFatigue.toFixed(1)}) or soreness (${avgSoreness.toFixed(1)})`
                };
            }
        }

        // Auto-deload every 4th week as standard periodization
        if (weekNumber % 4 === 0) {
            return {
                shouldDeload: true,
                reason: 'Scheduled deload (Week 4 of cycle)'
            };
        }

        return { shouldDeload: false, reason: '' };
    }

    /**
     * Finds an alternative exercise based on muscle group and user preferences.
     */
    async getExerciseAlternative(exerciseId, userId, availableEquipment) {
        const original = await this.prisma.exercise.findUnique({
            where: { id: exerciseId },
            include: {
                muscles: true,
                ExerciseToAlternative_ExerciseToAlternative_exerciseIdToExercise: {
                    include: {
                        Exercise_ExerciseToAlternative_alternativeIdToExercise: true
                    }
                }
            }
        });

        if (!original) return null;

        // First try explicit alternatives
        const alternatives = original.ExerciseToAlternative_ExerciseToAlternative_exerciseIdToExercise
            .map(alt => alt.Exercise_ExerciseToAlternative_alternativeIdToExercise);

        if (alternatives.length > 0) {
            const filtered = await this.filterByEquipment(availableEquipment, userId, alternatives);
            if (filtered.length > 0) return filtered[0];
        }

        // Fallback: find exercises with same primary muscles
        const primaryMuscles = original.muscles.filter(m => m.role === 'PRIMARY').map(m => m.muscleId);
        if (primaryMuscles.length === 0) return null;

        const similar = await this.prisma.exercise.findMany({
            where: {
                muscles: {
                    some: {
                        muscleId: { in: primaryMuscles },
                        role: 'PRIMARY'
                    }
                },
                id: { not: exerciseId }
            },
            include: {
                equipment: { include: { equipment: true } },
                split: true,
                muscles: true
            },
            take: 10
        });

        const filtered = await this.filterByEquipment(availableEquipment, userId, similar);
        return filtered.length > 0 ? filtered[0] : null;
    }

    /**
     * Calculates progression factors for multi-week plans.
     */
    calculateProgressionFactor(weekNumber, progressionModel = 'LINEAR') {
        switch (progressionModel.toUpperCase()) {
            case 'LINEAR':
                return {
                    weightMultiplier: 1.0,
                    repAdjustment: 0
                };
            case 'WAVE':
                const phase = (weekNumber - 1) % 3;
                return {
                    weightMultiplier: [0.85, 0.92, 1.0][phase],
                    repAdjustment: 0
                };
            default:
                return {
                    weightMultiplier: 1.0,
                    repAdjustment: 0
                };
        }
    }

    /**
     * Applies adaptive logic based on user's past performance and goals.
     * Implements Progressive Overload, Volume Regulation, and intelligent adaptation.
     */
    async applyGoalLogic(exercise, goal, userId = null, pastLogs = [], weekNumber = 1, progressionModel = 'LINEAR') {
        const defaults = {
            sets: exercise.defaultSets || 3,
            reps: exercise.defaultReps || "8-12",
            restMin: exercise.restMin || 1.5,
            restMax: exercise.restMax || 2,
            weight: 0,
            isAdaptive: false
        };

        // If no user or no past logs, return defaults
        if (!userId || pastLogs.length === 0) {
            return {
                exerciseId: exercise.id,
                name: exercise.name,
                ...defaults,
                note: pastLogs.length === 0 && userId ? "Initial week, using baseline" : ""
            };
        }

        // --- ANALYZE PERFORMANCE DATA ---
        const avgRPE = pastLogs.reduce((acc, log) => acc + (log.rpe || 7), 0) / pastLogs.length;
        const lastWeight = pastLogs[0].weight || 0;
        const lastReps = pastLogs[0].actualReps || 10;
        const recentHighRPE = pastLogs.filter(log => (log.rpe || 7) >= 9).length;

        let newWeight = lastWeight;
        let newSets = defaults.sets;
        let adaptiveNotes = [];

        // --- PROGRESSIVE OVERLOAD MODELS ---
        switch (progressionModel.toUpperCase()) {
            case 'LINEAR':
                // Simple linear progression: add weight if RPE is manageable
                if (avgRPE < 7) {
                    newWeight += 2.5;
                    adaptiveNotes.push(`RPE ${avgRPE.toFixed(1)} - increasing weight +2.5kg`);
                } else if (avgRPE >= 7 && avgRPE < 8.5) {
                    newWeight += 1.25;
                    adaptiveNotes.push(`RPE ${avgRPE.toFixed(1)} - small weight increase +1.25kg`);
                } else if (avgRPE > 9) {
                    adaptiveNotes.push(`RPE ${avgRPE.toFixed(1)} - maintaining weight for form`);
                }
                break;

            case 'DOUBLE_PROGRESSION':
                // Increase reps first, then weight when hitting top of range
                const [minReps, maxReps] = defaults.reps.split('-').map(r => parseInt(r.trim()));
                if (lastReps >= maxReps && avgRPE < 8) {
                    newWeight += 2.5;
                    adaptiveNotes.push(`Hit ${maxReps} reps, increasing weight +2.5kg`);
                } else if (avgRPE < 7) {
                    adaptiveNotes.push(`RPE low, aim for ${maxReps} reps before weight increase`);
                }
                break;

            case 'WAVE':
                // Wave periodization: vary intensity across weeks
                const wavePhase = (weekNumber - 1) % 3; // 0=light, 1=medium, 2=heavy
                const intensityMultipliers = [0.85, 0.92, 1.0];
                newWeight = lastWeight * intensityMultipliers[wavePhase];
                const phases = ['Light', 'Medium', 'Heavy'];
                adaptiveNotes.push(`Wave Week ${wavePhase + 1}/3 (${phases[wavePhase]})`);
                break;

            default:
                // Fallback to linear
                if (avgRPE < 7) {
                    newWeight += 2.5;
                    adaptiveNotes.push('Increasing weight');
                }
        }

        // --- VOLUME REGULATION ---
        // Check if user is consistently hitting high RPE (overreaching)
        if (recentHighRPE >= 2 && pastLogs.length >= 2) {
            newSets = Math.max(2, defaults.sets - 1);
            adaptiveNotes.push(`High RPE detected (${recentHighRPE}/${pastLogs.length} sessions), reducing volume`);
        }

        // Check muscle recovery if available
        if (userId && exercise.muscles && exercise.muscles.length > 0) {
            const primaryMuscles = exercise.muscles.filter(m => m.role === 'PRIMARY').map(m => m.muscleId);
            if (primaryMuscles.length > 0) {
                const recoveryLogs = await this.prisma.muscleRecoveryLog.findMany({
                    where: {
                        userId,
                        muscleId: { in: primaryMuscles }
                    }
                });

                const highFatigue = recoveryLogs.some(log => log.fatigueLevel >= 8);
                if (highFatigue) {
                    newSets = Math.max(2, newSets - 1);
                    adaptiveNotes.push('Muscle fatigue high, reducing sets');
                }
            }
        }

        const setsReps = {
            sets: newSets,
            reps: defaults.reps,
            weight: Math.round(newWeight * 4) / 4, // Round to nearest 0.25
            note: adaptiveNotes.join(' | '),
            isAdaptive: true
        };

        // Apply Goal Specific Overlays
        switch (goal.toLowerCase()) {
            case 'strength':
                setsReps.sets = Math.max(setsReps.sets, 4);
                setsReps.reps = "3-5";
                break;
            case 'endurance':
                setsReps.reps = "15-20";
                break;
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
            weeks = 1,
            progressionModel = 'LINEAR'
        } = specs;

        const MIN_EXERCISES = 4;
        const TARGET_EXERCISES = Math.max(exercises_per_day, MIN_EXERCISES);

        const daysPerWeek = parseInt(days_per_week);
        console.log(`Generating adaptive plan [v3] for User ${userId}, ${weeks} weeks`);

        // Batch fetch all performance logs for the user at the start to avoid N+1 issues
        let performanceMap = new Map();
        if (userId) {
            const allLogs = await this.prisma.exercisePerformanceLog.findMany({
                where: {
                    workoutExercise: {
                        session: {
                            plan: {
                                userId
                            }
                        }
                    }
                },
                include: { workoutExercise: true },
                orderBy: { createdAt: 'desc' }
            });
            // Group by exerciseId
            allLogs.forEach(log => {
                const exId = log.workoutExercise?.exerciseId;
                if (!performanceMap.has(exId)) performanceMap.set(exId, []);
                if (performanceMap.get(exId).length < 3) performanceMap.get(exId).push(log);
            });
        }

        const filtered = await this.filterByEquipment(available_equipment, userId);

        // --- FEEDBACK PRIORITIZATION ---
        // Sort: LIKE first, then others. AVOID is already filtered out in filterByEquipment.
        const userIdRef = userId;
        const feedbacks = userId ? await this.prisma.exerciseFeedback.findMany({ where: { userId } }) : [];
        const preferMap = new Map(feedbacks.map(f => [f.exerciseId, f.preference]));

        filtered.sort((a, b) => {
            const prefA = preferMap.get(a.id) === 'LIKE' ? 1 : 0;
            const prefB = preferMap.get(b.id) === 'LIKE' ? 1 : 0;
            return prefB - prefA; // Descending (1 comes before 0)
        });

        console.log(`Pool size: ${filtered.length}. Top of pool: ${filtered.slice(0, 3).map(e => e.name).join(', ')}`);

        const fullPlan = [];
        const splitMap = this.getSplitMap(daysPerWeek);

        for (let week = 1; week <= weeks; week++) {
            // --- DELOAD DETECTION ---
            const deloadStatus = await this.getDeloadStatus(userId, week);
            const isDeloadWeek = deloadStatus.shouldDeload;

            const weekPlan = {
                week,
                sessions: [],
                isDeload: isDeloadWeek,
                deloadReason: deloadStatus.reason || undefined
            };
            const usedInWeek = new Set();

            for (let day = 1; day <= daysPerWeek; day++) {
                const targetSplits = splitMap[day] || ['Push', 'Pull', 'Legs'];

                let selected = filtered.filter(ex =>
                    targetSplits.includes(ex.split?.name) && !usedInWeek.has(ex.id)
                );

                // Don't just shuffle immediately, protect the 'LIKE' ones at the top
                // We'll shuffle within preference groups
                const likes = selected.filter(ex => preferMap.get(ex.id) === 'LIKE');
                const others = selected.filter(ex => preferMap.get(ex.id) !== 'LIKE');
                this.shuffle(likes);
                this.shuffle(others);

                selected = [...likes, ...others].slice(0, TARGET_EXERCISES);

                if (selected.length < TARGET_EXERCISES) {
                    const remaining = TARGET_EXERCISES - selected.length;
                    let repeats = filtered.filter(ex =>
                        targetSplits.includes(ex.split?.name) && !selected.find(s => s.id === ex.id)
                    );
                    this.shuffle(repeats);
                    selected.push(...repeats.slice(0, remaining));
                }

                // Final sessions building
                const exercises = [];
                for (const ex of selected) {
                    usedInWeek.add(ex.id);
                    // Pass the pre-fetched logs to applyGoalLogic
                    const pastLogs = performanceMap.get(ex.id) || [];
                    const exerciseData = await this.applyGoalLogic(ex, goal, userId, pastLogs, week, progressionModel);

                    // --- APPLY DELOAD MODIFICATIONS ---
                    if (isDeloadWeek) {
                        exerciseData.weight = Math.round(exerciseData.weight * 0.8 * 4) / 4; // 20% reduction
                        exerciseData.sets = Math.max(2, exerciseData.sets - 1);
                        const deloadNote = `DELOAD: ${deloadStatus.reason}`;
                        exerciseData.note = exerciseData.note
                            ? `${deloadNote} | ${exerciseData.note}`
                            : deloadNote;
                    }

                    exercises.push(exerciseData);
                }

                weekPlan.sessions.push({
                    dayNumber: day,
                    focus: targetSplits.join(' / '),
                    exercises: exercises
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
