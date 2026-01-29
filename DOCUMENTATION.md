# Technical Documentation - Flex Backend

This document provides a deep dive into the architecture and internal logic of the Flex workout system.

## 🏗️ Architecture

Flex follows a standard MVC-inspired architecture:
- **Routes**: Defines the API surface.
- **Controllers**: Handles request logic and interacts with Prisma.
- **Utils**: Contains core logic like the `WorkoutGenerator`.
- **Database**: Managed via Prisma with a relational schema optimized for historical tracking.

## 🧬 Core Intelligence: `WorkoutGenerator.js`

The heart of the system is the `WorkoutGenerator` class, which handles:

### 1. Equipment Filtering
- Fuzzy matching for equipment (e.g., "Weights" expands to "Dumbbells" and "Barbell").
- Strict filtering based on user-provided available equipment.

### 2. Adaptive Workout Planning System

The system uses historical performance data to intelligently adapt workout plans across multiple weeks.

#### Progressive Overload Models

Three progression models are available (specified via `progressionModel` parameter):

**LINEAR (Default)**
- Analyzes last 3 sessions for each exercise
- `AVG RPE < 7`: Weight increased by **+2.5kg**
- `AVG RPE 7-8.5`: Small increase of **+1.25kg**
- `AVG RPE > 9`: Maintain weight for form and recovery

**DOUBLE_PROGRESSION**
- Increases reps first within the target range
- When max reps achieved with `RPE < 8`: increase weight by **+2.5kg** and reset to min reps
- Ideal for hypertrophy training

**WAVE**
- 3-week intensity cycle: Light (85%) → Medium (92%) → Heavy (100%)
- Automatically varies intensity based on week number
- Ideal for strength training and periodization

#### Volume Regulation

Automatically adjusts training volume based on recovery status:

- **High RPE Detection**: If 2+ recent sessions had `RPE >= 9`, reduce sets by 1
- **Muscle Fatigue**: Checks `MuscleRecoveryLog` for primary muscles
  - If `fatigueLevel >= 8`: reduce sets by 1 (minimum 2 sets)
- **Goal Overlays**: Strength goals maintain minimum 4 sets, endurance uses higher rep ranges

#### Deload Logic

Automatic deload week insertion based on:

1. **Systemic Fatigue**: If average `systemicFatigue >= 7` or `sorenessLevel >= 8` over last 7 days
2. **Scheduled Deload**: Every 4th week automatically becomes a deload week

Deload modifications:
- Weight reduced by **20%**
- Sets reduced by **1**
- Clear notes explaining deload reason

#### Exercise Rotation

- **AVOID** preference: Exercises completely excluded from plan
- **DISLIKE** preference: Deprioritized but included if needed
- **LIKE** preference: Prioritized in exercise selection
- Feedback stored in `ExerciseFeedback` table


### 3. Split Mapping
Dynamically maps workout days to specific splits (Push/Pull/Legs, Upper/Lower, or Full Body) based on the user's `days_per_week` selection.

---

## 📡 API Reference

### Auth Endpoints
- `POST /api/auth/register`: Register a new user.
- `POST /api/auth/login`: Authenticate and receive JWTs.
- `POST /api/auth/refresh`: Refresh expired access tokens.

### Workout Endpoints
- `POST /api/workout/generate`: Generates a new adaptive plan based on specs and history.
- `GET /api/workout/my-plans`: Retrieves all plans for the authenticated user.
- `GET /api/workout/trends`: Aggregates performance data and fatigue metrics for visualization.

### Log Endpoints
- `POST /api/logs/submit`: Bulk submission of an entire workout session (Performance + Feedback + Session Metrics).
- `POST /api/logs/recovery`: Log daily readiness, sleep, and soreness.

---

## 🗄️ Database Schema Highlights

- **User**: Core entity.
- **WorkoutPlan**: A collection of `WorkoutSession`s.
- **WorkoutExercise**: Junction table between sessions and exercises, storing prescribed sets/reps/weight.
- **ExercisePerformanceLog**: Stores the *actual* work done (Actual Reps, Actual Weight, RPE).
- **MuscleRecoveryLog**: Tracks current fatigue levels per muscle group (0-10).
- **ExerciseFeedback**: Stores user sentiment (LIKE/DISLIKE/AVOID) for specific exercises.

## 📊 Progress Intelligence Dashboard

The frontend (`/progress.html`) uses **Chart.js**. The backend provides a custom aggregation in `getPerformanceTrends` that avoids "N+1" query problems by fetching all historical logs in a single query and grouping them in memory.

---

## 🛠️ Maintenance

### Adding New Exercises
Exercises are stored in the database. To seed new exercises:
1. Update `public/exercises.json` if using a script.
2. Use the Prisma CLI to create new entries in the `Exercise` model.

### Testing Adaptive Logic

Run the automated test suite to verify adaptive features:

```bash
node scripts/test_adaptive_logic.js
```

This test suite verifies:
- ✓ Progressive overload (Linear, Double Progression, Wave)
- ✓ Volume regulation based on RPE and muscle fatigue
- ✓ Deload week insertion (scheduled and fatigue-based)
- ✓ Exercise rotation based on user preferences
- ✓ Multi-week progression simulation

The test creates dummy data, generates plans, and validates all adaptive logic.

### Troubleshooting
- **Transaction Timeouts**: Large session submissions are wrapped in a Prisma transaction with a **30-second timeout** to ensure data integrity during adaptive updates.
- **Routing Issues**: Always ensure `npm run dev` is running; Express routes are case-sensitive by default in some environments.
