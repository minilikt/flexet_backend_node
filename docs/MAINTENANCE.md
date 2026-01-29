# Maintenance & Contributing Guide

## 🛠️ Developer Workflow

### 1. Environment Setup
Ensure you have Node.js (v18+) and PostgreSQL installed.
```bash
# Clone
git clone <repo>
cd flex/back

# Install
npm install

# Database (Ensure Postgres is running)
# Create .env file based on .env.example
npx prisma migrate dev
```

### 2. Running Tests
We have a specialized test suite for the Adaptive Logic.
```bash
# Run the adaptive logic verification
node scripts/test_adaptive_logic.js

# Output should show "✓" for all tests
```

### 3. Database Updates
If you change `prisma/schema.prisma`:
1.  **Stop the server**.
2.  Run migration:
    ```bash
    npx prisma migrate dev --name describe_your_change
    ```
    *Example: `npx prisma migrate dev --name add_cardio_fields`*
3.  This regenerates the Prisma Client automatically.

## 🏋️ Adding New Exercises

Exercises are "static" data but live in the database.

**Option A: Admin Interface (If built)**
Use the API `POST /api/exercises`.

**Option B: Seeding/Scripting (Recommended)**
1.  Edit `public/exercises.json`.
2.  Run the seed script (if created) or use a direct Prisma script like this:

```javascript
// scripts/add_exercise.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.exercise.create({
    data: {
      name: "Bent Over Dumbbell Row",
      type: "Strength",
      difficultyMin: 2,
      difficultyMax: 6,
      muscles: {
        create: [
          { muscle: { connect: { name: "Latissimus Dorsi" } }, role: "PRIMARY" }
        ]
      },
      equipment: {
        create: [
          { equipment: { connect: { name: "Dumbbells" } } }
        ]
      },
      split: { connect: { name: "Pull" } }
    }
  });
}
main();
```

## 🐛 Debugging Guide

### "Why is my plan empty?"
1.  **Check Equipment**: Use `scripts/debug_filtering_file.js` to see if your equipment list is too restrictive.
2.  **Check Filters**: Did you `AVOID` too many exercises?
3.  **Check Database**: Run `node scripts/check_counts.js` to ensure the DB isn't empty.

### "Why isn't the weight increasing?"
1.  **Check Logs**: Look at `ExercisePerformanceLog`. Is the RPE consistently < 7?
2.  **Check Logic**: Inspect `WorkoutGenerator.js` -> `applyGoalLogic`.
3.  **Run Tests**: `node scripts/test_adaptive_logic.js` isolates the logic without DB noise.

## 📦 Deployment

1.  **Build**: Not needed for Node/Express (interpreted).
2.  **Start**: Use a process manager like PM2.
    ```bash
    pm2 start index.js --name "flex-backend"
    ```
3.  **Reverse Proxy**: Put Nginx in front of port 5000 for SSL termination.
