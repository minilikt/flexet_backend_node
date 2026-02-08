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
    "workoutDays": ["Monday"],      // optional (array of strings)
    "progressionModel": "LINEAR"    // LINEAR, DOUBLE_PROGRESSION, WAVE
  }
  ```
- **Response (201)**: Returns the created `WorkoutPlan` object with nested sessions.

### Get Active Session
**GET** `/workout/session`

Fetches the user's currently active session with full nested details.

- **Response (200)**: Full session object or `404` if none active.

### Get My Plans
**GET** `/workout/plans`

Retrieves all workout plans for the user.

- **Response (200)**: List of plan objects.

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
  - `categoryId`: Filter by category
  - `search`: String search for name
  - `limit`: Number of results (default: 50)

### Get Filter Metadata
**GET** `/exercises/metadata`

Returns lists of muscles, equipment, and categories to populate filter UI.

### Get Performance Trends
**GET** `/workout/trends`

Returns aggregated stats for visualization (e.g., 1RM progress over time).

---

## 📊 Analytics (`/analytics`) [NEW]

### Dashboard Summary
**GET** `/analytics/summary`

Returns streaks, weekly tonnage, and current goal progress.

### Muscle Distribution
**GET** `/analytics/muscles`

Returns volume (kg) breakdown per muscle group for radar charts.

### Body Metrics History
**GET** `/analytics/metrics`

Returns historical body measurements (weight, fat %) for progress charts.

### Log Body Metric
**POST** `/analytics/metrics`

Logs current physiological data.

- **Body**:
  ```json
  {
    "weight": 75.5,
    "fatPercentage": 14.2
  }
  ```

### Get Recovery Summary
Returns the user's current recovery status based on sleep, readiness, and fatigue logs.

- **URL**: `/api/analytics/recovery-summary`
- **Method**: `GET`
- **Auth Required**: Yes

#### Success Response
- **Code**: 200 OK
- **Content**:
```json
{
  "status": "success",
  "data": {
    "summary": {
      "readiness": 85,
      "sleep": 7.5,
      "soreness": 3,
      "fatigue": 4,
      "fatiguedMuscles": ["Quads", "Lower Back"],
      "recommendedIntensity": "HIGH" // HIGH, MODERATE, LOW, REST
    }
  }
}
```

### Get Exercise History
Returns a feed of completed exercises, grouped by date.

- **URL**: `/api/analytics/history`
- **Method**: `GET`
- **Auth Required**: Yes
- **Query Params**:
  - `limit`: Number of items to return (default: 30)
  - `offset`: Pagination offset (default: 0)

#### Success Response
- **Code**: 200 OK
- **Content**:
```json
{
  "status": "success",
  "data": {
    "history": [
      {
        "date": "Feb 7",
        "rawDate": "2026-02-07T14:30:00.000Z",
        "items": [
          {
            "id": "evt_123",
            "exercise": "Bench Press",
            "bodyPart": "Chest",
            "time": "2:30 PM",
            "sets": 4,
            "reps": 32,
            "weight": 85,
            "metric": "kg",
            "isPR": true,
            "prWeight": 85,
            "calories": 45,
            "duration": 12
          }
        ]
      }
    ]
  }
}
```
