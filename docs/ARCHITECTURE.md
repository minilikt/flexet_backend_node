# System Architecture

## Overview

Flex is a backend-heavy application designed to generate and track adaptive workout plans. It follows a standard **MVC (Model-View-Controller)** architecture, although user interactions are primarily API-driven.

### 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js (REST API)
- **Database**: PostgreSQL
- **ORM**: Prisma (Schema definition & Type-safe queries)
- **Encryption**: Bcrypt (Passwords), JWT (Sessions)

## 📂 Project Structure

```
c:/Projects/New folder/flex/back/
├── prisma/                 # Database layer
│   ├── schema.prisma       # Single source of truth for DB schema
│   ├── migrations/         # SQL migration history
│   └── seedExercises.js    # Data seeding script
├── public/                 # Static assets (images, standard JSONs)
│   └── exercises.json      # Base exercise data
├── scripts/                # Maintenance & Testing scripts
│   ├── test_adaptive_logic.js # Automated adaptive logic test
│   └── ...
├── src/
│   ├── controllers/        # Request Logic (Input validation -> Utils -> DB)
│   ├── middleware/         # Auth verification, Error handling
│   ├── routes/             # API Endpoint definitions
│   └── utils/              # Business Logic (Gen Algo, Helpers)
├── .env                    # Secrets (Not committed)
└── index.js                # Server entry point
```

## 🧩 Key Components

### 1. The Controller Layer
Located in `src/controllers/`, this layer handles incoming HTTP requests. It parses the body, validates inputs, and calls the necessary service or utility.
- **`log.controller.js`**: Massive controller handling session submissions. It is responsible for the **Reactive Sync**, where submitting a log triggers a plan recalculation.
- **`workout.controller.js`**: Handles plan creation and retrieval.

### 2. The Logic Layer (Utils)
Located in `src/utils/`.
- **`WorkoutGenerator.js`**: The brain of the application. Contains 400+ lines of adaptive algorithms. See [Workout Generation](WORKOUT_GENERATION.md) for details.

### 3. The Data Layer (Prisma)
Prisma Client is instantiated once and reused across the app. It provides a type-safe abstraction over SQL.

## 🔄 Data Flow Example

**Scenario: User Generates a Plan**

1.  **Request**: `POST /api/workout/generate` with preferences (Days/week, goal, equipment).
2.  **Route**: Express routes request to `workoutController.generate`.
3.  **Controller**:
    - Validates inputs.
    - Instantiates `WorkoutGenerator`.
    - Calls `generator.generatePlan()`.
4.  **Utility (`WorkoutGenerator`)**:
    - Filters equipment.
    - Fetches user history (Prisma).
    - Applies Progressive Overload logic.
    - Returns JSON plan.
5.  **Controller**: Saves the plan to DB (`prisma.workoutPlan.create`) and returns 201 Created.

## 🏗️ Design Decisions

- **Why Prisma?**
  Prisma was chosen for its schema-first approach. The `schema.prisma` file provides a clear, visual representation of the complex relationships (Exercises <-> Muscles, Logs <-> Exercises).

- **Why "Reactive Sync"?**
  Instead of a nightly cron job to adjust plans on the fly, we use a reactive approach. When a user calls `submitSessionResult`, the controller immediately triggers `recalculateRemainingPlan`. This ensures the user instantly sees an updated plan for next week if they failed/crushed their workout today.
