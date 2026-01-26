const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const totalExercises = await prisma.exercise.count();
        console.log(`Total Exercises: ${totalExercises}`);

        const splitCounts = await prisma.exercise.groupBy({
            by: ['splitId'],
            _count: { _all: true }
        });

        console.log('\nExercises per Split:');
        for (const c of splitCounts) {
            if (c.splitId) {
                const split = await prisma.split.findUnique({ where: { id: c.splitId } });
                console.log(`${split ? split.name : 'Unknown'}: ${c._count._all}`);
            } else {
                console.log(`No Split: ${c._count._all}`);
            }
        }

        const equipmentUsage = await prisma.exerciseEquipment.groupBy({
            by: ['equipmentId'],
            _count: { _all: true }
        });

        console.log('\nEquipment Usage Count:');
        for (const u of equipmentUsage) {
            const eq = await prisma.equipment.findUnique({ where: { id: u.equipmentId } });
            console.log(`${eq ? eq.name : 'Unknown'}: ${u._count._all}`);
        }

        // Check specific exercises with equipment
        const someEx = await prisma.exercise.findMany({
            take: 10,
            include: { equipment: { include: { equipment: true } } }
        });
        console.log('\nSample Exercises and Equipment:');
        someEx.forEach(ex => {
            console.log(`${ex.name}: ${ex.equipment.map(e => e.equipment.name).join(', ')}`);
        });

        const equipment = await prisma.equipment.findMany({
            select: { name: true }
        });
        console.log('\nAvailable Equipment in DB:', equipment.map(e => e.name).join(', '));

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
