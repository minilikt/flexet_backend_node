/*
  Warnings:

  - You are about to drop the `MetricEvent` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MetricEvent" DROP CONSTRAINT "MetricEvent_userId_fkey";

-- DropTable
DROP TABLE "MetricEvent";

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "workoutId" TEXT,
    "exerciseId" TEXT,
    "bodyPart" TEXT,
    "durationSeconds" INTEGER,
    "calories" INTEGER,
    "weight" DOUBLE PRECISION,
    "reps" INTEGER,
    "sets" INTEGER,
    "value" DOUBLE PRECISION,
    "unit" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityEvent_userId_type_createdAt_idx" ON "ActivityEvent"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_workoutId_idx" ON "ActivityEvent"("workoutId");

-- CreateIndex
CREATE INDEX "ActivityEvent_exerciseId_idx" ON "ActivityEvent"("exerciseId");

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
