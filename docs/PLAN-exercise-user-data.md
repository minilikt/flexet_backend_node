# PLAN-exercise-user-data.md

> **Task**: Integrate Exercise Instructions/GIFs & User Profile Image
> **Status**: APPROVED

## 1. Context Analysis
The user wants to enhance the application's data model in two areas:
1.  **Exercises**: Enrich the exercise library with visual guides (`gifUrl`) and step-by-step text (`instructions`). The source data is in `public/exercises.json`.
2.  **Users**: Add a profile image field to the User model (URL string only).

The user has explicitly requested a database **RESET** to apply these changes cleanly and has mandated the use of **pnpm**.

## 2. Technical Strategy

### Phase 1: Schema Definition (`prisma/schema.prisma`)
- **Model `User`**:
  - Add `profileImage String?` (Optional URL string).
- **Model `Exercise`**:
  - Add `instructions String[]` (PostgreSQL array of strings).
  - Verify `gifUrl String?` exists (it does, just checking placement).

### Phase 2: Seed Script Refactor (`prisma/seedExercises.js`)
- The current seed script likely doesn't map the new JSON structure correctly.
- **Changes**:
  - Map `gifUrl` from the root of the JSON object (previously it might have been nested).
  - Map `instructions` from the root of the JSON object to the Prisma `instructions` field.
  - Ensure `externalId` is handled correctly to prevent duplications during upserts.

### Phase 3: Database Migration & Reset
- **Action**: Perform a full migration reset to apply schema changes and re-seed the database.
- **Command**: `npx prisma migrate reset` (interactive) or `npx prisma migrate dev --name add_exercise_details_and_user_image` (which will prompt for reset if conflicts exist). Given the explicit request, we will ensure a reset happens.

## 3. Implementation Steps

1.  **Modify `prisma/schema.prisma`**:
    - Add `profileImage` to `User`.
    - Add `instructions` to `Exercise`.
2.  **Modify `prisma/seedExercises.js`**:
    - Update the `create` and `update` payloads in the `upsert` call to include `gifUrl` and `instructions`.
3.  **Execute Migration**:
    - Run: `pnpm dlx prisma migrate dev --name add_exercise_props_user_image`
    - This will apply the SQL changes.
4.  **Execute Seed**:
    - Verify the seed runs automatically (Prisma usually runs seed after migration if configured in `package.json`).
    - If not, run `pnpm prisma db seed`.

## 4. Verification
- check `Prisma Studio` to see:
  - `User` table has `profileImage` column.
  - `Exercise` table has populated `instructions` and `gifUrl`.

## 5. Risk Assessment
- **Data Loss**: The user explicitly requested "migrate reset", so they are aware existing data (users, logs) will be wiped.
- **JSON Structure**: We must ensure `exercises.json` strictly follows the expected format (Root `gifUrl` and `instructions` array) to avoid seed failures.
