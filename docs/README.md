# Flex - Backend Documentation

Welcome to the technical documentation for the Flex backend. This documentation is designed to help new developers understand the system, run it locally, and contribute to its development.

## 📚 Documentation Index

- **[System Architecture](ARCHITECTURE.md)**  
  High-level overview of the tech stack, project structure, and key design decisions.

- **[API Reference](API_REFERENCE.md)**  
  Complete guide to all API endpoints, parameters, and responses.

- **[Authentication & Security](AUTH_FLOWS.md)**  
  Details on user registration, JWT-based authentication, and security protocols.

- **[Database Schema](DATABASE.md)**  
  Deep dive into the Data Models (Prisma), relationships, and migrations.

- **[Workout Generation Engine](WORKOUT_GENERATION.md)**  
  **Core Feature**: Comprehensive guide to the adaptive workout algorithm, including equipment filtering, progressive overload, and volume regulation.

- **[Security Audit](SECURITY_RISKS.md)**  
  Analysis of potential security risks and current mitigations.

- **[Maintenance & Contributing](MAINTENANCE.md)**  
  How to add new exercises, run tests, and deploy changes.

## 🚀 Quick Start

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Setup**
    Create a `.env` file with:
    ```env
    DATABASE_URL="postgresql://user:password@localhost:5432/flex_db"
    JWT_SECRET="your_secret_key"
    JWT_REFRESH_SECRET="your_refresh_secret"
    PORT=5000
    ```

3.  **Database Migration**
    ```bash
    npx prisma migrate dev --name init
    ```

4.  **Run Server**
    ```bash
    npm run dev
    ```

5.  **Run Tests**
    ```bash
    node scripts/test_adaptive_logic.js
    ```
