/*
  Warnings:

  - The `preference` column on the `ExerciseFeedback` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `ExerciseMuscle` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `goal` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `trainingLevel` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `level` column on the `WorkoutPlan` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `WorkoutPlan` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `role` on the `ExerciseMuscle` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `goal` on the `WorkoutPlan` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "WorkoutGoal" AS ENUM ('STRENGTH', 'HYPERTROPHY', 'ENDURANCE', 'MAINTENANCE', 'WEIGHT_LOSS');

-- CreateEnum
CREATE TYPE "TrainingLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MuscleRole" AS ENUM ('PRIMARY', 'SECONDARY', 'STABILIZER');

-- CreateEnum
CREATE TYPE "Preference" AS ENUM ('LIKE', 'DISLIKE', 'AVOID');

-- AlterTable
ALTER TABLE "ExerciseFeedback" DROP COLUMN "preference",
ADD COLUMN     "preference" "Preference";

-- AlterTable
ALTER TABLE "ExerciseMuscle" DROP CONSTRAINT "ExerciseMuscle_pkey",
DROP COLUMN "role",
ADD COLUMN     "role" "MuscleRole" NOT NULL,
ADD CONSTRAINT "ExerciseMuscle_pkey" PRIMARY KEY ("exerciseId", "muscleId", "role");

-- AlterTable
ALTER TABLE "User" DROP COLUMN "goal",
ADD COLUMN     "goal" "WorkoutGoal",
DROP COLUMN "trainingLevel",
ADD COLUMN     "trainingLevel" "TrainingLevel";

-- AlterTable
ALTER TABLE "WorkoutPlan" DROP COLUMN "goal",
ADD COLUMN     "goal" "WorkoutGoal" NOT NULL,
DROP COLUMN "level",
ADD COLUMN     "level" "TrainingLevel",
DROP COLUMN "status",
ADD COLUMN     "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "BodyMetric_userId_date_idx" ON "BodyMetric"("userId", "date");

-- CreateIndex
CREATE INDEX "DailyRecoveryLog_userId_createdAt_idx" ON "DailyRecoveryLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Exercise_categoryId_splitId_idx" ON "Exercise"("categoryId", "splitId");

-- CreateIndex
CREATE INDEX "Exercise_name_idx" ON "Exercise"("name");

-- CreateIndex
CREATE INDEX "ExerciseFeedback_userId_preference_idx" ON "ExerciseFeedback"("userId", "preference");

-- CreateIndex
CREATE INDEX "ExerciseMuscle_muscleId_role_idx" ON "ExerciseMuscle"("muscleId", "role");

-- CreateIndex
CREATE INDEX "ExercisePerformanceLog_workoutExerciseId_createdAt_idx" ON "ExercisePerformanceLog"("workoutExerciseId", "createdAt");

-- CreateIndex
CREATE INDEX "MuscleRecoveryLog_userId_idx" ON "MuscleRecoveryLog"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "WorkoutExercise_sessionId_isCompleted_idx" ON "WorkoutExercise"("sessionId", "isCompleted");

-- CreateIndex
CREATE INDEX "WorkoutExercise_exerciseId_idx" ON "WorkoutExercise"("exerciseId");

-- CreateIndex
CREATE INDEX "WorkoutPlan_userId_status_idx" ON "WorkoutPlan"("userId", "status");

-- CreateIndex
CREATE INDEX "WorkoutSession_planId_isCompleted_weekNumber_dayNumber_idx" ON "WorkoutSession"("planId", "isCompleted", "weekNumber", "dayNumber");
