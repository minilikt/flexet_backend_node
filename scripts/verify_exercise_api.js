const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyExerciseAPI() {
    console.log('--- Verifying Exercise API ---');
    try {
        // 1. Test Metadata Fetching
        console.log('1. Testing Metadata...');
        const [muscles, equipment, categories] = await Promise.all([
            prisma.muscle.findMany({ select: { name: true } }),
            prisma.equipment.findMany({ select: { name: true } }),
            prisma.category.findMany({ select: { name: true } })
        ]);
        console.log(`- Found ${muscles.length} muscles, ${equipment.length} equipment types, ${categories.length} categories.`);

        // 2. Test Basic Search
        console.log('\n2. Testing Basic Search...');
        const exercises = await prisma.exercise.findMany({
            take: 5,
            include: { muscles: true, equipment: true, category: true }
        });
        if (exercises.length > 0) {
            console.log(`- Successfully fetched ${exercises.length} exercises.`);
            console.log(`- Example: ${exercises[0].name}`);
        } else {
            console.warn('! No exercises found in database.');
        }

        // 3. Test Filter Logic
        console.log('\n3. Testing Filters...');
        if (muscles.length > 0) {
            const mName = muscles[0].name;
            const filtered = await prisma.exercise.findMany({
                where: { muscles: { some: { muscle: { name: mName } } } },
                take: 1
            });
            console.log(`- Filtering by muscle "${mName}": ${filtered.length > 0 ? 'SUCCESS' : 'NO RESULTS'}`);
        }

        console.log('\n✅ API Logic Verification Complete.');
    } catch (err) {
        console.error('❌ Verification failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

verifyExerciseAPI();
