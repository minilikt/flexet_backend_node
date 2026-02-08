# Flex Frontend API Catalog

This document is an exhaustive reference for the Flex API. Every endpoint is listed with its method, purpose, request payload, and example response.

## � Authentication (`/api/auth`)

### POST `/register`
Creates a new user account.
- **Payload**:
  ```json
  { "email": "user@example.com", "password": "password123" }
  ```
- **Response (201)**:
  ```json
  { "message": "User registered successfully", "accessToken": "...", "refreshToken": "..." }
  ```

### POST `/login`
Authenticates user and returns tokens.
- **Payload**:
  ```json
  { "email": "user@example.com", "password": "password123" }
  ```
- **Response (200)**:
  ```json
  { "message": "Login successful", "accessToken": "...", "refreshToken": "..." }
  ```

### POST `/refresh`
Exchanges a valid refresh token for a new access token.
- **Payload**:
  ```json
  { "token": "refresh-token-here" }
  ```
- **Response (200)**:
  ```json
  { "accessToken": "new-access-token" }
  ```

### POST `/logout`
Invalidates the refresh token (Server-side).
- **Payload**:
  ```json
  { "token": "refresh-token-here" }
  ```
- **Response (200)**:
  ```json
  { "message": "Logged out successfully" }
  ```

### GET `/me`
Returns the current session user info (Internal logic check).
- **Headers**: `Authorization: Bearer <token>`
- **Response (200)**:
  ```json
  { "userId": "uuid-string", "email": "user@example.com" }
  ```

---

## 👤 User Profile (`/api/users`)

### GET `/profile`
Fetches full biometric and training data.
- **Response (200)**:
  ```json
  {
    "status": "success",
    "data": {
       "id": "uuid", "age": 25, "gender": "male", "goal": "strength",
       "trainingLevel": "intermediate", "equipment": ["gym", "dumbbells"]
    }
  }
  ```

### PUT `/profile`
Updates user profile settings.
- **Payload**:
  ```json
  {
    "age": 25, "gender": "male", "goal": "STRENGTH",
    "trainingLevel": "INTERMEDIATE", "equipment": ["Dumbbells", "Barbell"],
    "workoutDays": ["Monday", "Wednesday", "Friday"]
  }
  ```
- **Response (200)**:
  ```json
  { "message": "Profile updated successfully" }
  ```

---

## 💪 Workout Management (`/api/workout`)

### POST `/generate`
Creates or updates the multi-week adaptive training plan.
- **Payload**:
  ```json
  {
    "goal": "HYPERTROPHY",
    "days_per_week": 4,
    "weeks": 4,
    "available_equipment": ["Weights", "Bench"],
    "progressionModel": "LINEAR" 
  }
  ```
- **Response (200)**:
  ```json
  { "message": "Workout plan generated successfully", "plan": { "id": "uuid", "sessions": [...] } }
  ```

### GET `/plans`
Retrieves all workout plans for the user.
- **Response (200)**:
  ```json
  { "plans": [ { "id": "...", "status": "ACTIVE", "sessions": [...] } ] }
  ```

### GET `/session`
Retrieves the current incomplete session for the active plan.
- **Response (200)**:
  ```json
  {
    "status": "success",
    "message": "Active session fetched successfully",
    "data": {
      "session": {
        "id": "uuid",
        "dayLabel": "Monday",
        "focus": "Upper Body",
        "weekNumber": 1,
        "dayNumber": 1,
        "isCompleted": false,
        "exercises": [
          {
            "id": "uuid",
            "exercise": { "name": "Bench Press", "gifUrl": "..." },
            "sets": 3,
            "reps": "8-12",
            "restMin": 60
          }
        ]
      }
    }
  }
  ```

### GET `/trends`
Aggregated performance and fatigue data for charts.
- **Response (200)**:
  ```json
  {
    "trends": { "Bench Press": [ { "date": "...", "volume": 1500, "rpe": 8 } ] },
    "fatigue": [ { "muscle": "Chest", "level": 4 } ]
  }
  ```

---

