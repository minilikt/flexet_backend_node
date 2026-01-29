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

    console.log('Seeding Exercises...');
    let count = 0;
    for (const ex of exercisesData) {
        count++;
        if (count % 20 === 0) console.log(`Processed ${count}/${exercisesData.length} exercises...`);

        const category = await prisma.category.findUnique({ where: { name: ex.classification.category } });
        const split = await prisma.split.findUnique({ where: { name: ex.classification.split } });
        const pattern = await prisma.movementPattern.findUnique({ where: { name: ex.classification.movement_pattern } });

        const createdEx = await prisma.exercise.upsert({
            where: { externalId: ex.id },
            update: {},
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
                categoryId: category?.id,
                splitId: split?.id,
                movementPatternId: pattern?.id,
                gifUrl: ex.logic_assets.gif_url || null,
            },
        });

        // 1. Equipment Junction
        if (ex.requirements.equipment) {
            for (const eqName of ex.requirements.equipment) {
                const eq = await prisma.equipment.findUnique({ where: { name: eqName } });
                if (eq) {
                    await prisma.exerciseEquipment.upsert({
                        where: { exerciseId_equipmentId: { exerciseId: createdEx.id, equipmentId: eq.id } },
                        update: {},
                        create: { exerciseId: createdEx.id, equipmentId: eq.id }
                    });
                }
            }
        }

        // 2. Muscle Junction
        const muscleRoles = [
            { list: ex.anatomy.primary, role: 'PRIMARY' },
            { list: ex.anatomy.secondary, role: 'SECONDARY' },
            { list: ex.anatomy.stabilizers, role: 'STABILIZER' },
        ];

        for (const { list, role } of muscleRoles) {
            if (list) {
                for (const mName of list) {
                    const m = await prisma.muscle.findUnique({ where: { name: mName } });
                    if (m) {
                        await prisma.exerciseMuscle.upsert({
                            where: { exerciseId_muscleId_role: { exerciseId: createdEx.id, muscleId: m.id, role } },
                            update: {},
                            create: { exerciseId: createdEx.id, muscleId: m.id, role }
                        });
                    }
                }
            }
        }

        // 3. Tag Junction
        if (ex.logic_assets.tags) {
            for (const tagName of ex.logic_assets.tags) {
                const t = await prisma.tag.findUnique({ where: { name: tagName } });
                if (t) {
                    await prisma.exerciseTag.upsert({
                        where: { exerciseId_tagId: { exerciseId: createdEx.id, tagId: t.id } },
                        update: {},
                        create: { exerciseId: createdEx.id, tagId: t.id }
                    });
                }
            }
        }
    }

    console.log('Linking Alternatives...');
    for (const ex of exercisesData) {
        if (ex.logic_assets.alternatives && ex.logic_assets.alternatives.length > 0) {
            const currentEx = await prisma.exercise.findUnique({ where: { externalId: ex.id } });

            for (const altExtId of ex.logic_assets.alternatives) {
                const altEx = await prisma.exercise.findUnique({ where: { externalId: String(altExtId) } });
                if (currentEx && altEx) {
                    await prisma.exerciseToAlternative.upsert({
                        where: { exerciseId_alternativeId: { exerciseId: currentEx.id, alternativeId: altEx.id } },
                        update: {},
                        create: { exerciseId: currentEx.id, alternativeId: altEx.id }
                    });
                }
            }
        }
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
