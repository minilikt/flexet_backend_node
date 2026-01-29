# Workout Generation Engine

## 🧠 Overview

The **Workout Generator** (`src/utils/workoutGenerator.js`) is the intelligence core of Flex. It uses a **constraint-satisfaction approach** combined with **genetic algorithm-lite** principles to create multi-week, periodized, and adaptive workout plans.

Unlike static templates, Flex generates plans "Just In Time" (or updates them reactively) based on:
1.  **User Constraints** (Equipment, Days per week, Exercises per day).
2.  **User Preferences** (Goal, Like/Dislike feedback).
3.  **Historical Performance** (RPE, Weights used, 1RM estimates).
4.  **Recovery Status** (Muscle fatigue, Systemic fatigue, Soreness).

---

## ⚙️ Deep Dive: The Algorithm

### Phase 1: Expansion & Filtering (The "Funnel")
The generator starts with the full database of exercises (~200+) and applies a strict funnel:

1.  **Semantic Equipment Expansion**:
    - User input: `["Weights"]`
    - System transformation: `["dumbbells", "barbell", "plates", "kettlebell", "ez-bar"]`
    - Logic: Prevents users from needing to know every variation name.
    
2.  **Hard Constraint Filtering**:
    - Exercises are checked against the expanded equipment list.
    - **Rule**: If an exercise requires *any* piece of equipment the user lacks, it is strictly rejected.
    - *Example*: `Face Pull` (requires Cables) is rejected for a user with only `Dumbbells`.

3.  **Soft Constraint Filtering (Adaptive)**:
    - **Feedback**: `AVOID` exercises are removed entirely.
    - **Fatigue**: The system queries `MuscleRecoveryLog`. 
    - **Optimization**: [NEW] Uses **Batch Fetching** to retrieve all relevant recovery and performance logs in a single query, reducing transaction time from >500ms to ~14ms.
    - **Rule**: If a Muscle Group (e.g., Hamstrings) is at `>8/10` fatigue:
        - Compound movements hitting it are deprioritized.
        - Isolation movements hitting it are removed.

### Phase 2: Structural Logic (The "Split")
We map `days_per_week` to scientifically validated splits:
-   **3 Days**: Push / Pull / Legs (Standard PPL)
-   **4 Days**: Upper / Lower / Upper / Lower (or PPL + Full Body)
-   **5 Days**: PPL + Upper + Lower
-   **6 Days**: PPL x2

**Day Mapping**: [NEW] The generator now maps indices to specific `dayLabel` values (e.g., "Monday", "Tuesday") provided in user preferences, ensuring the generated plan aligns with the user's weekly schedule.

*Code Insight*: `getSplitMap(days)` handles this mapping. It ensures balanced frequency (hitting muscles 2x/week where possible).

### Phase 3: Exercise Selection & Prioritization
For each session focus (e.g., "Push"):
1.  **Bucket Sorting**: Exercises are grouped by the target split.
2.  **Preference Weighting**: 
    - `LIKE` exercises get a x2 probability weight.
    - `DISLIKE` exercises get a x0.5 probability weight.
3.  **Shuffle & Pick**: The system randomizes the weighted list and picks the top `N` exercises (Default: 6).
    - *Safety*: Ensures at least one Compound movement is chosen if available.

### Phase 4: Adaptive Goal Logic (The "Brain")
Once exercises are picked, `applyGoalLogic` calculates the numbers. This is where the magic happens.

#### 1. Progressive Overload Engine
The system looks back at the *last 3 sessions* of this specific exercise.

-   **Linear Progression (Default)**:
    -   Ideal for Beginners/Intermediates.
    -   `Avg RPE < 7`: **+2.5kg** (Aggressive).
    -   `Avg RPE 7-8.5`: **+1.25kg** (Micro-load).
    -   `Avg RPE > 9`: **Maintain** (Stabilize form).
    
-   **Double Progression (Hypertrophy Default)**:
    -   Focuses on Volume first.
    -   Target: "8-12 reps".
    -   User hits 12 reps @ RPE < 8 -> **Increase Weight + Reset to 8 reps**.
    
-   **Wave Periodization (Strength Default)**:
    -   Week 1: 85% Intensity (Accumulation).
    -   Week 2: 92% Intensity (Intensification).
    -   Week 3: 100% Intensity (Realization/Peak).
    -   Week 4: Deload (if scheduled).

#### 2. Volume Regulation (Auto-Regulation)
Prevents burnout by monitoring "Internal Load".
-   **RPE Check**: If `recentHighRPE >= 2` (User is grinding too hard), **Sets -1**.
-   **Fatigue Check**: If `MuscleRecoveryLog > 8`, **Sets -1**.

#### 3. Deload Logic
-   **Scheduled**: Every 4th week is forced deload.
-   **Reactive**: If `DailyRecoveryLog.systemicFatigue > 7`, next week becomes a deload.
-   **Modification**: Weight x0.8, Sets -1.

---

## 🔄 Reactive Sync Logic
Flex uses a "Reactive Sync" architecture.
1.  User submits log via `POST /api/logs/submit`.
2.  Database updates history.
3.  Controller triggers `recalculateRemainingPlan(userId)`.
4.  Generator re-runs `applyGoalLogic` for *future* sessions in the current plan.
5.  **Result**: If you hit a PR today, next week's prescribed weight increases *immediately*.

---

## 🚀 Future Mechanics & Roadmap

We are planning to evolve the generator from *Adaptive* to *Predictive*.

### 1. 1RM-Based "Percentage Training" (V2)
-   **Current**: Increases based on fixed weights (+2.5kg).
-   **Future**: Calculate estimated 1RM using Brzycki Formula from logs.
-   **Benefit**: Prescribe "3 sets @ 75% 1RM" which is more accurate than arbitrary weight additions.

### 2. Frequency-Based Rotation (V2)
-   **Problem**: Users get bored doing the same variation for 12 weeks.
-   **Solution**: Track `lastUsedDate` for every exercise.
-   **Logic**: After 6 weeks of usage, force-swap an exercise for a biomechanically similar alternative (e.g., *Bench Press* -> *Dumbbell Press*).

### 3. Injury Prevention heuristics (V3)
-   **Logic**: If user reports "Joint Pain" in `DailyRecoveryLog`:
    -   Swap high-impact exercises (Barbell Squat) for low-impact (Leg Press).
    -   Reduce intensity (RPE 6 cap) for 1 week.

### 4. Machine Learning Integration (V4)
-    Train a model on `(User Profile + Exercise History) -> Probability(Completion)`.
-   Optimize plans to maximize *Adherence* rather than just biological optimality.