## 📝 Training Logs (`/api/logs`)

### POST `/submit` (Primary)
Bulk submission of a complete workout session. This is the **most important** endpoint for frontend.
- **Payload**:
  ```json
  {
    "sessionId": "uuid",
    "durationMinutes": 60,
    "perceivedDifficulty": 7,
    "notes": "Felt strong today",
    "exercises": [
      {
        "workoutExerciseId": "uuid",
        "sets": [ { "setNumber": 1, "weight": 60, "reps": 10, "rpe": 8, "isPR": false } ],
        "feedback": { "preference": "LIKE", "difficulty": 6, "notes": "Great burn" }
      }
    ]
  }
  ```
- **Response (200)**:
  ```json
  { "message": "Session processed and future plan adapted.", "result": { ... } }
  ```

### POST `/recovery`
Log daily readiness metrics.
- **Payload**:
  ```json
  {
    "readiness": 8, "sleep": 7.5, "fatigue": 4, "soreness": 3,
    "muscleFatigues": [ { "muscleId": "uuid", "level": 6 } ]
  }
  ```

---

## 🔍 Exercises (`/api/exercises`)

### GET `/`
Search the exercise library using robust filters.
- **Query Params**:
  - `search`: Partial name match (e.g., "bench")
  - `muscle`: Filter by muscle name (e.g., "Chest")
  - `equipment`: Filter by equipment name (e.g., "Dumbbells")
  - `category`: Filter by category name (e.g., "Strength")
- **Response (200)**:
  ```json
  {
    "success": true,
    "message": "Exercises fetched successfully",
    "data": {
      "count": 15,
      "exercises": [
        {
          "id": "uuid",
          "name": "Barbell Bench Press",
          "muscles": [{ "muscle": { "name": "Chest" }, "role": "PRIMARY" }],
          "equipment": [...]
        }
      ]
    }
  }
  ```

### GET `/metadata`
Get muscles/equipment/categories for filter labels.
- **Response (200)**:
  ```json
  { "muscles": [...], "equipment": [...], "categories": [...] }
  ```

---

## 📊 Analytics (`/api/analytics`)

### GET `/summary`
Dashboard cards (streaks, total volume).
- **Response (200)**:
  ```json
  { "streak": 5, "weeklyVolume": 12000, "goalProgress": 0.8 }
  ```

### GET `/muscles`
Radar chart data (volume per muscle group).
- **Response (200)**:
  ```json
  { "Chest": 2500, "Back": 3000, "Legs": 4500 }
  ```

### GET `/metrics`
Weight and body fat history.
- **Response (200)**:
  ```json
  [ { "date": "...", "weight": 75.5, "fatPercentage": 14 } ]
  ```

### POST `/metrics`
Log current weight/fat percentage.
- **Payload**: `{ "weight": 76, "fatPercentage": 14.1 }`

### GET `/recovery-summary` [NEW]
Returns readiness score, fatigued muscles, and intensity recommendation.
- **Response (200)**:
  ```json
  {
    "summary": {
      "readiness": 85,
      "fatiguedMuscles": ["Quads"],
      "recommendedIntensity": "HIGH"
    }
  }
  ```

### GET `/history` [NEW]
Returns completed exercise feed grouped by date.
- **Response (200)**:
  ```json
  {
    "history": [
      {
        "date": "Feb 7",
        "items": [
          {
            "exercise": "Bench Press",
            "time": "2:30 PM",
            "isPR": true,
            "prWeight": 85
          }
        ]
      }
    ]
  }
  ```

---

## 🔬 Enums Reference
Use these exact strings in requests:
- **Goals**: `STRENGTH`, `HYPERTROPHY`, `ENDURANCE`, `MAINTENANCE`, `WEIGHT_LOSS`
- **Level**: `BEGINNER`, `INTERMEDIATE`, `ADVANCED`
- **Feedback**: `NEUTRAL`, `LIKE`, `DISLIKE`, `AVOID`
- **Progression**: `LINEAR`, `DOUBLE_PROGRESSION`, `WAVE`
