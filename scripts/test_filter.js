const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testFilter(availableEquipment) {
    const equipmentSet = new Set(availableEquipment.map(e => e.toLowerCase()));
    equipmentSet.add('bodyweight');
    equipmentSet.add('floor');

    const exercises = await prisma.exercise.findMany({
        include: {
            equipment: { include: { equipment: true } },
            split: true
        }
    });

    const filtered = exercises.filter(ex => {
        const reqs = ex.equipment.map(ee => ee.equipment.name.toLowerCase());
        if (reqs.length === 0) return true;
        return reqs.every(req => {
            return Array.from(equipmentSet).some(avail => avail.includes(req) || req.includes(avail));
        });
    });

    console.log(`\nTesting with Equipment: ${availableEquipment.join(', ')}`);
    console.log(`Total Filtered: ${filtered.length}`);

    const splitCounts = {};
    filtered.forEach(ex => {
        const s = ex.split?.name || 'Unknown';
        splitCounts[s] = (splitCounts[s] || 0) + 1;
    });

    console.log('Split Distribution:', splitCounts);

    if (splitCounts['Pull'] === undefined || splitCounts['Pull'] === 0) {
        console.log('\nSample Pull Exercises and their requirements:');
        const pullEx = exercises.filter(ex => ex.split?.name === 'Pull').slice(0, 10);
        pullEx.forEach(ex => {
            console.log(`${ex.name}: ${ex.equipment.map(e => e.equipment.name).join(', ')}`);
        });
    }
}

async function run() {
    await testFilter(['Dumbbells', 'Barbell', 'Rack', 'Flat Bench']);
    await testFilter(['Dumbbells']);
    await prisma.$disconnect();
}

run();
