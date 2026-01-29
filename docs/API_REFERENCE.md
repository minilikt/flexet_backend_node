# API Reference

Base URL: `http://localhost:5000/api`

## 🔐 Authentication (`/auth`)

### Register User
**POST** `/auth/register`

Creates a new user account, hashes password, and issues initial tokens.

- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "securePassword123"
  }
  ```
- **Response (201)**:
  ```json
  {
    "message": "User registered successfully",
    "accessToken": "eyJhb...",
    "refreshToken": "7f8a..."
  }
  ```

### Login
**POST** `/auth/login`

Authenticates user credentials. Revokes previous refresh tokens (rotation policy).

- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "securePassword123"
  }
  ```

### Refresh Token
**POST** `/auth/refresh`

Exchanges a valid Refresh Token for a new Access Token.

- **Body**: `{ "token": "refresh_token_string" }`
- **Response (200)**: `{ "accessToken": "new_jwt_string" }`

---

## � User Profile (`/users`)

### Get Profile
**GET** `/users/profile`

Returns the authenticated user's profile data.

- **Headers**: `Authorization: Bearer <token>`
- **Response (200)**:
  ```json
  {
    "id": "uuid",
    "email": "user@gmail.com",
    "age": 25,
    "gender": "male",
    "goal": "hypertrophy",
    "equipment": ["gym"],
    "createdAt": "2024-..."
  }
  ```

### Update Profile
**PUT** `/users/profile`

Updates user biometrics and preferences. Used during Onboarding.

- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "age": 25,
    "gender": "male",
    "height": 180,
    "weight": 75,
    "goal": "muscle_mass",
    "trainingLevel": "intermediate",
    "sleepHours": 7.5,
    "waterIntake": 3,
    "equipment": ["dumbbells", "bench"],
    "workoutDays": ["Monday", "Wednesday", "Friday"]
  }
  ```

---

## �💪 Workout Management (`/workout`)

### Generate Plan
**POST** `/workout/generate`

Triggers the **Workout Generator** to create a new multi-week adaptive plan.

- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "goal": "hypertrophy",          // strength, hypertrophy, endurance
    "days_per_week": 4,             // 3-6
    "available_equipment": ["Dumbbells", "Bench"],
    "exercises_per_day": 6,         // optional (default: 6)
    "weeks": 4,                     // optional (default: 4)
    "progressionModel": "LINEAR"    // LINEAR, DOUBLE_PROGRESSION, WAVE
  }
  ```
- **Response (201)**: Returns the created `WorkoutPlan` object with nested sessions.

### Get Active Plan
**GET** `/workout/current`

Fetches the user's currently active plan with full nested details.

- **Response (200)**: Full plan object or `404` if none active.

---

## 📝 Logging & Feedback (`/logs`)

### Submit Session Result
**POST** `/logs/submit`

Submits data for a completed workout session. **Triggers Reactive Sync**.

- **Body**:
  ```json
  {
    "sessionId": "uuid-string",
    "durationMinutes": 60,
    "perceivedDifficulty": 7, // 1-10 (Session RPE)
    "notes": "Good energy today",
    "exercises": [
      {
        "workoutExerciseId": "uuid-string",
        "sets": [
          { "setNumber": 1, "weight": 50, "reps": 10, "rpe": 8 },
          { "setNumber": 2, "weight": 50, "reps": 9, "rpe": 9 }
        ],
        "feedback": { // Optional
          "preference": "LIKE",
          "difficulty": 6,
          "notes": "Felt good"
        }
      }
    ]
  }
  ```

### Log Daily Recovery
**POST** `/logs/recovery`

Logs recovery metrics which influence Deload Logic.

- **Body**:
  ```json
  {
    "readiness": 8,        // 1-10
    "sleep": 7.5,          // hours
    "fatigue": 4,          // 1-10 (Systemic)
    "soreness": 3,         // 1-10
    "muscleFatigues": [    // Optional specific muscle fatigue
      { "muscleId": "uuid", "level": 6 }
    ]
  }
  ```

---

## 🔍 Data Resources

### Get Exercises
**GET** `/exercises`

Returns the library of exercises.

- **Query Params**:
  - `muscleId`: Filter by muscle
  - `equipmentId`: Filter by equipment

### Get Performance Trends
**GET** `/workout/trends`

Returns aggregated stats for visualization (e.g., 1RM progress over time).
