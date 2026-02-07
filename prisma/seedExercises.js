const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    const exercisesData = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../public/exercises.json'), 'utf8')
    );

    console.log('Starting migration [Explicit Schema Mode]...');

    const categories = new Set();
    const splits = new Set();
    const patterns = new Set();
    const equipments = new Set();
    const muscles = new Set();
    const tags = new Set();

    exercisesData.forEach(ex => {
        if (ex.classification.category) categories.add(ex.classification.category);
        if (ex.classification.split) splits.add(ex.classification.split);
        if (ex.classification.movement_pattern) patterns.add(ex.classification.movement_pattern);

        ex.requirements.equipment?.forEach(e => equipments.add(e));
        ex.anatomy.primary?.forEach(m => muscles.add(m));
        ex.anatomy.secondary?.forEach(m => muscles.add(m));
        ex.anatomy.stabilizers?.forEach(m => muscles.add(m));
        ex.logic_assets.tags?.forEach(t => tags.add(t));
    });

    console.log(`Seeding metadata: ${categories.size} categories, ${splits.size} splits, ${patterns.size} patterns, ${equipments.size} equipment, ${muscles.size} muscles, ${tags.size} tags.`);

    await prisma.category.createMany({ data: Array.from(categories).map(name => ({ name })), skipDuplicates: true });
    await prisma.split.createMany({ data: Array.from(splits).map(name => ({ name })), skipDuplicates: true });
    await prisma.movementPattern.createMany({ data: Array.from(patterns).map(name => ({ name })), skipDuplicates: true });
    await prisma.equipment.createMany({ data: Array.from(equipments).map(name => ({ name })), skipDuplicates: true });
    await prisma.muscle.createMany({ data: Array.from(muscles).map(name => ({ name })), skipDuplicates: true });
    await prisma.tag.createMany({ data: Array.from(tags).map(name => ({ name })), skipDuplicates: true });

    console.log('Fetching existing metadata for lookups...');
    const dbCategories = await prisma.category.findMany();
    const dbSplits = await prisma.split.findMany();
    const dbPatterns = await prisma.movementPattern.findMany();
    const dbEquipments = await prisma.equipment.findMany();
    const dbMuscles = await prisma.muscle.findMany();
    const dbTags = await prisma.tag.findMany();

    const categoryMap = new Map(dbCategories.map(c => [c.name, c.id]));
    const splitMap = new Map(dbSplits.map(s => [s.name, s.id]));
    const patternMap = new Map(dbPatterns.map(p => [p.name, p.id]));
    const equipmentMap = new Map(dbEquipments.map(e => [e.name, e.id]));
    const muscleMap = new Map(dbMuscles.map(m => [m.name, m.id]));
    const tagMap = new Map(dbTags.map(t => [t.name, t.id]));

    console.log('Seeding Exercises...');
    let count = 0;
    for (const ex of exercisesData) {
        count++;
        if (count % 50 === 0) console.log(`Processed ${count}/${exercisesData.length} exercises...`);

        const createdEx = await prisma.exercise.upsert({
            where: { externalId: ex.id },
            update: {
                gifUrl: ex.gifUrl || null,
                instructions: ex.instructions || [],
            },
            create: {
                externalId: ex.id,
                name: ex.name,
                type: ex.classification.type,
                difficultyMin: ex.requirements.difficulty_rpe.min,
                difficultyMax: ex.requirements.difficulty_rpe.max,
                restMin: ex.programming.rest_minutes.min,
                restMax: ex.programming.rest_minutes.max,
                defaultSets: ex.programming.default_sets,
                defaultReps: String(ex.programming.default_reps),
                loadFormula: ex.programming.load_formula,
                categoryId: categoryMap.get(ex.classification.category),
                splitId: splitMap.get(ex.classification.split),
                movementPatternId: patternMap.get(ex.classification.movement_pattern),
                gifUrl: ex.gifUrl || null,
                instructions: ex.instructions || [],
            },
        });

        // Batch junctions using createMany with skipDuplicates (if supported) or sequential upserts
        // Note: Prisma 5+ supports createMany for many-to-many via direct table access

        if (ex.requirements.equipment) {
            await prisma.exerciseEquipment.createMany({
                data: ex.requirements.equipment
                    .map(eqName => ({ exerciseId: createdEx.id, equipmentId: equipmentMap.get(eqName) }))
                    .filter(item => item.equipmentId),
                skipDuplicates: true
            });
        }

        const muscleRoles = [
            { list: ex.anatomy.primary, role: 'PRIMARY' },
            { list: ex.anatomy.secondary, role: 'SECONDARY' },
            { list: ex.anatomy.stabilizers, role: 'STABILIZER' },
        ];

        for (const { list, role } of muscleRoles) {
            if (list) {
                await prisma.exerciseMuscle.createMany({
                    data: list
                        .map(mName => ({ exerciseId: createdEx.id, muscleId: muscleMap.get(mName), role }))
                        .filter(item => item.muscleId),
                    skipDuplicates: true
                });
            }
        }

        if (ex.logic_assets.tags) {
            await prisma.exerciseTag.createMany({
                data: ex.logic_assets.tags
                    .map(tagName => ({ exerciseId: createdEx.id, tagId: tagMap.get(tagName) }))
                    .filter(item => item.tagId),
                skipDuplicates: true
            });
        }
    }

    console.log('Linking Alternatives (in-memory pass)...');
    const existingExercises = await prisma.exercise.findMany({ select: { id: true, externalId: true } });
    const extIdToId = new Map(existingExercises.map(e => [e.externalId, e.id]));

    const altPairs = [];
    for (const ex of exercisesData) {
        if (ex.logic_assets.alternatives) {
            const currentExId = extIdToId.get(ex.id);
            ex.logic_assets.alternatives.forEach(altExtId => {
                const altId = extIdToId.get(String(altExtId));
                if (currentExId && altId) {
                    altPairs.push({ exerciseId: currentExId, alternativeId: altId });
                }
            });
        }
    }

    if (altPairs.length > 0) {
        await prisma.exerciseToAlternative.createMany({
            data: altPairs,
            skipDuplicates: true
        });
    }

    console.log('Migration completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
