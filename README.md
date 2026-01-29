# Flex - Adaptive Workout Intelligence

Flex is a modern, data-driven workout planning and tracking application. It leverages adaptive algorithms (v2.0) to prescribe progressive overload based on your historical performance, recovery metrics, and exercise preferences.

## 🚀 Key Features

- **Adaptive Workout Generator (v2.0)**: Automatically adjusts weight, reps, and sets using a Progressive Overload algorithm based on your RPE and past performance.
- **Progress Intelligence Dashboard**: Visualize your volume load trends (Weight × Reps) and muscle fatigue heatmaps using Chart.js.
- **Dynamic Equipment Filtering**: Generates plans based on your available equipment (e.g., Barbell, Dumbbells, Power Rack).
- **Comprehensive Logging**: Track sets, reps, weight, RPE, and PRs with a specialized "Adaptive Logger".
- **Recovery Sync**: Monitor systemic and local muscle fatigue to optimize training frequency and intensity.

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: Prisma ORM, PostgreSQL (Neon DB)
- **Authentication**: JWT (JSON Web Tokens) with Refresh Token support.
- **Frontend**: Vanilla HTML5/CSS3/JS, Chart.js for data visualization.
- **Security**: Helmet, CORS, and Cookie-parser integration.

## 🏁 Quick Start

### Prerequisites
- Node.js (v18+)
- PostgreSQL database

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd flex/back
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="your-postgresql-url"
   JWT_ACCESS_SECRET="your-access-secret"
   JWT_REFRESH_SECRET="your-refresh-secret"
   PORT=5000
   CLIENT_URL=http://localhost:3000
   ```

4. **Initialize Database**:
   ```bash
   npx prisma migrate dev
   ```

5. **Start the Development Server**:
   ```bash
   npm run dev
   ```

6. **Access the App**:
   Open `http://localhost:5000` in your browser.

## 📈 Adaptive Logic (How it works)

Flex doesn't just give you a static plan. It learns from your logs:
1. **Intensity Analysis**: If your average RPE for an exercise is < 7 across the last 3 sessions, the system increases the weight by +2.5kg.
2. **Fatigue Management**: If you report high muscle soreness (> 8), the generator avoids that muscle group in the next session to prevent overtraining.
3. **Preference Filter**: Exercises you "LIKE" are prioritized; exercises you "AVOID" are never shown.

## 📄 License

This project is licensed under the ISC License.
