-- AlterTable
ALTER TABLE "ExercisePerformanceLog" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "restSeconds" INTEGER,
ADD COLUMN     "volume" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "WorkoutSessionLog" ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "WorkoutExerciseSet" (
    "id" TEXT NOT NULL,
    "workoutExerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "targetRepsMin" INTEGER,
    "targetRepsMax" INTEGER,
    "targetWeight" DOUBLE PRECISION,
    "targetRPE" INTEGER,
    "restSeconds" INTEGER,

    CONSTRAINT "WorkoutExerciseSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutExerciseSet_workoutExerciseId_setNumber_key" ON "WorkoutExerciseSet"("workoutExerciseId", "setNumber");

-- CreateIndex
CREATE INDEX "ExercisePerformanceLog_workoutExerciseId_setNumber_idx" ON "ExercisePerformanceLog"("workoutExerciseId", "setNumber");

-- AddForeignKey
ALTER TABLE "WorkoutExerciseSet" ADD CONSTRAINT "WorkoutExerciseSet_workoutExerciseId_fkey" FOREIGN KEY ("workoutExerciseId") REFERENCES "WorkoutExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
