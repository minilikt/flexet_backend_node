# Database Seeding Guide - Flex

This guide explains how to populate your local database with the master exercise list found in `public/exercises.json`.

## 🛠 Prerequisites

- Node.js installed
- `pnpm` (or `npm`) installed
- A running PostgreSQL database (configured in your `.env`)
- Prisma client generated (`npx prisma generate`)

## 🚀 How to Seed

We have configured a custom seed script in `package.json` that reads from the centralized `exercises.json` file.

### Option 1: Using `pnpm` (Recommended)
Run the following command in your terminal:
```bash
pnpm run seed
```

### Option 2: Using `prisma`
If you prefer using the built-in Prisma seed command:
```bash
pnpm exec prisma db seed
```

### Option 3: Using `node`
You can also run the script directly:
```bash
node prisma/seedExercises.js
```

## 📝 What this script does
1. **Metadata Seeding**: It extracts and creates categories, splits, movement patterns, equipment, muscles, and tags from the JSON.
2. **Exercise Seeding**: It creates or updates each exercise with its classification, requirements, and programming details.
3. **Relation Mapping**: It maps many-to-many relationships for equipment and muscle roles (Primary, Secondary, Stabilizer).
4. **Alternative Linking**: It links exercises with their alternative versions.

## ⚠️ Troubleshooting
- **Duplicates**: The script uses `upsert` and unique identifiers (`externalId`), so it is safe to run multiple times without creating duplicates.
- **Connection Errors**: Ensure your `DATABASE_URL` in `.env` is correct and the database is accessible.
- **Missing Data**: If you add new exercises to `public/exercises.json`, simply run the seed command again to sync the database.
