# Flex Analytics Engine

The Flex Analytics Engine provides real-time insights into user performance, consistency, and physical recovery. This document explains the underlying logic and data flow for the metrics displayed in the dashboard.

## 📊 Core Metrics

### 1. Workout Streaks
- **Logic**: Calculates the number of consecutive days a user has completed at least one workout session.
- **Rules**:
    - A streak is maintained if a workout is logged either **Today** or **Yesterday**.
    - If no workout is logged within 24 hours of the last session, the streak resets to zero.
- **Performance**: To ensure fast response times, the engine only scans the last **60 days** of session history.

### 2. Weekly Volume (Tonnage)
- **Calculation**: Sum of `(Weight × Reps)` for all exercises completed in the last **7 days**.
- **Scope**: Includes all sets from all sessions within the rolling 7-day window.
- **Goal**: Provides a concrete measure of total workload, allowing users to track absolute strength progression (progressive overload).

### 3. Goal Progress
- **Logic**: Tracks the completion percentage of the currently **ACTIVE** workout plan.
- **Formula**: `(Completed Sessions / Total Planned Sessions) × 100`.
- **Display**: Shown as a progress bar on the dashboard to visualize how close the user is to finishing their current phase.

### 4. Muscle Distribution
- **Logic**: Aggregates total tonnage (Weight × Reps) per muscle group.
- **Focus**: Currently prioritizes **PRIMARY** muscles to give a clear picture of which body parts are receiving the most stimulus.
- **Data Flow**: `Exercise Performance Logs` → `Exercise Muscle Mapping` → `Primary Muscle Volumes`.

### 5. Body Metrics Tracking
- **Features**: Allows users to log weight, height, and body fat percentage.
- **Persistence**: Uses an `upsert` strategy, meaning only one entry is saved per day. If a user logs twice in one day, the previous entry is updated.

---

## ⚡ Performance Optimization

The analytics engine is built for scale. Key optimizations include:

| Optimization | Description |
| :--- | :--- |
| **Selective Fetching** | Using Prisma `select` to only fetch required fields (weight, reps, dates), reducing memory overhead. |
| **Time Windows** | Limiting expensive calculations (like streaks) to the most recent 60-day window. |
| **Database Aggregation** | Leveraging `_count` and `_sum` at the database level where possible to minimize JavaScript loops. |

## 🔄 Data Sync
Analytics are updated **immediately** after a workout session is submitted via the `submitSessionResult` endpoint in `log.controller.js`.
